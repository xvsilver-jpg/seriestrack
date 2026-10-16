#!/usr/bin/env node
'use strict';

/**
 * Configura la clave de API de TMDB sin abrir la aplicación.
 *
 * Uso:  node scripts/set-tmdb-key.js <clave>
 *       node scripts/set-tmdb-key.js --show
 *       node scripts/set-tmdb-key.js --clear
 *
 * Escribe en el archivo de datos de SeriesTrack, el mismo que usa la app
 * (%APPDATA%\SeriesTrack\seriestrack-data.json).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const dataFile = path.join(os.homedir(), 'AppData', 'Roaming', 'SeriesTrack', 'seriestrack-data.json');

function read() {
  if (!fs.existsSync(dataFile)) {
    console.error(`No se encontró el archivo de datos:\n  ${dataFile}\nAbre SeriesTrack al menos una vez.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function write(data) {
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, dataFile);
}

const arg = process.argv[2];

if (!arg) {
  console.error('Uso: node scripts/set-tmdb-key.js <clave> | --show | --clear');
  process.exit(1);
}

const data = read();

if (arg === '--show') {
  const key = data.settings.tmdbApiKey;
  console.log(key ? `Clave configurada: ${key.slice(0, 6)}…${key.slice(-4)}` : 'Sin clave configurada.');
  process.exit(0);
}

if (arg === '--clear') {
  data.settings.tmdbApiKey = '';
  write(data);
  console.log('Clave eliminada.');
  process.exit(0);
}

data.settings.tmdbApiKey = arg.trim();
write(data);
console.log(`Clave guardada en ${dataFile}`);
console.log('Abre SeriesTrack y pulsa «Sincronizar», o usa «Vincular catálogo con TMDB» en Configuración.');
