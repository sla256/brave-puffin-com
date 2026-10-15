// Adapted from brave-puffin-backend/web/currents.js for the public tracking map.
// Animated currents; the renderer and hover readout sample the packed u/v grid.
// Public site uses ECMWF only; source selection belongs to the dashboard.
const CURRENTS_SOURCES = {
  ecmwf: {
    label: 'ECMWF IFS', url: 'https://app.bravepuffinrobotics.com/currents-ecmwf.json', daily: false,
    link: 'https://www.ecmwf.int/en/forecasts/datasets/open-data',
    description: 'Forecast surface current, 3-hour step nearest now | Atlantic 0.25° grid',
    staleHours: 12,
  },
};

const CURRENTS_PARTICLE_COUNT = 1238;
const CURRENTS_SPEED_SCALE = 12;   // px/frame moved per m/s of current, at 60fps
const CURRENTS_FADE = 0.02;        // canvas repaint alpha per frame - lower means longer trails
const CURRENTS_PARTICLE_COLOR = '#e6edf3'; // uniform colour; motion alone conveys speed
const CURRENTS_CUTOFF = 0.05;      // m/s - slower than this, a particle just respawns
const CURRENTS_MIN_WEIGHT = 0.5;   // how much of a sample's 2x2 cell square must be ocean

// Shared source metadata stays outside the animation so both pages show the same labels.
function currentsFieldTime(grid, source) {
  const date = new Date(grid.time);
  return source.daily
    ? date.toLocaleDateString([], {dateStyle: 'medium', timeZone: 'UTC'})
    : date.toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'});
}

function currentsValidateGrid(grid, sourceId) {
  const count = grid.nlat * grid.nlon;
  if (!Number.isInteger(grid.nlat) || !Number.isInteger(grid.nlon)
      || grid.nlat < 2 || grid.nlon < 2 || count > 2000000
      || !Number.isFinite(grid.lat0) || !Number.isFinite(grid.lon0)
      || !Number.isFinite(grid.step) || grid.step <= 0
      || !Number.isFinite(Date.parse(grid.time))
      || !Array.isArray(grid.u) || !Array.isArray(grid.v)
      || grid.u.length !== count || grid.v.length !== count
      || grid.source !== 'ecmwf-currents') {
    throw new Error('Invalid current field');
  }
  for (let i = 0; i < count; i++) {
    for (const value of [grid.u[i], grid.v[i]]) {
      if (value !== null && (!Number.isFinite(value) || Math.abs(value) > 1000)) {
        throw new Error('Invalid current velocity');
      }
    }
  }
}

// Revalidate the deployed S3/CloudFront field at most once every five minutes.
function currentsFieldLoader() {
  const cache = new Map();
  return async function(sourceId) {
    const cached = cache.get(sourceId);
    if (cached && Date.now() - cached.loaded < 300000) return cached.promise;
    const promise = (async () => {
      const response = await fetch(CURRENTS_SOURCES[sourceId].url, {credentials: 'omit', signal: AbortSignal.timeout(20000)});
      if (!response.ok) throw new Error('Current source unavailable');
      const grid = await response.json();
      currentsValidateGrid(grid, sourceId);
      return grid;
    })();
    cache.set(sourceId, {promise, loaded: Date.now()});
    try { return await promise; }
    catch (error) {
      if (cache.get(sourceId)?.promise === promise) cache.delete(sourceId);
      throw error;
    }
  };
}

// Load when enabled. Retain the last good overlay if a background refresh fails.
function drawCurrents(map, checkbox) {
  const loadField = currentsFieldLoader();
  let overlay = null, updating = false, lastAttempt = 0;

  async function update() {
    if (updating || !checkbox.checked) return;
    updating = true;
    lastAttempt = Date.now();
    try {
      const grid = await loadField('ecmwf');
      if (!checkbox.checked) return;
      if (overlay) overlay.setVisible(false);
      overlay = new CurrentsOverlay(map, grid, {noLegend: true});
      overlay.setVisible(true);
    } catch (error) {
      // Keep the map and any last good field visible; the next refresh retries.
      console.warn('ECMWF currents unavailable; will retry automatically.');
    } finally {
      updating = false;
    }
  }

  function refreshIfDue() {
    if (!document.hidden && Date.now() - lastAttempt >= 300000) update();
  }
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) update();
    else if (overlay) {
      overlay.setVisible(false);
      overlay = null;
    }
  });
  setInterval(refreshIfDue, 300000);
  document.addEventListener('visibilitychange', refreshIfDue);
  update();
}

// Nearest grid cell value, in m/s. Land or missing data (packed as null) comes back null.
function currentsCellValue(grid, row, col) {
  if (row < 0 || row >= grid.nlat || col < 0 || col >= grid.nlon) return null;
  const idx = row * grid.nlon + col;
  const u = grid.u[idx];
  const v = grid.v[idx];
  if (u === null || v === null) return null;
  return { u: u / 100, v: v / 100 }; // cm/s -> m/s
}

// Average of the 4 surrounding cells, weighted by distance. Skips any that are land.
//
// The ocean cells have to carry at least CURRENTS_MIN_WEIGHT of the total or we give up and
// return null. Dividing by sumW renormalises whatever is left, so without this check a point
// with one ocean cell just barely inside its 2x2 square gets that cell's full velocity - a 3%
// neighbour scaled up to 100%, a whole cell past the edge of the data.
function currentsSample(grid, lat, lon) {
  const row = (lat - grid.lat0) / grid.step;
  const col = (lon - grid.lon0) / grid.step;
  const r0 = Math.floor(row), c0 = Math.floor(col);

  let sumU = 0, sumV = 0, sumW = 0;
  for (let dr = 0; dr <= 1; dr++) {
    for (let dc = 0; dc <= 1; dc++) {
      const val = currentsCellValue(grid, r0 + dr, c0 + dc);
      if (val === null) continue;
      const w = (1 - Math.abs(row - (r0 + dr))) * (1 - Math.abs(col - (c0 + dc)));
      sumU += val.u * w;
      sumV += val.v * w;
      sumW += w;
    }
  }
  return sumW < CURRENTS_MIN_WEIGHT ? null : { u: sumU / sumW, v: sumV / sumW };
}

function currentsRandomPointInBounds(map) {
  const bounds = map.getBounds();
  if (!bounds) return map.getCenter();
  const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
  return new google.maps.LatLng(
    sw.lat() + Math.random() * (ne.lat() - sw.lat()),
    sw.lng() + Math.random() * (ne.lng() - sw.lng()),
  );
}

// One canvas, positioned over the map's overlayLayer pane (same layer Polygons use, above
// tiles, below markers) and pointer-events:none so route.html's click-to-add-waypoint keeps
// working - see sargasso.js for why that matters.
//
// Particles are tracked in lat/lon, the same as any other geography on the map, so they pan
// and zoom with it. Each animation frame projects a particle's lat/lon to a screen pixel,
// steps that pixel by (u,v) scaled to CURRENTS_SPEED_SCALE, and projects the new pixel back
// to lat/lon. Doing the step in pixel space (rather than degrees) keeps the same visual speed
// at any zoom level, matching what was tuned in the flat, unprojected POC page.
function CurrentsOverlay(map, grid, options = {}) {
  const overlay = new google.maps.OverlayView();
  let canvas, ctx, offset = { x: 0, y: 0 };
  let particles = [];
  let animHandle = null;
  let visible = false;

  overlay.onAdd = function() {
    canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    ctx = canvas.getContext('2d');
    this.getPanes().overlayLayer.appendChild(canvas);
  };

  overlay.draw = function() {
    const projection = this.getProjection();
    const bounds = map.getBounds();
    if (!projection || !bounds) return;

    const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
    const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
    // Rounded because canvas.width only stores whole pixels. The projection returns floats, so
    // comparing the raw value against canvas.width would differ every frame and never match.
    const width = Math.round(ne.x - sw.x), height = Math.round(sw.y - ne.y);
    if (!(width > 0 && height > 0)) return;   // also rejects NaN

    canvas.style.left = sw.x + 'px';
    canvas.style.top = ne.y + 'px';
    // Assigning to canvas.width wipes the bitmap even when the number does not change, and
    // Google Maps calls draw() on every frame of a pinch zoom. Writing it every time is what
    // made the overlay strobe - it was cleared 60 times a second and never had the frames to
    // grow a trail. During a zoom the viewport keeps its size, so this almost never fires.
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    offset = { x: sw.x, y: ne.y };
  };

  overlay.onRemove = function() {
    canvas.remove();
    canvas = null;
  };

  function spawnParticle() {
    const p = currentsRandomPointInBounds(map);
    return { lat: p.lat(), lon: p.lng(), age: 0, lifespan: 40 + Math.random() * 80 };
  }

  function toCanvasPixel(lat, lon) {
    const projection = overlay.getProjection();
    const px = projection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lon));
    return { x: px.x - offset.x, y: px.y - offset.y };
  }

  // Moves one particle by one frame and draws its trail segment. Returns nothing - a
  // particle that goes off-screen, over land, too slow, or too old is simply respawned.
  function stepParticle(p) {
    const val = currentsSample(grid, p.lat, p.lon);
    p.age++;

    const bounds = map.getBounds();
    const offMap = !bounds || !bounds.contains({ lat: p.lat, lng: p.lon });
    const tooSlowOrLand = val === null || Math.hypot(val.u, val.v) < CURRENTS_CUTOFF;
    if (offMap || tooSlowOrLand || p.age > p.lifespan) {
      Object.assign(p, spawnParticle());
      return;
    }

    const from = toCanvasPixel(p.lat, p.lon);
    const toPixel = {
      x: from.x + val.u * CURRENTS_SPEED_SCALE / 60,
      y: from.y - val.v * CURRENTS_SPEED_SCALE / 60, // screen y grows downward, v is northward
    };
    const to = overlay.getProjection().fromDivPixelToLatLng(
      new google.maps.Point(toPixel.x + offset.x, toPixel.y + offset.y));
    p.lat = to.lat();
    p.lon = to.lng();

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(toPixel.x, toPixel.y);
    ctx.stroke();
  }

  function animate() {
    if (!visible) { animHandle = null; return; }
    // onAdd/draw run async after setMap() - wait for the canvas and projection to exist.
    if (!canvas || !overlay.getProjection()) { animHandle = requestAnimationFrame(animate); return; }

    while (particles.length < CURRENTS_PARTICLE_COUNT) particles.push(spawnParticle());
    particles.length = CURRENTS_PARTICLE_COUNT;

    // Fades old trail pixels toward transparent (not toward an opaque colour) so the map tiles
    // stay visible underneath - destination-out erases alpha instead of painting over it.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0, 0, 0, ${CURRENTS_FADE})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';

    ctx.strokeStyle = CURRENTS_PARTICLE_COLOR;
    ctx.lineWidth = 1.3;
    particles.forEach(stepParticle);

    animHandle = requestAnimationFrame(animate);
  }

  const legend = options.noLegend ? null : currentsLegend(map, grid.time, options.source);

  overlay.setVisible = function(on) {
    visible = on;
    if (on) {
      overlay.setMap(map);
      if (legend) legend.style.display = 'block';
      if (!animHandle) animHandle = requestAnimationFrame(animate);
    } else {
      overlay.setMap(null);
      if (legend) {
        const controls = map.controls[google.maps.ControlPosition.LEFT_BOTTOM];
        const index = controls.getArray().indexOf(legend);
        if (index >= 0) controls.removeAt(index);
      }
    }
  };

  return overlay;
}

// Motion key and field date, positioned inside the map as a Google Maps control.
function currentsLegend(map, isoTime, source = CURRENTS_SOURCES.ecmwf) {
  const el = document.createElement('div');
  const base = 'display:none; background:rgba(13,17,23,0.88); border:1px solid #30363d; ' +
    'border-radius:4px; font:11px monospace; color:#c9d1d9;';

  el.style.cssText = base + ' margin:0 0 24px 10px; padding:6px 10px;';
  el.innerHTML = `
    <div>${source.label}</div>
    <div style="margin:3px 0">Faster particles = stronger currents</div>
    <div style="color:#8b949e; margin-top:2px">${currentsFieldTime({time: isoTime}, source)}</div>
  `;
  map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(el);

  return el;
}
