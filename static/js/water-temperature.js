// Measured water temperatures from the public mission feed; no additional fetches.
(function(root) {
  'use strict';
  // Match the private app's palette and its measured-range normalization.
  const stops = [[0, '#3855b8'], [.25, '#16bdce'], [.5, '#83dd55'], [.75, '#ffb139'], [1, '#c72b36']];
  const hasReading = p => typeof p.water_temp_c === 'number' && Number.isFinite(p.water_temp_c);
  function scale(positions) {
    let lo = Infinity, hi = -Infinity;
    for (const p of positions) if (hasReading(p)) {
      lo = Math.min(lo, p.water_temp_c); hi = Math.max(hi, p.water_temp_c);
    }
    if (lo === Infinity) return [0, 1];
    return lo === hi ? [lo - .5, hi + .5] : [lo, hi];
  }
  function color(temp, range) {
    const t = Math.max(0, Math.min(1, (temp - range[0]) / (range[1] - range[0])));
    let i = 1;
    while (i < stops.length - 1 && t > stops[i][0]) i++;
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], f = (t - a) / (b - a);
    const rgb = c => [1, 3, 5].map(j => parseInt(c.slice(j, j + 2), 16));
    const from = rgb(ca), to = rgb(cb);
    return '#' + from.map((v, j) => Math.round(v + (to[j] - v) * f).toString(16).padStart(2, '0')).join('');
  }
  function label(p) {
    const date = new Date(p.epoch * 1000).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'});
    return date + ' ' + (hasReading(p) ? `${Math.round(p.water_temp_c)}C/${Math.round(p.water_temp_c * 1.8 + 32)}F` : '—');
  }

  function createOverlay(map, positions) {
    const range = scale(positions);
    let layers = null;
    function buildLayers() {
      const result = [];
      let previous = -1;
      positions.forEach((p, i) => {
        if (!hasReading(p)) return;
        if (previous >= 0) {
          // Keep every intervening position fix and use the same geodesic renderer as
          // the base track, so colors stay aligned at every zoom and map projection.
          const path = positions.slice(previous, i + 1).map(p => ({lat: p.lat, lng: p.lng}));
          const stroke = color((positions[previous].water_temp_c + p.water_temp_c) / 2, range);
          for (const outline of [true, false]) {
            result.push(new google.maps.Polyline({
              path, geodesic: true, clickable: false,
              strokeColor: outline ? '#ffffff' : stroke,
              strokeOpacity: outline ? .73 : 1,
              strokeWeight: outline ? 8 : 6, zIndex: outline ? 3 : 4,
            }));
          }
        }
        // Show single/stationary measurements as well as connected readings.
        result.push(new google.maps.Marker({
          position: {lat: p.lat, lng: p.lng}, clickable: false,
          icon: {path: google.maps.SymbolPath.CIRCLE, scale: 3,
            fillColor: color(p.water_temp_c, range), fillOpacity: 1, strokeWeight: 0},
          zIndex: 2,
        }));
        previous = i;
      });
      return result;
    }
    return {
      setMap(nextMap) {
        if (nextMap && !layers) layers = buildLayers();
        for (const layer of layers || []) layer.setMap(nextMap);
      },
    };
  }
  const api = {hasReading, scale, color, label, createOverlay};
  root.TrackWaterTemperature = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
