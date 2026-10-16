'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, shell, nativeImage, dialog, net, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

const Store = require('./src/store');
const seed = require('./src/seed');
const catalog = require('./src/catalog');
const scheduler = require('./src/scheduler');
const tmdb = require('./src/tmdb');

const APP_ID = 'com.seriestrack.desktop';
const ICON_CANDIDATES = [
  path.join(__dirname, 'assets', 'icon.ico'),
  path.join(__dirname, 'build', 'icon.ico')
];

/** Modo diagnóstico: arranca, captura la ventana y sale (npm run smoke). */
const SMOKE = process.argv.includes('--smoke') || process.env.ST_SMOKE === '1';

let mainWindow = null;
let tray = null;
let store = null;
let syncTimer = null;
let quitting = false;

/* ------------------------------------------------------------------ */
/*  Arranque                                                           */
/* ------------------------------------------------------------------ */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.setAppUserModelId(APP_ID);

/* ------------------------------------------------------------------ */
/*  Caché local de imágenes (carátulas, fondos y miniaturas)           */
/* ------------------------------------------------------------------ */

// Se sirven como stimg://<tamaño>/<archivo> en lugar de descargarlas de
// internet cada vez. La primera vez se guardan en disco y después se leen
// de la carpeta local.
protocol.registerSchemesAsPrivileged([
  { scheme: 'stimg', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

let imageCacheDir = null;

function imageCachePaths() {
  return {
    dir: imageCacheDir,
    sizes: imageCacheDir ? fs.readdirSync(imageCacheDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length : 0
  };
}

function imageCacheStats() {
  let files = 0;
  let bytes = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        files++;
        try {
          bytes += fs.statSync(full).size;
        } catch { /* ignorar */ }
      }
    }
  };
  if (imageCacheDir) walk(imageCacheDir);
  return { dir: imageCacheDir, files, bytes, mb: Math.round((bytes / 1048576) * 10) / 10 };
}

function registerImageProtocol() {
  imageCacheDir = path.join(app.getPath('userData'), 'imagenes');
  fs.mkdirSync(imageCacheDir, { recursive: true });

  protocol.handle('stimg', async (request) => {
    let size;
    let file;
    try {
      const url = new URL(request.url);
      size = url.hostname;
      file = decodeURIComponent(url.pathname.replace(/^\//, ''));
    } catch {
      return new Response('Petición no válida', { status: 400 });
    }

    if (!SAFE_NAME.test(size) || !SAFE_NAME.test(file)) {
      return new Response('Nombre no permitido', { status: 400 });
    }

    const folder = path.join(imageCacheDir, size);
    const target = path.join(folder, file);

    // 1. Ya está en la carpeta local
    try {
      const data = fs.readFileSync(target);
      return new Response(new Uint8Array(data), {
        headers: { 'content-type': mimeFor(file), 'cache-control': 'max-age=31536000' }
      });
    } catch { /* hay que descargarla */ }

    // 2. Descargar y guardar
    try {
      const remote = `${TMDB_IMAGE_BASE}${size}/${file}`;
      const res = await net.fetch(remote);
      if (!res.ok) return new Response('Imagen no disponible', { status: 404 });

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(target, buffer);

      return new Response(new Uint8Array(buffer), {
        headers: {
          'content-type': res.headers.get('content-type') || mimeFor(file),
          'cache-control': 'max-age=31536000'
        }
      });
    } catch (err) {
      console.warn(`[seriestrack] No se pudo cachear ${size}/${file}: ${err.message}`);
      return new Response('Error de descarga', { status: 502 });
    }
  });
}

function mimeFor(file) {
  if (/\.png$/i.test(file)) return 'image/png';
  if (/\.webp$/i.test(file)) return 'image/webp';
  if (/\.svg$/i.test(file)) return 'image/svg+xml';
  return 'image/jpeg';
}


function appIcon() {
  for (const candidate of ICON_CANDIDATES) {
    if (fs.existsSync(candidate)) return nativeImage.createFromPath(candidate);
  }
  return nativeImage.createEmpty();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    backgroundColor: '#0f0f0f',
    icon: appIcon(),
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f0f0f',
      symbolColor: '#e8e8e8',
      height: 44
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (SMOKE || !store.data.settings.startMinimized) mainWindow.show();
  });

  if (SMOKE) {
    mainWindow.webContents.once('did-finish-load', async () => {
      const smokeDir =
        process.env.ST_SMOKE_DIR ||
        (app.isPackaged ? path.join(app.getPath('userData'), 'smoke') : path.join(__dirname, 'build'));
      fs.mkdirSync(smokeDir, { recursive: true });

      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const shot = async (name) => {
        const image = await mainWindow.webContents.capturePage();
        fs.writeFileSync(path.join(smokeDir, `smoke-${name}.png`), image.toPNG());
      };
      const run = (js) => mainWindow.webContents.executeJavaScript(js).catch(() => {});

      await wait(3200);

      // Paso opcional: vincular el catálogo con TMDB antes de capturar
      if (process.env.ST_SMOKE_LINK === '1') {
        try {
          const res = await mainWindow.webContents.executeJavaScript('window.api.series.linkCatalog()');
          console.log(`[seriestrack] Diagnóstico: vinculadas ${res.linked.length}/${res.total} series con TMDB`);
          if (res.failed.length) {
            console.log(`[seriestrack] Diagnóstico: sin coincidencia -> ${res.failed.map((f) => f.title).join(', ')}`);
          }
        } catch (err) {
          console.error('[seriestrack] Diagnóstico: fallo al vincular', err);
        }
        await wait(2500);
      }

      await shot('inicio');

      await run(`document.querySelector('.card')?.click(); true`);
      await wait(1600);
      await shot('detalle');

      await run(`document.querySelector('[data-action="detail-tab"][data-tab="info"]')?.click(); true`);
      await wait(900);
      await shot('detalle-info');

      await run(`document.querySelector('[data-view="settings"]')?.click(); true`);
      await wait(1600);
      await shot('configuracion');

      await run(`document.querySelector('.view').scrollTop = 99999; true`);
      await wait(800);
      await shot('configuracion-cache');

      await run(`document.getElementById('bellBtn')?.click(); true`);
      await wait(1300);
      await shot('notificaciones');

      await run(`document.getElementById('drawerClose')?.click(); document.querySelector('[data-view="explore"]')?.click(); true`);
      await wait(1300);
      await shot('explorar');

      console.log(`[seriestrack] Diagnóstico: capturas guardadas en ${smokeDir}`);
      quitting = true;
      app.quit();
    });
  }

  mainWindow.on('close', (event) => {
    if (!quitting && store.data.settings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Enlaces externos -> navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray() {
  try {
    tray = new Tray(appIcon());
  } catch {
    return;
  }
  const menu = Menu.buildFromTemplate([
    { label: 'Abrir SeriesTrack', click: () => showWindow() },
    { label: 'Buscar nuevos episodios ahora', click: () => runSync({ manual: true }) },
    { type: 'separator' },
    {
      label: 'Notificaciones',
      type: 'checkbox',
      checked: store.data.settings.notificationsEnabled,
      click: (item) => {
        store.data.settings.notificationsEnabled = item.checked;
        store.save();
        broadcast('settings:changed');
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]);
  tray.setToolTip('SeriesTrack');
  tray.setContextMenu(menu);
  tray.on('double-click', () => showWindow());
}

function showWindow() {
  if (!mainWindow) createWindow();
  mainWindow.show();
  mainWindow.focus();
}

/* ------------------------------------------------------------------ */
/*  Notificaciones y sincronización                                    */
/* ------------------------------------------------------------------ */

function desktopNotify({ title, body, seriesId, episodeId }) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title,
    body,
    icon: appIcon(),
    silent: false,
    timeoutType: 'default'
  });
  n.on('click', () => {
    showWindow();
    if (seriesId) broadcast('navigate', { view: 'series', seriesId });
  });
  n.show();
}

function broadcast(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function scheduleSync() {
  if (syncTimer) clearInterval(syncTimer);
  const minutes = Math.max(5, Number(store.data.settings.syncIntervalMinutes) || 60);
  syncTimer = setInterval(() => runSync({ manual: false }), minutes * 60 * 1000);
}

async function runSync({ manual = false } = {}) {
  try {
    const summary = await scheduler.sync(store.data, {
      notify: desktopNotify,
      log: (m) => console.log(`[seriestrack] ${m}`)
    });
    store.save();
    broadcast('data:changed', { reason: 'sync', summary });
    if (manual) {
      broadcast('toast', {
        kind: 'info',
        message: summary.newEpisodes
          ? `Sincronización completa: ${summary.newEpisodes} episodio(s) nuevo(s).`
          : 'Sincronización completa: no hay episodios nuevos.'
      });
    }
    return summary;
  } catch (err) {
    console.error('[seriestrack] Error en sincronización:', err);
    if (manual) broadcast('toast', { kind: 'error', message: `Error al sincronizar: ${err.message}` });
    return { error: err.message };
  }
}

/* ------------------------------------------------------------------ */
/*  IPC                                                                */
/* ------------------------------------------------------------------ */

function bootstrap() {
  const data = store.data;
  return {
    settings: data.settings,
    platforms: [...data.platforms].sort((a, b) => a.priority - b.priority),
    lists: data.lists,
    stats: catalog.stats(data),
    unread: catalog.unreadCount(data),
    images: imageCacheStats(),
    version: app.getVersion(),
    userData: app.getPath('userData')
  };
}

function registerIpc() {
  const handle = (channel, fn) => ipcMain.handle(channel, fn);

  handle('app:bootstrap', () => bootstrap());

  handle('series:list', (_e, opts) => catalog.listSeries(store.data, opts || {}));
  handle('series:detail', (_e, seriesId) => catalog.seriesDetail(store.data, seriesId));

  handle('series:search', async (_e, query) => {
    const local = catalog.localSearch(store.data, query);
    const apiKey = store.data.settings.tmdbApiKey;
    if (!apiKey) {
      return { local, tmdb: [], mode: 'local', hint: 'Añade una clave de TMDB en Configuración para buscar en todo el catálogo real.' };
    }
    try {
      const remote = await tmdb.searchTv(apiKey, query, store.data.settings.language);
      const owned = new Set(store.data.series.map((s) => s.tmdbId).filter(Boolean));
      return {
        local,
        tmdb: remote.map((r) => ({ ...r, owned: owned.has(r.tmdbId) })),
        mode: 'tmdb'
      };
    } catch (err) {
      return { local, tmdb: [], mode: 'error', hint: err.message };
    }
  });

  handle('series:addTmdb', async (_e, tmdbId) => {
    const apiKey = store.data.settings.tmdbApiKey;
    if (!apiKey) throw new Error('Necesitas una clave de TMDB para añadir series reales.');
    const existing = store.data.series.find((s) => s.tmdbId === tmdbId);
    if (existing) {
      existing.followed = true;
      store.save();
      broadcast('data:changed', { reason: 'follow' });
      return catalog.decorate(store.data, existing);
    }
    const built = await tmdb.buildSeriesFromTmdb(apiKey, tmdbId, {
      language: store.data.settings.language,
      region: store.data.settings.region
    });
    store.data.series.push(built.series);
    store.data.seasons.push(...built.seasons);
    store.data.episodes.push(...built.episodes);
    store.save();
    broadcast('data:changed', { reason: 'add' });
    return catalog.decorate(store.data, built.series);
  });

  handle('series:addManual', (_e, input) => {
    const title = String(input.title || '').trim();
    if (!title) throw new Error('El título es obligatorio.');
    let id = catalog.slugify(title);
    while (store.data.series.some((s) => s.id === id)) id += '-2';

    const series = {
      id,
      tmdbId: null,
      title,
      originalTitle: title,
      synopsis: input.synopsis || 'Sin sinopsis.',
      poster: input.poster || null,
      backdrop: null,
      year: input.year ? Number(input.year) : null,
      genres: [],
      rating: null,
      status: 'Manual',
      platformIds: Array.isArray(input.platformIds) ? input.platformIds : [],
      followed: true,
      manual: true,
      demo: false,
      addedAt: new Date().toISOString()
    };
    store.data.series.push(series);

    const seasonCount = Math.max(1, Math.min(30, Number(input.seasons) || 1));
    const epCount = Math.max(1, Math.min(60, Number(input.episodesPerSeason) || 8));
    for (let s = 1; s <= seasonCount; s++) {
      store.data.seasons.push({ id: `${id}-s${s}`, seriesId: id, number: s, episodeCount: epCount });
      for (let e = 1; e <= epCount; e++) {
        store.data.episodes.push({
          id: `${id}-s${s}e${e}`,
          seriesId: id,
          season: s,
          number: e,
          title: `Episodio ${e}`,
          airDate: null,
          runtime: 0,
          overview: ''
        });
      }
    }
    store.save();
    broadcast('data:changed', { reason: 'add' });
    return catalog.decorate(store.data, series);
  });

  handle('series:linkTmdb', async (_e, seriesId) => {
    const data = store.data;
    const series = data.series.find((s) => s.id === seriesId);
    if (!series) throw new Error('Serie no encontrada.');

    const apiKey = data.settings.tmdbApiKey;
    if (!apiKey) throw new Error('Configura primero tu clave de TMDB en Configuración.');

    let tmdbId = series.tmdbId;
    if (!tmdbId) {
      const match = await tmdb.findBestMatch(
        apiKey,
        { title: series.title, year: series.year },
        data.settings.language
      );
      if (!match) throw new Error(`No se encontró «${series.title}» en TMDB.`);
      tmdbId = match.tmdbId;
    }

    const built = await tmdb.buildSeriesFromTmdb(apiKey, tmdbId, {
      language: data.settings.language,
      region: data.settings.region
    });

    catalog.applyTmdbMetadata(series, built.series);
    const result = catalog.replaceSeriesContent(data, series, built);
    store.save();
    broadcast('data:changed', { reason: 'link' });
    return { series: catalog.decorate(data, series), ...result };
  });

  handle('series:linkCatalog', async () => {
    const data = store.data;
    const apiKey = data.settings.tmdbApiKey;
    if (!apiKey) throw new Error('Configura primero tu clave de TMDB en Configuración.');

    const targets = data.series.filter((s) => !s.tmdbId);
    const linked = [];
    const failed = [];

    for (const series of targets) {
      try {
        const match = await tmdb.findBestMatch(
          apiKey,
          { title: series.title, year: series.year },
          data.settings.language
        );
        if (!match) {
          failed.push({ title: series.title, reason: 'sin coincidencia en TMDB' });
          continue;
        }
        const built = await tmdb.buildSeriesFromTmdb(apiKey, match.tmdbId, {
          language: data.settings.language,
          region: data.settings.region
        });
        catalog.applyTmdbMetadata(series, built.series);
        const result = catalog.replaceSeriesContent(data, series, built);
        linked.push({ id: series.id, title: series.title, episodes: result.newCount, restored: result.restored });
        store.save();
      } catch (err) {
        failed.push({ title: series.title, reason: err.message });
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    // Si ya no queda nada de demostración, retiramos el aviso
    if (!data.series.some((s) => s.demo)) data.settings.showDemoBanner = false;
    store.save();
    broadcast('data:changed', { reason: 'link-all' });
    return { linked, failed, total: targets.length };
  });

  handle('series:follow', (_e, seriesId, followed) => {
    const series = store.data.series.find((s) => s.id === seriesId);
    if (!series) return null;
    series.followed = !!followed;
    store.save();
    broadcast('data:changed', { reason: 'follow' });
    return catalog.decorate(store.data, series);
  });

  handle('series:setPlatforms', (_e, seriesId, platformIds) => {
    const series = store.data.series.find((s) => s.id === seriesId);
    if (!series) return null;
    series.platformIds = Array.isArray(platformIds) ? platformIds : [];
    store.save();
    broadcast('data:changed', { reason: 'platforms' });
    return catalog.decorate(store.data, series);
  });

  handle('series:delete', (_e, seriesId) => {
    const data = store.data;
    data.series = data.series.filter((s) => s.id !== seriesId);
    data.seasons = data.seasons.filter((s) => s.seriesId !== seriesId);
    const removed = data.episodes.filter((e) => e.seriesId === seriesId).map((e) => e.id);
    data.episodes = data.episodes.filter((e) => e.seriesId !== seriesId);
    for (const id of removed) delete data.progress[id];
    data.notifications = data.notifications.filter((n) => n.seriesId !== seriesId);
    for (const list of data.lists) list.seriesIds = list.seriesIds.filter((id) => id !== seriesId);
    store.save();
    broadcast('data:changed', { reason: 'delete' });
    return true;
  });

  handle('episode:toggle', (_e, episodeId, watched) => {
    const ep = catalog.setEpisodeWatched(store.data, episodeId, watched);
    if (!ep) return null;
    store.save();
    broadcast('data:changed', { reason: 'progress' });
    return { episodeId, watched, seriesId: ep.seriesId };
  });

  handle('season:mark', (_e, seriesId, season, watched) => {
    const n = catalog.setSeasonWatched(store.data, seriesId, season, watched);
    store.save();
    broadcast('data:changed', { reason: 'progress' });
    return { changed: n };
  });

  handle('series:markAll', (_e, seriesId, watched) => {
    const n = catalog.setSeriesWatched(store.data, seriesId, watched);
    store.save();
    broadcast('data:changed', { reason: 'progress' });
    return { changed: n };
  });

  handle('list:create', (_e, name) => {
    const list = catalog.createList(store.data, String(name || 'Nueva lista').trim(), 'custom');
    store.save();
    broadcast('data:changed', { reason: 'list' });
    return list;
  });

  handle('list:rename', (_e, listId, name) => {
    const list = catalog.renameList(store.data, listId, String(name || '').trim());
    store.save();
    broadcast('data:changed', { reason: 'list' });
    return list;
  });

  handle('list:delete', (_e, listId) => {
    const ok = catalog.deleteList(store.data, listId);
    store.save();
    broadcast('data:changed', { reason: 'list' });
    return ok;
  });

  handle('list:toggle', (_e, listId, seriesId) => {
    const list = catalog.toggleListMembership(store.data, listId, seriesId);
    store.save();
    broadcast('data:changed', { reason: 'list' });
    return list;
  });

  handle('platform:save', (_e, input) => {
    const platform = catalog.savePlatform(store.data, input || {});
    store.save();
    broadcast('data:changed', { reason: 'platform' });
    return platform;
  });

  handle('platform:delete', (_e, platformId) => {
    const ok = catalog.deletePlatform(store.data, platformId);
    store.save();
    broadcast('data:changed', { reason: 'platform' });
    return ok;
  });

  handle('platform:toggle', (_e, platformId, active) => {
    const platform = store.data.platforms.find((p) => p.id === platformId);
    if (!platform) return null;
    platform.active = !!active;
    store.save();
    broadcast('data:changed', { reason: 'platform' });
    return platform;
  });

  handle('platform:reorder', (_e, orderedIds) => {
    const platforms = catalog.reorderPlatforms(store.data, orderedIds || []);
    store.save();
    broadcast('data:changed', { reason: 'platform' });
    return platforms;
  });

  handle('settings:save', (_e, patch) => {
    Object.assign(store.data.settings, patch || {});
    store.save();
    scheduleSync();
    broadcast('data:changed', { reason: 'settings' });
    return store.data.settings;
  });

  handle('sync:now', () => runSync({ manual: true }));

  handle('app:upcoming', (_e, days) => scheduler.upcoming(store.data, days || 30));

  handle('notifications:list', () => ({
    items: store.data.notifications,
    unread: catalog.unreadCount(store.data)
  }));

  handle('notifications:read', (_e, ids) => {
    const list = store.data.notifications;
    if (Array.isArray(ids) && ids.length) {
      for (const n of list) if (ids.includes(n.id)) n.read = true;
    } else {
      for (const n of list) n.read = true;
    }
    store.save();
    broadcast('data:changed', { reason: 'notifications' });
    return catalog.unreadCount(store.data);
  });

  handle('notifications:remove', (_e, id) => {
    store.data.notifications = store.data.notifications.filter((n) => n.id !== id);
    store.save();
    broadcast('data:changed', { reason: 'notifications' });
    return true;
  });

  handle('notifications:clear', () => {
    store.data.notifications = [];
    store.save();
    broadcast('data:changed', { reason: 'notifications' });
    return true;
  });

  handle('shell:open', async (_e, url) => {
    if (!url) return false;
    const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    await shell.openExternal(safe);
    return true;
  });

  handle('app:reset', async () => {
    const res = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancelar', 'Borrar y reiniciar'],
      defaultId: 0,
      cancelId: 0,
      title: 'Reiniciar datos',
      message: 'Se borrarán tus series, progreso, listas y notificaciones.',
      detail: 'Esta acción no se puede deshacer.'
    });
    if (res.response !== 1) return false;
    store.reset(seed.defaults);
    store.save();
    broadcast('data:changed', { reason: 'reset' });
    return true;
  });

  handle('app:openDataFolder', () => shell.openPath(app.getPath('userData')));

  handle('images:info', () => imageCacheStats());

  handle('images:open', async () => {
    fs.mkdirSync(imageCacheDir, { recursive: true });
    await shell.openPath(imageCacheDir);
    return true;
  });

  handle('images:clear', () => {
    let removed = 0;
    for (const entry of fs.readdirSync(imageCacheDir, { withFileTypes: true })) {
      const full = path.join(imageCacheDir, entry.name);
      if (entry.isDirectory()) {
        removed += fs.readdirSync(full).length;
        fs.rmSync(full, { recursive: true, force: true });
      }
    }
    return { removed, ...imageCacheStats() };
  });
}

/* ------------------------------------------------------------------ */
/*  Ciclo de vida                                                      */
/* ------------------------------------------------------------------ */

app.whenReady().then(() => {
  store = new Store(app.getPath('userData'));
  store.load(seed.defaults);

  registerImageProtocol();
  registerIpc();
  createWindow();
  createTray();
  scheduleSync();

  // Primera sincronización tras arrancar
  setTimeout(() => runSync({ manual: false }), 4000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !store?.data?.settings?.minimizeToTray) app.quit();
});

app.on('before-quit', () => {
  quitting = true;
});
