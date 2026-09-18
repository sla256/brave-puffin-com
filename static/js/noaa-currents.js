// Adapted from brave-puffin-backend/web/currents.js for the public tracking map.
// Animated currents shared by map and route pages. Each source supplies the same
// packed u/v grid; the renderer and hover readout sample the selected field.
// Public site uses NOAA only; source selection belongs to the dashboard.
const CURRENTS_SOURCES = {
  noaa: {
    label: 'NOAA CoastWatch', url: 'https://app.bravepuffinrobotics.com/currents.json', daily: true,
    link: 'https://coastwatch.noaa.gov/erddap/griddap/noaacwBLENDEDNRTcurrentsDaily.html',
    description: 'Geostrophic surface current | Atlantic 0.25° grid',
    staleHours: 96,
  },

};

const CURRENTS_PARTICLE_COUNT = 375;
const CURRENTS_SPEED_SCALE = 12;   // px/frame moved per m/s of current, at 60fps
const CURRENTS_FADE = 0.02;        // canvas repaint alpha per frame - lower means longer trails
const CURRENTS_PARTICLE_COLOR = '#e6edf3'; // uniform colour; motion alone conveys speed
const CURRENTS_CUTOFF = 0.05;      // m/s - slower than this, a particle just respawns
const CURRENTS_MIN_WEIGHT = 0.5;   // how much of a sample's 2x2 cell square must be ocean
const CURRENTS_COAST_MARGIN = 2;   // ocean cells this close to land are thrown away - see below

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
      || grid.u.length !== count || grid.v.length !== count) {
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
      // This filter was built for NOAA's coastal artifacts and its quarter-degree grid.
      if (sourceId === 'noaa') currentsErodeCoast(grid, CURRENTS_COAST_MARGIN);
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

// Always on. Retain the last good overlay if a background refresh fails.
function drawCurrents(map) {
  const loadField = currentsFieldLoader();
  let overlay = null, updating = false, lastAttempt = 0;

  async function update() {
    if (updating) return;
    updating = true;
    lastAttempt = Date.now();
    try {
      const grid = await loadField('noaa');
      if (overlay) overlay.setVisible(false);
      overlay = new CurrentsOverlay(map, grid, {noLegend: true});
      overlay.setVisible(true);
    } catch (error) {
      // Keep the map and any last good field visible; the next refresh retries.
      console.warn('NOAA currents unavailable; will retry automatically.');
    } finally {
      updating = false;
    }
  }

  function refreshIfDue() {
    if (!document.hidden && Date.now() - lastAttempt >= 300000) update();
  }
  setInterval(refreshIfDue, 300000);
  document.addEventListener('visibilitychange', refreshIfDue);
  update();
}

// Throws away the ocean cells nearest the coast, because the source product's values there are
// not real. The cells right against the shore flip between land and ocean from one daily file
// to the next, and on the days they are filled in they can carry a metre per second while the
// water one cell further out sits at a tenth of that.
//
// Ten days of Bay of Fundy files: 14 of the 35 cells changed between land and ocean, and the
// vector changed more from one day to the next than its own length. The same ten days over the
// Gulf Stream and the Sargasso: no cell ever changed state, and about a third as much change
// day to day. A cell cannot really be land on Tuesday and sea on Wednesday, so this is the
// product's processing, not water moving.
//
// Two cells costs about 5% of the ocean in the file and 0.2% of the fast cells along the
// crossing route. It does thin out narrow channels like the Florida Straits.
// Missing offshore measurements are not land. Only missing cells near the geographic
// coastline seed this filter; subsequent passes expand that coastal mask alone.
function currentsNearLand(lat, lon) {
  const row = Math.round((lat - 10.125) / 0.25);
  const col = Math.round((lon + 84.875) / 0.25);
  const runs = CURRENTS_LAND_ROWS[row];
  if (!runs || col < 0 || col > 340) return false;
  for (let i = 0; i < runs.length; i += 2) {
    if (col >= runs[i] && col <= runs[i + 1]) return true;
  }
  return false;
}

function currentsErodeCoast(grid, margin) {
  let coastal = grid.u.map((u, i) =>
    (u === null || grid.v[i] === null) && currentsNearLand(
      grid.lat0 + Math.floor(i / grid.nlon) * grid.step,
      grid.lon0 + (i % grid.nlon) * grid.step));
  for (let pass = 0; pass < margin; pass++) {
    const wasLand = coastal;
    coastal = wasLand.slice();
    for (let row = 0; row < grid.nlat; row++) {
      for (let col = 0; col < grid.nlon; col++) {
        const i = row * grid.nlon + col;
        if (wasLand[i]) continue;
        // The edges of the requested box are open ocean, not coastline, so they do not erode.
        const touchesLand =
          (row > 0 && wasLand[i - grid.nlon]) ||
          (row < grid.nlat - 1 && wasLand[i + grid.nlon]) ||
          (col > 0 && wasLand[i - 1]) ||
          (col < grid.nlon - 1 && wasLand[i + 1]);
        if (touchesLand) {
          grid.u[i] = null; grid.v[i] = null;
          coastal[i] = true;
        }
      }
    }
  }
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
// neighbour scaled up to 100%. That is how a value reaches a whole cell past the edge of the
// data, which would put back one of the two coastal cells currentsErodeCoast just removed.
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
function currentsLegend(map, isoTime, source = CURRENTS_SOURCES.noaa) {
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

// BEGIN GENERATED LAND MASK
// Natural Earth 1:10m land v5.1.1; public domain. Rebuild with
// scripts/build-currents-land-mask.py. Rows: 10.125N + r*0.25;
// inclusive column pairs: -84.875E + c*0.25. Footprint half-width 0.375 degrees.
const CURRENTS_LAND_ROWS = [[0,9,35,97,280,340],[0,8,36,97,279,340],[0,7,36,97,278,340],[0,7,36,98,273,340],[0,6,37,68,77,90,92,98,273,340],[0,6,39,67,71,73,81,88,95,98,273,340],[0,6,42,66,68,76,80,82,86,88,96,98,273,340],[0,8,46,76,80,82,91,94,272,340],[0,9,48,76,80,82,91,95,271,340],[0,9,12,14,50,70,91,95,271,340],[0,9,12,14,50,56,58,67,92,96,271,340],[0,6,12,14,58,61,93,96,100,103,271,340],[0,6,13,15,93,96,100,103,271,340],[0,7,13,15,18,20,93,97,100,103,271,340],[0,7,13,15,18,20,93,97,100,102,271,340],[0,10,18,20,94,97,271,340],[0,10,94,97,270,340],[0,10,94,97,268,340],[0,10,94,97,239,247,268,340],[0,10,93,97,239,248,268,340],[0,10,93,97,239,248,268,340],[0,10,84,86,93,96,241,248,270,340],[0,7,19,22,24,26,84,86,92,96,243,249,271,340],[0,7,19,22,24,26,84,86,91,96,247,250,272,340],[0,7,19,22,24,26,91,97,241,243,247,250,272,340],[5,7,90,97,239,244,247,250,272,340],[89,97,237,244,247,249,272,340],[88,95,237,244,247,249,273,340],[3,5,87,94,237,242,247,249,273,340],[3,5,29,32,52,55,79,82,85,94,237,241,273,340],[3,5,27,36,52,56,70,77,79,82,85,94,274,340],[25,36,42,60,63,82,85,89,91,94,274,340],[25,36,38,83,85,89,274,340],[25,35,38,83,85,89,274,340],[25,34,38,67,69,83,85,89,274,340],[27,30,41,67,70,73,81,83,85,87,273,340],[13,16,45,67,272,340],[13,16,18,22,45,65,272,340],[13,16,18,22,28,41,45,64,272,340],[18,22,28,61,272,340],[19,22,28,59,272,340],[23,44,47,50,272,340],[22,48,270,340],[21,42,44,48,270,340],[6,10,21,39,44,49,52,56,270,340],[6,15,18,38,44,56,270,340],[0,15,17,35,46,56,270,340],[0,33,35,38,41,44,46,56,271,340],[0,31,35,38,41,54,271,340],[0,30,35,38,41,50,271,340],[1,29,35,50,272,340],[2,27,38,47,273,340],[3,22,35,46,273,340],[6,22,27,30,34,41,43,46,274,340],[14,22,27,30,33,43,274,340],[17,22,26,43,274,340],[17,22,25,43,275,340],[7,20,25,43,276,340],[7,18,25,39,277,340],[7,19,22,38,278,340],[13,20,22,36,279,340],[13,24,26,36,279,340],[12,25,27,35,279,340],[11,25,27,34,280,340],[10,33,280,340],[9,20,22,33,281,340],[9,20,23,33,281,340],[8,20,23,33,283,340],[8,20,24,31,284,340],[7,20,25,27,266,269,276,278,285,340],[7,20,266,269,272,279,285,340],[7,19,266,340],[7,19,266,340],[7,18,266,285,289,340],[8,18,266,276,282,287,292,340],[6,18,266,270,273,276,282,287,293,340],[5,18,266,270,283,287,294,340],[0,2,4,17,283,287,296,340],[0,16,284,287,297,340],[0,16,274,277,298,340],[0,16,274,277,299,340],[0,15,274,277,299,340],[0,15,299,340],[0,15,299,340],[0,16,299,340],[0,16,299,340],[0,17,299,340],[0,18,79,81,299,340],[0,19,79,82,273,275,300,340],[0,21,79,82,270,275,301,340],[0,23,79,82,269,275,301,340],[0,24,269,275,301,340],[0,24,269,275,302,340],[0,25,273,275,303,340],[0,29,304,340],[0,29,307,340],[0,31,309,340],[0,35,311,340],[0,36,312,340],[0,38,312,340],[0,39,313,340],[0,39,314,340],[0,39,314,321,323,329,332,340],[0,39,314,320,326,328,334,340],[0,39,313,322,326,328,335,340],[0,38,313,332,339,340],[0,37,238,240,307,309,312,333,340,340],[0,37,238,240,303,333],[0,38,238,240,303,335],[0,38,236,240,303,338],[0,39,235,240,303,338],[0,40,235,240,303,338],[0,40,224,228,235,240,302,340],[0,40,223,232,301,340],[0,41,223,232,301,340],[0,42,223,232,301,340],[0,43,213,216,225,232,300,340],[0,44,213,216,226,229,300,340],[0,44,213,216,300,340],[0,45,213,216,302,340],[0,45,302,340],[0,49,303,340],[0,52,303,340],[0,61,303,340],[0,61,303,340],[0,61,303,340],[0,61,303,340],[0,61,303,340],[0,61,303,340],[0,60,302,340],[0,58,301,340],[0,58,301,340],[0,59,76,79,301,340],[0,61,74,80,301,340],[0,65,74,82,98,102,303,340],[0,68,74,83,98,102,305,320,324,326,332,340],[0,70,73,86,98,102,307,310,333,340],[0,89,100,102,333,340],[0,93,333,340],[0,96,333,340],[0,97,334,340],[0,100,334,340],[0,102,333,340],[0,102,332,340],[0,102,331,340],[0,102,124,128,329,340],[0,100,113,120,122,129,329,340],[0,87,90,100,113,129,329,340],[0,85,90,100,113,130,325,340],[0,85,90,130,324,340],[0,83,90,95,101,130,321,340],[0,83,92,95,101,130,320,340],[0,84,92,95,101,130,318,340],[0,84,101,129,318,340],[0,84,101,129,318,340],[0,84,86,94,102,129,319,340],[0,94,103,127,324,340],[0,94,104,127,328,340],[0,73,76,93,106,127,313,315,318,320,328,340],[0,76,80,100,106,125,313,321,323,326,328,336,339,340],[0,102,107,119,122,124,313,327,340,340],[0,104,108,119,316,337,339,340],[0,105,108,119,317,340],[0,107,109,119,318,340],[0,119,299,304,320,340],[0,119,298,307,317,340],[0,119,297,310,317,340],[0,119,297,315,317,340],[0,18,20,119,297,315,317,340],[0,18,20,119,297,316,318,340],[0,18,20,118,297,317,319,340],[0,118,299,317,319,340],[0,118,298,317,319,340],[0,118,298,317,320,340],[0,12,18,118,297,317,320,340],[0,12,19,117,297,323,325,340],[0,12,14,16,19,115,297,340],[0,12,14,16,19,112,298,340],[0,12,14,16,19,112,298,339],[0,12,19,111,303,338],[0,12,19,109,304,335],[0,12,24,105,304,335],[0,6,18,25,27,102,307,334],[18,26,28,100,312,334],[18,99,311,333],[18,97,311,331],[18,96,308,332],[19,28,31,96,308,332],[19,27,31,95,308,333],[19,22,24,27,31,95,284,286,308,333],[19,22,24,27,30,94,284,286,304,306,308,333],[19,22,24,26,28,94,284,286,304,306,308,333],[15,17,20,22,25,94,304,306,310,328],[15,17,24,91,310,329],[15,17,23,90,311,330],[16,18,23,69,71,90,313,331],[16,19,23,67,73,89,315,317,325,331],[16,20,25,65,75,88,315,317,325,334],[16,21,27,64,76,87,159,168,326,336],[16,21,27,62,65,68,76,86,157,168,330,336],[18,21,28,62,65,69,76,85,156,168,330,337]];
// END GENERATED LAND MASK
