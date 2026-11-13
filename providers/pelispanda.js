// Pelispanda provider for Nuvio (pelispanda.org, tema "wpreact").
//
// Flujo:
//   TMDB (títulos en es-MX / es-ES / en-US)
//     -> API /wp-json/wpreact/v1/search (los resultados traen tmdb_id)
//     -> movie|serie|anime/{slug}/related (lista de embeds)
//     -> resolver Vimeos / VOE / genérico
//
// Hermes-safe: sin require(), URL, URLSearchParams, matchAll ni optional chaining.

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE = "https://pelispanda.org";
var API = BASE + "/wp-json/wpreact/v1/";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
var JSON_HEADERS = { "User-Agent": UA, "Accept": "application/json" };
var HTML_HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9"
};

// Indica la fuente/servidor usado junto al nombre del provider:
// "Provider (Servidor)". Si el servidor no se conoce, deja solo el nombre.
function withSourceName(base, source) {
  return source ? base + " (" + source + ")" : base;
}

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(list) {
  var out = [];
  var seen = {};
  for (var i = 0; i < list.length; i++) {
    var v = list[i];
    if (!v) continue;
    var k = String(v).toLowerCase();
    if (seen[k]) continue;
    seen[k] = true;
    out.push(v);
  }
  return out;
}

function scoreTitle(candidate, targets) {
  var nc = normalize(candidate);
  if (!nc) return -9999;
  var best = -9999;
  for (var i = 0; i < targets.length; i++) {
    var nt = normalize(targets[i]);
    if (!nt) continue;
    var score;
    if (nc === nt) {
      score = 1000;
    } else if (nc.indexOf(nt) === 0 || nt.indexOf(nc) === 0) {
      score = 800;
    } else if (nc.indexOf(nt) !== -1 || nt.indexOf(nc) !== -1) {
      score = 650;
    } else {
      var ct = nt.split(" ").filter(Boolean);
      var cr = nc.split(" ").filter(Boolean);
      var common = 0;
      for (var t = 0; t < ct.length; t++) {
        if (cr.indexOf(ct[t]) !== -1) common++;
      }
      if (!ct.length || !cr.length) continue;
      score = Math.round((common / Math.min(ct.length, cr.length)) * 500);
    }
    if (score > best) best = score;
  }
  return best;
}

function compatibleType(mediaType, item) {
  var t = String((item && item.type) || "").toLowerCase();
  if (mediaType === "movie") return t === "pelicula" || t === "película";
  return t === "serie" || t === "anime";
}

function httpJson(url) {
  return fetch(url, { headers: JSON_HEADERS, redirect: "follow" }).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
}

function httpText(url, headers) {
  return fetch(url, { headers: headers || HTML_HEADERS, redirect: "follow" }).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  });
}

function getTmdbData(tmdbId, mediaType) {
  var endpoint = mediaType === "movie" ? "movie" : "tv";
  var langs = ["es-MX", "es-ES", "en-US"];
  return Promise.all(
    langs.map(function (lang) {
      var url = "https://api.themoviedb.org/3/" + endpoint + "/" + tmdbId +
        "?api_key=" + TMDB_API_KEY + "&language=" + lang;
      return fetch(url, { headers: { "User-Agent": UA } })
        .then(function (r) { return r.json(); })
        .catch(function () { return null; });
    })
  ).then(function (rows) {
    var titles = [];
    var year = "";
    for (var i = 0; i < rows.length; i++) {
      var data = rows[i];
      if (!data) continue;
      var title = mediaType === "movie" ? data.title : data.name;
      var original = mediaType === "movie" ? data.original_title : data.original_name;
      if (title) titles.push(title);
      if (original) titles.push(original);
      if (!year) {
        var date = mediaType === "movie" ? data.release_date : data.first_air_date;
        if (date) year = String(date).substring(0, 4);
      }
    }
    titles = uniq(titles);
    if (!titles.length) return null;
    var main = titles[0];
    console.log("[Pelispanda] TMDB: \"" + main + "\"" + (year ? " (" + year + ")" : ""));
    return { titles: titles, year: year };
  });
}

function searchSite(query) {
  var url = API + "search?query=" + encodeURIComponent(query) + "&posts_per_page=40&page=1";
  return httpJson(url).then(function (data) {
    return data && data.results ? data.results : [];
  }).catch(function (e) {
    console.log("[Pelispanda] Error búsqueda \"" + query + "\": " + e.message);
    return [];
  });
}

function findItem(info, tmdbId, mediaType) {
  var targets = info.titles;
  var seen = {};
  var items = [];
  var exact = null;

  function add(results) {
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (!r || !r.slug || !compatibleType(mediaType, r)) continue;
      var key = String(r.type) + ":" + String(r.slug);
      if (seen[key]) continue;
      seen[key] = true;
      items.push(r);
      if (String(r.tmdb_id) === String(tmdbId)) exact = r;
    }
  }

  function next(index) {
    // Corta en cuanto aparece el tmdb_id exacto.
    if (exact || index >= targets.length) return Promise.resolve();
    return searchSite(targets[index]).then(function (results) {
      add(results);
      return next(index + 1);
    });
  }

  return next(0).then(function () {
    if (exact) {
      console.log("[Pelispanda] ✓ tmdb_id " + tmdbId + " -> " + exact.slug + " (" + exact.type + ")");
      return exact;
    }

    var best = null;
    var bestScore = -9999;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var score = scoreTitle(item.title, targets);
      var original = item.original_title ? scoreTitle(item.original_title, targets) : -9999;
      if (original > score) score = original;
      var itemYear = String(item.year || "").substring(0, 4);
      if (info.year && itemYear) {
        if (itemYear === info.year) score += 80;
        else if (Math.abs(parseInt(itemYear, 10) - parseInt(info.year, 10)) <= 1) score += 40;
        else score -= 250;
      }
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    if (best && (bestScore >= 900 || (bestScore >= 780 && info.year))) {
      console.log("[Pelispanda] ✓ Coincidencia por título: " + best.title + " -> " + best.slug);
      return best;
    }
    return null;
  });
}

function getRelated(kind, slug) {
  var url = API + kind + "/" + encodeURIComponent(slug) + "/related";
  return httpJson(url).catch(function (e) {
    console.log("[Pelispanda] Error related: " + e.message);
    return null;
  });
}

function normalizeLang(raw) {
  var s = String(raw || "").toLowerCase();
  if (s.indexOf("latino") !== -1) return "Latino";
  if (s.indexOf("castellano") !== -1) return "Castellano";
  if (s.indexOf("sub") !== -1) return "Subtitulado";
  if (s.indexOf("espa") !== -1) return "Español";
  if (s.indexOf("ingl") !== -1) return "Inglés";
  return raw ? String(raw).trim() : "Español";
}

function langRank(label) {
  if (label === "Latino") return 4;
  if (label === "Castellano") return 3;
  if (label === "Español") return 2;
  if (label === "Subtitulado") return 1;
  return 0;
}

function embedQuality(embed) {
  var raw = String((embed && embed.quality) || "");
  var m = raw.match(/(\d{3,4})\s*p/i);
  if (m) return m[1] + "p";
  var s = raw.toLowerCase();
  if (s.indexOf("4k") !== -1 || s.indexOf("2160") !== -1) return "4K";
  if (s.indexOf("full") !== -1 || s.indexOf("1080") !== -1) return "1080p";
  if (s.indexOf("hd") !== -1 || s.indexOf("720") !== -1) return "720p";
  if (s.indexOf("sd") !== -1 || s.indexOf("480") !== -1) return "480p";
  if (s.indexOf("cam") !== -1) return "CAM";
  return "Unknown";
}

function qualityRank(q) {
  if (q === "4K") return 5;
  if (q === "1080p") return 4;
  if (q === "720p") return 3;
  if (q === "480p") return 2;
  if (q === "360p") return 1;
  return 0;
}

function hostOf(url) {
  var m = String(url || "").match(/^https?:\/\/([^\/]+)/i);
  return m ? m[1].replace(/^www\./i, "") : "";
}

function serverName(url) {
  var h = hostOf(url).toLowerCase();
  if (h.indexOf("vimeos") !== -1) return "Vimeos";
  if (/^voe\./.test(h) || h.indexOf("cloudwindow") !== -1) return "VOE";
  if (h.indexOf("streamwish") !== -1 || h.indexOf("hlswish") !== -1 || h.indexOf("strwish") !== -1) return "StreamWish";
  if (h.indexOf("vidhide") !== -1 || h.indexOf("minochinos") !== -1 || h.indexOf("dintezuvio") !== -1) return "VidHide";
  if (h.indexOf("goodstream") !== -1) return "GoodStream";
  if (h.indexOf("filemoon") !== -1) return "Filemoon";
  if (h.indexOf("dood") !== -1) return "DoodStream";
  if (h.indexOf("uqload") !== -1) return "Uqload";
  var base = h.split(".")[0] || "Online";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// --- utilidades de resolución -------------------------------------------

function b64decode(str) {
  try {
    if (typeof atob === "function") return atob(str);
  } catch (e) {}
  try {
    if (typeof Buffer !== "undefined") return Buffer.from(str, "base64").toString("binary");
  } catch (e) {}
  return null;
}

function unpackPacker(data) {
  var m = String(data || "").match(
    /eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/
  );
  if (!m) return null;
  var p = m[1];
  var a = parseInt(m[2], 10);
  var c = parseInt(m[3], 10);
  var k = m[4].split("|");
  while (c--) {
    if (k[c]) p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
  }
  return p;
}

function pickPlaylist(text) {
  var m = String(text || "").match(/"(?:hls[234]|file)"\s*:\s*"([^"]+\.(?:m3u8|mp4)[^"]*)"/i);
  if (!m) m = String(text || "").match(/'(?:hls[234]|file)'\s*:\s*'([^']+\.(?:m3u8|mp4)[^']*)'/i);
  if (!m) m = String(text || "").match(/["']([^"']+\.m3u8[^"']*)['"]/i);
  if (!m) m = String(text || "").match(/["']([^"']+\.mp4[^"']*)['"]/i);
  if (!m) m = String(text || "").match(/https?:\/\/[^\s"'\\<>]+\.m3u8[^\s"'\\<>]*/i);
  if (!m) return null;
  var url = m[1] || m[0];
  return url ? String(url) : null;
}

function absolute(url, baseUrl) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.charAt(0) === "/") {
    var origin = String(baseUrl || "").match(/^(https?:\/\/[^\/]+)/i);
    return origin ? origin[1] + url : url;
  }
  return url;
}

var TIER_MAPS = {
  vimeos: { x: "1080p", o: "1080p", h: "720p", n: "480p", l: "360p" },
  voe: { x: "1080p", h: "720p", n: "720p", l: "360p" }
};
var TIER_PRIORITY = ["x", "o", "h", "n", "l"];

function inferQuality(url) {
  if (!url) return "Unknown";
  var map = null;
  if (url.indexOf("vimeos") !== -1) map = TIER_MAPS.vimeos;
  else if (url.indexOf("cloudwindow") !== -1 || url.indexOf("voe") !== -1) map = TIER_MAPS.voe;
  if (map) {
    var tierMatch = String(url).match(/_,([a-z,]+),\.urlset/);
    if (tierMatch) {
      var tiers = tierMatch[1].split(",").filter(Boolean);
      for (var i = 0; i < TIER_PRIORITY.length; i++) {
        if (tiers.indexOf(TIER_PRIORITY[i]) !== -1 && map[TIER_PRIORITY[i]]) return map[TIER_PRIORITY[i]];
      }
    }
  }
  var num = String(url).match(/[_\-\/](\d{3,4})p/);
  if (num) return num[1] + "p";
  return "Unknown";
}

function normalizeResolution(width, height) {
  if (width >= 3840 || height >= 2160) return "4K";
  if (width >= 1920 || height >= 1080) return "1080p";
  if (width >= 1280 || height >= 720) return "720p";
  if (width >= 854 || height >= 480) return "480p";
  return "360p";
}

function detectQuality(url, headers) {
  if (!url || String(url).indexOf(".m3u8") === -1) return Promise.resolve("Unknown");
  var merged = { "User-Agent": UA };
  if (headers) {
    for (var k in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, k)) merged[k] = headers[k];
    }
  }
  return fetch(url, { headers: merged, redirect: "follow" })
    .then(function (res) { return res.text(); })
    .then(function (data) {
      if (String(data).indexOf("#EXT-X-STREAM-INF") === -1) return "Unknown";
      var bestWidth = 0;
      var bestHeight = 0;
      var lines = String(data).split("\n");
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(/RESOLUTION=(\d+)x(\d+)/);
        if (m) {
          var h = parseInt(m[2], 10);
          if (h > bestHeight) {
            bestHeight = h;
            bestWidth = parseInt(m[1], 10);
          }
        }
      }
      return bestHeight > 0 ? normalizeResolution(bestWidth, bestHeight) : "Unknown";
    })
    .catch(function () { return "Unknown"; });
}

function resolveVimeos(url) {
  console.log("[Pelispanda][Vimeos] Resolviendo: " + url);
  return httpText(url, {
    "User-Agent": UA,
    "Referer": BASE + "/",
    "Accept": "text/html,application/xhtml+xml,*/*"
  }).then(function (data) {
    var unpacked = unpackPacker(data);
    var playlist = pickPlaylist(unpacked || data);
    if (!playlist) {
      console.log("[Pelispanda][Vimeos] No se encontró playlist");
      return null;
    }
    var headers = { "User-Agent": UA, "Referer": "https://vimeos.net/" };
    var quality = inferQuality(playlist);
    if (quality !== "Unknown") return { url: playlist, quality: quality, headers: headers };
    return detectQuality(playlist, headers).then(function (probed) {
      return { url: playlist, quality: probed !== "Unknown" ? probed : quality, headers: headers };
    });
  }).catch(function (e) {
    console.log("[Pelispanda][Vimeos] Error: " + e.message);
    return null;
  });
}

function voeDecode(ct, luts) {
  try {
    var raw = String(luts)
      .replace(/^\[|\]$/g, "")
      .split(/['"]\s*,\s*['"]/)
      .map(function (s) { return s.replace(/^['"]+|['"]+$/g, ""); });
    var txt = "";
    for (var i = 0; i < ct.length; i++) {
      var x = ct.charCodeAt(i);
      if (x > 64 && x < 91) x = (x - 52) % 26 + 65;
      else if (x > 96 && x < 123) x = (x - 84) % 26 + 97;
      txt += String.fromCharCode(x);
    }
    for (var j = 0; j < raw.length; j++) {
      if (raw[j]) txt = txt.split(raw[j]).join("_");
    }
    txt = txt.split("_").join("");
    var decoded = b64decode(txt);
    if (!decoded) return null;
    var step = "";
    for (var k = 0; k < decoded.length; k++) {
      step += String.fromCharCode((decoded.charCodeAt(k) - 3 + 256) % 256);
    }
    var finalStr = b64decode(step.split("").reverse().join(""));
    if (!finalStr) return null;
    return JSON.parse(finalStr);
  } catch (e) {
    console.log("[Pelispanda][VOE] voeDecode error: " + e.message);
    return null;
  }
}

function resolveVoe(url) {
  console.log("[Pelispanda][VOE] Resolviendo: " + url);
  var current = url;

  function load(target, depth) {
    if (depth > 3) return Promise.resolve("");
    return httpText(target, {
      "User-Agent": UA,
      "Referer": url,
      "Accept": "text/html,application/xhtml+xml,*/*"
    }).then(function (data) {
      // Página intermedia que redirige por JS a un dominio rotativo.
      var redirect = data.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
      if (redirect && data.indexOf('json">') === -1 && data.indexOf("<video") === -1) {
        current = absolute(redirect[1], current);
        console.log("[Pelispanda][VOE] Redirect -> " + current);
        return load(current, depth + 1);
      }
      return data;
    });
  }

  return load(current, 0).then(function (data) {
    if (!data) return null;
    var main = data.match(
      /json">\s*\[\s*['"]([^'"]+)['"]\s*\]\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i
    );
    if (!main) return null;
    var encoded = main[1];
    var loaderUrl = absolute(main[2], current);
    return httpText(loaderUrl, {
      "User-Agent": UA,
      "Referer": current,
      "Accept": "*/*"
    }).then(function (js) {
      var repl = js.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) ||
        js.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
      if (!repl) return null;
      var decoded = voeDecode(encoded, repl[1]);
      if (!decoded) return null;
      var playlist = decoded.source || decoded.direct_access_url || null;
      if (!playlist) return null;
      var headers = { "User-Agent": UA, "Referer": current };
      var quality = inferQuality(playlist);
      if (quality !== "Unknown") return { url: playlist, quality: quality, headers: headers };
      return detectQuality(playlist, headers).then(function (probed) {
        return { url: playlist, quality: probed !== "Unknown" ? probed : quality, headers: headers };
      });
    });
  }).catch(function (e) {
    console.log("[Pelispanda][VOE] Error: " + e.message);
    return null;
  });
}

function resolveGeneric(url) {
  console.log("[Pelispanda][Genérico] Resolviendo: " + url);
  return httpText(url, {
    "User-Agent": UA,
    "Referer": BASE + "/",
    "Accept": "text/html,application/xhtml+xml,*/*"
  }).then(function (data) {
    var unpacked = unpackPacker(data);
    var playlist = pickPlaylist(unpacked || data) || pickPlaylist(data);
    if (!playlist) return null;
    var headers = { "User-Agent": UA, "Referer": url };
    var quality = inferQuality(playlist);
    if (quality !== "Unknown") return { url: playlist, quality: quality, headers: headers };
    return detectQuality(playlist, headers).then(function (probed) {
      return { url: playlist, quality: probed !== "Unknown" ? probed : quality, headers: headers };
    });
  }).catch(function (e) {
    console.log("[Pelispanda][Genérico] Error: " + e.message);
    return null;
  });
}

function resolveEmbed(url) {
  var h = hostOf(url).toLowerCase();
  if (h.indexOf("vimeos") !== -1) return resolveVimeos(url);
  if (/^voe\./.test(h) || h.indexOf("voe.") !== -1) return resolveVoe(url);
  return resolveGeneric(url);
}

function pickEmbeds(related, mediaType, season, episode) {
  var list = (related && related.embeds) || [];
  var out = [];
  var seen = {};
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e || !e.url || !/^https?:\/\//i.test(e.url)) continue;
    if (mediaType === "tv") {
      if (Number(e.season) !== Number(season) || Number(e.episode) !== Number(episode)) continue;
    }
    var key = String(e.url);
    if (seen[key]) continue;
    seen[key] = true;
    out.push(e);
  }
  out.sort(function (a, b) {
    return (langRank(normalizeLang(b.lang)) - langRank(normalizeLang(a.lang))) ||
      (qualityRank(embedQuality(b)) - qualityRank(embedQuality(a)));
  });
  return out.slice(0, 4);
}

function getStreams(tmdbId, mediaType, season, episode) {
  if (!tmdbId || !mediaType) return Promise.resolve([]);
  if (mediaType !== "movie" && mediaType !== "tv") return Promise.resolve([]);
  if (mediaType === "tv" && (!season || !episode)) return Promise.resolve([]);

  var startTime = Date.now();
  console.log("[Pelispanda] Buscando: TMDB " + tmdbId + " (" + mediaType + ")" +
    (mediaType === "tv" ? " S" + season + "E" + episode : ""));

  return getTmdbData(tmdbId, mediaType).then(function (info) {
    if (!info) {
      console.log("[Pelispanda] Sin datos de TMDB");
      return [];
    }
    return findItem(info, tmdbId, mediaType).then(function (item) {
      if (!item) {
        console.log("[Pelispanda] No encontrado en el sitio");
        return [];
      }
      var kind = String(item.type).toLowerCase() === "anime" ? "anime" : "serie";
      if (String(item.type).toLowerCase() === "pelicula" || String(item.type).toLowerCase() === "película") {
        kind = "movie";
      }
      return getRelated(kind, item.slug).then(function (related) {
        if (!related) return [];
        var embeds = pickEmbeds(related, mediaType, season, episode);
        if (!embeds.length) {
          console.log("[Pelispanda] Sin embeds disponibles");
          return [];
        }
        console.log("[Pelispanda] " + embeds.length + " embed(s) para resolver");

        var streams = [];
        var chain = Promise.resolve();
        embeds.forEach(function (embed) {
          chain = chain.then(function () {
            return resolveEmbed(embed.url).then(function (res) {
              if (!res || !res.url) return;
              var suggested = embedQuality(embed);
              var quality = res.quality && res.quality !== "Unknown" ? res.quality : suggested;
              if (quality === "Unknown" || quality === "HD") quality = suggested;
              var lang = normalizeLang(embed.lang);
              var server = serverName(embed.url);
              for (var i = 0; i < streams.length; i++) {
                if (streams[i].url === res.url) return;
              }
              streams.push({
                name: withSourceName("Pelispanda", server),
                title: quality + " · " + lang + " · " + server,
                url: res.url,
                quality: quality,
                headers: res.headers || {}
              });
            });
          });
        });

        return chain.then(function () {
          streams.sort(function (a, b) {
            return (langRank(normalizeLang(a.title.split(" · ")[1])) -
              langRank(normalizeLang(b.title.split(" · ")[1]))) ||
              (qualityRank(b.quality) - qualityRank(a.quality));
          });
          var elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
          console.log("[Pelispanda] ✓ " + streams.length + " streams en " + elapsed + "s");
          return streams;
        });
      });
    });
  }).catch(function (e) {
    console.log("[Pelispanda] Error: " + (e && e.message ? e.message : e));
    return [];
  });
}

module.exports = { getStreams: getStreams };
