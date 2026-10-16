'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  bootstrap: () => invoke('app:bootstrap'),

  series: {
    list: (opts) => invoke('series:list', opts),
    detail: (seriesId) => invoke('series:detail', seriesId),
    search: (query) => invoke('series:search', query),
    addTmdb: (tmdbId) => invoke('series:addTmdb', tmdbId),
    addManual: (input) => invoke('series:addManual', input),
    linkTmdb: (seriesId) => invoke('series:linkTmdb', seriesId),
    linkCatalog: () => invoke('series:linkCatalog'),
    follow: (seriesId, followed) => invoke('series:follow', seriesId, followed),
    setPlatforms: (seriesId, platformIds) => invoke('series:setPlatforms', seriesId, platformIds),
    remove: (seriesId) => invoke('series:delete', seriesId),
    markAll: (seriesId, watched) => invoke('series:markAll', seriesId, watched)
  },

  episodes: {
    toggle: (episodeId, watched) => invoke('episode:toggle', episodeId, watched),
    markSeason: (seriesId, season, watched) => invoke('season:mark', seriesId, season, watched)
  },

  lists: {
    create: (name) => invoke('list:create', name),
    rename: (listId, name) => invoke('list:rename', listId, name),
    remove: (listId) => invoke('list:delete', listId),
    toggle: (listId, seriesId) => invoke('list:toggle', listId, seriesId)
  },

  platforms: {
    save: (input) => invoke('platform:save', input),
    remove: (platformId) => invoke('platform:delete', platformId),
    toggle: (platformId, active) => invoke('platform:toggle', platformId, active),
    reorder: (orderedIds) => invoke('platform:reorder', orderedIds)
  },

  settings: {
    save: (patch) => invoke('settings:save', patch)
  },

  sync: {
    now: () => invoke('sync:now'),
    upcoming: (days) => invoke('app:upcoming', days)
  },

  notifications: {
    list: () => invoke('notifications:list'),
    read: (ids) => invoke('notifications:read', ids),
    remove: (id) => invoke('notifications:remove', id),
    clear: () => invoke('notifications:clear')
  },

  system: {
    open: (url) => invoke('shell:open', url),
    reset: () => invoke('app:reset'),
    openDataFolder: () => invoke('app:openDataFolder')
  },

  images: {
    info: () => invoke('images:info'),
    clear: () => invoke('images:clear'),
    openFolder: () => invoke('images:open')
  },

  on: (channel, callback) => {
    const allowed = ['data:changed', 'settings:changed', 'navigate', 'toast'];
    if (!allowed.includes(channel)) return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
