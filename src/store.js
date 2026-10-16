'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Almacén JSON con escritura atómica.
 * Todo el estado de SeriesTrack vive en un único archivo dentro de userData.
 */
class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'seriestrack-data.json');
    this.data = null;
  }

  load(defaultsFactory) {
    fs.mkdirSync(this.dir, { recursive: true });
    let loaded = null;
    try {
      loaded = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (err) {
      loaded = null;
    }

    if (!loaded || typeof loaded !== 'object') {
      this.data = defaultsFactory();
      this.save();
      return this.data;
    }

    // Rellenar claves que falten (migración suave entre versiones)
    const base = defaultsFactory();
    for (const key of Object.keys(base)) {
      if (loaded[key] === undefined) loaded[key] = base[key];
    }
    if (!loaded.settings || typeof loaded.settings !== 'object') loaded.settings = base.settings;
    for (const key of Object.keys(base.settings)) {
      if (loaded.settings[key] === undefined) loaded.settings[key] = base.settings[key];
    }

    this.data = loaded;
    return this.data;
  }

  save() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  reset(defaultsFactory) {
    this.data = defaultsFactory();
    this.save();
    return this.data;
  }
}

module.exports = Store;
