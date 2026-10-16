'use strict';

/**
 * Catálogo semilla de SeriesTrack.
 *
 * IMPORTANTE: este catálogo es de DEMOSTRACIÓN. Sirve para que la aplicación
 * funcione y se vea completa nada más instalarla, sin necesidad de claves ni
 * conexión. Para datos reales y actualizados, el usuario añade una clave de
 * TMDB en Configuración > Fuentes de datos y pulsa "Sincronizar ahora".
 */

const PLATFORMS = [
  { id: 'netflix',    name: 'Netflix',          short: 'N',  color: '#E50914', domain: 'netflix.com',        custom: false, active: true,  priority: 1 },
  { id: 'hbo',        name: 'HBO Max',          short: 'HBO', color: '#7B2FF7', domain: 'hbomax.com',         custom: false, active: true,  priority: 2 },
  { id: 'disney',     name: 'Disney+',          short: 'D+', color: '#113CCF', domain: 'disneyplus.com',     custom: false, active: true,  priority: 3 },
  { id: 'prime',      name: 'Prime Video',      short: 'PV', color: '#00A8E1', domain: 'primevideo.com',     custom: false, active: true,  priority: 4 },
  { id: 'apple',      name: 'Apple TV+',        short: '', color: '#4A4A4F', domain: 'tv.apple.com',       custom: false, active: true,  priority: 5 },
  { id: 'movistar',   name: 'Movistar Plus+',   short: 'M+', color: '#019DF4', domain: 'movistarplus.es',    custom: false, active: true,  priority: 6 },
  { id: 'skyshowtime',name: 'SkyShowtime',      short: 'SS', color: '#0C4DA2', domain: 'skyshowtime.com',    custom: false, active: true,  priority: 7 },
  { id: 'filmin',     name: 'Filmin',           short: 'F',  color: '#00B7A1', domain: 'filmin.es',          custom: false, active: true,  priority: 8 },
  { id: 'atresplayer',name: 'Atresplayer',      short: 'A3', color: '#00A0DF', domain: 'atresplayer.com',    custom: false, active: true,  priority: 9 },
  { id: 'rtve',       name: 'RTVE Play',        short: 'R',  color: '#0B5EA8', domain: 'rtve.es',            custom: false, active: true,  priority: 10 },
  { id: 'crunchyroll',name: 'Crunchyroll',      short: 'CR', color: '#F47521', domain: 'crunchyroll.com',    custom: false, active: true,  priority: 11 },
  { id: 'rakuten',    name: 'Rakuten TV',       short: 'RTV',color: '#BF0000', domain: 'rakuten.tv',         custom: false, active: false, priority: 12 }
];

function buildEpisodes(seriesId, seasons) {
  const out = [];
  for (const s of seasons) {
    s.titles.forEach((title, i) => {
      const d = new Date(s.start + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + i * 7);
      out.push({
        id: `${seriesId}-s${s.n}e${i + 1}`,
        seriesId,
        season: s.n,
        number: i + 1,
        title,
        airDate: d.toISOString().slice(0, 10),
        runtime: s.runtime || 50,
        overview: ''
      });
    });
  }
  return out;
}

const CATALOG = [
  {
    key: 'tlou', title: 'The Last of Us', year: 2023, rating: 8.7,
    genres: ['Drama', 'Ciencia ficción'], platforms: ['hbo'], followed: true,
    synopsis: 'Veinte años después de la destrucción de la civilización, un superviviente endurecido acepta escoltar a una adolescente que puede ser la última esperanza de la humanidad.',
    seasons: [
      { n: 1, runtime: 58, start: '2023-01-15', titles: ['When You\'re Lost in the Darkness', 'Infected', 'Long, Long Time', 'Kin', 'Endure and Survive', 'Kin', 'Left Behind', 'When We Are in Need', 'Look for the Light'] },
      { n: 2, runtime: 55, start: '2025-04-13', titles: ['Future Days', 'Through the Valley', 'The Path', 'Day One', 'Feel Her Love', 'The Price', 'Convergence'] }
    ]
  },
  {
    key: 'severance', title: 'Severance', year: 2022, rating: 8.7,
    genres: ['Drama', 'Misterio', 'Ciencia ficción'], platforms: ['apple'], followed: true,
    synopsis: 'Empleados de Lumon Industries se someten a un procedimiento que separa quirúrgicamente sus recuerdos laborales de los personales. Pronto descubren que la línea que los divide no es tan clara.',
    seasons: [
      { n: 1, runtime: 50, start: '2022-02-18', titles: ['Good News About Hell', 'Half Loop', 'In Perpetuity', 'The You You Are', 'The Grim Barbarity of Optics and Design', 'Hide and Seek', 'Defiant Jazz', 'What\'s for Dinner?', 'The We We Are'] },
      { n: 2, runtime: 52, start: '2026-09-04', titles: ['Hello, Ms. Cobel', 'Goodbye, Mrs. Selvig', 'Who Is Alive?', 'Woe\'s Hollow', 'Trojan\'s Horse', 'Attila', 'Chikhai Bardo', 'Sweet Vitriol', 'The After Hours', 'Cold Harbor'] }
    ]
  },
  {
    key: 'fallout', title: 'Fallout', year: 2024, rating: 8.4,
    genres: ['Ciencia ficción', 'Aventura', 'Acción'], platforms: ['prime'], followed: true,
    synopsis: 'En un futuro post-apocalíptico, los habitantes de refugios nucleares se ven obligados a volver a la superficie, donde descubren un mundo devastado, extraño y muy violento.',
    seasons: [
      { n: 1, runtime: 62, start: '2024-04-10', titles: ['The End', 'The Target', 'The Head', 'The Ghouls', 'The Past', 'The Trap', 'The Radio', 'The Beginning'] }
    ]
  },
  {
    key: 'thebear', title: 'The Bear', year: 2022, rating: 8.6,
    genres: ['Drama', 'Comedia'], platforms: ['disney'], followed: true,
    synopsis: 'Un chef de alta cocina regresa a Chicago para hacerse cargo del caótico restaurante familiar tras la muerte de su hermano.',
    seasons: [
      { n: 1, runtime: 30, start: '2022-06-23', titles: ['System', 'Hands', 'Brigade', 'Dogs', 'Sheridan', 'Ceres', 'Review', 'Braciole'] },
      { n: 2, runtime: 32, start: '2023-06-22', titles: ['Beef', 'Pasta', 'Sundae', 'Honeydew', 'Pop', 'Ceres', 'Fishes', 'Forks', 'Omelette', 'The Bear'] },
      { n: 3, runtime: 34, start: '2024-06-27', titles: ['Tomorrow', 'Next', 'Doors', 'Violet', 'Children', 'Napkins', 'Legacy', 'Ice Chips', 'Apologies', 'Forever'] }
    ]
  },
  {
    key: 'lacasadepapel', title: 'La casa de papel', year: 2017, rating: 8.2,
    genres: ['Crimen', 'Thriller', 'Drama'], platforms: ['netflix'], followed: true,
    synopsis: 'Un cerebro enigmático conocido como "El Profesor" recluta a ocho ladrones con alias de ciudades para llevar a cabo el mayor atraco de la historia en la Fábrica de Moneda y Timbre.',
    seasons: [
      { n: 1, runtime: 50, start: '2017-05-02', titles: ['Efectuar lo acordado', 'Imprudencias letales', 'Errar al disparar', 'Cuestión de eficacia', 'Perro come perro', 'Todo pareció insignificante', 'Un momento dulce', 'La deriva', 'El plan de Berlín'] }
    ]
  },
  {
    key: 'strangerthings', title: 'Stranger Things', year: 2016, rating: 8.6,
    genres: ['Ciencia ficción', 'Terror', 'Drama'], platforms: ['netflix'], followed: true,
    synopsis: 'Cuando un niño desaparece en el pequeño pueblo de Hawkins, sus amigos descubren una conspiración gubernamental, fuerzas sobrenaturales y a una niña muy extraña.',
    seasons: [
      { n: 1, runtime: 50, start: '2016-07-15', titles: ['Will', 'La chica rara', 'Holly, Jolly', 'El cuerpo', 'La pulga y el acróbata', 'El monstruo', 'El baño de la piscina', 'El mundo del revés'] },
      { n: 2, runtime: 55, start: '2017-10-27', titles: ['Trick or Treat, Freak', 'Maps', 'The Pollywog', 'Will the Wise', 'Dig Dug', 'The Spy', 'The Lost Sister', 'The Mind Flayer', 'The Gate'] }
    ]
  },
  {
    key: 'dark', title: 'Dark', year: 2017, rating: 8.7,
    genres: ['Misterio', 'Ciencia ficción', 'Drama'], platforms: ['netflix'], followed: true,
    synopsis: 'La desaparición de dos niños en un pueblo alemán desvela los secretos y las conexiones ocultas entre cuatro familias que se extienden a lo largo de varias generaciones.',
    seasons: [
      { n: 1, runtime: 55, start: '2017-12-01', titles: ['Secretos', 'Mentiras', 'Pasado y presente', 'Dobleces', 'Verdades', 'Ciclos', 'Cruces', 'Así como es arriba, es abajo', 'Todo es ahora', 'Alfa y Omega'] }
    ]
  },
  {
    key: 'succession', title: 'Succession', year: 2018, rating: 8.9,
    genres: ['Drama'], platforms: ['hbo'], followed: true,
    synopsis: 'La familia Roy, propietaria de uno de los mayores conglomerados de medios del mundo, libra una guerra despiadada por el control de la empresa mientras su patriarca envejece.',
    seasons: [
      { n: 1, runtime: 60, start: '2018-06-03', titles: ['Celebration', 'Shit Show at the Fuck Factory', 'Lifeboats', 'Sad Sack Wasp Trap', 'I Went to Market', 'Which Side Are You On?', 'Austerlitz', 'Prague', 'Pre-Nuptial', 'Nobody Is Ever Missing'] }
    ]
  },
  {
    key: 'lupin', title: 'Lupin', year: 2021, rating: 7.5,
    genres: ['Crimen', 'Misterio', 'Drama'], platforms: ['netflix'], followed: true,
    synopsis: 'Inspirado por las aventuras de Arsène Lupin, el ladrón de guante blanco Assane Diop se propone vengar a su padre de una familia adinerada que lo incriminó.',
    seasons: [
      { n: 1, runtime: 45, start: '2021-01-08', titles: ['Capítulo 1', 'Capítulo 2', 'Capítulo 3', 'Capítulo 4', 'Capítulo 5'] }
    ]
  },
  {
    key: 'visavis', title: 'Vis a vis', year: 2015, rating: 8.1,
    genres: ['Drama', 'Crimen'], platforms: ['netflix'], followed: false,
    synopsis: 'Una joven ingenua entra en prisión por desfalco y descubre un mundo brutal donde debe aprender a sobrevivir mientras planea su venganza.',
    seasons: [
      { n: 1, runtime: 70, start: '2015-04-20', titles: ['Un día de perros', 'Causa y efecto', 'La teoría del todo', 'La otra verdad', 'A la mierda el mundo', 'El fondo del pozo', 'Mala leche', 'La última noche'] }
    ]
  },
  {
    key: 'elitemp', title: 'El Ministerio del Tiempo', year: 2015, rating: 8.2,
    genres: ['Ciencia ficción', 'Aventura', 'Historia'], platforms: ['rtve', 'movistar'], followed: false,
    synopsis: 'Una patrulla secreta del gobierno español viaja al pasado para evitar que intrusos del futuro alteren la historia del país.',
    seasons: [
      { n: 1, runtime: 65, start: '2015-02-24', titles: ['El tiempo es el que es', 'Cómo se reescribe el tiempo', 'La llave del tiempo', 'Una negociación a tiempo', 'La primera misión de una mujer', 'Sangre de mayo', 'El tiempo de los valientes', 'La puerta del tiempo'] }
    ]
  },
  {
    key: 'elite', title: 'Élite', year: 2018, rating: 7.2,
    genres: ['Drama', 'Misterio'], platforms: ['netflix'], followed: false,
    synopsis: 'Tres estudiantes becados llegan a un exclusivo colegio privado donde el choque de clases termina en un crimen que todos quieren ocultar.',
    seasons: [
      { n: 1, runtime: 50, start: '2018-10-05', titles: ['Bienvenidos', 'Deseo', 'Sábado por la noche', 'El amor es una droga', 'Todos mienten', 'Todo va a salir bien', 'Todo estalla', 'Assilah'] }
    ]
  },
  {
    key: 'truedetective', title: 'True Detective', year: 2014, rating: 8.9,
    genres: ['Crimen', 'Drama', 'Misterio'], platforms: ['hbo'], followed: false,
    synopsis: 'Una antología de investigaciones criminales donde cada temporada sigue a detectives distintos enfrentándose a casos que los marcan para siempre.',
    seasons: [
      { n: 1, runtime: 55, start: '2014-01-12', titles: ['The Long Bright Dark', 'Seeing Things', 'The Locked Room', 'Who Goes There', 'The Secret Fate of All Life', 'Haunted Houses', 'After You\'ve Gone', 'Form and Void'] }
    ]
  },
  {
    key: 'lanque', title: 'La que se avecina', year: 2007, rating: 7.0,
    genres: ['Comedia'], platforms: ['prime'], followed: false,
    synopsis: 'Los vecinos de la comunidad de propietarios de Montepinar viven todo tipo de enredos y situaciones absurdas en su día a día.',
    seasons: [
      { n: 15, runtime: 80, start: '2026-09-08', titles: ['Un bautizo, una okupa y un bikini de premio', 'Un armario ropero, un tarotista y un vecino en pelotas', 'Un disfraz de carnaval, un perro salchicha y un divorcio exprés', 'Una cata de vinos, un alijo y una amistad peligrosa', 'Una boda exprés, un torero y una invasión de cucarachas', 'Un concurso de talentos, una herencia y un secreto inconfesable'] }
    ]
  },
  {
    key: 'berlin', title: 'Berlín', year: 2023, rating: 7.3,
    genres: ['Crimen', 'Thriller', 'Drama'], platforms: ['netflix'], followed: true,
    synopsis: 'Antes del atraco a la Fábrica de Moneda, Berlín y su banda se reúnen en París para llevar a cabo su golpe más ambicioso: robar 44 millones en joyas.',
    seasons: [
      { n: 1, runtime: 48, start: '2026-09-25', titles: ['El golpe de las joyas', 'La casa de subastas', 'Un invitado inesperado', 'Cuarenta y cuatro millones', 'La trampa de París', 'Todo o nada', 'La huida', 'El último beso'] }
    ]
  }
];

function build() {
  const series = [];
  const seasons = [];
  const episodes = [];

  for (const c of CATALOG) {
    const id = c.key;
    series.push({
      id,
      tmdbId: null,
      title: c.title,
      originalTitle: c.title,
      synopsis: c.synopsis,
      poster: null,
      backdrop: null,
      year: c.year,
      genres: c.genres,
      rating: c.rating,
      status: 'En emisión',
      platformIds: c.platforms,
      followed: !!c.followed,
      demo: true,
      addedAt: new Date().toISOString(),
      lastNewAt: null
    });

    for (const s of c.seasons) {
      seasons.push({ id: `${id}-s${s.n}`, seriesId: id, number: s.n, episodeCount: s.titles.length });
    }
    episodes.push(...buildEpisodes(id, c.seasons));
  }

  return { series, seasons, episodes };
}

function defaults() {
  const { series, seasons, episodes } = build();

  // Progreso inicial de demostración: algunas series a medias, otras al día.
  const today = new Date();
  const progress = {};
  const plan = {
    tlou: { s1: 9, s2: 2 },
    severance: { s1: 9, s2: 3 },
    fallout: { s1: 5 },
    thebear: { s1: 8, s2: 10, s3: 4 },
    lacasadepapel: { s1: 9 },
    strangerthings: { s1: 8, s2: 3 },
    dark: { s1: 10 },
    succession: { s1: 6 },
    lupin: { s1: 5 },
    berlin: { s1: 2 }
  };

  for (const ep of episodes) {
    const p = plan[ep.seriesId];
    if (p && p[`s${ep.season}`] >= ep.number) {
      progress[ep.id] = { watched: true, watchedAt: new Date(today.getTime() - 86400000 * 3).toISOString(), seconds: 0 };
    }
  }

  return {
    settings: {
      tmdbApiKey: '',
      region: 'ES',
      language: 'es-ES',
      syncIntervalMinutes: 60,
      notificationsEnabled: true,
      quietHours: { enabled: false, from: '23:00', to: '08:00' },
      digestThreshold: 5,
      theme: 'dark',
      density: 'comfortable',
      startMinimized: false,
      minimizeToTray: true,
      lastSync: null,
      showDemoBanner: true
    },
    platforms: PLATFORMS.map((p) => ({ ...p })),
    lists: [
      { id: 'favorites', name: 'Favoritas', kind: 'favorite', seriesIds: ['tlou', 'severance', 'succession', 'dark'] },
      { id: 'pending', name: 'Pendientes', kind: 'pending', seriesIds: ['fallout', 'elitemp', 'lanque'] }
    ],
    series,
    seasons,
    episodes,
    progress,
    notifications: [],
    meta: { seededAt: new Date().toISOString(), version: 1 }
  };
}

module.exports = { defaults, PLATFORMS };
