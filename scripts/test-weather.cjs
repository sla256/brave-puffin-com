// Run with node scripts/test-weather.cjs; no network or Google Maps key needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('static/js/wind.js', 'utf8');
let now = Date.parse('2026-09-26T10:10:00Z'), fail = false, attached = false;
let visibility, requests = [], strokes = 0, cloudDraws = 0, cloudAlpha = 0;
let animationNow = 0;
const canvases = [];
let rafId = 0, deferFrames = false, releaseFrames = [];
const intervals = new Map(), animations = new Map();
class Clock extends Date { static now() { return now; } }
const manifest = {
  schema: 2, run: '2026-09-26T06:00:00Z', wind_scale: .01, horizon_hours: 48,
  grid: {nlat:261,nlon:231,lat0:-60,lon0:-95,step:.5},
  frames: Array.from({length: 60}, (_, i) => ({
    valid: new Date(Date.parse('2026-09-26T07:00:00Z') + i * 3600000).toISOString(),
    interval_start: new Date(Date.parse('2026-09-26T06:00:00Z') + i * 3600000).toISOString(),
    url: `/weather/atlantic/gfs-v2/20260926T06Z/${String(i+1).padStart(3,'0')}.json`,
  })),
};
const point = (lat, lon) => ({lat:()=>lat,lng:()=>lon});
const projection = {
  fromLatLngToDivPixel: p => ({x:(p.lng()+40)*20, y:(20-p.lat())*20}),
  fromDivPixelToLatLng: p => point(20-p.y/20,p.x/20-40),
  getWorldWidth: () => 7200,
};
const context = {
  window: {}, Date: Clock, AbortSignal, AbortController,
  performance: {now:()=>animationNow},
  fetch: async (url, options) => {
    assert.equal(options.credentials, 'omit'); requests.push(url);
    if (fail) throw Error('offline');
    if (url.endsWith('latest.json')) return {ok:true,json:async()=>manifest};
    if (deferFrames) await new Promise(resolve=>releaseFrames.push(resolve));
    const entry = manifest.frames.find(f=>url.endsWith(f.url)); assert.ok(entry);
    return {ok:true,json:async()=>({schema:2,run:manifest.run,...entry,
      u:Array(261*231).fill(500),v:Array(261*231).fill(200),cloud:Array(261*231).fill(50)})};
  },
  document: {hidden:false, addEventListener:(event, cb)=>visibility=cb,
    removeEventListener:()=>visibility=null,
    createElement:()=>{
      const canvas={style:{},setAttribute(){},remove(){},width:0,height:0,clears:0,segments:[],draws:[]};
      let start;
      const ctx={globalAlpha:1,clearRect(){canvas.clears++;},fillRect(){},beginPath(){},
        moveTo(x,y){start=[x,y];},lineTo(x,y){canvas.segments.push({from:start,to:[x,y]});},stroke(){strokes++;},
        createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
        putImageData(image){cloudAlpha=image.data[3];canvas.alpha=cloudAlpha;},
        drawImage(source){cloudDraws++;canvas.draws.push({alpha:ctx.globalAlpha,sourceAlpha:source.alpha});}};
      canvas.getContext=()=>ctx;canvases.push(canvas);return canvas;
    }},
  ResizeObserver: class {observe(){} disconnect(){}},
  requestAnimationFrame: cb => {animations.set(++rafId,cb); return rafId;},
  cancelAnimationFrame:id=>animations.delete(id),
  setInterval:(cb,ms)=>{intervals.set(ms,cb);return ms;}, clearInterval:id=>intervals.delete(id),
  google:{maps:{
    OverlayView:class {
      getProjection(){return projection;}
      getPanes(){return {overlayLayer:{appendChild(){}}};}
      setMap(map){attached=!!map; if(map){this.onAdd();this.draw();}else this.onRemove();}
    },
    LatLng:class {constructor(lat,lon){this.lat=()=>lat;this.lng=()=>lon;}},
    Point:class {constructor(x,y){this.x=x;this.y=y;}},
  }},
};
vm.createContext(context);
vm.runInContext(source.replace('})(window);','global.test = {sample, forecastFrames, validateManifest, validateFrame, createOverlay};\n})(window);'),context);
const {sample,forecastFrames,validateManifest,validateFrame}=context.window.test;
assert.equal(sample({lat0:0,lon0:0,step:1,nlat:2,nlon:2},[0,2,4,6],.5,.5),3);
assert.equal(sample({lat0:0,lon0:0,step:1,nlat:2,nlon:2},[0,null,4,6],.5,.5),null);
assert.equal(sample({lat0:0,lon0:0,step:1,nlat:2,nlon:2},new Float32Array([0,NaN,4,6]),.5,.5),null);
assert.equal(forecastFrames(manifest, now).length,24);
assert.equal(forecastFrames(manifest, now)[0].valid,'2026-09-26T11:00:00.000Z');
assert.equal(forecastFrames(manifest, now)[23].valid,'2026-09-27T10:00:00.000Z');
assert.throws(()=>forecastFrames(manifest,Date.parse('2026-09-30T10:30Z')));
assert.throws(()=>forecastFrames({...manifest,schema:1},now));
assert.throws(()=>forecastFrames({...manifest,frames:manifest.frames.slice(0,10)},now));
assert.throws(()=>validateManifest({...manifest,frames:[manifest.frames[0],manifest.frames[2]]}));
assert.throws(()=>validateManifest({...manifest,frames:[{...manifest.frames[0],url:'https://evil.test/data'}]}));
assert.throws(()=>validateFrame({schema:2,run:manifest.run,...manifest.frames[0],u:[],v:[]},manifest,manifest.frames[0]));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const animate=(time=animationNow+16)=>{animationNow=time;const batch=[...animations]; animations.clear(); for(const [,cb] of batch) cb(time);};
const checkbox=checked=>({checked,addEventListener(event,cb){this.toggle=cb;},removeEventListener(){this.toggle=null;}});
(async()=>{
  const status={textContent:''}, size={clientWidth:1200,clientHeight:550};
  const wind=checkbox(false), clouds=checkbox(false);
  const map={getDiv:()=>size,getCenter:()=>point(20,-40)};
  const controller=context.window.drawWeather(map,status,wind,clouds);
  await flush();
  assert.equal(requests.length,0,'Default-off weather does not fetch even the manifest');
  assert.equal(attached,false);assert.equal(status.textContent,'');
  intervals.get(300000)();intervals.get(1000)();await flush();
  assert.equal(requests.length,0,'Periodic callbacks do not fetch while disabled');
  wind.checked=true;wind.toggle();
  await flush(); assert.ok(attached); assert.match(status.textContent,/24h forecast.*1\/24/);
  assert.equal(requests.filter(u=>!u.endsWith('latest.json')).length,24);
  const initialStrokes=strokes; animate(); assert.equal(strokes-initialStrokes,540); assert.equal(cloudDraws,0);
  const first=status.textContent;
  intervals.get(1000)(); assert.match(status.textContent,/2\/24/);
  for(let i=0;i<23;i++) intervals.get(1000)();
  assert.equal(status.textContent,first); // Complete loop wraps to its first hour.
  assert.equal(requests.length,25); // Playback reuses cached grids.
  clouds.checked=true; clouds.toggle(); await flush(); animate();
  assert.ok(cloudDraws>0); assert.equal(cloudAlpha,40);
  wind.checked=false; wind.toggle(); await flush();
  const before=strokes; animate(); assert.equal(strokes,before); assert.ok(attached); // Clouds alone.
  const label=status.textContent; intervals.get(1000)(); assert.notEqual(status.textContent,label);
  context.document.hidden=true;
  const hiddenLabel=status.textContent; intervals.get(1000)(); assert.equal(status.textContent,hiddenLabel);
  context.document.hidden=false;
  clouds.checked=false; clouds.toggle(); assert.ok(!attached); assert.equal(status.textContent,'');
  const requestCount=requests.length;
  now+=5*60000; intervals.get(300000)(); await flush(); assert.equal(requests.length,requestCount);
  wind.checked=true; wind.toggle(); await flush(); assert.ok(attached);
  assert.equal(requests.filter(u=>!u.endsWith('latest.json')).length,24);
  now+=3600000; intervals.get(300000)(); await flush();
  assert.equal(requests.filter(u=>!u.endsWith('latest.json')).length,25); // Only the new end hour loads.
  fail=true; now+=5*60000; intervals.get(300000)(); await flush();
  assert.match(status.textContent,/refresh delayed/); assert.ok(attached);
  now+=2*3600000; intervals.get(300000)(); await flush();
  assert.match(status.textContent,/unavailable/); assert.ok(!attached);
  fail=false; now+=5*60000; intervals.get(300000)(); await flush();
  assert.ok(attached); assert.doesNotMatch(status.textContent,/delayed|unavailable/);
  controller.destroy(); assert.equal(intervals.size,0); assert.equal(visibility,null);
  assert.equal(wind.toggle,null); assert.equal(clouds.toggle,null); assert.equal(animations.size,0);
  // Disabling layers while a frame is in flight must not attach the overlay on completion.
  deferFrames=true;
  const offWind=checkbox(true), offCloud=checkbox(false), offStatus={textContent:''};
  const offController=context.window.drawWeather(map,offStatus,offWind,offCloud);
  await flush(); assert.equal(releaseFrames.length,3);
  offWind.checked=false; offWind.toggle();
  deferFrames=false; releaseFrames.splice(0).forEach(resolve=>resolve()); await flush();
  assert.ok(!attached); assert.equal(offStatus.textContent,'');
  offWind.checked=true; offWind.toggle(); await flush(); assert.ok(attached);
  offController.destroy();
  // Drive a real overlay with changing fields and a deterministic animation clock.
  // Particle positions/trails must survive an hour change, and velocities/cloud opacity blend.
  const grid={lat0:-60,lon0:-95,step:1,nlat:161,nlon:191};
  const field=(u,cloud)=>({u:new Float32Array(161*191).fill(u),v:new Float32Array(161*191),cloud:new Float32Array(161*191).fill(cloud)});
  const overlay=context.window.test.createOverlay(map);
  const old=field(500,0),next=field(1500,100);
  overlay.update(old,grid);overlay.setLayers(true,true);overlay.setMap(map);
  animate();
  const [cloudCanvas,flowCanvas]=canvases.slice(-2);
  const oldClears=flowCanvas.clears;
  const lastPositions=flowCanvas.segments.slice(-540).map(segment=>segment.to);
  const start=animationNow;
  overlay.update(next,grid);
  assert.equal(flowCanvas.clears,oldClears,'Hourly update never clears wind trails');
  flowCanvas.segments=[];
  animate(start+1);
  assert.ok(flowCanvas.segments.some(segment=>lastPositions.some(p=>Math.abs(p[0]-segment.from[0])<1e-6 && Math.abs(p[1]-segment.from[1])<1e-6)), 'Existing particle positions survive the update');
  flowCanvas.segments=[];cloudCanvas.draws=[];
  animate(start+500);
  const halfway=flowCanvas.segments[0];
  assert.ok(Math.abs(halfway.to[0]-halfway.from[0]-6)<1e-6,'Wind velocity is halfway between old and new');
  assert.equal(cloudCanvas.draws.length,2);
  assert.equal(cloudCanvas.draws[0].alpha,.5);assert.equal(cloudCanvas.draws[1].alpha,.5);
  assert.equal(cloudCanvas.draws[1].sourceAlpha,80,'Cloud opacity remains at its reduced maximum');
  // Repeating the same target (checkbox or manifest refresh) must not restart the blend.
  overlay.update(next,grid);animate(start+750);
  flowCanvas.segments=[];animate(start+1000);
  assert.ok(Math.abs(flowCanvas.segments[0].to[0]-flowCanvas.segments[0].from[0]-9)<1e-6);
  assert.equal(flowCanvas.clears,oldClears);
  // Clouds still crossfade while wind is off, including a transition back to the first frame.
  overlay.setLayers(false,true);
  const wrapStart=animationNow;overlay.update(old,grid);animate(wrapStart+1);
  cloudCanvas.draws=[];animate(wrapStart+500);
  assert.equal(cloudCanvas.draws.length,2);assert.equal(cloudCanvas.draws[1].alpha,.5);
  overlay.setMap(null);assert.equal(animations.size,0);
  console.log('Passed: smooth wind velocity, retained particle positions/trails, cloud crossfade, clouds-only wrap, transition completion');
  console.log('Passed: hourly horizon, validation, 24-frame looping/cache reuse, 2x wind density, cloud rendering, independent toggles, hidden/off playback, refresh/outage recovery, in-flight cancellation, cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
