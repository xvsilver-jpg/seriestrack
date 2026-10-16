'use strict';

/**
 * Lógica de dominio: series, temporadas, episodios, progreso, listas.
 * Funciones puras sobre el objeto de datos (sin dependencias de Electron),
 * para poder probarlas con `node scripts/selftest.js`.
 */

const DAY = 86400000;
const NEW_WINDOW_DAYS = 30;

function todayISO(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function dateFromISO(iso) {
  return new Date(`${iso}T00:00:00Z`);
}

function isAired(ep, today = todayISO()) {
  return ep.airDate && ep.airDate <= today;
}

function isRecent(ep, today = todayISO()) {
  return isAired(ep, today) && dateFromISO(ep.airDate) >= dateFromISO(today).getTime() - NEW_WINDOW_DAYS * DAY;
}

function isWatched(data, episodeId) {
  return !!(data.progress[episodeId] && data.progress[episodeId].watched);
}

function episodesOf(data, seriesId) {
  return data.episodes
    .filter((e) => e.seriesId === seriesId)
    .sort((a, b) => a.season - b.season || a.number - b.number);
}

function seasonsOf(data, seriesId) {
  return data.seasons.filter((s) => s.seriesId === seriesId).sort((a, b) => a.number - b.number);
}

function platformsOf(data, series) {
  return (series.platformIds || [])
    .map((id) => data.platforms.find((p) => p.id === id))
    .filter(Boolean);
}

/** Primer episodio emitido y no visto, en orden cronológico. */
function nextUnwatched(data, seriesId) {
  const eps = episodesOf(data, seriesId);
  return eps.find((e) => isAired(e) && !isWatched(data, e.id)) || null;
}

/** Resumen de progreso + estado textual de una serie. */
function summarize(data, series) {
  const eps = episodesOf(data, series.id).filter((e) => isAired(e));
  const watched = eps.filter((e) => isWatched(data, e.id)).length;
  const total = eps.length;
  const newEps = eps.filter((e) => isRecent(e) && !isWatched(data, e.id));
  const next = eps.find((e) => !isWatched(data, e.id)) || null;
  const upcoming = episodesOf(data, series.id).filter((e) => !isAired(e));

  let state = 'sin-episodios';
  if (total > 0 && watched >= total) state = 'al-dia';
  else if (watched > 0) state = 'en-curso';
  else state = 'pendiente';

  return {
    watched,
    total,
    pending: total - watched,
    newCount: newEps.length,
    newEpisodeIds: newEps.map((e) => e.id),
    nextEpisode: next,
    nextAiring: upcoming[0] || null,
    state,
    stateLabel:
      state === 'al-dia' ? 'Al día'
      : state === 'en-curso' ? `${total - watched} por ver`
      : state === 'pendiente' ? 'Sin empezar'
      : 'Sin episodios',
    percent: total ? Math.round((watched / total) * 100) : 0
  };
}

function decorate(data, series) {
  const s = summarize(data, series);
  return {
    ...series,
    platforms: platformsOf(data, series),
    progress: s,
    inLists: data.lists.filter((l) => l.seriesIds.includes(series.id)).map((l) => l.id)
  };
}

function listSeries(data, opts = {}) {
  let items = data.series.slice();

  if (opts.onlyFollowed) items = items.filter((s) => s.followed);
  if (opts.listId) {
    const list = data.lists.find((l) => l.id === opts.listId);
    items = list ? items.filter((s) => list.seriesIds.includes(s.id)) : [];
  }
  if (opts.platformId) items = items.filter((s) => (s.platformIds || []).includes(opts.platformId));
  if (opts.state) {
    items = items.filter((s) => summarize(data, s).state === opts.state);
  }

  let decorated = items.map((s) => decorate(data, s));

  const sort = opts.sort || 'recent';
  if (sort === 'title') decorated.sort((a, b) => a.title.localeCompare(b.title, 'es'));
  else if (sort === 'progress') decorated.sort((a, b) => b.progress.percent - a.progress.percent);
  else if (sort === 'year') decorated.sort((a, b) => (b.year || 0) - (a.year || 0));
  else if (sort === 'new') {
    decorated.sort((a, b) => (b.progress.newCount - a.progress.newCount) || a.title.localeCompare(b.title, 'es'));
  } else {
    decorated.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
  }

  if (opts.query) {
    const q = opts.query.toLowerCase();
    decorated = decorated.filter(
      (s) => s.title.toLowerCase().includes(q) || (s.synopsis || '').toLowerCase().includes(q)
    );
  }

  return decorated;
}

function seriesDetail(data, seriesId) {
  const series = data.series.find((s) => s.id === seriesId);
  if (!series) return null;

  const seasons = seasonsOf(data, seriesId).map((season) => {
    const eps = episodesOf(data, seriesId).filter((e) => e.season === season.number);
    const watched = eps.filter((e) => isWatched(data, e.id)).length;
    return {
      ...season,
      episodes: eps.map((e) => ({
        ...e,
        watched: isWatched(data, e.id),
        aired: isAired(e),
        isNew: isRecent(e) && !isWatched(data, e.id)
      })),
      watched,
      total: eps.length
    };
  });

  return { ...decorate(data, series), seasons };
}

function setEpisodeWatched(data, episodeId, watched) {
  const ep = data.episodes.find((e) => e.id === episodeId);
  if (!ep) return null;
  if (watched) {
    data.progress[episodeId] = {
      watched: true,
      watchedAt: new Date().toISOString(),
      seconds: data.progress[episodeId]?.seconds || 0
    };
  } else {
    delete data.progress[episodeId];
  }
  return ep;
}

function setSeasonWatched(data, seriesId, season, watched) {
  const eps = episodesOf(data, seriesId).filter((e) => e.season === season);
  let n = 0;
  for (const ep of eps) {
    if (watched && !isWatched(data, ep.id)) n++;
    if (!watched && isWatched(data, ep.id)) n++;
    setEpisodeWatched(data, ep.id, watched);
  }
  return n;
}

function setSeriesWatched(data, seriesId, watched) {
  let n = 0;
  for (const season of seasonsOf(data, seriesId)) {
    n += setSeasonWatched(data, seriesId, season.number, watched);
  }
  return n;
}

/* ------------------------------- Listas ------------------------------- */

function createList(data, name, kind = 'custom') {
  const id = `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const list = { id, name, kind, seriesIds: [] };
  data.lists.push(list);
  return list;
}

function deleteList(data, listId) {
  const list = data.lists.find((l) => l.id === listId);
  if (!list) return false;
  if (list.kind === 'favorite' || list.kind === 'pending') return false; // listas del sistema
  data.lists = data.lists.filter((l) => l.id !== listId);
  return true;
}

function renameList(data, listId, name) {
  const list = data.lists.find((l) => l.id === listId);
  if (!list) return null;
  list.name = name;
  return list;
}

function addToList(data, listId, seriesId) {
  const list = data.lists.find((l) => l.id === listId);
  if (!list) return null;
  if (!list.seriesIds.includes(seriesId)) list.seriesIds.push(seriesId);
  return list;
}

function removeFromList(data, listId, seriesId) {
  const list = data.lists.find((l) => l.id === listId);
  if (!list) return null;
  list.seriesIds = list.seriesIds.filter((id) => id !== seriesId);
  return list;
}

function toggleListMembership(data, listId, seriesId) {
  const list = data.lists.find((l) => l.id === listId);
  if (!list) return null;
  if (list.seriesIds.includes(seriesId)) removeFromList(data, listId, seriesId);
  else addToList(data, listId, seriesId);
  return list;
}

/* ---------------------------- Plataformas ---------------------------- */

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || `plataforma-${Date.now().toString(36)}`;
}

function savePlatform(data, input) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('El nombre de la plataforma es obligatorio.');

  if (input.id) {
    const platform = data.platforms.find((p) => p.id === input.id);
    if (!platform) throw new Error('Plataforma no encontrada.');
    Object.assign(platform, {
      name,
      color: input.color || platform.color,
      short: (input.short || name.slice(0, 2)).toUpperCase().slice(0, 3),
      domain: input.domain || platform.domain,
      active: input.active !== undefined ? !!input.active : platform.active,
      priority: input.priority !== undefined ? Number(input.priority) : platform.priority
    });
    return platform;
  }

  let id = slugify(name);
  while (data.platforms.some((p) => p.id === id)) id += '-2';
  const platform = {
    id,
    name,
    short: (input.short || name.slice(0, 2)).toUpperCase().slice(0, 3),
    color: input.color || '#6C5CE7',
    domain: input.domain || '',
    custom: true,
    active: input.active !== undefined ? !!input.active : true,
    priority: data.platforms.length + 1,
    note: input.note || ''
  };
  data.platforms.push(platform);
  return platform;
}

function deletePlatform(data, platformId) {
  const platform = data.platforms.find((p) => p.id === platformId);
  if (!platform) return false;
  if (!platform.custom) throw new Error('Las plataformas preconfiguradas no se pueden eliminar, solo desactivar.');
  data.platforms = data.platforms.filter((p) => p.id !== platformId);
  for (const s of data.series) {
    s.platformIds = (s.platformIds || []).filter((id) => id !== platformId);
  }
  return true;
}

function reorderPlatforms(data, orderedIds) {
  orderedIds.forEach((id, index) => {
    const platform = data.platforms.find((p) => p.id === id);
    if (platform) platform.priority = index + 1;
  });
  data.platforms.sort((a, b) => a.priority - b.priority);
  return data.platforms;
}

/* --------------------------- Notificaciones --------------------------- */

function pushNotification(data, payload) {
  const exists = data.notifications.some(
    (n) => n.seriesId === payload.seriesId && n.episodeId === payload.episodeId
  );
  if (exists) return null;
  const notification = {
    id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    read: false,
    createdAt: new Date().toISOString(),
    ...payload
  };
  data.notifications.unshift(notification);
  if (data.notifications.length > 300) data.notifications.length = 300;
  return notification;
}

function unreadCount(data) {
  return data.notifications.filter((n) => !n.read).length;
}

/* --------------------------- Vinculación TMDB --------------------------- */

/**
 * Sustituye las temporadas y episodios de una serie por los datos reales de
 * TMDB, conservando el progreso del usuario (emparejado por temporada/episodio)
 * y manteniendo el id local de la serie para no romper listas ni notificaciones.
 */
function replaceSeriesContent(data, series, built) {
  const oldEpisodes = episodesOf(data, series.id);
  const watched = new Map();
  for (const ep of oldEpisodes) {
    if (isWatched(data, ep.id)) watched.set(`${ep.season}:${ep.number}`, data.progress[ep.id]);
  }
  const previousCount = oldEpisodes.length;

  for (const ep of oldEpisodes) delete data.progress[ep.id];
  data.episodes = data.episodes.filter((e) => e.seriesId !== series.id);
  data.seasons = data.seasons.filter((s) => s.seriesId !== series.id);
  data.notifications = data.notifications.filter((n) => n.seriesId !== series.id);

  for (const season of built.seasons) {
    data.seasons.push({
      id: `${series.id}-s${season.number}`,
      seriesId: series.id,
      number: season.number,
      episodeCount: season.episodeCount
    });
  }

  let restored = 0;
  for (const ep of built.episodes) {
    const id = `${series.id}-s${ep.season}e${ep.number}`;
    data.episodes.push({ ...ep, id, seriesId: series.id });
    const previous = watched.get(`${ep.season}:${ep.number}`);
    if (previous) {
      data.progress[id] = previous;
      restored++;
    }
  }

  return { previousCount, newCount: built.episodes.length, restored };
}

/** Copia los metadatos de TMDB sobre la serie local (no toca progreso ni listas). */
function applyTmdbMetadata(series, builtSeries) {
  const fields = ['title', 'originalTitle', 'synopsis', 'poster', 'backdrop', 'year',
    'genres', 'rating', 'status', 'platformIds', 'providerLink'];
  for (const field of fields) {
    const value = builtSeries[field];
    if (Array.isArray(value) ? value.length > 0 : value) series[field] = value;
  }
  series.tmdbId = builtSeries.tmdbId;
  series.demo = false;
  return series;
}

/* ------------------------------ Búsqueda ------------------------------ */

function localSearch(data, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  return data.series
    .filter((s) => s.title.toLowerCase().includes(q) || (s.originalTitle || '').toLowerCase().includes(q))
    .map((s) => ({ ...decorate(data, s), source: 'local' }));
}

function stats(data) {
  const aired = data.episodes.filter((e) => isAired(e));
  const watched = aired.filter((e) => isWatched(data, e.id));
  const minutes = watched.reduce((acc, e) => acc + (e.runtime || 0), 0);
  return {
    followed: data.series.filter((s) => s.followed).length,
    totalSeries: data.series.length,
    unlinked: data.series.filter((s) => !s.tmdbId).length,
    demo: data.series.filter((s) => s.demo).length,
    watchedEpisodes: watched.length,
    airedEpisodes: aired.length,
    hours: Math.round((minutes / 60) * 10) / 10,
    platforms: data.platforms.filter((p) => p.active).length,
    lists: data.lists.length,
    unread: unreadCount(data)
  };
}

module.exports = {
  DAY,
  todayISO,
  isAired,
  isRecent,
  isWatched,
  episodesOf,
  seasonsOf,
  platformsOf,
  nextUnwatched,
  summarize,
  decorate,
  listSeries,
  seriesDetail,
  setEpisodeWatched,
  setSeasonWatched,
  setSeriesWatched,
  createList,
  deleteList,
  renameList,
  addToList,
  removeFromList,
  toggleListMembership,
  savePlatform,
  deletePlatform,
  reorderPlatforms,
  replaceSeriesContent,
  applyTmdbMetadata,
  slugify,
  pushNotification,
  unreadCount,
  localSearch,
  stats
};
