'use strict';

/* ==========================================================================
   SeriesTrack — interfaz (renderer)
   ========================================================================== */

(() => {

const api = window.api;

const state = {
  boot: null,
  view: 'home',
  seriesId: null,
  listId: null,
  query: '',
  filters: { platformId: '', status: '', sort: 'recent' },
  search: null,
  detailTab: 'episodes',
  openSeasons: {},
  upcoming: [],
  searchTimer: null
};

/* ------------------------------ Utilidades ------------------------------ */

const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const truncate = (text, max) => {
  const t = String(text || '');
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

const POSTER_GRADIENTS = [
  ['#4a2c5a', '#171226'], ['#1f3b57', '#0e1a26'], ['#5a2b2b', '#221010'],
  ['#2b5a3f', '#0f2118'], ['#5a4a1f', '#211c0e'], ['#2f2f5a', '#12122a'],
  ['#5a2b47', '#220f1b'], ['#2b4f5a', '#0f1d22']
];

function hashCode(text) {
  let h = 0;
  for (let i = 0; i < String(text).length; i++) h = (h * 31 + String(text).charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* Iconos SVG (trazo, heredan el color del texto) */
const ICONS = {
  home: '<path d="M3 10.6 12 3.2l9 7.4"/><path d="M5.6 9.4V20.8h12.8V9.4"/>',
  tv: '<rect x="2.5" y="7.5" width="19" height="12.5" rx="2.2"/><path d="m8.2 3.2 3.8 4 3.8-4"/>',
  library: '<rect x="3.2" y="4.2" width="4.4" height="15.6" rx="1.2"/><rect x="9.6" y="4.2" width="4.4" height="15.6" rx="1.2"/><path d="m16.6 5.6 4.2 14.2"/>',
  star: '<path d="m12 3.4 2.6 5.4 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.9z"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>',
  folder: '<path d="M3.2 7.2a2 2 0 0 1 2-2h3.9l2 2h7.7a2 2 0 0 1 2 2v7.6a2 2 0 0 1-2 2H5.2a2 2 0 0 1-2-2z"/>',
  plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  search: '<circle cx="11" cy="11" r="7.2"/><path d="m20.4 20.4-3.9-3.9"/>',
  bell: '<path d="M18.2 16.4v-5.2a6.2 6.2 0 1 0-12.4 0v5.2l-1.9 2.9h16.2z"/><path d="M10 21.6h4"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.8M12 18.6v2.8M4.4 4.4l2 2M17.6 17.6l2 2M2.6 12h2.8M18.6 12h2.8M4.4 19.6l2-2M17.6 6.4l2-2"/>',
  play: '<path d="M8 5.4v13.2L19 12z"/>',
  check: '<path d="m5 12.8 4.6 4.6L19 7.6"/>',
  edit: '<path d="M4 20h4.2L20 8.2 15.8 4 4 15.8z"/>',
  trash: '<path d="M4.6 7.4h14.8M9.6 7.4V5.2h4.8v2.2M6.8 7.4l1 12.4h8.4l1-12.4"/>',
  up: '<path d="M12 19V5.6M6.4 11.2 12 5.6l5.6 5.6"/>',
  down: '<path d="M12 5v13.4M6.4 12.8 12 18.4l5.6-5.6"/>',
  sync: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4.2V10h-5.6"/>'
};

function icon(name, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function initials(title) {
  const words = String(title || '?').split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return String(title || '?').slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/**
 * Convierte una URL de imagen de TMDB en una servida desde la carpeta local
 * (protocolo stimg://). La primera visita la descarga y la guarda; después
 * se lee siempre del disco.
 */
function img(url) {
  if (!url) return '';
  const match = /^https?:\/\/image\.tmdb\.org\/t\/p\/([^/]+)\/(.+)$/.exec(url);
  return match ? `stimg://${match[1]}/${match[2]}` : url;
}

function posterInner(series) {
  const [a, b] = POSTER_GRADIENTS[hashCode(series.title) % POSTER_GRADIENTS.length];
  const fallback = `<div class="poster__fallback" style="background:linear-gradient(150deg, ${a}, ${b})">
      <div class="pf-center"><div class="pf-initials">${esc(initials(series.title))}</div></div>
      <div class="pf-title">${esc(series.title)}</div>
    </div>`;

  if (!series.poster) return fallback;

  // El respaldo se dibuja detrás: si la imagen no carga, se sigue viendo bien
  return `${fallback}<img class="poster__img" src="${esc(img(series.poster))}" alt="${esc(series.title)}"
            loading="lazy" onerror="this.remove()" />`;
}

function miniPoster(title) {
  const [a, b] = POSTER_GRADIENTS[hashCode(title || '?') % POSTER_GRADIENTS.length];
  return `<div class="poster__fallback" style="background:linear-gradient(150deg, ${a}, ${b});padding:4px">
      <div class="pf-center"><div class="pf-initials" style="font-size:14px">${esc(initials(title || '?'))}</div></div>
    </div>`;
}

function platformChip(platform) {
  if (!platform) return '';
  return `<div class="poster__platform" style="background:${esc(platform.color)}CC" title="${esc(platform.name)}">${esc(platform.short || platform.name)}</div>`;
}

function formatDate(iso) {
  if (!iso) return 'Fecha por confirmar';
  const date = new Date(`${iso}T00:00:00Z`);
  const today = new Date();
  const d0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const diff = Math.round((date.getTime() - d0) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff > 1 && diff <= 14) return `En ${diff} días`;
  if (diff < -1 && diff >= -14) return `Hace ${Math.abs(diff)} días`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function timeAgo(iso) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'ahora mismo';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return new Date(iso).toLocaleDateString('es-ES');
}

function toast(message, kind = 'info') {
  const host = document.getElementById('toasts');
  const node = document.createElement('div');
  node.className = `toast${kind === 'error' ? ' toast--error' : kind === 'ok' ? ' toast--ok' : ''}`;
  node.textContent = message;
  host.appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity .25s';
    setTimeout(() => node.remove(), 260);
  }, 4200);
}

/* -------------------------------- Sidebar ------------------------------- */

function renderNav() {
  const { boot } = state;
  const s = boot.stats;
  const custom = boot.lists.filter((l) => l.kind === 'custom');

  const item = (id, iconName, label, count, alert) => `
    <button class="nav__item${state.view === id ? ' active' : ''}" data-action="nav" data-view="${id}">
      <span class="nav__icon">${icon(iconName)}</span>
      <span class="nav__label">${esc(label)}</span>
      ${count ? `<span class="nav__count${alert ? ' nav__count--alert' : ''}">${count}</span>` : ''}
    </button>`;

  const listItem = (list) => `
    <button class="nav__item${state.view === 'list' && state.listId === list.id ? ' active' : ''}"
            data-action="nav-list" data-list="${list.id}">
      <span class="nav__icon">${icon(list.kind === 'favorite' ? 'star' : list.kind === 'pending' ? 'clock' : 'folder')}</span>
      <span class="nav__label">${esc(list.name)}</span>
      <span class="nav__count">${list.seriesIds.length}</span>
    </button>`;

  document.getElementById('nav').innerHTML = `
    <div class="nav__section">Biblioteca</div>
    ${item('home', 'home', 'Inicio')}
    ${item('followed', 'tv', 'Mis seguidas', s.followed)}
    ${item('library', 'library', 'Toda la biblioteca', s.totalSeries)}
    <div class="nav__section">Mis listas</div>
    ${boot.lists.filter((l) => l.kind !== 'custom').map(listItem).join('')}
    ${custom.map(listItem).join('')}
    <button class="nav__item" data-action="new-list">
      <span class="nav__icon">${icon('plus')}</span><span class="nav__label">Nueva lista</span>
    </button>
    <div class="nav__section">Sistema</div>
    ${item('explore', 'search', 'Explorar')}
    ${item('notifications', 'bell', 'Notificaciones', s.unread, s.unread > 0)}
    ${item('settings', 'gear', 'Configuración')}
  `;

  const badge = document.getElementById('bellBadge');
  badge.hidden = !s.unread;
  badge.textContent = s.unread;

  const last = boot.settings.lastSync;
  document.getElementById('syncMini').textContent = last
    ? `Última sync: ${timeAgo(last)}`
    : 'Sin sincronizar todavía';
}

/* --------------------------------- Vistas ------------------------------- */

function pageHead(title, subtitle, actions = '') {
  return `<div class="page-head">
      <div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
      ${actions ? `<div class="page-head__actions">${actions}</div>` : ''}
    </div>`;
}

function cardMarkup(series) {
  const p = series.progress;
  const stateClass = p.newCount ? 'state--new' : p.state === 'al-dia' ? 'state--ok' : '';
  const label = p.newCount ? `${p.newCount} nuevo${p.newCount > 1 ? 's' : ''}` : p.stateLabel;
  return `<article class="card" data-action="open-series" data-id="${esc(series.id)}">
    <div class="poster">
      ${posterInner(series)}
      ${platformChip(series.platforms[0])}
      ${p.newCount ? '<div class="poster__flag">NUEVO</div>' : ''}
      <div class="poster__overlay"><div>${esc(truncate(series.synopsis, 170))}</div></div>
      <div class="poster__progress"><i style="width:${p.percent}%"></i></div>
    </div>
    <div class="card__meta">
      <div class="card__title" title="${esc(series.title)}">${esc(series.title)}</div>
      <div class="card__sub">
        <span class="${stateClass}">${esc(label)}</span>
        <span class="dot-sep">•</span>
        <span>${p.watched}/${p.total}</span>
      </div>
    </div>
  </article>`;
}

function railMarkup(title, series, subtitle = '') {
  if (!series.length) return '';
  return `<section class="section">
    <div class="section__head">
      <h2>${esc(title)}</h2>
      ${subtitle ? `<span class="section__sub">${esc(subtitle)}</span>` : ''}
    </div>
    <div class="rail">${series.map(cardMarkup).join('')}</div>
  </section>`;
}

async function viewHome() {
  const followed = await api.series.list({ onlyFollowed: true });
  const upcoming = await api.sync.upcoming(30);
  state.upcoming = upcoming;

  const withNew = followed.filter((s) => s.progress.newCount > 0);
  const hero = withNew[0] || followed[0] || null;

  const continueWatching = followed
    .filter((s) => s.progress.state === 'en-curso')
    .sort((a, b) => (b.progress.nextEpisode?.airDate || '').localeCompare(a.progress.nextEpisode?.airDate || ''));

  const banner = state.boot.settings.showDemoBanner
    ? `<div class="banner">
         <span>🎬</span>
         <div>Estás viendo el <strong>catálogo de demostración</strong>. Conecta tu clave de TMDB para seguir series reales con fechas de estreno actualizadas.</div>
         <div class="banner__actions">
           <button class="btn btn--primary btn--sm" data-action="nav" data-view="settings">Configurar</button>
           <button class="btn btn--ghost btn--sm" data-action="dismiss-banner">Ocultar</button>
         </div>
       </div>`
    : '';

  const heroHtml = hero
    ? `<div class="hero">
        <div class="hero__bg">
          <div class="hero__fallback" style="background:radial-gradient(85% 130% at 12% 0%, ${esc(hero.platforms[0]?.color || '#e5a00d')}55, transparent 58%), linear-gradient(120deg, #1e1e1e, #0d0d0d 72%)"></div>
          ${hero.backdrop ? `<img src="${esc(img(hero.backdrop))}" alt="" onerror="this.remove()">` : ''}
        </div>
        <div class="hero__content">
          <div class="hero__poster">${posterInner(hero)}</div>
          <div class="hero__info">
            <div class="hero__tags">
              ${hero.progress.newCount ? `<span class="chip chip--new">● NUEVO</span>` : ''}
              ${hero.platforms.map((p) => `<span class="chip chip--accent">${esc(p.name)}</span>`).join('')}
              ${hero.year ? `<span class="chip">${hero.year}</span>` : ''}
              ${hero.rating ? `<span class="chip">★ ${hero.rating}</span>` : ''}
            </div>
            <h1>${esc(hero.title)}</h1>
            <p class="hero__synopsis">${esc(truncate(hero.synopsis, 260))}</p>
            <div class="hero__actions">
              <button class="btn btn--primary" data-action="open-series" data-id="${esc(hero.id)}">Ver episodios</button>
              <button class="btn" data-action="open-provider" data-id="${esc(hero.id)}">Abrir en ${esc(hero.platforms[0]?.name || 'plataforma')}</button>
            </div>
          </div>
        </div>
      </div>`
    : '';

  const upcomingHtml = upcoming.length
    ? `<section class="section">
        <div class="section__head"><h2>Próximos estrenos</h2><span class="section__sub">siguientes 30 días</span></div>
        <div class="panel" style="padding:8px 16px">
          ${upcoming.slice(0, 8).map((u) => `
            <div class="row">
              <div class="row__main">
                <div class="row__title">${esc(u.seriesTitle)} · T${u.season}E${u.number}</div>
                <div class="row__desc">${esc(u.title || '')} ${u.platformName ? `· ${esc(u.platformName)}` : ''}</div>
              </div>
              <span class="chip ${u.daysUntil <= 1 ? 'chip--accent' : ''}">${esc(formatDate(u.airDate))}</span>
              <button class="btn btn--ghost btn--sm" data-action="open-series" data-id="${esc(u.seriesId)}">Abrir</button>
            </div>`).join('')}
        </div>
      </section>`
    : '';

  const lists = state.boot.lists;
  const fav = lists.find((l) => l.kind === 'favorite');
  const favSeries = fav ? followed.filter((s) => fav.seriesIds.includes(s.id)) : [];

  document.getElementById('view').innerHTML = `<div class="view__inner">
    ${banner}
    ${heroHtml}
    ${railMarkup('Nuevos esta semana', withNew, `${withNew.length} serie(s) con episodios recientes`)}
    ${railMarkup('Continuar viendo', continueWatching)}
    ${railMarkup('Tus favoritas', favSeries)}
    ${upcomingHtml}
    ${!followed.length ? `<div class="empty">
        <div class="empty__icon">📺</div>
        <h3>Aún no sigues ninguna serie</h3>
        <p>Busca una serie en «Explorar» y pulsa «Seguir». SeriesTrack te avisará en cuanto se estrene un episodio nuevo.</p>
        <button class="btn btn--primary" data-action="nav" data-view="explore">Explorar catálogo</button>
      </div>` : ''}
  </div>`;
}

function filtersMarkup(extra = '') {
  const platforms = state.boot.platforms.filter((p) => p.active);
  const f = state.filters;
  return `<div class="filters">
    <select class="select" data-filter="platformId">
      <option value="">Todas las plataformas</option>
      ${platforms.map((p) => `<option value="${esc(p.id)}"${f.platformId === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
    </select>
    <select class="select" data-filter="status">
      <option value="">Cualquier estado</option>
      <option value="en-curso"${f.status === 'en-curso' ? ' selected' : ''}>En curso</option>
      <option value="al-dia"${f.status === 'al-dia' ? ' selected' : ''}>Al día</option>
      <option value="pendiente"${f.status === 'pendiente' ? ' selected' : ''}>Sin empezar</option>
    </select>
    <select class="select" data-filter="sort">
      <option value="recent"${f.sort === 'recent' ? ' selected' : ''}>Añadidas recientemente</option>
      <option value="new"${f.sort === 'new' ? ' selected' : ''}>Con novedades primero</option>
      <option value="title"${f.sort === 'title' ? ' selected' : ''}>Título (A–Z)</option>
      <option value="progress"${f.sort === 'progress' ? ' selected' : ''}>Progreso</option>
      <option value="year"${f.sort === 'year' ? ' selected' : ''}>Año</option>
    </select>
    ${extra}
  </div>`;
}

async function renderGrid({ title, subtitle, listId, onlyFollowed, actions = '', empty }) {
  const series = await api.series.list({
    listId,
    onlyFollowed,
    platformId: state.filters.platformId || undefined,
    state: state.filters.status || undefined,
    sort: state.filters.sort
  });

  document.getElementById('view').innerHTML = `<div class="view__inner">
    ${pageHead(title, subtitle, actions)}
    ${filtersMarkup()}
    ${series.length
      ? `<div class="grid">${series.map(cardMarkup).join('')}</div>`
      : `<div class="empty">
           <div class="empty__icon">${empty?.icon || '🍿'}</div>
           <h3>${esc(empty?.title || 'Nada por aquí')}</h3>
           <p>${esc(empty?.text || 'No hay series que coincidan con los filtros seleccionados.')}</p>
           <button class="btn btn--primary" data-action="nav" data-view="explore">Explorar catálogo</button>
         </div>`}
  </div>`;
}

function viewFollowed() {
  return renderGrid({
    title: 'Mis seguidas',
    subtitle: 'Series que estás siguiendo y su progreso',
    onlyFollowed: true,
    empty: { icon: '📺', title: 'No sigues ninguna serie', text: 'Busca series en «Explorar» y pulsa Seguir para empezar a recibir avisos de nuevos episodios.' }
  });
}

function viewLibrary() {
  return renderGrid({
    title: 'Toda la biblioteca',
    subtitle: 'Todo lo que tienes en SeriesTrack, lo sigas o no',
    empty: { icon: '📚', title: 'Biblioteca vacía', text: 'Añade series desde «Explorar» para llenar tu biblioteca.' }
  });
}

async function viewList() {
  const list = state.boot.lists.find((l) => l.id === state.listId) || state.boot.lists[0];
  if (!list) return viewLibrary();
  const isSystem = list.kind === 'favorite' || list.kind === 'pending';
  const actions = isSystem
    ? ''
    : `<button class="btn btn--ghost" data-action="rename-list" data-list="${esc(list.id)}">Renombrar</button>
       <button class="btn btn--danger" data-action="delete-list" data-list="${esc(list.id)}">Eliminar lista</button>`;

  return renderGrid({
    title: list.name,
    subtitle: `${list.seriesIds.length} serie(s) en esta lista`,
    listId: list.id,
    actions,
    empty: {
      icon: list.kind === 'favorite' ? '⭐' : '⏳',
      title: `${list.name} está vacía`,
      text: 'Abre cualquier serie y usa el botón de la lista para añadirla aquí.'
    }
  });
}

async function viewExplore() {
  const q = state.query.trim();
  let html = '';

  if (q.length < 2) {
    html = `<div class="empty">
      <div class="empty__icon">🔍</div>
      <h3>Busca una serie</h3>
      <p>Escribe al menos dos letras. Si has configurado tu clave de TMDB, la búsqueda se hace sobre el catálogo real en español; si no, busca en tu biblioteca local.</p>
    </div>`;
  } else {
    const result = await api.series.search(q);
    state.search = result;

    const localCards = (result.local || []).map(cardMarkup).join('');

    const tmdbRows = (result.tmdb || []).map((r) => `
      <div class="row">
        <div class="notif__thumb" style="flex:0 0 46px">${miniPoster(r.title)}${r.poster
          ? `<img class="poster__img" src="${esc(img(r.poster))}" alt="" loading="lazy" onerror="this.remove()">`
          : ''}</div>
        <div class="row__main">
          <div class="row__title">${esc(r.title)}</div>
          <div class="row__desc">${r.year ? `${r.year} · ` : ''}${esc(truncate(r.synopsis, 130) || 'Sin sinopsis disponible.')}</div>
        </div>
        ${r.owned
          ? `<span class="chip chip--accent">En tu biblioteca</span>
             <button class="btn btn--ghost btn--sm" data-action="open-series" data-id="tmdb-${r.tmdbId}">Abrir</button>`
          : `<button class="btn btn--primary btn--sm" data-action="add-tmdb" data-id="${r.tmdbId}">Seguir</button>`}
      </div>`).join('');

    html = `
      ${result.hint ? `<div class="banner"><span>ℹ️</span><div>${esc(result.hint)}</div>
        <div class="banner__actions"><button class="btn btn--ghost btn--sm" data-action="nav" data-view="settings">Configuración</button></div></div>` : ''}
      ${localCards ? `<section class="section"><div class="section__head"><h2>En tu biblioteca</h2></div><div class="grid">${localCards}</div></section>` : ''}
      ${tmdbRows ? `<section class="section"><div class="section__head"><h2>Resultados de TMDB</h2><span class="section__sub">${result.tmdb.length} coincidencia(s)</span></div><div class="panel">${tmdbRows}</div></section>` : ''}
      ${!localCards && !tmdbRows ? `<div class="empty"><div class="empty__icon">🤷</div><h3>Sin resultados</h3><p>No encontramos nada para «${esc(q)}».</p></div>` : ''}
    `;
  }

  document.getElementById('view').innerHTML = `<div class="view__inner">
    ${pageHead(
      'Explorar',
      'Busca series y añádelas a tu biblioteca',
      `<button class="btn" data-action="manual-series">＋ Añadir serie manualmente</button>`
    )}
    ${html}
  </div>`;
}

async function viewDetail() {
  const detail = await api.series.detail(state.seriesId);
  if (!detail) {
    state.view = 'followed';
    return render();
  }
  const p = detail.progress;
  const primaryPlatform = detail.platforms[0];

  const tabs = [
    ['episodes', 'Episodios'],
    ['info', 'Información'],
    ['stats', 'Estadísticas']
  ];

  const episodesTab = detail.seasons.map((season) => {
    const key = `${detail.id}-s${season.number}`;
    const open = state.openSeasons[key] ?? (season.number === detail.seasons[0]?.number);
    return `<div class="season${open ? ' open' : ''}" data-season-box="${esc(key)}">
      <div class="season__head" data-action="toggle-season" data-key="${esc(key)}">
        <span class="season__chevron">▶</span>
        <div>
          <div class="season__title">Temporada ${season.number}</div>
          <div class="season__meta">${season.watched}/${season.total} vistos</div>
        </div>
        <div class="season__bar"><i style="width:${season.total ? Math.round((season.watched / season.total) * 100) : 0}%"></i></div>
        <button class="btn btn--ghost btn--sm" data-action="mark-season"
                data-series="${esc(detail.id)}" data-season="${season.number}"
                data-watched="${season.watched >= season.total ? 'false' : 'true'}">
          ${season.watched >= season.total ? 'Desmarcar T' + season.number : 'Marcar T' + season.number + ' vista'}
        </button>
      </div>
      <div class="season__body">
        ${season.episodes.map((ep) => `
          <div class="episode${ep.isNew ? ' episode--unread' : ''}">
            <div class="episode__thumb"><span>SIN IMAGEN</span>${ep.still
              ? `<img class="poster__img" src="${esc(img(ep.still))}" alt="" loading="lazy" onerror="this.remove()">`
              : ''}</div>
            <div class="episode__code">T${ep.season}E${ep.number}</div>
            <div class="episode__main">
              <div class="episode__name">
                ${esc(ep.title || `Episodio ${ep.number}`)}
                ${ep.isNew ? '<span class="chip chip--new">NUEVO</span>' : ''}
                ${!ep.aired ? '<span class="chip">Próximamente</span>' : ''}
              </div>
              <div class="episode__sub">
                ${esc(formatDate(ep.airDate))}${ep.runtime ? ` · ${ep.runtime} min` : ''}
                ${ep.overview ? ` · ${esc(truncate(ep.overview, 110))}` : ''}
              </div>
            </div>
            <button class="episode__check${ep.watched ? ' on' : ''}"
                    data-action="toggle-episode" data-id="${esc(ep.id)}" data-watched="${ep.watched ? 'true' : 'false'}"
                    title="${ep.watched ? 'Marcar como no visto' : 'Marcar como visto'}">✓</button>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('') || `<div class="empty"><div class="empty__icon">🗂️</div><h3>Sin episodios registrados</h3><p>Esta serie no tiene temporadas cargadas todavía.</p></div>`;

  const infoTab = `
    <div class="panel">
      <div class="panel__title">Ficha</div>
      <div class="panel__desc">Datos de la serie y disponibilidad.</div>
      <div class="row"><div class="row__main"><div class="row__title">Título original</div></div><div>${esc(detail.originalTitle || detail.title)}</div></div>
      <div class="row"><div class="row__main"><div class="row__title">Año</div></div><div>${esc(detail.year || '—')}</div></div>
      <div class="row"><div class="row__main"><div class="row__title">Géneros</div></div><div>${detail.genres.length ? detail.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join(' ') : '—'}</div></div>
      <div class="row"><div class="row__main"><div class="row__title">Valoración</div></div><div>${detail.rating ? `★ ${detail.rating}` : '—'}</div></div>
      <div class="row"><div class="row__main"><div class="row__title">Estado</div></div><div>${esc(detail.status || '—')}</div></div>
      <div class="row"><div class="row__main"><div class="row__title">ID TMDB</div><div class="row__desc">Identificador en The Movie Database</div></div><div>${esc(detail.tmdbId || '—')}</div></div>
    </div>
    <div class="panel">
      <div class="panel__title">Disponible en</div>
      <div class="panel__desc">Plataformas asignadas a esta serie. Puedes cambiarlas manualmente.</div>
      <div class="row" style="flex-wrap:wrap;gap:10px">
        ${state.boot.platforms.map((pl) => `
          <button class="chip ${detail.platformIds.includes(pl.id) ? 'chip--accent' : ''}"
                  data-action="toggle-series-platform" data-series="${esc(detail.id)}" data-platform="${esc(pl.id)}">
            ${detail.platformIds.includes(pl.id) ? '✓ ' : ''}${esc(pl.name)}
          </button>`).join('')}
      </div>
    </div>`;

  const statsTab = `
    <div class="panel">
      <div class="panel__title">Tu progreso</div>
      <div class="panel__desc">Resumen de lo que llevas visto de esta serie.</div>
      <div class="detail-head__stats">
        <div><div class="stat__value">${p.watched}/${p.total}</div><div class="stat__label">Episodios vistos</div></div>
        <div><div class="stat__value">${p.percent}%</div><div class="stat__label">Completado</div></div>
        <div><div class="stat__value">${p.pending}</div><div class="stat__label">Pendientes</div></div>
        <div><div class="stat__value">${p.newCount}</div><div class="stat__label">Novedades</div></div>
      </div>
      <div class="season__bar" style="max-width:none;margin-top:18px;height:8px"><i style="width:${p.percent}%"></i></div>
    </div>`;

  const listChips = state.boot.lists.map((l) => `
    <button class="chip ${l.seriesIds.includes(detail.id) ? 'chip--accent' : ''}"
            data-action="toggle-list-member" data-list="${esc(l.id)}" data-series="${esc(detail.id)}">
      ${l.seriesIds.includes(detail.id) ? '✓ ' : '＋ '}${esc(l.name)}
    </button>`).join('');

  document.getElementById('view').innerHTML = `<div class="view__inner">
    <button class="back-link" data-action="back">◀ Volver</button>

    <div class="detail-head">
      <div class="detail-head__bg">
        <div class="hero__fallback" style="background:radial-gradient(70% 140% at 20% 0%, ${esc(detail.platforms[0]?.color || '#e5a00d')}44, transparent 60%), linear-gradient(120deg, #1a1a1a, #0d0d0d 75%)"></div>
        ${detail.backdrop ? `<img src="${esc(img(detail.backdrop))}" alt="" onerror="this.remove()">` : ''}
      </div>
      <div class="detail-head__content">
        <div class="detail-head__poster">${posterInner(detail)}</div>
        <div class="detail-head__info">
          <div class="hero__tags">
            ${detail.progress.newCount ? `<span class="chip chip--new">● ${detail.progress.newCount} NUEVO(S)</span>` : ''}
            ${detail.platforms.map((pl) => `<span class="chip chip--accent">${esc(pl.name)}</span>`).join('')}
            ${detail.year ? `<span class="chip">${detail.year}</span>` : ''}
            ${detail.rating ? `<span class="chip">★ ${detail.rating}</span>` : ''}
            <span class="chip">${esc(detail.progress.stateLabel)}</span>
          </div>
          <h1>${esc(detail.title)}</h1>
          <p class="detail-head__synopsis">${esc(detail.synopsis || 'Sin sinopsis disponible.')}</p>
          <div class="detail-head__actions">
            ${primaryPlatform ? `<button class="btn btn--primary" data-action="open-provider" data-id="${esc(detail.id)}">▶ Abrir en ${esc(primaryPlatform.name)}</button>` : ''}
            <button class="btn" data-action="toggle-follow" data-id="${esc(detail.id)}" data-followed="${detail.followed}">
              ${detail.followed ? '✓ Siguiendo' : '+ Seguir'}
            </button>
            <button class="btn" data-action="mark-all" data-id="${esc(detail.id)}" data-watched="${p.watched >= p.total ? 'false' : 'true'}">
              ${p.watched >= p.total ? 'Desmarcar todo' : 'Marcar todo visto'}
            </button>
            ${detail.tmdbId ? `<button class="btn btn--ghost" data-action="open-tmdb" data-id="${detail.tmdbId}">Ver en TMDB</button>` : ''}
            ${!detail.tmdbId && state.boot.settings.tmdbApiKey
              ? `<button class="btn" data-action="link-tmdb" data-id="${esc(detail.id)}">Vincular con TMDB</button>`
              : ''}
            <button class="btn btn--danger btn--ghost" data-action="delete-series" data-id="${esc(detail.id)}">Quitar</button>
          </div>
          <div style="margin-top:16px">
            <div class="section__sub" style="margin-bottom:8px">Añadir a lista:</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">${listChips}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="tabs">
      ${tabs.map(([id, label]) => `<button class="tab${state.detailTab === id ? ' active' : ''}" data-action="detail-tab" data-tab="${id}">${label}</button>`).join('')}
    </div>

    ${state.detailTab === 'episodes' ? episodesTab : state.detailTab === 'info' ? infoTab : statsTab}
  </div>`;
}

function switchMarkup(checked, action, attrs = '') {
  return `<label class="switch">
      <input type="checkbox" data-action="${action}" ${attrs} ${checked ? 'checked' : ''} />
      <span class="switch__slider"></span>
    </label>`;
}

async function viewSettings() {
  const { settings, platforms, stats } = state.boot;

  const platformRows = platforms.map((pl, index) => `
    <div class="row" data-platform-row="${esc(pl.id)}">
      <div class="platform-dot" style="background:${esc(pl.color)}">${esc(pl.short || pl.name.slice(0, 2))}</div>
      <div class="row__main">
        <div class="row__title">${esc(pl.name)} ${pl.custom ? '<span class="chip" style="margin-left:6px">personalizada</span>' : ''}</div>
        <div class="row__desc">${pl.domain ? esc(pl.domain) : 'Sin dominio configurado'} · prioridad ${pl.priority}</div>
      </div>
      <button class="icon-btn" data-action="platform-up" data-id="${esc(pl.id)}" title="Subir prioridad" ${index === 0 ? 'disabled' : ''}>↑</button>
      <button class="icon-btn" data-action="platform-down" data-id="${esc(pl.id)}" title="Bajar prioridad" ${index === platforms.length - 1 ? 'disabled' : ''}>↓</button>
      <button class="icon-btn" data-action="platform-edit" data-id="${esc(pl.id)}" title="Editar">✎</button>
      ${pl.custom ? `<button class="icon-btn" data-action="platform-delete" data-id="${esc(pl.id)}" title="Eliminar">🗑</button>` : ''}
      ${switchMarkup(pl.active, 'platform-toggle', `data-id="${esc(pl.id)}"`)}
    </div>`).join('');

  document.getElementById('view').innerHTML = `<div class="view__inner">
    ${pageHead('Configuración', 'Plataformas, notificaciones, fuentes de datos y apariencia')}

    <div class="panel">
      <div class="panel__title">Fuentes de datos</div>
      <div class="panel__desc">
        SeriesTrack obtiene los datos reales de <strong>The Movie Database (TMDB)</strong>: sinopsis en español,
        temporadas, episodios con fechas de estreno y disponibilidad por país. La clave es gratuita.
      </div>
      <div class="field">
        <label>Clave de API de TMDB</label>
        <input class="input" id="tmdbKey" type="password" placeholder="Pega aquí tu clave v3"
               value="${esc(settings.tmdbApiKey || '')}" />
        <div class="hint">
          Consíguela gratis en
          <a href="#" data-action="open-external" data-url="https://www.themoviedb.org/settings/api">themoviedb.org/settings/api</a>.
          ${settings.tmdbApiKey ? '<span class="hint--ok">● Clave guardada.</span>' : '<span class="hint--warn">Sin clave: la app funciona con el catálogo de demostración.</span>'}
        </div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Región de disponibilidad</label>
          <select class="select" id="region">
            ${['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'US'].map((r) => `<option value="${r}"${settings.region === r ? ' selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Idioma de los metadatos</label>
          <select class="select" id="language">
            ${['es-ES', 'es-MX', 'en-US'].map((l) => `<option value="${l}"${settings.language === l ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn--primary" data-action="save-tmdb">Guardar clave</button>
        <button class="btn" data-action="test-tmdb">Probar conexión</button>
        <button class="btn btn--ghost" data-action="sync-now">Sincronizar ahora</button>
        ${settings.tmdbApiKey && stats.unlinked
          ? `<button class="btn" data-action="link-catalog">Vincular ${stats.unlinked} serie(s) del catálogo con TMDB</button>`
          : ''}
      </div>
      <div class="hint" id="tmdbStatus"></div>
      ${settings.tmdbApiKey && stats.unlinked
        ? `<div class="hint">«Vincular» busca cada serie del catálogo de demostración en TMDB, sustituye sus episodios por los reales y <strong>conserva tu progreso</strong> emparejando temporada y número de episodio.</div>`
        : ''}
    </div>

    <div class="panel">
      <div class="panel__title">Plataformas de streaming</div>
      <div class="panel__desc">
        Activa las plataformas que usas y ordena su prioridad con las flechas. Cuando una serie está en varias,
        se usa la primera de la lista. Puedes añadir las que no estén preconfiguradas.
      </div>
      ${platformRows}
      <div style="margin-top:16px">
        <button class="btn btn--primary" data-action="platform-new">＋ Añadir plataforma personalizada</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel__title">Notificaciones</div>
      <div class="panel__desc">Avisos de escritorio cuando se estrena un episodio de una serie que sigues.</div>
      <div class="row">
        <div class="row__main"><div class="row__title">Notificaciones activadas</div><div class="row__desc">Avisos nativos de Windows y centro de notificaciones</div></div>
        ${switchMarkup(settings.notificationsEnabled, 'setting-toggle', 'data-key="notificationsEnabled"')}
      </div>
      <div class="row">
        <div class="row__main"><div class="row__title">Horas de silencio</div><div class="row__desc">Guarda los avisos sin mostrarlos por la noche</div></div>
        ${switchMarkup(settings.quietHours.enabled, 'setting-toggle', 'data-key="quietHours.enabled"')}
      </div>
      <div class="grid-2">
        <div class="field"><label>Desde</label><input class="input" type="time" data-setting="quietHours.from" value="${esc(settings.quietHours.from)}" /></div>
        <div class="field"><label>Hasta</label><input class="input" type="time" data-setting="quietHours.to" value="${esc(settings.quietHours.to)}" /></div>
      </div>
      <div class="field">
        <label>Agrupar en un solo aviso si hay más de…</label>
        <input class="input" type="number" min="1" max="50" data-setting="digestThreshold" value="${esc(settings.digestThreshold)}" />
      </div>
    </div>

    <div class="panel">
      <div class="panel__title">Seguimiento automático</div>
      <div class="panel__desc">Cada cuánto tiempo SeriesTrack comprueba si hay episodios nuevos.</div>
      <div class="row">
        <div class="row__main"><div class="row__title">Frecuencia de comprobación</div><div class="row__desc">Última sincronización: ${settings.lastSync ? esc(new Date(settings.lastSync).toLocaleString('es-ES')) : 'nunca'}</div></div>
        <select class="select" data-setting="syncIntervalMinutes">
          ${[[15, 'Cada 15 minutos'], [30, 'Cada 30 minutos'], [60, 'Cada hora'], [180, 'Cada 3 horas'], [360, 'Cada 6 horas'], [720, 'Cada 12 horas']]
            .map(([v, l]) => `<option value="${v}"${Number(settings.syncIntervalMinutes) === v ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="row">
        <div class="row__main"><div class="row__title">Minimizar a la bandeja al cerrar</div><div class="row__desc">La app sigue vigilando estrenos en segundo plano</div></div>
        ${switchMarkup(settings.minimizeToTray, 'setting-toggle', 'data-key="minimizeToTray"')}
      </div>
      <div class="row">
        <div class="row__main"><div class="row__title">Arrancar minimizada</div></div>
        ${switchMarkup(settings.startMinimized, 'setting-toggle', 'data-key="startMinimized"')}
      </div>
    </div>

    <div class="panel">
      <div class="panel__title">Apariencia</div>
      <div class="panel__desc">Ajusta la densidad de la interfaz.</div>
      <div class="row">
        <div class="row__main"><div class="row__title">Densidad</div></div>
        <select class="select" data-setting="density">
          <option value="comfortable"${settings.density === 'comfortable' ? ' selected' : ''}>Cómoda</option>
          <option value="compact"${settings.density === 'compact' ? ' selected' : ''}>Compacta</option>
        </select>
      </div>
      <div class="row">
        <div class="row__main"><div class="row__title">Mostrar aviso de catálogo de demostración</div></div>
        ${switchMarkup(settings.showDemoBanner, 'setting-toggle', 'data-key="showDemoBanner"')}
      </div>
    </div>

    <div class="panel">
      <div class="panel__title">Caché de imágenes</div>
      <div class="panel__desc">
        Las carátulas, los fondos y las miniaturas se descargan una sola vez y se guardan en tu
        equipo. A partir de ahí la app las lee del disco: arranca más rápido y no vuelve a pedirlas
        a internet.
      </div>
      <div class="row">
        <div class="row__main">
          <div class="row__title">Carpeta de imágenes</div>
          <div class="row__desc">${esc(state.boot.images.dir)}</div>
        </div>
        <span class="chip">${state.boot.images.files} archivo(s) · ${state.boot.images.mb} MB</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <button class="btn" data-action="open-images-folder">Abrir carpeta de imágenes</button>
        <button class="btn btn--danger" data-action="clear-images">Vaciar caché</button>
      </div>
      <div class="hint">
        Si vacías la caché, las imágenes se volverán a descargar la próxima vez que abras cada serie.
      </div>
    </div>

    <div class="panel">
      <div class="panel__title">Datos y privacidad</div>
      <div class="panel__desc">Toda tu información se guarda solo en este equipo.</div>
      <div class="detail-head__stats">
        <div><div class="stat__value">${stats.totalSeries}</div><div class="stat__label">Series</div></div>
        <div><div class="stat__value">${stats.watchedEpisodes}</div><div class="stat__label">Episodios vistos</div></div>
        <div><div class="stat__value">${stats.hours}</div><div class="stat__label">Horas</div></div>
        <div><div class="stat__value">${stats.platforms}</div><div class="stat__label">Plataformas activas</div></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">
        <button class="btn" data-action="open-data-folder">Abrir carpeta de datos</button>
        <button class="btn btn--danger" data-action="reset-app">Borrar todo y reiniciar</button>
      </div>
      <div class="hint">SeriesTrack v${esc(state.boot.version)}</div>
    </div>
  </div>`;
}

async function viewNotifications() {
  state.view = 'home';
  await render();
  openDrawer();
}

/* ------------------------------- Render --------------------------------- */

async function render() {
  renderNav();
  const view = document.getElementById('view');

  switch (state.view) {
    case 'home': return viewHome();
    case 'followed': return viewFollowed();
    case 'library': return viewLibrary();
    case 'list': return viewList();
    case 'explore': return viewExplore();
    case 'settings': return viewSettings();
    case 'detail': return viewDetail();
    default:
      view.innerHTML = '<div class="empty">Vista no encontrada</div>';
  }
}

async function refresh() {
  state.boot = await api.bootstrap();
  await render();
}

/* ------------------------------- Drawer --------------------------------- */

function openDrawer() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'false');
  document.getElementById('drawerScrim').hidden = false;
  renderDrawer();
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'true');
  document.getElementById('drawerScrim').hidden = true;
}

async function renderDrawer() {
  const { items } = await api.notifications.list();
  const body = document.getElementById('drawerBody');
  if (!items.length) {
    body.innerHTML = `<div class="empty"><div class="empty__icon">🔔</div><h3>Sin notificaciones</h3><p>Aquí aparecerán los estrenos de las series que sigues.</p></div>`;
    return;
  }
  body.innerHTML = items.map((n) => `
    <div class="notif${n.read ? '' : ' unread'}">
      <div class="notif__thumb">${miniPoster(n.seriesTitle)}${n.poster
        ? `<img class="poster__img" src="${esc(img(n.poster))}" alt="" loading="lazy" onerror="this.remove()">`
        : ''}</div>
      <div class="notif__body">
        <div class="notif__title">${esc(n.title)}</div>
        <div class="notif__text">${esc(n.body)}</div>
        <div class="notif__time">${esc(timeAgo(n.createdAt))}</div>
        <div class="notif__actions">
          <button class="btn btn--primary btn--sm" data-action="notif-watch" data-episode="${esc(n.episodeId)}" data-notif="${esc(n.id)}">Marcar visto</button>
          <button class="btn btn--ghost btn--sm" data-action="open-series" data-id="${esc(n.seriesId)}">Abrir serie</button>
          <button class="btn btn--ghost btn--sm" data-action="notif-remove" data-notif="${esc(n.id)}">✕</button>
        </div>
      </div>
    </div>`).join('');
}

/* -------------------------------- Modal --------------------------------- */

function openModal(html, wide = false) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-scrim" data-action="close-modal"></div><div class="modal${wide ? ' modal--wide' : ''}">${html}</div>`;
  root.classList.add('open');
}

function closeModal() {
  const root = document.getElementById('modalRoot');
  root.classList.remove('open');
  root.innerHTML = '';
}

function listModal() {
  openModal(`
    <div class="modal__head"><h2>Nueva lista</h2><button class="icon-btn" data-action="close-modal">✕</button></div>
    <div class="field">
      <label>Nombre de la lista</label>
      <input class="input" id="newListName" placeholder="Por ejemplo: Ciencia ficción para el finde" />
    </div>
    <div class="modal__actions">
      <button class="btn btn--ghost" data-action="close-modal">Cancelar</button>
      <button class="btn btn--primary" data-action="create-list">Crear lista</button>
    </div>`);
  setTimeout(() => document.getElementById('newListName')?.focus(), 60);
}

function platformModal(platform = null) {
  const p = platform || { name: '', domain: '', color: '#6C5CE7', short: '', note: '' };
  openModal(`
    <div class="modal__head">
      <h2>${platform ? 'Editar plataforma' : 'Añadir plataforma personalizada'}</h2>
      <button class="icon-btn" data-action="close-modal">✕</button>
    </div>
    <div class="field">
      <label>Nombre *</label>
      <input class="input" id="pfName" value="${esc(p.name)}" placeholder="Mi plataforma de streaming" />
    </div>
    <div class="grid-2">
      <div class="field">
        <label>Abreviatura (máx. 3)</label>
        <input class="input" id="pfShort" maxlength="3" value="${esc(p.short || '')}" placeholder="MP" />
      </div>
      <div class="field">
        <label>Color de marca</label>
        <input class="input" id="pfColor" type="color" value="${esc(p.color || '#6C5CE7')}" />
      </div>
    </div>
    <div class="field">
      <label>Dominio o URL</label>
      <input class="input" id="pfDomain" value="${esc(p.domain || '')}" placeholder="miplataforma.com" />
      <div class="hint">Se usará para el botón «Abrir en…» y como referencia para enlazar las series.</div>
    </div>
    <div class="field">
      <label>Notas (opcional)</label>
      <input class="input" id="pfNote" value="${esc(p.note || '')}" placeholder="Plan familiar, cuenta compartida…" />
    </div>
    <div class="modal__actions">
      <button class="btn btn--ghost" data-action="close-modal">Cancelar</button>
      <button class="btn btn--primary" data-action="save-platform" data-id="${platform ? esc(platform.id) : ''}">Guardar</button>
    </div>`);
  setTimeout(() => document.getElementById('pfName')?.focus(), 60);
}

function manualSeriesModal() {
  const platforms = state.boot.platforms.filter((p) => p.active);
  openModal(`
    <div class="modal__head"><h2>Añadir serie manualmente</h2><button class="icon-btn" data-action="close-modal">✕</button></div>
    <div class="panel__desc">Útil para series que no están en TMDB o para plataformas personalizadas.</div>
    <div class="field"><label>Título *</label><input class="input" id="msTitle" placeholder="Nombre de la serie" /></div>
    <div class="field"><label>Sinopsis</label><textarea class="input" id="msSynopsis" rows="3" placeholder="Breve descripción"></textarea></div>
    <div class="grid-2">
      <div class="field"><label>Año</label><input class="input" id="msYear" type="number" min="1900" max="2100" placeholder="2026" /></div>
      <div class="field"><label>Temporadas</label><input class="input" id="msSeasons" type="number" min="1" max="30" value="1" /></div>
    </div>
    <div class="field"><label>Episodios por temporada</label><input class="input" id="msEpisodes" type="number" min="1" max="60" value="8" /></div>
    <div class="field">
      <label>Plataforma</label>
      <select class="select" id="msPlatform">
        <option value="">— Sin asignar —</option>
        ${platforms.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
      </select>
    </div>
    <div class="modal__actions">
      <button class="btn btn--ghost" data-action="close-modal">Cancelar</button>
      <button class="btn btn--primary" data-action="create-manual-series">Añadir serie</button>
    </div>`);
  setTimeout(() => document.getElementById('msTitle')?.focus(), 60);
}

/* ------------------------------- Eventos -------------------------------- */

async function handleAction(target) {
  const action = target.dataset.action;
  const { boot } = state;

  switch (action) {
    case 'nav':
      state.view = target.dataset.view;
      state.seriesId = null;
      if (state.view === 'notifications') return viewNotifications();
      return render();

    case 'nav-list':
      state.view = 'list';
      state.listId = target.dataset.list;
      return render();

    case 'back':
      state.view = 'followed';
      state.seriesId = null;
      return render();

    case 'open-series':
      state.view = 'detail';
      state.seriesId = target.dataset.id;
      state.detailTab = 'episodes';
      return render();

    case 'detail-tab':
      state.detailTab = target.dataset.tab;
      return render();

    case 'toggle-season': {
      const key = target.dataset.key;
      state.openSeasons[key] = !(state.openSeasons[key] ?? document.querySelector(`[data-season-box="${key}"]`)?.classList.contains('open'));
      return render();
    }

    case 'toggle-episode': {
      const id = target.dataset.id;
      const watched = target.dataset.watched === 'true';
      await api.episodes.toggle(id, !watched);
      return;
    }

    case 'mark-season': {
      await api.episodes.markSeason(target.dataset.series, Number(target.dataset.season), target.dataset.watched === 'true');
      toast('Temporada actualizada.', 'ok');
      return;
    }

    case 'mark-all': {
      const res = await api.series.markAll(target.dataset.id, target.dataset.watched === 'true');
      toast(`${res.changed} episodio(s) actualizados.`, 'ok');
      return;
    }

    case 'toggle-follow': {
      const followed = target.dataset.followed === 'true';
      await api.series.follow(target.dataset.id, !followed);
      toast(followed ? 'Has dejado de seguir la serie.' : 'Ahora sigues esta serie.', 'ok');
      return;
    }

    case 'toggle-series-platform': {
      const detail = await api.series.detail(target.dataset.series);
      const id = target.dataset.platform;
      const ids = detail.platformIds.includes(id)
        ? detail.platformIds.filter((x) => x !== id)
        : [...detail.platformIds, id];
      await api.series.setPlatforms(detail.id, ids);
      return;
    }

    case 'toggle-list-member':
      await api.lists.toggle(target.dataset.list, target.dataset.series);
      return;

    case 'new-list':
      return listModal();

    case 'create-list': {
      const name = document.getElementById('newListName').value.trim();
      if (!name) return toast('Escribe un nombre para la lista.', 'error');
      const list = await api.lists.create(name);
      closeModal();
      state.view = 'list';
      state.listId = list.id;
      toast(`Lista «${list.name}» creada.`, 'ok');
      return;
    }

    case 'rename-list': {
      const list = boot.lists.find((l) => l.id === target.dataset.list);
      const name = window.prompt('Nuevo nombre de la lista:', list?.name || '');
      if (name && name.trim()) {
        await api.lists.rename(target.dataset.list, name.trim());
        toast('Lista renombrada.', 'ok');
      }
      return;
    }

    case 'delete-list': {
      const ok = await api.lists.remove(target.dataset.list);
      if (ok) {
        state.view = 'followed';
        state.listId = null;
        toast('Lista eliminada.', 'ok');
      }
      return;
    }

    case 'delete-series': {
      const detail = await api.series.detail(target.dataset.id);
      if (!window.confirm(`¿Quitar «${detail?.title}» de SeriesTrack? Se perderá su progreso.`)) return;
      await api.series.remove(target.dataset.id);
      state.view = 'followed';
      state.seriesId = null;
      toast('Serie eliminada.', 'ok');
      return;
    }

    case 'open-provider': {
      const detail = await api.series.detail(target.dataset.id);
      const platform = detail?.platforms[0];
      if (platform?.domain) await api.system.open(platform.domain);
      else toast('Esta serie no tiene plataforma con dominio configurado.', 'error');
      return;
    }

    case 'open-tmdb':
      await api.system.open(`https://www.themoviedb.org/tv/${target.dataset.id}`);
      return;

    case 'open-external':
      await api.system.open(target.dataset.url);
      return;

    case 'add-tmdb': {
      target.disabled = true;
      target.textContent = 'Añadiendo…';
      try {
        const series = await api.series.addTmdb(Number(target.dataset.id));
        toast(`«${series.title}» añadida a tus seguidas.`, 'ok');
        state.view = 'detail';
        state.seriesId = series.id;
        await refresh();
      } catch (err) {
        toast(err.message || 'No se pudo añadir la serie.', 'error');
        target.disabled = false;
        target.textContent = 'Seguir';
      }
      return;
    }

    case 'link-tmdb': {
      const btn = target;
      btn.disabled = true;
      btn.textContent = 'Vinculando…';
      try {
        const res = await api.series.linkTmdb(target.dataset.id);
        toast(`«${res.series.title}» vinculada: ${res.newCount} episodios reales, ${res.restored} vistos conservados.`, 'ok');
      } catch (err) {
        toast(err.message || 'No se pudo vincular la serie.', 'error');
        btn.disabled = false;
        btn.textContent = 'Vincular con TMDB';
      }
      return;
    }

    case 'link-catalog': {
      const btn = target;
      btn.disabled = true;
      btn.textContent = 'Vinculando… (puede tardar un minuto)';
      toast('Buscando cada serie en TMDB y trayendo episodios reales…');
      try {
        const res = await api.series.linkCatalog();
        const failures = res.failed.length
          ? ` Sin coincidencia: ${res.failed.map((f) => f.title).join(', ')}.`
          : '';
        toast(
          `Vinculadas ${res.linked.length} de ${res.total} series.${failures}`,
          res.linked.length ? 'ok' : 'error'
        );
      } catch (err) {
        toast(err.message || 'No se pudo vincular el catálogo.', 'error');
        btn.disabled = false;
        btn.textContent = 'Vincular catálogo con TMDB';
      }
      return;
    }

    case 'platform-new':
      return platformModal();

    case 'platform-edit': {
      const platform = boot.platforms.find((p) => p.id === target.dataset.id);
      return platformModal(platform);
    }

    case 'platform-delete': {
      try {
        await api.platforms.remove(target.dataset.id);
        toast('Plataforma eliminada.', 'ok');
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }

    case 'platform-up':
    case 'platform-down': {
      const ids = boot.platforms.map((p) => p.id);
      const index = ids.indexOf(target.dataset.id);
      const swap = action === 'platform-up' ? index - 1 : index + 1;
      if (swap < 0 || swap >= ids.length) return;
      [ids[index], ids[swap]] = [ids[swap], ids[index]];
      await api.platforms.reorder(ids);
      return;
    }

    case 'save-platform': {
      const input = {
        id: target.dataset.id || undefined,
        name: document.getElementById('pfName').value,
        short: document.getElementById('pfShort').value,
        color: document.getElementById('pfColor').value,
        domain: document.getElementById('pfDomain').value,
        note: document.getElementById('pfNote').value
      };
      try {
        await api.platforms.save(input);
        closeModal();
        toast('Plataforma guardada.', 'ok');
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }

    case 'save-tmdb': {
      const key = document.getElementById('tmdbKey').value.trim();
      await api.settings.save({
        tmdbApiKey: key,
        region: document.getElementById('region').value,
        language: document.getElementById('language').value
      });
      toast(key ? 'Clave guardada. Ya puedes buscar en TMDB.' : 'Clave eliminada.', 'ok');
      return;
    }

    case 'test-tmdb': {
      const status = document.getElementById('tmdbStatus');
      status.className = 'hint';
      status.textContent = 'Probando conexión…';
      const res = await api.series.search('The Last of Us');
      if (res.mode === 'tmdb') {
        status.className = 'hint hint--ok';
        status.textContent = `✓ Conexión correcta. ${res.tmdb.length} resultado(s) de prueba recibidos.`;
      } else {
        status.className = 'hint hint--warn';
        status.textContent = res.hint || 'No se pudo conectar con TMDB.';
      }
      return;
    }

    case 'sync-now': {
      const btn = document.getElementById('syncBtn');
      toast('Buscando nuevos episodios…');
      const summary = await api.sync.now();
      if (summary?.error) toast(`Error: ${summary.error}`, 'error');
      return;
    }

    case 'manual-series':
      return manualSeriesModal();

    case 'create-manual-series': {
      const title = document.getElementById('msTitle').value.trim();
      if (!title) return toast('El título es obligatorio.', 'error');
      const platformId = document.getElementById('msPlatform').value;
      await api.series.addManual({
        title,
        synopsis: document.getElementById('msSynopsis').value,
        year: document.getElementById('msYear').value,
        seasons: document.getElementById('msSeasons').value,
        episodesPerSeason: document.getElementById('msEpisodes').value,
        platformIds: platformId ? [platformId] : []
      });
      closeModal();
      toast(`«${title}» añadida.`, 'ok');
      return;
    }

    case 'notif-watch': {
      await api.episodes.toggle(target.dataset.episode, true);
      await api.notifications.remove(target.dataset.notif);
      toast('Episodio marcado como visto.', 'ok');
      return;
    }

    case 'notif-remove':
      await api.notifications.remove(target.dataset.notif);
      return;

    case 'close-modal':
      return closeModal();

    case 'dismiss-banner':
      await api.settings.save({ showDemoBanner: false });
      return;

    case 'reset-app':
      await api.system.reset();
      return;

    case 'open-data-folder':
      await api.system.openDataFolder();
      return;

    case 'open-images-folder':
      await api.images.openFolder();
      return;

    case 'clear-images': {
      const res = await api.images.clear();
      toast(`Caché vaciada: ${res.removed} archivo(s) eliminados.`, 'ok');
      await refresh();
      return;
    }

    default:
      return;
  }
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  try {
    await handleAction(target);
  } catch (err) {
    toast(err.message || 'Se ha producido un error.', 'error');
  }
});

document.addEventListener('change', async (event) => {
  const el = event.target;

  if (el.dataset.filter) {
    state.filters[el.dataset.filter] = el.value;
    return render();
  }

  if (el.dataset.action === 'platform-toggle') {
    await api.platforms.toggle(el.dataset.id, el.checked);
    return;
  }

  if (el.dataset.action === 'setting-toggle') {
    const key = el.dataset.key;
    if (key.includes('.')) {
      const [group, prop] = key.split('.');
      const patch = { [group]: { ...state.boot.settings[group], [prop]: el.checked } };
      await api.settings.save(patch);
    } else {
      await api.settings.save({ [key]: el.checked });
    }
    return;
  }

  if (el.dataset.setting) {
    const key = el.dataset.setting;
    const value = el.type === 'number' ? Number(el.value) : el.value;
    if (key.includes('.')) {
      const [group, prop] = key.split('.');
      await api.settings.save({ [group]: { ...state.boot.settings[group], [prop]: value } });
    } else {
      await api.settings.save({ [key]: value });
    }
    return;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (document.getElementById('modalRoot').classList.contains('open')) closeModal();
    else closeDrawer();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.getElementById('searchInput').focus();
  }
});

/* ------------------------------ Arranque -------------------------------- */

function wireChrome() {
  const input = document.getElementById('searchInput');

  input.addEventListener('input', () => {
    state.query = input.value;
    document.getElementById('searchClear').hidden = !input.value;
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      if (state.query.trim().length >= 2) {
        state.view = 'explore';
        render();
      } else if (state.view === 'explore') {
        render();
      }
    }, 260);
  });

  document.getElementById('searchClear').addEventListener('click', () => {
    input.value = '';
    state.query = '';
    document.getElementById('searchClear').hidden = true;
    if (state.view === 'explore') render();
  });

  document.getElementById('syncBtn').addEventListener('click', async (event) => {
    const icon = event.currentTarget.querySelector('.spin-target');
    icon.classList.add('spin');
    const summary = await api.sync.now();
    icon.classList.remove('spin');
    if (summary?.error) toast(`Error: ${summary.error}`, 'error');
    else if (!summary?.newEpisodes) toast('Sin novedades: no hay episodios nuevos.');
  });

  document.getElementById('bellBtn').addEventListener('click', openDrawer);
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  document.getElementById('drawerScrim').addEventListener('click', closeDrawer);

  document.getElementById('readAllBtn').addEventListener('click', async () => {
    await api.notifications.read();
    renderDrawer();
  });

  document.getElementById('clearAllBtn').addEventListener('click', async () => {
    await api.notifications.clear();
    renderDrawer();
  });

  document.getElementById('collapseBtn').addEventListener('click', () => {
    document.body.classList.toggle('collapsed');
    localStorage.setItem('st-collapsed', document.body.classList.contains('collapsed') ? '1' : '0');
  });

  document.getElementById('avatar').addEventListener('click', () => {
    state.view = 'settings';
    render();
  });

  api.on('data:changed', () => refresh());
  api.on('settings:changed', () => refresh());
  api.on('navigate', ({ view, seriesId }) => {
    if (view === 'series' && seriesId) {
      state.view = 'detail';
      state.seriesId = seriesId;
    }
    refresh();
  });
  api.on('toast', ({ message, kind }) => toast(message, kind));

  if (localStorage.getItem('st-collapsed') === '1') document.body.classList.add('collapsed');
}

async function init() {
  wireChrome();
  state.boot = await api.bootstrap();
  await render();
  // Precalentar datos de próximos estrenos
  api.sync.upcoming(30).then((u) => { state.upcoming = u; });
}

init().catch((err) => {
  document.getElementById('view').innerHTML = `<div class="empty"><div class="empty__icon">⚠️</div><h3>Error al iniciar</h3><p>${esc(err.message)}</p></div>`;
});

})();
