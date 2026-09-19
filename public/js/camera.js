// Opening camera — frames the player's country when a game begins.
// The map never changes game data; this module only chooses what to show.

export function playerHomeTerritory(state) {
  return state?.nations?.[state.player]?.home || null;
}

export function playerOwnedTerritories(state) {
  const tag = state?.player;
  if (!tag || !state.territories) return [];
  return Object.entries(state.territories)
    .filter(([, t]) => t.owner === tag)
    .map(([name]) => name);
}

export function initialFocusTerritories(state) {
  const owned = playerOwnedTerritories(state);
  const home = playerHomeTerritory(state);
  if (home && owned.includes(home)) return [home];
  return owned;
}

export function initialCamera(state, { defaultView = 'world', animate = true } = {}) {
  const territories = initialFocusTerritories(state);
  if (territories.length) return { type: 'focus', territories, animate };
  return { type: 'view', name: defaultView || 'world', animate };
}

export function applyInitialCamera(map, state, opts = {}) {
  const camera = initialCamera(state, opts);
  if (camera.type === 'focus' && map.focus(camera.territories, camera.animate)) return camera;
  const name = camera.type === 'view' ? camera.name : (opts.defaultView || 'world');
  map.view(name, camera.animate);
  return { type: 'view', name, animate: camera.animate };
}
