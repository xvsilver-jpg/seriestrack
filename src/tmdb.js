'use strict';

/**
 * Cliente de TMDB (The Movie Database).
 *
 * Es la fuente de datos REAL de la aplicación: metadatos en español, listado
 * completo de temporadas/episodios con fechas de estreno y disponibilidad por
 * país (watch/providers). Requiere una clave de API gratuita que el usuario
 * introduce en Configuración > Fuentes de datos.
 */

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

/** Nombres de proveedor de TMDB -> id de plataforma interna. */
const PROVIDER_MAP = [
  [/netflix/i, 'netflix'],
  [/hbo|max/i, 'hbo'],
  [/disney/i, 'disney'],
  [/amazon|prime video/i, 'prime'],
  [/apple\s*tv/i, 'apple'],
  [/movistar/i, 'movistar'],
  [/skyshowtime/i, 'skyshowtime'],
  [/filmin/i, 'filmin'],
  [/atresplayer|atres/i, 'atresplayer'],
  [/rtve|radiotelevisi/i, 'rtve'],
  [/crunchyroll/i, 'crunchyroll'],
  [/rakuten/i, 'rakuten']
];

function providerToPlatformId(name) {
  for (const [re, id] of PROVIDER_MAP) if (re.test(name)) return id;
  return null;
}

function imageUrl(filePath, size = 'w342') {
  return filePath ? `${IMG}/${size}${filePath}` : null;
}

async function request(apiKey, endpoint, params = {}) {
  if (!apiKey) throw new Error('Falta la clave de API de TMDB.');
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (res.status === 401) throw new Error('Clave de TMDB no válida (401).');
    if (res.status === 404) throw new Error('Recurso no encontrado en TMDB (404).');
    if (!res.ok) throw new Error(`TMDB respondió ${res.status}.`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('TMDB tardó demasiado en responder.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function searchTv(apiKey, query, language = 'es-ES') {
  const data = await request(apiKey, '/search/tv', { query, language, include_adult: 'false' });
  return (data.results || []).map((r) => ({
    tmdbId: r.id,
    title: r.name || r.original_name,
    originalTitle: r.original_name,
    year: r.first_air_date ? Number(r.first_air_date.slice(0, 4)) : null,
    firstAirDate: r.first_air_date || null,
    synopsis: r.overview || '',
    poster: imageUrl(r.poster_path),
    backdrop: imageUrl(r.backdrop_path, 'w1280'),
    rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
    source: 'tmdb'
  }));
}

async function getTv(apiKey, tmdbId, language = 'es-ES') {
  return request(apiKey, `/tv/${tmdbId}`, { language });
}

async function getSeason(apiKey, tmdbId, seasonNumber, language = 'es-ES') {
  return request(apiKey, `/tv/${tmdbId}/season/${seasonNumber}`, { language });
}

async function getWatchProviders(apiKey, tmdbId, region = 'ES') {
  const data = await request(apiKey, `/tv/${tmdbId}/watch/providers`);
  const regional = (data.results || {})[region] || {};
  const groups = ['flatrate', 'free', 'ads', 'rent', 'buy'];
  const out = [];
  for (const group of groups) {
    for (const provider of regional[group] || []) {
      const platformId = providerToPlatformId(provider.provider_name);
      out.push({
        platformId,
        providerName: provider.provider_name,
        group,
        link: regional.link || null
      });
    }
  }
  return { link: regional.link || null, providers: out };
}

/**
 * Convierte una serie de TMDB al modelo interno, incluyendo todas las
 * temporadas y episodios (con sus fechas de estreno reales).
 */
async function buildSeriesFromTmdb(apiKey, tmdbId, opts = {}) {
  const language = opts.language || 'es-ES';
  const region = opts.region || 'ES';

  const tv = await getTv(apiKey, tmdbId, language);
  const providers = await getWatchProviders(apiKey, tmdbId, region).catch(() => ({ providers: [] }));

  const platformIds = [...new Set(providers.providers.map((p) => p.platformId).filter(Boolean))];

  const series = {
    id: `tmdb-${tmdbId}`,
    tmdbId,
    title: tv.name || tv.original_name,
    originalTitle: tv.original_name,
    synopsis: tv.overview || '',
    poster: imageUrl(tv.poster_path),
    backdrop: imageUrl(tv.backdrop_path, 'w1280'),
    year: tv.first_air_date ? Number(tv.first_air_date.slice(0, 4)) : null,
    genres: (tv.genres || []).map((g) => g.name),
    rating: tv.vote_average ? Math.round(tv.vote_average * 10) / 10 : null,
    status: tv.status || 'Desconocido',
    totalSeasons: tv.number_of_seasons || 0,
    platformIds,
    providerLink: providers.link,
    followed: opts.followed !== false,
    demo: false,
    addedAt: new Date().toISOString(),
    lastNewAt: null
  };

  const seasons = [];
  const episodes = [];
  const seasonNumbers = (tv.seasons || [])
    .filter((s) => s.season_number > 0)
    .map((s) => s.season_number);

  for (const n of seasonNumbers) {
    let seasonData;
    try {
      seasonData = await getSeason(apiKey, tmdbId, n, language);
    } catch {
      continue;
    }
    const eps = (seasonData.episodes || []).map((e) => ({
      id: `${series.id}-s${n}e${e.episode_number}`,
      seriesId: series.id,
      season: n,
      number: e.episode_number,
      title: e.name || `Episodio ${e.episode_number}`,
      airDate: e.air_date || null,
      runtime: e.runtime || 0,
      overview: e.overview || '',
      still: imageUrl(e.still_path, 'w300')
    }));
    episodes.push(...eps);
    seasons.push({ id: `${series.id}-s${n}`, seriesId: series.id, number: n, episodeCount: eps.length });
  }

  return { series, seasons, episodes };
}

function normalizeTitle(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Busca la mejor coincidencia en TMDB para un título local.
 * Puntúa por similitud de nombre y cercanía del año de estreno.
 */
async function findBestMatch(apiKey, { title, year }, language = 'es-ES') {
  const results = await searchTv(apiKey, title, language);
  if (!results.length) return null;

  const target = normalizeTitle(title);
  let best = null;
  let bestScore = -Infinity;

  for (const result of results) {
    // Se compara con el título localizado y con el original: TMDB puede
    // devolver el título en español ("Separación") cuando buscas el inglés.
    const names = [normalizeTitle(result.title), normalizeTitle(result.originalTitle)].filter(Boolean);

    let score = 0;
    for (const name of names) {
      if (name === target) score = Math.max(score, 100);
      else if (name.startsWith(target) || target.startsWith(name)) score = Math.max(score, 60);
      else if (name.includes(target) || target.includes(name)) score = Math.max(score, 30);
    }

    if (year && result.year) score -= Math.min(40, Math.abs(result.year - year) * 4);

    if (score > bestScore) {
      bestScore = score;
      best = result;
    }
  }

  // Si solo hay un resultado y el año encaja, se acepta aunque el título
  // esté traducido de forma muy distinta.
  if (bestScore < 30 && results.length === 1) {
    const only = results[0];
    if (!year || !only.year || Math.abs(only.year - year) <= 1) return only;
  }

  return bestScore >= 30 ? best : null;
}

module.exports = {
  searchTv,
  getTv,
  getSeason,
  getWatchProviders,
  buildSeriesFromTmdb,
  findBestMatch,
  providerToPlatformId,
  imageUrl
};
