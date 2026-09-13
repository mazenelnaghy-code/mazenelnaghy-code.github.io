/* air.js — live Port Said air quality from my own pipeline, with a saved sample as fallback. */
(function () {
  "use strict";

  var ME = window.ME;
  var CSV_URL = "https://mazenelnaghy-code.github.io/egypt-air-quality/data/mart_latest_city.csv";
  var TIMEOUT_MS = 5000;

  /* Published by the pipeline for 2026-09-13 11:00 UTC; used only when the live file can't be reached. */
  var SAMPLE = [
    "city_id,city_name,governorate,aqi_grid,latitude,longitude,observed_at,pm2_5,pm10,us_aqi,aqi_category,temperature_c,humidity_pct,wind_speed_kmh",
    "alexandria,Alexandria,Alexandria,alexandria,31.2001,29.9187,2026-09-13 11:00:00,11.1,19.3,52.0,Moderate,30.4,62.0,13.2",
    "aswan,Aswan,Aswan,aswan,24.0889,32.8998,2026-09-12 23:00:00,108.7,422.8,165.0,Unhealthy,31.8,23.0,17.7",
    "cairo,Cairo,Cairo,cairo_giza,30.0444,31.2357,2026-09-13 11:00:00,15.9,25.3,68.0,Moderate,35.0,35.0,10.1",
    "giza,Giza,Giza,cairo_giza,30.0131,31.2089,2026-09-13 11:00:00,15.9,25.3,68.0,Moderate,35.1,34.0,11.2",
    "luxor,Luxor,Luxor,luxor,25.6872,32.6396,2026-09-13 11:00:00,24.3,85.0,158.0,Unhealthy,41.5,11.0,7.8",
    "mansoura,Mansoura,Dakahlia,mansoura,31.0409,31.3785,2026-09-13 11:00:00,11.0,19.4,61.0,Moderate,35.8,41.0,8.4",
    "port_said,Port Said,Port Said,port_said,31.2653,32.3019,2026-09-13 11:00:00,16.5,28.7,61.0,Moderate,31.2,60.0,11.7",
    "suez,Suez,Suez,suez,29.9668,32.5498,2026-09-13 11:00:00,12.6,25.8,55.0,Moderate,34.1,39.0,17.0"
  ].join("\n");

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  }

  function splitRow(line) {
    var out = [], cur = "", quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (quoted) {
        if (ch === '"' && line.charAt(i + 1) === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  function parseCSV(text) {
    var lines = String(text || "").trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    var head = splitRow(lines[0]).map(function (h) { return h.trim(); });
    return lines.slice(1).map(function (line) {
      var cells = splitRow(line), row = {};
      head.forEach(function (h, i) { row[h] = (cells[i] || "").trim(); });
      return {
        id: row.city_id,
        name: row.city_name,
        pm25: num(row.pm2_5),
        pm10: num(row.pm10),
        aqi: num(row.us_aqi),
        category: row.aqi_category || "",
        tempC: num(row.temperature_c),
        humidity: num(row.humidity_pct),
        windKmh: num(row.wind_speed_kmh),
        // the pipeline stores observed_at in UTC without a zone suffix
        observedAt: row.observed_at ? new Date(row.observed_at.replace(" ", "T") + "Z") : null
      };
    }).filter(function (c) { return c.id && c.aqi !== null && c.pm25 !== null; });
  }

  var cairoTime = null;
  try {
    cairoTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch (e) { /* very old engines */ }

  function timeLocal(date) {
    if (!date || isNaN(date.getTime())) return "--:--";
    return cairoTime ? cairoTime.format(date) : date.toISOString().slice(11, 16) + " UTC";
  }

  function fetchLive() {
    if (ME.params.get("air") === "offline") return Promise.reject(new Error("offline requested"));
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
    return fetch(CSV_URL, { cache: "no-cache", signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var cities = parseCSV(text);
        if (!cities.length) throw new Error("no rows");
        return cities;
      })
      .finally(function () { clearTimeout(timer); });
  }

  function toState(cities, source) {
    var portSaid = cities.filter(function (c) { return c.id === "port_said"; })[0] || cities[0];
    return { source: source, cities: cities, portSaid: portSaid };
  }

  ME.air = {
    url: CSV_URL,
    parseCSV: parseCSV,
    timeLocal: timeLocal,
    state: null,
    ready: null
  };

  ME.air.ready = fetchLive()
    .then(function (cities) { return toState(cities, "live"); })
    .catch(function (err) {
      if (ME.params.get("air") !== "offline") console.warn("[air] live data unavailable, using sample:", err.message);
      return toState(parseCSV(SAMPLE), "sample");
    })
    .then(function (state) {
      ME.air.state = state;
      ME.bus.emit("air", state);
      return state;
    });
})();
