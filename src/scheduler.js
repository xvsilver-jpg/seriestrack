'use strict';

const catalog = require('./catalog');
const tmdb = require('./tmdb');

const DAY = 86400000;

function inQuietHours(settings, now = new Date()) {
  const q = settings.quietHours;
  if (!q || !q.enabled) return false;
  const [fh, fm] = String(q.from || '23:00').split(':').map(Number);
  const [th, tm] = String(q.to || '08:00').split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const from = fh * 60 + fm;
  const to = th * 60 + tm;
  return from <= to ? cur >= from && cur < to : cur >= from || cur < to;
}

/**
 * Refresca desde TMDB todas las series seguidas que tengan tmdbId.
 * Devuelve el número de series refrescadas.
 */
async function refreshFromTmdb(data, log = () => {}) {
  const { tmdbApiKey, language, region } = data.settings;
  if (!tmdbApiKey) return 0;

  let refreshed = 0;
  const targets = data.series.filter((s) => s.followed && s.tmdbId);

  for (const series of targets) {
    try {
      const built = await tmdb.buildSeriesFromTmdb(tmdbApiKey, series.tmdbId, { language, region });

      // Actualizar metadatos (sin tocar el progreso del usuario)
      Object.assign(series, {
        title: built.series.title,
        originalTitle: built.series.originalTitle,
        synopsis: built.series.synopsis || series.synopsis,
        poster: built.series.poster || series.poster,
        backdrop: built.series.backdrop || series.backdrop,
        year: built.series.year || series.year,
        genres: built.series.genres.length ? built.series.genres : series.genres,
        rating: built.series.rating || series.rating,
        status: built.series.status,
        platformIds: built.series.platformIds.length ? built.series.platformIds : series.platformIds,
        providerLink: built.series.providerLink || series.providerLink
      });

      // Fusionar temporadas y episodios nuevos conservando los ya existentes
      for (const season of built.seasons) {
        if (!data.seasons.some((s) => s.id === season.id)) data.seasons.push(season);
      }
      for (const ep of built.episodes) {
        const existing = data.episodes.find((e) => e.id === ep.id);
        if (existing) Object.assign(existing, { title: ep.title, airDate: ep.airDate, runtime: ep.runtime, overview: ep.overview, still: ep.still });
        else data.episodes.push(ep);
      }
      refreshed++;
      log(`TMDB: ${series.title} actualizada`);
    } catch (err) {
      log(`TMDB: fallo al actualizar "${series.title}": ${err.message}`);
    }
  }
  return refreshed;
}

/**
 * Busca episodios recién estrenados de las series seguidas y genera
 * notificaciones. Aplica deduplicación, umbral de resumen y horas de silencio.
 */
async function sync(data, opts = {}) {
  const { notify = () => {}, log = () => {} } = opts;
  const settings = data.settings;
  const now = new Date();
  const today = catalog.todayISO(now);
  const sevenDaysAgo = catalog.todayISO(new Date(now.getTime() - 7 * DAY));

  const lastSyncDay = settings.lastSync ? String(settings.lastSync).slice(0, 10) : null;
  const windowStart = lastSyncDay && lastSyncDay > sevenDaysAgo ? lastSyncDay : sevenDaysAgo;

  const refreshed = await refreshFromTmdb(data, log);

  const candidates = [];
  for (const series of data.series) {
    if (!series.followed) continue;
    for (const ep of catalog.episodesOf(data, series.id)) {
      if (!ep.airDate || ep.airDate > today || ep.airDate < windowStart) continue;
      if (catalog.isWatched(data, ep.id)) continue;
      if (data.notifications.some((n) => n.episodeId === ep.id)) continue;
      candidates.push({ series, ep });
    }
  }

  // Más recientes primero
  candidates.sort((a, b) => (b.ep.airDate || '').localeCompare(a.ep.airDate || ''));

  const created = [];
  for (const { series, ep } of candidates) {
    const platforms = catalog.platformsOf(data, series);
    const platformName = platforms.length ? platforms.map((p) => p.name).join(' / ') : 'plataforma desconocida';

    const notification = catalog.pushNotification(data, {
      seriesId: series.id,
      episodeId: ep.id,
      seriesTitle: series.title,
      title: 'Nuevo episodio disponible',
      body: `${series.title} · T${ep.season}E${ep.number}${ep.title ? `: "${ep.title}"` : ''} ya está en ${platformName}.`,
      platformName,
      poster: series.poster,
      season: ep.season,
      number: ep.number
    });
    if (notification) created.push(notification);
  }

  // Notificaciones de escritorio (con digest si superan el umbral)
  const silent = inQuietHours(settings, now);
  if (settings.notificationsEnabled && !silent && created.length) {
    const threshold = Number(settings.digestThreshold) || 5;
    if (created.length > threshold) {
      notify({
        title: `${created.length} nuevos episodios disponibles`,
        body: created.slice(0, 3).map((n) => n.seriesTitle).join(', ') + (created.length > 3 ? ` y ${created.length - 3} más` : ''),
        digest: true,
        seriesId: null,
        episodeId: null
      });
    } else {
      for (const n of created) {
        notify({ title: n.title, body: n.body, seriesId: n.seriesId, episodeId: n.episodeId, poster: n.poster });
      }
    }
  }

  settings.lastSync = now.toISOString();

  const summary = {
    at: settings.lastSync,
    mode: settings.tmdbApiKey ? 'tmdb' : 'local',
    refreshed,
    newEpisodes: created.length,
    silent,
    windowStart,
    seriesChecked: data.series.filter((s) => s.followed).length
  };
  log(`Sync ${summary.mode}: ${created.length} nuevos, ${refreshed} series refrescadas`);
  return summary;
}

/** Próximos estrenos de las series seguidas dentro de N días. */
function upcoming(data, days = 30) {
  const now = new Date();
  const today = catalog.todayISO(now);
  const limit = catalog.todayISO(new Date(now.getTime() + days * DAY));
  const out = [];
  for (const series of data.series) {
    if (!series.followed) continue;
    for (const ep of catalog.episodesOf(data, series.id)) {
      if (!ep.airDate || ep.airDate <= today || ep.airDate > limit) continue;
      out.push({
        episodeId: ep.id,
        seriesId: series.id,
        seriesTitle: series.title,
        poster: series.poster,
        platformName: catalog.platformsOf(data, series).map((p) => p.name).join(' / '),
        season: ep.season,
        number: ep.number,
        title: ep.title,
        airDate: ep.airDate,
        daysUntil: Math.round((catalog.todayISO(new Date(`${ep.airDate}T00:00:00Z`)) ? new Date(`${ep.airDate}T00:00:00Z`).getTime() - now.getTime() : 0) / DAY)
      });
    }
  }
  out.sort((a, b) => a.airDate.localeCompare(b.airDate));
  return out;
}

module.exports = { sync, refreshFromTmdb, upcoming, inQuietHours };
