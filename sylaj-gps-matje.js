/* SYLAJ - GPS Walk Scan V7 */
(() => {
  "use strict";

  if (window.sylajGpsV7) return;
  window.sylajGpsV7 = true;

  const $ = id => document.getElementById(id);
  const rad = n => n * Math.PI / 180;

  let watch = null;
  let previous = null;
  let meters = 0;
  let accepted = 0;
  let lastTime = 0;
  let segments = [];

  function distance(a, b) {
    const dLat = rad(b.latitude - a.latitude);
    const dLon = rad(b.longitude - a.longitude);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;

    return 12742000 *
      Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function message(txt) {
    if ($("swState")) $("swState").textContent = txt;
  }

  function render() {
    const box = $("swSegments");
    if (!box) return;

    box.replaceChildren();

    segments.forEach((s, i) => {
      const row = document.createElement("div");
      row.style.cssText =
        "padding:10px;border-bottom:1px solid #ddd";

      const title = document.createElement("strong");
      title.textContent = `${i + 1}. ${s.type}`;
      row.append(title);

      const length = document.createElement("input");
      length.type = "number";
      length.min = "0";
      length.step = "0.01";
      length.value = s.length.toFixed(2);
      length.style.maxWidth = "130px";

      const lengthLabel = document.createElement("label");
      lengthLabel.textContent = " Dolžina (m): ";
      lengthLabel.append(length);
      row.append(lengthLabel);

      let width = null;

      if (s.type !== "kanal") {
        width = document.createElement("input");
        width.type = "number";
        width.min = "0";
        width.step = "0.01";
        width.value = s.width;
        width.style.maxWidth = "130px";

        const widthLabel = document.createElement("label");
        widthLabel.textContent = " Širina (m): ";
        widthLabel.append(width);
        row.append(widthLabel);
      }

      const result = document.createElement("p");
      row.append(result);

      function update() {
        const l = Number(length.value);
        const w = width ? Number(width.value) : 1;

        if (l < 0 || w < 0) {
          result.textContent = "Neveljavna vrednost.";
          return;
        }

        s.length = l;
        if (width) s.width = w;

        const quantity = s.type === "kanal"
          ? l
          : l * w;

        result.textContent =
          "Količina: " + quantity.toFixed(2) +
          (s.type === "kanal" ? " m" : " m²");
      }

      length.oninput = update;
      if (width) width.oninput = update;

      update();
      box.append(row);
    });
  }

  function stopGPS() {
    if (watch !== null) {
      navigator.geolocation.clearWatch(watch);
      watch = null;
    }

    $("swStart").disabled = false;
    $("swStop").disabled = true;

    if (accepted < 2) {
      message("Premalo GPS točk. Poskusite zunaj.");
      return;
    }

    const width = Number($("swWidth").value);

    if (!Number.isFinite(width) || width <= 0) {
      message("Vnesite pravilno širino.");
      return;
    }

    segments.push({
      type: $("swSurface").value,
      length: meters,
      width: width
    });

    render();

    message(
      "Segment dodan: " + meters.toFixed(2) +
      " m. Preverite meritev."
    );
  }

  function startGPS() {
    if (!navigator.geolocation) {
      message("GPS ni na voljo.");
      return;
    }

    meters = 0;
    accepted = 0;
    previous = null;
    lastTime = 0;

    $("swStart").disabled = true;
    $("swStop").disabled = false;

    message("Čakam GPS ... Dovolite lokacijo.");

    watch = navigator.geolocation.watchPosition(
      position => {
        const c = position.coords;
        const t = position.timestamp;

        if (c.accuracy > 20) {
          message(
            "GPS premalo natančen: ±" +
            Math.round(c.accuracy) + " m"
          );
          return;
        }

        if (previous) {
          const d = distance(previous, c);
          const dt = (t - lastTime) / 1000;

          if (dt > 0 && d >= 1 && d / dt <= 3.5) {
            meters += d;
            previous = c;
            lastTime = t;
            accepted++;
          }
        } else {
          previous = c;
          lastTime = t;
          accepted++;
        }

        message(
          "GPS dolžina: " + meters.toFixed(1) +
          " m | natančnost ±" +
          Math.round(c.accuracy) + " m"
        );
      },
      error => {
        message("GPS napaka: " + error.message);

        if (watch !== null) {
          navigator.geolocation.clearWatch(watch);
          watch = null;
        }

        $("swStart").disabled = false;
        $("swStop").disabled = true;
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );
  }

  function createPanel() {
    if ($("sylajGpsWalk")) return;

    const panel = document.createElement("section");
    panel.id = "sylajGpsWalk";
    panel.className = "card";

    panel.style.cssText =
      "margin-top:18px;padding:16px;" +
      "border:1px solid #cbd5e1;" +
      "border-radius:14px;background:#f8fafc";

    panel.innerHTML = `
      <h2>📍 SYLAJ – GPS Walk Scan</h2>
      <p>Poskusna meritev dolžine med hojo.</p>

      <label>Vrsta dela
        <select id="swSurface">
          <option value="kanal">📏 Kanal</option>
          <option value="tlakovci">🧱 Tlakovci</option>
          <option value="asfalt">🛣️ Asfalt</option>
        </select>
      </label>

      <label>Širina (m)
        <input id="swWidth"
          type="number"
          min="0.01"
          step="0.01"
          value="0.60">
      </label>

      <p>
        <button type="button" id="swStart">
          ▶️ Začni GPS
        </button>

        <button type="button" id="swStop" disabled>
          ⏹️ Končaj segment
        </button>
      </p>

      <p id="swState">Pripravljeno.</p>

      <h3>📋 Segmenti</h3>
      <div id="swSegments"></div>

      <button type="button" id="swCopy">
        📋 Kopiraj meritve
      </button>

      <p style="font-size:13px">
        GPS ni geodetska meritev.
        Vse količine preverite na terenu.
      </p>
    `;

    const target = $("izmereView");

    if (target) {
      target.append(panel);
    } else {
      document.body.append(panel);
    }

    $("swStart").onclick = startGPS;
    $("swStop").onclick = stopGPS;

    $("swCopy").onclick = async () => {
      if (!segments.length) {
        message("Ni segmentov.");
        return;
      }

      const data = segments.map((s, i) => {
        const qty = s.type === "kanal"
          ? s.length
          : s.length * s.width;

        return `${i + 1}. ${s.type}: ` +
          qty.toFixed(2) +
          (s.type === "kanal" ? " m" : " m²");
      }).join("\n");

      try {
        await navigator.clipboard.writeText(data);
        message("Meritve kopirane.");
      } catch {
        message(data);
      }
    };
  }

  function init() {
    createPanel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("pagehide", () => {
    if (watch !== null) {
      navigator.geolocation.clearWatch(watch);
    }
  });
})();
