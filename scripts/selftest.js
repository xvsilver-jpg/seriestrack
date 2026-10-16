'use strict';

/**
 * Autoprueba sin interfaz gráfica.
 * Ejecuta: node scripts/selftest.js
 *
 * Comprueba la cadena completa: semilla -> dominio -> detección de
 * episodios nuevos -> notificaciones -> listas -> plataformas personalizadas.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const Store = require('../src/store');
const seed = require('../src/seed');
const catalog = require('../src/catalog');
const scheduler = require('../src/scheduler');

let failures = 0;

function check(label, condition, detail = '') {
  const ok = !!condition;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seriestrack-test-'));
  const store = new Store(dir);
  const data = store.load(seed.defaults);

  console.log('\n== Persistencia ==');
  check('el archivo de datos se crea', fs.existsSync(store.file));
  check('catálogo semilla cargado', data.series.length >= 10, `${data.series.length} series`);
  check('episodios generados', data.episodes.length > 100, `${data.episodes.length} episodios`);
  check('plataformas preconfiguradas', data.platforms.length >= 10, `${data.platforms.length}`);
  check('listas del sistema', data.lists.filter((l) => l.kind !== 'custom').length === 2);

  console.log('\n== Dominio ==');
  const tlou = data.series.find((s) => s.id === 'tlou');
  const detail = catalog.seriesDetail(data, 'tlou');
  check('detalle de serie', detail && detail.seasons.length === 2, `${detail?.seasons.length} temporadas`);
  check('resumen con progreso', detail.progress.total > 0, `${detail.progress.watched}/${detail.progress.total}`);
  check('plataforma asignada', detail.platforms.length > 0, detail.platforms.map((p) => p.name).join(', '));

  const firstEp = catalog.episodesOf(data, 'tlou')[0];
  catalog.setEpisodeWatched(data, firstEp.id, false);
  check('desmarcar episodio', !catalog.isWatched(data, firstEp.id));
  catalog.setEpisodeWatched(data, firstEp.id, true);
  check('marcar episodio', catalog.isWatched(data, firstEp.id));

  const before = catalog.summarize(data, tlou).watched;
  catalog.setSeasonWatched(data, 'tlou', 1, false);
  check('desmarcar temporada completa', catalog.summarize(data, tlou).watched < before);

  console.log('\n== Listas ==');
  const list = catalog.createList(data, 'Pruebas', 'custom');
  catalog.addToList(data, list.id, 'fallout');
  check('añadir a lista', catalog.listSeries(data, { listId: list.id }).length === 1);
  catalog.toggleListMembership(data, list.id, 'fallout');
  check('quitar de lista', catalog.listSeries(data, { listId: list.id }).length === 0);
  check('no se puede borrar una lista del sistema', catalog.deleteList(data, 'favorites') === false);
  check('sí se puede borrar una lista propia', catalog.deleteList(data, list.id) === true);

  console.log('\n== Plataformas personalizadas ==');
  const custom = catalog.savePlatform(data, { name: 'Mi Plataforma Ñ', domain: 'miplata.es', color: '#00C2A8' });
  check('plataforma creada con slug válido', custom.id === 'mi-plataforma-n', custom.id);
  check('marcada como personalizada', custom.custom === true);
  catalog.savePlatform(data, { id: custom.id, name: 'Mi Plataforma ES' });
  check('plataforma editada', data.platforms.find((p) => p.id === custom.id).name === 'Mi Plataforma ES');
  check('plataforma personalizada eliminable', catalog.deletePlatform(data, custom.id) === true);
  let threw = false;
  try { catalog.deletePlatform(data, 'netflix'); } catch { threw = true; }
  check('las preconfiguradas no se eliminan', threw);

  console.log('\n== Búsqueda ==');
  check('búsqueda local encuentra resultados', catalog.localSearch(data, 'last').length > 0);
  check('búsqueda sin resultados', catalog.localSearch(data, 'zzzzzz').length === 0);

  console.log('\n== Motor de seguimiento y notificaciones ==');
  const seen = [];
  const summary = await scheduler.sync(data, { notify: (n) => seen.push(n), log: () => {} });
  check('sincronización sin clave usa modo local', summary.mode === 'local');
  check('se detectan episodios recientes', summary.newEpisodes > 0, `${summary.newEpisodes} nuevos`);
  check('se generan notificaciones', data.notifications.length === summary.newEpisodes);
  check('se avisa al sistema', seen.length > 0, `${seen.length} avisos`);

  const second = await scheduler.sync(data, { notify: () => {}, log: () => {} });
  check('no se duplican notificaciones', second.newEpisodes === 0, `${second.newEpisodes} en la 2ª pasada`);

  const upcoming = scheduler.upcoming(data, 60);
  check('hay próximos estrenos', upcoming.length > 0, `${upcoming.length} en 60 días`);
  check('próximos estrenos ordenados', upcoming.every((u, i) => i === 0 || upcoming[i - 1].airDate <= u.airDate));

  console.log('\n== Horas de silencio ==');
  check('desactivadas por defecto', scheduler.inQuietHours({ quietHours: { enabled: false } }) === false);
  const q = { quietHours: { enabled: true, from: '00:00', to: '23:59' } };
  check('franja amplia silencia', scheduler.inQuietHours(q, new Date()) === true);

  console.log('\n== Vinculación con TMDB ==');
  const demoSeries = data.series.find((s) => s.id === 'severance');
  const fakeBuilt = {
    series: {
      tmdbId: 95396,
      title: 'Severance',
      originalTitle: 'Severance',
      synopsis: 'Sinopsis real de TMDB.',
      poster: 'https://image.tmdb.org/t/p/w342/poster-real.jpg',
      backdrop: null,
      year: 2022,
      genres: ['Drama', 'Misterio'],
      rating: 8.7,
      status: 'Returning Series',
      platformIds: ['apple'],
      providerLink: 'https://www.themoviedb.org/tv/95396/watch'
    },
    seasons: [{ id: 'x-s1', seriesId: 'x', number: 1, episodeCount: 10 }],
    episodes: Array.from({ length: 10 }, (_, i) => ({
      id: `x-s1e${i + 1}`,
      seriesId: 'x',
      season: 1,
      number: i + 1,
      title: `Episodio real ${i + 1}`,
      airDate: '2022-02-18',
      runtime: 50,
      overview: ''
    }))
  };

  catalog.applyTmdbMetadata(demoSeries, fakeBuilt.series);
  check('metadatos de TMDB aplicados', demoSeries.tmdbId === 95396 && demoSeries.demo === false);
  check('carátula real asignada', /poster-real/.test(demoSeries.poster));

  const linkResult = catalog.replaceSeriesContent(data, demoSeries, fakeBuilt);
  check('episodios sustituidos por los reales', linkResult.newCount === 10, `${linkResult.previousCount} -> ${linkResult.newCount}`);
  check('progreso conservado por temporada/episodio', linkResult.restored === 9, `${linkResult.restored} restaurados`);
  check('los episodios usan el id local de la serie', data.episodes.some((e) => e.id === 'severance-s1e1'));
  check('el progreso apunta al id nuevo', catalog.isWatched(data, 'severance-s1e1'));
  check('ya no quedan episodios viejos', !data.episodes.some((e) => e.id === 'severance-s2e10'));
  check('las notificaciones de la serie se limpian', !data.notifications.some((n) => n.seriesId === 'severance'));

  console.log('\n== Estadísticas ==');
  const stats = catalog.stats(data);
  check('estadísticas coherentes', stats.totalSeries === data.series.length && stats.watchedEpisodes >= 0,
    `${stats.totalSeries} series, ${stats.watchedEpisodes} eps, ${stats.hours} h`);

  console.log('\n== Persistencia (recarga) ==');
  store.save();
  const store2 = new Store(dir);
  const data2 = store2.load(seed.defaults);
  check('los datos sobreviven a la recarga', data2.notifications.length === data.notifications.length);
  check('el progreso sobrevive a la recarga', Object.keys(data2.progress).length === Object.keys(data.progress).length);

  fs.rmSync(dir, { recursive: true, force: true });

  console.log(`\n${failures === 0 ? '✅ TODAS LAS PRUEBAS PASARON' : `❌ ${failures} PRUEBA(S) FALLARON`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Error inesperado en la autoprueba:', err);
  process.exit(1);
});
