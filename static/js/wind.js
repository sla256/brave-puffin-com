// Current-time GFS 10 m wind
(function(global) {
  'use strict';
  const ORIGIN = 'https://app.bravepuffinrobotics.com';
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
    for (const field of ['u', 'v']) {
      if (!Array.isArray(frame[field]) || frame[field].length !== count || frame[field].some(v => v !== null && !Number.isFinite(v))) throw Error('Incomplete forecast grid');
    }
    return frame;
  }

  function createOverlay(map) {
    const overlay = new google.maps.OverlayView();
    let flow, frame, grid, left = 0, top = 0, width = 0, height = 0;
    let animation = null, previousTime = 0, particles = [], observer;

    overlay.onAdd = function() {
      flow = document.createElement('canvas');
      for (const canvas of [flow]) {
        canvas.style.cssText = 'position:absolute;pointer-events:none;';
        canvas.setAttribute('aria-hidden', 'true');
        this.getPanes().overlayLayer.appendChild(canvas);
      }
      observer = new ResizeObserver(() => overlay.draw());
      observer.observe(map.getDiv());
      animate(0);
    };
    overlay.onRemove = function() {
      observer.disconnect();
      cancelAnimationFrame(animation);
      flow.remove();
      flow = null; animation = null; particles = []; previousTime = 0;
    };
    overlay.draw = function() {
      const projection = this.getProjection(), center = map.getCenter();
      if (!flow || !projection || !center) return;
      width = map.getDiv().clientWidth; height = map.getDiv().clientHeight;
      const origin = projection.fromLatLngToDivPixel(center);
      if (!origin || !width || !height) return;
      left = origin.x - width / 2; top = origin.y - height / 2;
      for (const canvas of [flow]) {
        canvas.style.left = left + 'px'; canvas.style.top = top + 'px';
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
      }
    };

    function spawn() {
      const projection = overlay.getProjection();
      const point = projection.fromDivPixelToLatLng(new google.maps.Point(left + Math.random() * width, top + Math.random() * height));
      return {lat: point.lat(), lon: point.lng(), life: 1 + Math.random() * 3};
    }
    function animate(now) {
      animation = requestAnimationFrame(animate);
      if (!flow || !frame || !width || !height || !overlay.getProjection() || document.hidden) { previousTime = now; return; }
      const dt = Math.min((now - previousTime) / 1000 || 1/60, .05); previousTime = now;
      const ctx = flow.getContext('2d'), projection = overlay.getProjection();
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = `rgba(0,0,0,${1 - Math.exp(-3 * dt)})`;
      ctx.fillRect(0,0,width,height); ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = 1.2;
      const count = Math.min(240, Math.round(width * height / 2200 * .6));
      while (particles.length < count) particles.push(spawn());
      particles.length = count;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]; p.life -= dt;
        const u = sample(grid, frame.u, p.lat, p.lon), v = sample(grid, frame.v, p.lat, p.lon);
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
        particles = [];
        if (flow) flow.getContext('2d').clearRect(0,0,width,height);
      }
      frame = data; grid = geometry;
      this.draw();
    };
    return overlay;
  }

  function nearestFrame(manifest, now) {
    // Never clamp an expired forecast to an old endpoint and call it current.
    const frames = manifest.frames;
    const halfInterval = (manifest.schema === 2 ? .5 : 1.5) * 3600000;
    if (now < Date.parse(frames[0].valid) - halfInterval ||
        now > Date.parse(frames[frames.length - 1].valid) + halfInterval) {
      throw Error('No forecast for the current time');
    }
    return frames.reduce((best, frame) =>
      Math.abs(Date.parse(frame.valid) - now) < Math.abs(Date.parse(best.valid) - now) ? frame : best);
  }

  async function getJSON(path) {
    const response = await fetch(ORIGIN + path, {credentials: 'omit', signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw Error('Wind forecast unavailable');
    return response.json();
  }

  global.drawWind = function(map, status, checkbox) {
    const overlay = createOverlay(map);
    let busy = false, disposed = false, lastAttempt = 0, activeURL = null, activeTime = null;
    let attached = false;
    function describe(suffix = '') {
      const time = new Date(activeTime).toLocaleString([], {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
      status.textContent = 'Wind, as of ' + time + suffix;
    }
    async function update() {
      if (busy || disposed) return;
      busy = true;
      lastAttempt = Date.now();
      try {
        const manifest = validateManifest(await getJSON('/weather/atlantic/latest.json'));
        const entry = nearestFrame(manifest, Date.now());
        if (entry.url !== activeURL) {
          const frame = validateFrame(await getJSON(entry.url), manifest, entry);
          if (disposed) return;
          overlay.update(frame, manifest.grid);
          activeURL = entry.url;
          activeTime = entry.valid;
        }
        if (disposed) return;
        if (checkbox.checked && !attached) { overlay.setMap(map); attached = true; }
        const oldRun = Date.now() - Date.parse(manifest.run) > 18 * 3600000;
        describe(oldRun ? ' · older model run' : '');
      } catch (error) {
        if (disposed) return;
        // Allow a brief outage, but remove wind that is no longer near now.
        if (activeTime && Math.abs(Date.now() - Date.parse(activeTime)) <= 90 * 60000) {
          if (checkbox.checked && !attached) { overlay.setMap(map); attached = true; }
          describe(' · refresh delayed');
        } else {
          if (attached) overlay.setMap(null);
          attached = false;
          activeURL = null;
          status.textContent = 'Wind · unavailable';
        }
      } finally { busy = false; }
    }
    function refreshIfDue() {
      if (!document.hidden && Date.now() - lastAttempt >= 300000) update();
    }
    function toggle() {
      if (checkbox.checked) update();
      else if (attached) { overlay.setMap(null); attached = false; }
    }
    status.textContent = 'Wind · loading…';
    checkbox.addEventListener('change', toggle);
    const timer = setInterval(refreshIfDue, 300000);
    document.addEventListener('visibilitychange', refreshIfDue);
    update();
    return {destroy() {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfDue);
      checkbox.removeEventListener('change', toggle);
      if (attached) overlay.setMap(null);
    }};
  };
})(window);
