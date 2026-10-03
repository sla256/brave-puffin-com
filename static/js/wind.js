// Shared 24-hour GFS forecast playback: 10 m wind and hourly mean cloud cover
(function(global) {
  'use strict';
  const ORIGIN = 'https://app.bravepuffinrobotics.com';
  const HOUR = 3600000, FRAME_MS = 1000, TRANSITION_MS = 1000;
  const WIND_STOPS = [[80, 145, 235], [59, 201, 169], [230, 215, 80], [244, 139, 60], [225, 72, 86]];
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  function sample(grid, values, lat, lon) {
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    const y = (lat - grid.lat0) / grid.step, x = (lon - grid.lon0) / grid.step;
    if (x < 0 || y < 0 || x > grid.nlon - 1 || y > grid.nlat - 1) return null;
    const row = Math.min(Math.floor(y), grid.nlat - 2), col = Math.min(Math.floor(x), grid.nlon - 2);
    const fy = y - row, fx = x - col, i = row * grid.nlon + col;
    const a = values[i], b = values[i + 1], c = values[i + grid.nlon], d = values[i + grid.nlon + 1];
    if ([a,b,c,d].some(v => v == null || !Number.isFinite(v))) return null;
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  function blendValue(from, to, fraction) {
    if (from === null || !Number.isFinite(from)) return to;
    if (to === null || !Number.isFinite(to)) return from;
    return from + (to - from) * fraction;
  }

  function color(stops, fraction) {
    const pos = clamp(fraction, 0, 1) * (stops.length - 1);
    const i = Math.min(Math.floor(pos), stops.length - 2), f = pos - i;
    return stops[i].map((n, channel) => Math.round(n + (stops[i + 1][channel] - n) * f));
  }

  function validateManifest(data) {
    const g = data.grid;
    if (![1, 2].includes(data.schema) || !g || g.nlat !== 261 || g.nlon !== 231 || g.lat0 !== -60 || g.lon0 !== -95 || g.step !== .5 || data.wind_scale !== .01 || data.horizon_hours !== (data.schema === 2 ? 48 : 72) || !Number.isFinite(Date.parse(data.run)) || !Array.isArray(data.frames) || !data.frames.length) throw Error('Unsupported weather forecast');
    let previous = -Infinity;
    for (const frame of data.frames) {
      const time = Date.parse(frame.valid), start = Date.parse(frame.interval_start);
      if (!Number.isFinite(time) || time <= previous || time - start !== (data.schema === 2 ? 1 : 3) * 3600000 || !/^\/weather\/atlantic\/gfs-v[12]\/\d{8}T\d{2}Z\/\d{3}\.json$/.test(frame.url)) throw Error('Invalid forecast timeline');
      const lead = (time - Date.parse(data.run)) / 3600000;
      const runId = new Date(data.run).toISOString().replace(/[-:]/g, '').slice(0, 11) + 'Z';
      if (!Number.isInteger(lead) || lead <= 0 || lead > (data.schema === 2 ? 60 : 84) || frame.url !== `/weather/atlantic/gfs-v${data.schema}/${runId}/${String(lead).padStart(3, '0')}.json`) throw Error('Invalid forecast source');
      if (data.schema === 2 && previous !== -Infinity && time - previous !== 3600000) throw Error('Missing hourly frame');
      previous = time;
    }
    return data;
  }

  function validateFrame(frame, manifest, entry) {
    if (frame.schema !== manifest.schema || frame.run !== manifest.run || frame.valid !== entry.valid || frame.interval_start !== entry.interval_start) throw Error('Forecast frame does not match its run');
    const count = manifest.grid.nlat * manifest.grid.nlon;
    for (const field of ['u', 'v', 'cloud']) {
      if (!Array.isArray(frame[field]) || frame[field].length !== count || frame[field].some(v => v !== null && !Number.isFinite(v))) throw Error('Incomplete forecast grid');
    }
    return frame;
  }

  function createOverlay(map) {
    const overlay = new google.maps.OverlayView();
    let flow, clouds, frame, previousFrame = null, transitionStart = 0, grid, left = 0, top = 0, width = 0, height = 0;
    let animation = null, repaint = null, previousTime = 0, particles = [], observer;
    let showWind = true, showClouds = false;
    const cloudFrom = document.createElement('canvas'), cloudTo = document.createElement('canvas');

    overlay.onAdd = function() {
      clouds = document.createElement('canvas');
      flow = document.createElement('canvas');
      for (const canvas of [clouds, flow]) {
        canvas.style.cssText = 'position:absolute;pointer-events:none;';
        canvas.setAttribute('aria-hidden', 'true');
        this.getPanes().overlayLayer.appendChild(canvas);
      }
      observer = new ResizeObserver(() => overlay.draw());
      observer.observe(map.getDiv());
      animate(performance.now());
    };
    overlay.onRemove = function() {
      observer.disconnect();
      cancelAnimationFrame(animation); cancelAnimationFrame(repaint);
      flow.remove(); clouds.remove();
      flow = clouds = null; animation = repaint = null; particles = []; previousTime = 0;
      previousFrame = null;
    };
    overlay.draw = function() {
      const projection = this.getProjection(), center = map.getCenter();
      if (!flow || !projection || !center) return;
      width = map.getDiv().clientWidth; height = map.getDiv().clientHeight;
      const origin = projection.fromLatLngToDivPixel(center);
      if (!origin || !width || !height) return;
      left = origin.x - width / 2; top = origin.y - height / 2;
      for (const canvas of [clouds, flow]) {
        canvas.style.left = left + 'px'; canvas.style.top = top + 'px';
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
      }
      if (!repaint) repaint = requestAnimationFrame(() => { repaint = null; prepareClouds(); });
    };

    function transitionFraction(now) {
      if (!previousFrame) return 1;
      const t = clamp((now - transitionStart) / TRANSITION_MS, 0, 1);
      return t * t * (3 - 2 * t);
    }

    function renderClouds(raster, data) {
      const projection = overlay.getProjection();
      const scale = 5, w = Math.ceil(width / scale), h = Math.ceil(height / scale);
      raster.width = w; raster.height = h;
      const rctx = raster.getContext('2d'), image = rctx.createImageData(w, h);
      const center = map.getCenter(), world = projection.getWorldWidth();
      for (let y = 0; y < h; y++) {
        const lat = projection.fromDivPixelToLatLng(new google.maps.Point(left + width / 2, top + (y + .5) * scale), true).lat();
        for (let x = 0; x < w; x++) {
          const lon = center.lng() + ((x + .5) * scale - width / 2) * 360 / world;
          const cover = sample(grid, data.cloud, lat, lon);
          if (cover === null) continue;
          const i = (y * w + x) * 4;
          image.data[i] = 240; image.data[i + 1] = 245; image.data[i + 2] = 250;
          // Clear sky is transparent; retain the reduced maximum cloud opacity.
          image.data[i + 3] = Math.round(clamp(cover / 100, 0, 1) * 80);
        }
      }
      rctx.putImageData(image, 0, 0);
    }

    function prepareClouds() {
      if (!clouds) return;
      clouds.getContext('2d').clearRect(0, 0, width, height);
      if (!showClouds || !frame || !width || !height || !overlay.getProjection()) return;
      renderClouds(cloudTo, frame);
      if (previousFrame) renderClouds(cloudFrom, previousFrame);
      paintClouds(transitionFraction(performance.now()));
    }

    function paintClouds(fraction) {
      if (!clouds || !showClouds || !cloudTo.width) return;
      const ctx = clouds.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      // Add weighted premultiplied pixels, preserving opacity throughout the crossfade.
      ctx.globalCompositeOperation = 'source-over';
      if (previousFrame && fraction < 1) {
        ctx.globalAlpha = 1 - fraction;
        ctx.drawImage(cloudFrom, 0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
      }
      ctx.globalAlpha = fraction;
      ctx.drawImage(cloudTo, 0, 0, width, height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function spawn() {
      const projection = overlay.getProjection();
      const point = projection.fromDivPixelToLatLng(new google.maps.Point(left + Math.random() * width, top + Math.random() * height));
      return {lat: point.lat(), lon: point.lng(), life: 1 + Math.random() * 3};
    }
    function animate(now) {
      animation = requestAnimationFrame(animate);
      if (!flow || !frame || !width || !height || !overlay.getProjection() || document.hidden) { previousTime = now; return; }
      const fraction = transitionFraction(now);
      if (previousFrame && !repaint) {
        paintClouds(fraction);
        if (fraction === 1) previousFrame = null;
      }
      if (!showWind) { previousTime = now; return; }
      const dt = Math.min((now - previousTime) / 1000 || 1/60, .05); previousTime = now;
      const ctx = flow.getContext('2d'), projection = overlay.getProjection();
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = `rgba(0,0,0,${1 - Math.exp(-3 * dt)})`;
      ctx.fillRect(0,0,width,height); ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = 1.2;
      const count = 2 * Math.min(360, Math.round(width * height / 2200 * .9));
      while (particles.length < count) particles.push(spawn());
      particles.length = count;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]; p.life -= dt;
        let u = sample(grid, frame.u, p.lat, p.lon), v = sample(grid, frame.v, p.lat, p.lon);
        if (previousFrame) {
          u = blendValue(sample(grid, previousFrame.u, p.lat, p.lon), u, fraction);
          v = blendValue(sample(grid, previousFrame.v, p.lat, p.lon), v, fraction);
        }
        const pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lon));
        const x = pixel.x - left, y = pixel.y - top;
        if (u === null || v === null || p.life <= 0 || x < 0 || x > width || y < 0 || y > height) { particles[i] = spawn(); continue; }
        const speed = Math.hypot(u, v) * .01;
        const nx = x + u * .01 * 12 * dt, ny = y - v * .01 * 12 * dt;
        const dest = projection.fromDivPixelToLatLng(new google.maps.Point(left + nx, top + ny));
        p.lat = dest.lat(); p.lon = dest.lng();
        ctx.strokeStyle = `rgb(${color(WIND_STOPS, speed / 25).join(',')})`;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(nx,ny); ctx.stroke();
      }
    }
    overlay.update = function(data, geometry) {
      if (frame !== data) {
        const now = performance.now(), fraction = transitionFraction(now);
        // A refreshed model can arrive mid-transition. Start from the currently shown field.
        previousFrame = previousFrame && fraction < 1
          ? Object.fromEntries(['u', 'v', 'cloud'].map(field => [field,
              Float32Array.from(frame[field], (value, i) => blendValue(previousFrame[field][i], value, fraction))]))
          : frame;
        transitionStart = now;
      }
      frame = data; grid = geometry;
      this.draw();
    };
    overlay.setLayers = function(wind, cloud) {
      showWind = wind; showClouds = cloud;
      if (!wind && flow) {
        flow.getContext('2d').clearRect(0, 0, width, height);
        particles = [];
      }
      this.draw();
    };
    return overlay;
  }

  function forecastFrames(manifest, now) {
    if (manifest.schema !== 2) throw Error('Hourly forecast unavailable');
    const start = Math.ceil(now / HOUR) * HOUR;
    const frames = manifest.frames.filter(frame => Date.parse(frame.valid) >= start).slice(0, 24);
    if (frames.length !== 24 || Date.parse(frames[0].valid) !== start ||
        Date.parse(frames[23].valid) !== start + 23 * HOUR) {
      throw Error('Full 24-hour forecast unavailable');
    }
    return frames;
  }

  async function getJSON(path, signal) {
    const response = await fetch(ORIGIN + path, {
      credentials: 'omit', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    });
    if (!response.ok) throw Error('Forecast unavailable');
    return response.json();
  }

  global.drawWeather = function(map, status, wind, clouds) {
    const overlay = createOverlay(map), cache = new Map();
    let disposed = false, attached = false, ready = false;
    let lastAttempt = 0, request = null, manifest = null, entries = [], index = 0, note = '';
    const enabled = () => wind.checked || clouds.checked;

    function syncLayers() {
      overlay.setLayers(wind.checked, clouds.checked);
      if (!enabled() && attached) { overlay.setMap(null); attached = false; }
    }
    function show() {
      if (!entries.length || !enabled() || disposed) return;
      const entry = entries[index], frame = cache.get(entry.url);
      if (!frame) return;
      overlay.update(frame, manifest.grid);
      if (!attached) { overlay.setMap(map); attached = true; }
      const time = new Date(entry.valid).toLocaleString([], {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      });
      status.textContent = `24h forecast · ${time} · ${index + 1}/24` +
        note;
      status.title = `NOAA GFS run: ${manifest.run}. Wind at the displayed time; cloud cover is the hourly mean ending then.`;
    }
    async function update() {
      if (request || disposed || !enabled() || document.hidden) return;
      const controller = new AbortController();
      request = controller;
      lastAttempt = Date.now();
      const active = () => !disposed && request === controller && !controller.signal.aborted && enabled();
      try {
        const nextManifest = validateManifest(await getJSON('/weather/atlantic/latest.json', controller.signal));
        const nextEntries = forecastFrames(nextManifest, Date.now());
        let cursor = 0;
        // Limit concurrent downloads and retain only the three fields we draw.
        await Promise.all(Array.from({length: 3}, async () => {
          while (cursor < nextEntries.length && active()) {
            const entry = nextEntries[cursor++];
            if (!cache.has(entry.url)) {
              const frame = validateFrame(await getJSON(entry.url, controller.signal), nextManifest, entry);
              if (!active()) return;
              cache.set(entry.url, Object.fromEntries(['u', 'v', 'cloud'].map(field =>
                [field, Float32Array.from(frame[field], value => value === null ? NaN : value)])));
            }
          }
        }));
        if (!active()) return;
        const previousURL = entries[index]?.url;
        manifest = nextManifest; entries = nextEntries;
        index = Math.max(0, entries.findIndex(entry => entry.url === previousURL));
        const keep = new Set(entries.map(entry => entry.url));
        for (const url of cache.keys()) if (!keep.has(url)) cache.delete(url);
        ready = true;
        note = Date.now() - Date.parse(manifest.run) > 18 * HOUR ? ' · older model run' : '';
        show();
      } catch (error) {
        if (!active()) return;
        controller.abort();
        // A brief refresh outage can reuse the loop; never keep displaying yesterday's forecast.
        if (ready && Date.now() - Date.parse(entries[0].valid) < HOUR) {
          note = ' · refresh delayed';
          show();
        } else {
          ready = false;
          entries = []; cache.clear();
          if (attached) { overlay.setMap(null); attached = false; }
          status.textContent = '24h forecast unavailable · retrying';
        }
      } finally {
        if (request === controller) request = null;
      }
    }
    function refreshIfDue() {
      if (Date.now() - lastAttempt >= 300000) update();
    }
    function toggle() {
      syncLayers();
      if (enabled()) {
        if (ready) show();
        else status.textContent = 'Loading 24h forecast…';
        update();
      } else {
        if (request) request.abort();
        request = null;
        status.textContent = '';
      }
    }
    status.textContent = enabled() ? 'Loading 24h forecast…' : '';
    wind.addEventListener('change', toggle);
    clouds.addEventListener('change', toggle);
    const timer = setInterval(refreshIfDue, 300000);
    const playback = setInterval(() => {
      if (!ready || !enabled() || document.hidden) return;
      index = (index + 1) % entries.length;
      show();
    }, FRAME_MS);
    document.addEventListener('visibilitychange', refreshIfDue);
    syncLayers(); update();
    return {destroy() {
      disposed = true;
      if (request) request.abort();
      clearInterval(timer); clearInterval(playback);
      document.removeEventListener('visibilitychange', refreshIfDue);
      wind.removeEventListener('change', toggle);
      clouds.removeEventListener('change', toggle);
      if (attached) overlay.setMap(null);
      cache.clear();
    }};
  };
})(window);
