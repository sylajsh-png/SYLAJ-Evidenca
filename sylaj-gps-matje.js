
/* SYLAJ - GPS matje provuese per Walk Scan */
(() => {
  'use strict';
  if (document.getElementById('sylajGpsWalk')) return;
  const el = document.createElement('section');
  el.id = 'sylajGpsWalk';
  el.style.cssText = 'margin-top:18px;padding:16px;border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;color:#172c40';
  el.innerHTML = `<h3>📍 Walk Scan – GPS (poskusno)</h3>
    <p>GPS izmeri približno dolžino poti. Za obračun preverite z merilnim orodjem.</p>
    <label>Vrsta površine <select id="swSurface"><option value="kanal">📏 Kanal</option><option value="tlakovci">🧱 Tlakovci</option><option value="asfalt">🛣️ Asfalt</option></select></label>
    <label>Širina posega (m) <input id="swWidth" type="number" min="0" step="0.01" value="0.60"></label>
    <p><button type="button" id="swStart">▶️ Začni GPS</button> <button type="button" id="swStop" disabled>⏹️ Končaj segment</button></p>
    <p id="swState" role="status">Pripravljeno.</p><h4>Segmenti</h4><div id="swSegments"></div>
    <button type="button" id="swCopy">📋 Kopiraj meritve</button>`;
  const get = id => document.getElementById(id);
  let watch = null, prev = null, meters = 0, lastAt = 0, accepted = 0;
  const segments = [];
  const rad = n => n * Math.PI / 180;
  function distance(a,b) {
    const lat = rad(b.latitude-a.latitude), lon = rad(b.longitude-a.longitude);
    const x = Math.sin(lat/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(lon/2)**2;
    return 12742000*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  }
  const status = s => {get('swState').textContent = s;};
  function render() {
    const root = get('swSegments'); root.replaceChildren();
    segments.forEach((s,i) => {
      const row = document.createElement('div'); row.style.cssText='margin:8px 0;padding:8px;border-bottom:1px solid #ddd';
      const label = document.createElement('label'); label.textContent = `${i+1}. ${s.type} – dolžina (m): `;
      const length = document.createElement('input'); length.type='number'; length.min='0'; length.step='0.01'; length.value=s.length.toFixed(2); length.style.maxWidth='100px';
      length.onchange=()=>{ const n=Number(length.value); if(Number.isFinite(n)&&n>=0) s.length=n; render();};
      label.append(length); row.append(label);
      if(s.type!=='kanal') {
        const wl=document.createElement('label'); wl.textContent=' širina (m): ';
        const wi=document.createElement('input'); wi.type='number'; wi.min='0'; wi.step='0.01'; wi.value=s.width; wi.style.maxWidth='90px';
        wi.onchange=()=>{const n=Number(wi.value);if(Number.isFinite(n)&&n>=0)s.width=n;render();};
        wl.append(wi); row.append(wl);
      }
      const result=document.createElement('div'); result.textContent=`Količina: ${(s.type==='kanal'?s.length:s.length*s.width).toFixed(2)} ${s.type==='kanal'?'m':'m²'}`;row.append(result);root.append(row);
    });
  }
  function stop() {
    if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null;}
    get('swStart').disabled=false;get('swStop').disabled=true;
    if(accepted<2){status('Premalo zanesljivih GPS točk. Poskusite zunaj.');return;}
    const width=Number(get('swWidth').value);
    if(!Number.isFinite(width)||width<=0){status('Vnesite pravilno širino.');return;}
    segments.push({type:get('swSurface').value,length:meters,width});
    render();status(`Segment dodan: ${meters.toFixed(2)} m. Preverite meritev pred obračunom.`);
  }
  get('swStart').onclick=()=>{
    if(!navigator.geolocation){status('GPS ni na voljo.');return;}
    meters=0;prev=null;lastAt=0;accepted=0;
    get('swStart').disabled=true;get('swStop').disabled=false;
    status('Čakam GPS ... Dovolite lokacijo in hodite zunaj.');
    watch=navigator.geolocation.watchPosition(p=>{
      const c=p.coords, t=p.timestamp;
      if(c.accuracy>20){status(`GPS premalo natančen (±${Math.round(c.accuracy)} m). Čakam ...`);return;}
      if(prev){
        const d=distance(prev,c), dt=(t-lastAt)/1000;
        if(dt>0 && d>=1 && d/dt<=3.5){meters+=d;prev=c;lastAt=t;accepted++;}
      } else {prev=c;lastAt=t;accepted++;}
      status(`GPS dolžina: ${meters.toFixed(1)} m · natančnost ±${Math.round(c.accuracy)} m. Ne zaklepajte telefona.`);
    },e=>{status('GPS napaka: '+e.message);if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;get('swStart').disabled=false;get('swStop').disabled=true;},
    {enableHighAccuracy:true,maximumAge:0,timeout:20000});
  };
  get('swStop').onclick=stop;
  get('swCopy').onclick=()=>{
    if(!segments.length){status('Ni segmentov.');return;}
    const data=segments.map((s,i)=>`${i+1}. ${s.type}: ${s.length.toFixed(2)} m; širina ${s.width} m; količina ${(s.type==='kanal'?s.length:s.length*s.width).toFixed(2)} ${s.type==='kanal'?'m':'m²'}`).join('\n');
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(data).then(()=>status('Meritve kopirane.')).catch(()=>status(data));
    else status(data);
  };
  window.addEventListener('pagehide',()=>{if(watch!==null)navigator.geolocation.clearWatch(watch);});
const mount = () => {
  const camera = document.getElementById('sylajWalkScan');
  const izmere = document.getElementById('izmereView');
  const target = camera || izmere;

  if (target && !target.contains(el)) {
    target.appendChild(el);
  }
};

  mount();new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
})();
