/**
 * SYLAJ-Evidenca 2.0 – Lokacija ekip (GPS)
 * Admin: mapa + zgodovina (Fitimi, Lumi, ostale ekipe)
 * Vodja: deljenje lokacije 05:00–21:00 z eksplicitnim soglasjem
 * PWA omejitve: sledenje deluje med odprto aplikacijo; v ozadju le kolikor OS dovoli.
 */
(function () {
  'use strict';
  if (window.__sylajGpsTeams) return;
  window.__sylajGpsTeams = true;

  const GPS_TABLE = 'gps_lokacije';
  const GPS_START_MIN = 5 * 60;   // 05:00
  const GPS_END_MIN = 21 * 60;    // 21:00
  const WATCH_OPTS = { enableHighAccuracy: true, maximumAge: 15000, timeout: 25000 };
  const UPLOAD_MIN_INTERVAL_MS = 45000;

  let watchId = null;
  let guardTimer = null;
  let lastUploadAt = 0;
  let busy = false;
  let leafletMap = null;
  let leafletLayer = null;
  let consentGiven = false;
  let transitioning = false;
  let sessionOpen = false;
  let trackingUser = null;

  function $(id) { return document.getElementById(id); }

  function minutesNow() {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }

  function gpsTimeAllowed() {
    const m = minutesNow();
    return m >= GPS_START_MIN && m < GPS_END_MIN;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function isVodjaOrAdmin() {
    
    const role = String((typeof currentProfile !== 'undefined' && currentProfile?.vloga) || '').toLowerCase();
    return role === 'vodja';
  }

  function getClient() {
    return (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
  }

  function getUser() {
    return (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
  }

  function setStatus(txt) {
    const el = $('gpsTeamsStatus');
    if (el) el.textContent = txt;
  }

  function setMsg(txt, isErr) {
    const el = $('gpsTeamsMsg');
    if (!el) return;
    el.textContent = txt || '';
    el.style.color = isErr ? '#b91c1c' : '#0f766e';
  }

  /* ---------- Tracking (vodja / admin) ---------- */

  async function uploadPosition(pos) {
    const client = getClient();
    const user = getUser();
    if (!client || !user || !gpsTimeAllowed() || busy || !sessionOpen || user.id !== trackingUser) return;
    const now = Date.now();
    if (now - lastUploadAt < UPLOAD_MIN_INTERVAL_MS) return;

    busy = true;
    try {
      const { error } = await client.from(GPS_TABLE).insert({
        vodja_id: user.id,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy || null,
        cas: new Date().toISOString()
      });
      if (error) throw error;
      lastUploadAt = now;
      setStatus('GPS aktiven – ' + new Date().toLocaleTimeString('sl-SI'));
      setMsg('Lokacija poslana.');
    } catch (e) {
      setMsg('Napaka pri pošiljanju: ' + (e.message || e), true);
    } finally {
      busy = false;
    }
  }

  function clearWatch() {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (guardTimer) {
      clearInterval(guardTimer);
      guardTimer = null;
    }
  }

  async function startSharing() {
    if (transitioning || watchId !== null) return;
    if (!isVodjaOrAdmin()) {
      setMsg('Deljenje lokacije je na voljo vodjem ekip in administratorju.', true);
      return;
    }
    if (!gpsTimeAllowed()) {
      setMsg('GPS je dovoljen samo med 05:00 in 21:00.', true);
      return;
    }
    if (!navigator.geolocation) {
      setMsg('Ta naprava ne podpira geolokacije.', true);
      return;
    }
    if (!consentGiven) {
      const ok = confirm(
        'SYLAJ GPS – soglasje\n\n' +
        '• Lokacija se beleži samo med 05:00 in 21:00.\n' +
        '• Samo med odprto aplikacijo (PWA ne more zanesljivo slediti, ko je aplikacija zaprta).\n' +
        '• Podatki so vidni administratorju (Fitimi / Lumi) za koordinacijo ekip.\n' +
        '• Sledenje lahko kadarkoli ustavite.\n\n' +
        'Ali dovoljujete beleženje lokacije?'
      );
      if (!ok) {
        setMsg('Sledenje ni bilo zagnano (brez soglasja).');
        return;
      }
      consentGiven = true;
    }

    const client = getClient(), user = getUser();
    if (!client || !user) return;
    transitioning = true;
    try {
      const {data, error} = await client.from('gps_seje').select('id').eq('vodja_id', user.id).is('konec', null).limit(1);
      if (error) throw error;
      if (!data?.length) {
        const result = await client.rpc('fillo_gps');
        if (result.error) throw result.error;
      }
      sessionOpen = true;
      trackingUser = user.id;
      lastUploadAt = 0;
    } catch(e) { setMsg('GPS: ' + e.message, true); return; }
    finally { transitioning = false; }
    clearWatch();
    setStatus('Zaganjam GPS…');
    setMsg('');

    watchId = navigator.geolocation.watchPosition(
      pos => uploadPosition(pos),
      err => { if (err.code === 1) stopSharing('GPS dovoljenje zavrnjeno.'); else setMsg('GPS napaka: ' + (err.message || err.code), true); },
      WATCH_OPTS
    );

    guardTimer = setInterval(() => {
      if (!gpsTimeAllowed()) {
        stopSharing('Časovno okno 05:00–21:00 se je končalo. GPS ustavljen.');
      }
    }, 30000);

    setStatus('GPS aktiven – čakam na prvo lokacijo…');
    updateShareButtons(true);
  }

  async function stopSharing(reason) {
    if (transitioning) return false;
    clearWatch();
    consentGiven = false;
    if (sessionOpen) {
      transitioning = true;
      try {
        const result = await getClient().rpc('ndalo_gps');
        if (result.error) throw result.error;
        sessionOpen = false;
        trackingUser = null;
      } catch(e) { setMsg('GPS: ' + e.message, true); updateShareButtons(true); return false; }
      finally { transitioning = false; }
    }
    setStatus('GPS ni aktiven.');
    setMsg(reason || 'Sledenje ustavljeno.');
    updateShareButtons(false);
    return true;
  }

  function updateShareButtons(active) {
    const startBtn = $('gpsShareStart');
    const stopBtn = $('gpsShareStop');
    if (startBtn) startBtn.disabled = !!active;
    if (stopBtn) stopBtn.disabled = !active;
  }

  /* ---------- Admin map + history ---------- */

  function ensureLeaflet(cb) {
    if (window.L) return cb();
    if (document.getElementById('sylaj-leaflet-css')) {
      const check = setInterval(() => { if (window.L) { clearInterval(check); cb(); } }, 100);
      return;
    }
    const link = document.createElement('link');
    link.id = 'sylaj-leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => cb();
    script.onerror = () => setMsg('Ni bilo mogoče naložiti zemljevida (Leaflet).', true);
    document.head.appendChild(script);
  }

  function destroyMap() {
    if (leafletMap) {
      try { leafletMap.remove(); } catch (_) {}
      leafletMap = null;
      leafletLayer = null;
    }
  }

  async function loadLatestPositions() {
    const client = getClient();
    if (!client) throw new Error('Supabase ni na voljo.');

    const { data: teams, error: te } = await client
      .from('ekipe')
      .select('id, naziv, vodja_id')
      .order('naziv');
    if (te) throw te;

    const leaders = [...new Map(
      (teams || []).filter(t => t.vodja_id).map(t => [t.vodja_id, t])
    ).values()];

    const points = [];
    for (const leader of leaders) {
      const { data, error } = await client
        .from(GPS_TABLE)
        .select('latitude, longitude, accuracy, cas, vodja_id')
        .eq('vodja_id', leader.vodja_id)
        .order('cas', { ascending: false })
        .limit(1);
      if (error) throw error;
      const loc = data && data[0];
      points.push({
        team: leader.naziv,
        teamId: leader.id,
        vodjaId: leader.vodja_id,
        lat: loc ? Number(loc.latitude) : null,
        lng: loc ? Number(loc.longitude) : null,
        accuracy: loc?.accuracy ?? null,
        time: loc ? new Date(loc.cas) : null
      });
    }
    return points;
  }

  function renderMap(points) {
    const box = $('gpsLiveMap');
    if (!box) return;
    destroyMap();
    box.innerHTML = '';

    const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (!valid.length) {
      box.innerHTML = '<p style="padding:24px;color:#64748b;text-align:center">Ni zabeleženih lokacij za prikaz na mapi.</p>';
      return;
    }

    ensureLeaflet(() => {
      leafletMap = L.map(box, { zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
      }).addTo(leafletMap);

      const bounds = [];
      const colors = { fitimi: '#059669', lumi: '#7c3aed' };

      valid.forEach(p => {
        const nameLower = (p.team || '').toLowerCase();
        let color = '#0a4d8c';
        if (nameLower.includes('fitim')) color = colors.fitimi;
        else if (nameLower.includes('lum')) color = colors.lumi;

        const icon = L.divIcon({
          className: 'sylaj-gps-marker',
          html: `<div style="background:${color};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">📍</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const ageMs = p.time ? Date.now() - p.time.getTime() : null;
        const fresh = ageMs != null && ageMs <= 120000;
        const popup =
          `<b>${esc(p.team)}</b><br>` +
          `Zadnja lokacija: ${p.time ? p.time.toLocaleString('sl-SI') : '—'}<br>` +
          (fresh ? '<span style="color:#059669">Sveža (≤ 2 min)</span>' : '<span style="color:#b45309">Starejša – trenutni položaj ni potrjen</span>') +
          (p.accuracy != null ? `<br>Natančnost: ±${Math.round(p.accuracy)} m` : '');

        L.marker([p.lat, p.lng], { icon }).addTo(leafletMap).bindPopup(popup);
        bounds.push([p.lat, p.lng]);
      });

      if (bounds.length === 1) leafletMap.setView(bounds[0], 14);
      else leafletMap.fitBounds(bounds, { padding: [40, 40] });

      setTimeout(() => leafletMap && leafletMap.invalidateSize(), 200);
    });
  }

  function renderCards(points) {
    const el = $('gpsTeamsCards');
    if (!el) return;
    if (!points.length) {
      el.innerHTML = '<p style="color:#64748b">Ni ekip z dodeljenim vodjo.</p>';
      return;
    }
    el.innerHTML = points.map(p => {
      const nameLower = (p.team || '').toLowerCase();
      let badge = '';
      if (nameLower.includes('fitim')) badge = ' style="border-left:4px solid #059669"';
      else if (nameLower.includes('lum')) badge = ' style="border-left:4px solid #7c3aed"';
      const has = Number.isFinite(p.lat) && Number.isFinite(p.lng);
      const ageMs = p.time ? Date.now() - p.time.getTime() : null;
      const fresh = ageMs != null && ageMs <= 120000;
      return `<div class="worker-profile-section"${badge}>
        <b>${esc(p.team)}</b>
        ${has
          ? `<p>Zadnja lokacija: ${p.time.toLocaleString('sl-SI')}</p>
             <p style="color:${fresh ? '#059669' : '#b45309'};font-size:13px">${fresh ? 'Sveža lokacija (≤ 2 min)' : 'Starejša lokacija'}</p>
             <a href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank" rel="noopener" class="action-btn" style="display:inline-block;margin-top:6px;text-decoration:none">Odpri v Google Maps</a>`
          : '<p style="color:#64748b">Ni zabeležene lokacije.</p>'}
      </div>`;
    }).join('');
  }

  async function refreshLive() {
    if (typeof isAdmin === 'undefined' || !isAdmin) return;
    setMsg('Nalagam lokacije…');
    try {
      const points = await loadLatestPositions();
      renderMap(points);
      renderCards(points);
      setMsg('Lokacije osvežene – ' + new Date().toLocaleTimeString('sl-SI'));
    } catch (e) {
      setMsg('Napaka: ' + (e.message || e) + '. Preverite tabelo gps_lokacije in RLS.', true);
    }
  }

  async function loadHistory() {
    const client = getClient();
    const list = $('gpsHistoryList');
    if (!client || !list) return;
    if (typeof isAdmin === 'undefined' || !isAdmin) {
      list.innerHTML = '<p>Zgodovina je na voljo samo administratorju.</p>';
      return;
    }

    const dateEl = $('gpsHistoryDate');
    const day = dateEl?.value || new Date().toISOString().slice(0, 10);
    const from = day + 'T00:00:00';
    const to = day + 'T23:59:59.999';

    list.innerHTML = '<p>Nalaganje zgodovine…</p>';
    try {
      const { data: teams } = await client.from('ekipe').select('id, naziv, vodja_id');
      const teamByVodja = {};
      (teams || []).forEach(t => { if (t.vodja_id) teamByVodja[t.vodja_id] = t.naziv; });

      const { data, error } = await client
        .from(GPS_TABLE)
        .select('id, vodja_id, latitude, longitude, accuracy, cas')
        .gte('cas', from)
        .lte('cas', to)
        .order('cas', { ascending: false })
        .limit(500);
      if (error) throw error;

      if (!data || !data.length) {
        list.innerHTML = `<p style="color:#64748b">Za ${esc(day)} ni zapisov.</p>`;
        return;
      }

      list.innerHTML = `<p style="margin-bottom:8px"><b>${data.length}</b> zapisov za ${esc(day)}</p>` +
        data.map(r => {
          const team = teamByVodja[r.vodja_id] || r.vodja_id;
          const t = new Date(r.cas);
          return `<div style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px">
            <b>${esc(team)}</b> · ${t.toLocaleTimeString('sl-SI')}
            <div style="color:#64748b;font-size:12px">${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}
            ${r.accuracy != null ? ` · ±${Math.round(r.accuracy)} m` : ''}
            · <a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank" rel="noopener">Maps</a></div>
          </div>`;
        }).join('');
    } catch (e) {
      list.innerHTML = `<p style="color:#b91c1c">Napaka: ${esc(e.message || e)}</p>`;
    }
  }

  /* ---------- Page render (called from navigate) ---------- */

  window.renderGpsTeams = async function renderGpsTeams() {
    const content = document.getElementById('content');
    if (!content) return;

    const admin = typeof isAdmin !== 'undefined' && isAdmin;
    const canShare = isVodjaOrAdmin();

    if (!admin && !canShare) {
      content.innerHTML = `<div class="sub-header">
        <button class="back-btn" onclick="navigate('home')">← Nazaj</button>
        <div class="title-area"><h2>📍 Lokacija ekip</h2></div>
        <button class="home-btn" onclick="navigate('home')">⌂</button>
      </div>
      <div style="padding:20px"><p>Ta modul je na voljo administratorju in vodjem ekip.</p></div>`;
      return;
    }

    content.innerHTML = `
      <div class="sub-header">
        <button class="back-btn" onclick="navigate('home')">← Nazaj</button>
        <div class="title-area"><h2>📍 Lokacija ekip</h2></div>
        <button class="home-btn" onclick="navigate('home')">⌂</button>
      </div>
      <div style="padding:14px 16px 90px">

        <div class="worker-profile-section" style="margin-bottom:14px">
          <b>Deljenje lastne lokacije</b>
          <p style="font-size:13px;color:#64748b;margin:6px 0">
            Dovoljeno 05:00–21:00. Sledenje deluje, dokler je aplikacija odprta.
            Na Androidu/iPhonu v ozadju (aplikacija zaprta) PWA ne more zanesljivo slediti – to je omejitev sistema, ne aplikacije.
          </p>
          <p id="gpsTeamsStatus" style="font-weight:600;margin:8px 0">GPS ni aktiven.</p>
          <p id="gpsTeamsMsg" style="font-size:13px;min-height:1.2em"></p>
          ${canShare ? `
            <button type="button" class="action-btn" id="gpsShareStart" onclick="window.__sylajGpsStart()">▶️ Začni deljenje</button>
            <button type="button" class="action-btn" id="gpsShareStop" disabled onclick="window.__sylajGpsStop()" style="background:#64748b">⏹ Ustavi</button>
          ` : '<p style="color:#b45309">Za deljenje lokacije potrebujete vlogo vodje ali admin.</p>'}
        </div>

        ${admin ? `
        <div class="worker-profile-section" style="margin-bottom:14px">
          <b>Živa mapa – ekipe (Fitimi, Lumi, …)</b>
          <p style="font-size:13px;color:#64748b;margin:6px 0">Zadnja znana lokacija vodij. Osvežite po potrebi.</p>
          <div id="gpsLiveMap" style="height:360px;width:100%;border-radius:12px;background:#e2e8f0;margin:10px 0;overflow:hidden"></div>
          <button type="button" class="action-btn" onclick="window.__sylajGpsRefresh()">🔄 Osveži lokacije</button>
          <div id="gpsTeamsCards" style="margin-top:12px;display:grid;gap:10px"></div>
        </div>

        <div class="worker-profile-section">
          <b>Zgodovina premikov</b>
          <p style="font-size:13px;color:#64748b;margin:6px 0">Po datumu in uri.</p>
          <label style="display:block;margin:8px 0">Datum
            <input type="date" id="gpsHistoryDate" class="form-input" style="margin-top:4px"
              value="${new Date().toISOString().slice(0, 10)}"
              onchange="window.__sylajGpsHistory()">
          </label>
          <button type="button" class="action-btn" onclick="window.__sylajGpsHistory()">Prikaži zgodovino</button>
          <div id="gpsHistoryList" style="margin-top:12px;max-height:420px;overflow:auto"></div>
        </div>
        ` : `
        <div class="worker-profile-section">
          <p style="color:#64748b">Mapa in zgodovina sta vidni samo administratorju (Fitimi / Lumi).</p>
        </div>
        `}
      </div>
    `;

    updateShareButtons(sessionOpen);
    if (watchId !== null) setStatus('GPS aktiven');

    if (admin) {
      await refreshLive();
      await loadHistory();
    }
  };

  window.__sylajGpsLogout = () => stopSharing();
  window.__sylajGpsStart = () => startSharing();
  window.__sylajGpsStop = () => stopSharing('Sledenje ustavljeno.');
  window.__sylajGpsRefresh = () => refreshLive();
  window.__sylajGpsHistory = () => loadHistory();

  // Cleanup on logout / page hide
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && watchId !== null) {
      // Keep watch if possible; some browsers throttle. Do not pretend background works.
      setMsg('Aplikacija je v ozadju – OS lahko omeji GPS. Odprite aplikacijo za zanesljivo sledenje.');
    }
  });

  window.addEventListener('beforeunload', () => {
    // Best-effort; browsers may ignore
    if (watchId !== null) clearWatch();
  });
})();
