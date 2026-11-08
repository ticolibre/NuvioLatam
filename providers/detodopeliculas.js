// DeTodoPeliculas provider for Nuvio (detodopeliculas.nu).
//
// The site is Cloudflare protected, so every request (including the player
// AJAX) must look like a real browser: full Accept/Sec-Fetch/sec-ch-ua headers.
// Movies embed their servers in `window.FV2_PL`; episodes expose them through
// `.fv2-epcard` cards, and long seasons are split into `?ep_bloque=bN-M`
// pages. The player list is fetched from `admin-ajax.php` (doo_player_ajax).
//
// Resolvers: Vidara (POST /api/stream) and Vidsonic (hex + reversed `_0x1`).
// bysevepoin/filemoon/savefiles/voe/waaw are intentionally skipped: they are
// either dead or gated behind a CAPTCHA/attestation that cannot run here.
//
// Hermes-safe: __async generator helper, no require(), no URL/URLSearchParams,
// no allSettled/any/matchAll, no optional chaining, no async/await syntax.

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var detodopeliculas_exports = {};
__export(detodopeliculas_exports, {
  getStreams: () => getStreams
});
function __export(target, all) {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
}
module.exports = __toCommonJS(detodopeliculas_exports);

// Indica la fuente/servidor usado junto al nombre del provider:
// "Provider (Servidor)". Si el servidor no se conoce, deja solo el nombre.
function withSourceName(base, source) {
  return source ? `${base} (${source})` : base;
}

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://detodopeliculas.nu";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "sec-ch-ua": "\"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": "\"Windows\""
};
var AJAX_HEADERS = {
  "User-Agent": UA,
  "Accept": "*/*",
  "Accept-Language": "es-MX,es;q=0.9",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "X-Requested-With": "XMLHttpRequest",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "sec-ch-ua": HEADERS["sec-ch-ua"],
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": "\"Windows\"",
  "Referer": BASE_URL + "/",
  "Origin": BASE_URL
};
var LANG_PRIORITY = ["LAT", "ESP", "SUB"];
var LANG_LABELS = { "LAT": "Latino", "ESP": "Castellano", "SUB": "Subtitulado" };

function withDeadline(promise, ms, fallback) {
  if (typeof setTimeout !== "function")
    return promise;
  return new Promise(function (resolve) {
    var settled = false;
    var timer = setTimeout(function () {
      if (settled)
        return;
      settled = true;
      resolve(fallback());
    }, Math.max(0, ms));
    promise.then(function (value) {
      if (settled)
        return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, function () {
      if (settled)
        return;
      settled = true;
      clearTimeout(timer);
      resolve(fallback());
    });
  });
}

function allSettled(promises) {
  return Promise.all(promises.map(function (p) {
    return Promise.resolve(p).then(
      function (v) { return { status: "fulfilled", value: v }; },
      function (e) { return { status: "rejected", reason: e }; }
    );
  }));
}

function merge(a, b) {
  var out = {};
  var k;
  for (k in a)
    if (__hasOwnProp.call(a, k))
      out[k] = a[k];
  for (k in b)
    if (__hasOwnProp.call(b, k))
      out[k] = b[k];
  return out;
}

function norm(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(title, year) {
  var s = norm(title).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!s)
    return "";
  return year ? s + "-" + year : s;
}

function hasLatin(str) {
  return /[a-z0-9]/i.test(str || "");
}

function decodeEntities(str) {
  return (str || "")
    .replace(/&quot;|&#34;|&#x22;/gi, "\"")
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2f;/gi, "/")
    .replace(/&amp;/gi, "&");
}

function parseJsonSafe(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function getAttr(tag, name) {
  var m = tag.match(new RegExp(name + "\\s*=\\s*[\"']([^\"']*)[\"']", "i"));
  return m ? m[1] : null;
}

function getOrigin(url) {
  var m = (url || "").match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] : "";
}

function lastPathSegment(url) {
  var clean = (url || "").split("?")[0].split("#")[0].replace(/\/+$/, "");
  return clean.substring(clean.lastIndexOf("/") + 1);
}

// --- HTTP helpers ---

function httpGet(url, headers) {
  return __async(this, null, function* () {
    var res = yield fetch(url, { headers: merge(HEADERS, headers || {}), redirect: "follow" });
    if (!res.ok)
      throw new Error("HTTP " + res.status);
    return res.text();
  });
}

// Returns { url, text } for a real page, or null for a 404/challenge page.
function fetchPage(url) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(url, { headers: HEADERS, redirect: "follow" });
      if (res.status !== 200)
        return null;
      var text = yield res.text();
      if (/p[áa]gina no encontrada/i.test(text))
        return null;
      return { url: res.url || url, text: text };
    } catch (e) {
      return null;
    }
  });
}

// --- TMDB ---

function getTmdbInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var endpoint = mediaType === "movie" ? "movie" : "tv";
    var langs = ["es-MX", "es-ES", "en-US"];
    var urls = [];
    for (var i = 0; i < langs.length; i++)
      urls.push("https://api.themoviedb.org/3/" + endpoint + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=" + langs[i]);
    var results = yield allSettled(urls.map(function (u) {
      return fetch(u, { headers: { "User-Agent": UA } }).then(function (r) {
        return r.ok ? r.json() : null;
      }).catch(function () {
        return null;
      });
    }));
    var titles = [];
    var year = "";
    for (var j = 0; j < results.length; j++) {
      if (results[j].status !== "fulfilled" || !results[j].value)
        continue;
      var data = results[j].value;
      var title = mediaType === "movie" ? data.title : data.name;
      var original = mediaType === "movie" ? data.original_title : data.original_name;
      if (title && hasLatin(title) && titles.indexOf(title) === -1)
        titles.push(title);
      if (original && hasLatin(original) && titles.indexOf(original) === -1)
        titles.push(original);
      if (!year)
        year = (data.release_date || data.first_air_date || "").substring(0, 4);
    }
    return { titles: titles, year: year };
  });
}

// --- site search / page discovery ---

function collectLinks(html, category) {
  var out = [];
  var seen = {};
  var re = /href=["']([^"']+)["']/gi;
  var m;
  while ((m = re.exec(html))) {
    var href = m[1];
    if (href.charAt(0) === "/")
      href = BASE_URL + href;
    if (href.indexOf(BASE_URL + "/" + category + "/") !== 0)
      continue;
    var slug = href.substring((BASE_URL + "/" + category + "/").length).split("?")[0].split("#")[0].replace(/\/$/, "");
    if (!slug || seen[slug])
      continue;
    seen[slug] = true;
    out.push({ href: href, slug: slug });
  }
  return out;
}

function scoreSlug(slug, title, year) {
  var ns = norm(String(slug).replace(/-/g, " "));
  var nt = norm(title);
  if (!nt)
    return -1;
  var score = 0;
  if (ns === nt)
    score += 500;
  var target = nt.split(" ").filter(Boolean);
  var candidate = ns.split(" ").filter(Boolean);
  var common = 0;
  for (var i = 0; i < target.length; i++) {
    if (candidate.indexOf(target[i]) !== -1)
      common++;
  }
  score += common * 40;
  if (target.length > 0 && common === target.length)
    score += 250;
  if (year && String(slug).indexOf(year) !== -1)
    score += 120;
  return score;
}

function findMediaPage(info, mediaType) {
  return __async(this, null, function* () {
    var category = mediaType === "movie" ? "pelicula" : "serie";
    var slugs = [];
    // Plain slugs first: the site usually redirects /pelicula/slug/ to the
    // canonical /pelicula/slug-year/ page, so this avoids a wasted 404.
    for (var i = 0; i < info.titles.length; i++) {
      var plain = slugify(info.titles[i]);
      if (plain && slugs.indexOf(plain) === -1)
        slugs.push(plain);
    }
    for (var y = 0; y < info.titles.length; y++) {
      var withYear = slugify(info.titles[y], info.year);
      if (withYear && slugs.indexOf(withYear) === -1)
        slugs.push(withYear);
    }
    if (slugs.length > 8)
      slugs = slugs.slice(0, 8);
    for (var j = 0; j < slugs.length; j += 2) {
      var batch = slugs.slice(j, j + 2);
      var results = yield allSettled(batch.map(function (slug) {
        return fetchPage(BASE_URL + "/" + category + "/" + slug + "/");
      }));
      for (var k = 0; k < results.length; k++) {
        if (results[k].status === "fulfilled" && results[k].value)
          return results[k].value;
      }
    }
    // Fallback: site search.
    for (var t = 0; t < info.titles.length; t++) {
      var html;
      try {
        html = yield httpGet(BASE_URL + "/?s=" + encodeURIComponent(info.titles[t]));
      } catch (e) {
        continue;
      }
      var links = collectLinks(html, category);
      var best = null;
      var bestScore = 0;
      for (var l = 0; l < links.length; l++) {
        var sc = scoreSlug(links[l].slug, info.titles[t], info.year);
        if (sc > bestScore) {
          bestScore = sc;
          best = links[l];
        }
      }
      if (!best)
        continue;
      var page = yield fetchPage(best.href);
      if (page)
        return page;
    }
    return null;
  });
}

// --- page parsing ---

function parseMovieServers(html) {
  var m = html.match(/window\.FV2_PL\s*=\s*\{post:(\d+),servers:(\[[\s\S]*?\]),ajax:/);
  if (!m)
    return null;
  var servers = parseJsonSafe(m[2]);
  if (!servers || !servers.length)
    return null;
  return { post: m[1], servers: servers };
}

function parseServers(raw) {
  if (!raw)
    return [];
  var arr = parseJsonSafe(decodeEntities(raw));
  return arr && arr.length ? arr : [];
}

function findEpisodeInHtml(html, season, episode) {
  var re = /<a\b[^>]*class=["'][^"']*fv2-epcard[^"']*["'][^>]*>/gi;
  var m;
  while ((m = re.exec(html))) {
    var tag = m[0];
    var s = parseInt(getAttr(tag, "data-s"), 10);
    var e = parseInt(getAttr(tag, "data-e"), 10);
    if (s !== season || e !== episode)
      continue;
    var post = getAttr(tag, "data-ep");
    if (!post)
      continue;
    return {
      post: post,
      href: getAttr(tag, "href") || "",
      servers: parseServers(getAttr(tag, "data-servers"))
    };
  }
  return null;
}

function collectBlocks(html, season) {
  var out = [];
  var re = /ep_bloque=(b(\d+)-(\d+))/gi;
  var m;
  while ((m = re.exec(html))) {
    if (parseInt(m[2], 10) !== season)
      continue;
    if (out.indexOf(m[1]) === -1)
      out.push(m[1]);
  }
  return out;
}

function getEpisode(seriesUrl, season, episode) {
  return __async(this, null, function* () {
    var seasonUrl = seriesUrl + (seriesUrl.indexOf("?") === -1 ? "?" : "&") + "ep_season=" + season;
    // Most pages put the newest episode first. Fetch the first block in
    // parallel so low episode numbers (S01E01) resolve in one round.
    var firstBlock = "b" + season + "-1";
    var results = yield allSettled([
      fetchPage(seasonUrl),
      fetchPage(seriesUrl + "?ep_bloque=" + firstBlock)
    ]);
    var page = results[0].status === "fulfilled" ? results[0].value : null;
    var firstPage = results[1].status === "fulfilled" ? results[1].value : null;
    if (page) {
      var found = findEpisodeInHtml(page.text, season, episode);
      if (found)
        return found;
    }
    if (firstPage) {
      found = findEpisodeInHtml(firstPage.text, season, episode);
      if (found)
        return found;
    }
    if (!page)
      return null;
    var blocks = collectBlocks(page.text, season);
    for (var i = 0; i < blocks.length && i < 12; i++) {
      if (blocks[i] === firstBlock)
        continue;
      var blockPage = yield fetchPage(seriesUrl + "?ep_bloque=" + blocks[i]);
      if (!blockPage)
        continue;
      found = findEpisodeInHtml(blockPage.text, season, episode);
      if (found)
        return found;
    }
    return null;
  });
}

// --- player AJAX ---

function extractEmbedUrl(value) {
  if (!value)
    return null;
  var m = value.match(/src=["']([^"']+)["']/i);
  return m ? m[1] : value;
}

function getEmbedUrl(post, nume, playerType, referer) {
  return __async(this, null, function* () {
    try {
      var body = "action=doo_player_ajax&post=" + encodeURIComponent(post) +
        "&nume=" + encodeURIComponent(nume) +
        "&type=" + encodeURIComponent(playerType);
      var res = yield fetch(BASE_URL + "/wp-admin/admin-ajax.php", {
        method: "POST",
        headers: merge(AJAX_HEADERS, { "Referer": referer, "Origin": BASE_URL }),
        body: body,
        redirect: "follow"
      });
      if (!res.ok)
        return null;
      var data = parseJsonSafe(yield res.text());
      if (!data || data.type === "trailer")
        return null;
      var url = extractEmbedUrl(data.embed_url);
      if (!url || url.indexOf("http") !== 0)
        return null;
      if (url.indexOf("youtube.com") !== -1 || url.indexOf("googletagmanager") !== -1)
        return null;
      if (url.indexOf("aviso.mp4") !== -1)
        return null;
      return url;
    } catch (e) {
      return null;
    }
  });
}

// --- resolvers ---

function normalizeResolution(width, height) {
  if (width >= 3000 || height >= 2000)
    return "4K";
  if (width >= 1800 || height >= 1000)
    return "1080p";
  if (width >= 1200 || height >= 700)
    return "720p";
  if (width >= 800 || height >= 400)
    return "480p";
  return height ? height + "p" : "HD";
}

function detectQuality(url, headers) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(url, { headers: merge({ "User-Agent": UA }, headers || {}), redirect: "follow" });
      if (!res.ok)
        return "HD";
      var text = yield res.text();
      var re = /RESOLUTION=(\d+)x(\d+)/gi;
      var m;
      var bestWidth = 0;
      var bestHeight = 0;
      while ((m = re.exec(text))) {
        var h = parseInt(m[2], 10);
        if (h > bestHeight) {
          bestHeight = h;
          bestWidth = parseInt(m[1], 10);
        }
      }
      if (bestHeight > 0)
        return normalizeResolution(bestWidth, bestHeight);
      var nm = url.match(/[_\-\/](\d{3,4})p/);
      return nm ? nm[1] + "p" : "HD";
    } catch (e) {
      return "HD";
    }
  });
}

function resolveVidara(embedUrl) {
  return __async(this, null, function* () {
    try {
      var code = lastPathSegment(embedUrl);
      if (!code)
        return null;
      var origin = getOrigin(embedUrl) || "https://vidara.to";
      var res = yield fetch(origin + "/api/stream", {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Origin": origin,
          "Referer": embedUrl
        },
        body: JSON.stringify({ filecode: code, device: "web", codecs: [] })
      });
      if (!res.ok)
        return null;
      var data = yield res.json();
      var url = data && data.streaming_url;
      if (!url)
        return null;
      var quality = yield withDeadline(
        detectQuality(url, { "Referer": origin + "/", "Origin": origin }),
        3500,
        function () { return "HD"; }
      );
      return {
        url: url,
        quality: quality,
        headers: { "User-Agent": UA, "Referer": origin + "/", "Origin": origin }
      };
    } catch (e) {
      return null;
    }
  });
}

function resolveVidsonic(embedUrl) {
  return __async(this, null, function* () {
    try {
      var res = yield fetch(embedUrl, {
        headers: merge(HEADERS, { "Referer": BASE_URL + "/" }),
        redirect: "follow"
      });
      if (!res.ok)
        return null;
      var html = yield res.text();
      var m = html.match(/_0x1\s*=\s*'([^']+)'/);
      if (!m)
        return null;
      var joined = m[1].split("|").join("");
      var decoded = "";
      for (var i = 0; i + 1 < joined.length; i += 2) {
        var code = parseInt(joined.substring(i, i + 2), 16);
        if (isNaN(code))
          return null;
        decoded += String.fromCharCode(code);
      }
      var url = decoded.split("").reverse().join("");
      if (url.indexOf("http") !== 0)
        return null;
      var origin = getOrigin(embedUrl) || "https://vidsonic.net";
      var quality = yield withDeadline(
        detectQuality(url, { "Referer": origin + "/", "Origin": origin }),
        3500,
        function () { return "HD"; }
      );
      return {
        url: url,
        quality: quality,
        headers: { "User-Agent": UA, "Referer": origin + "/", "Origin": origin }
      };
    } catch (e) {
      return null;
    }
  });
}

function getResolver(url) {
  var low = (url || "").toLowerCase();
  if (low.indexOf("vidara") !== -1)
    return { fn: resolveVidara, label: "Vidara" };
  if (low.indexOf("vidsonic") !== -1)
    return { fn: resolveVidsonic, label: "Vidsonic" };
  return null;
}

function processEmbed(embedUrl, lang) {
  return __async(this, null, function* () {
    var resolver = getResolver(embedUrl);
    if (!resolver)
      return null;
    var result = yield resolver.fn(embedUrl);
    if (!result || !result.url)
      return null;
    var quality = result.quality || "HD";
    return {
      name: withSourceName("DeTodoPeliculas", resolver.label),
      title: quality + " · " + (LANG_LABELS[lang] || "Latino") + " · " + resolver.label,
      url: result.url,
      quality: quality,
      headers: result.headers || {}
    };
  });
}

function collectEmbeds(post, servers, playerType, referer) {
  return __async(this, null, function* () {
    var groups = { LAT: [], ESP: [], SUB: [] };
    if (!servers.length)
      return groups;
    var tasks = servers.map(function (server) {
      return getEmbedUrl(post, server.nume, playerType, referer).then(function (url) {
        return url ? { url: url, lang: langCode(server.lang) } : null;
      });
    });
    var results = yield allSettled(tasks);
    var seen = {};
    for (var i = 0; i < results.length; i++) {
      if (results[i].status !== "fulfilled" || !results[i].value)
        continue;
      var item = results[i].value;
      if (seen[item.url])
        continue;
      seen[item.url] = true;
      groups[item.lang].push(item.url);
    }
    return groups;
  });
}

function resolveGroups(groups) {
  return __async(this, null, function* () {
    for (var li = 0; li < LANG_PRIORITY.length; li++) {
      var lang = LANG_PRIORITY[li];
      var urls = groups[lang];
      if (!urls || !urls.length)
        continue;
      var resolved = yield allSettled(urls.map(function (u) {
        return processEmbed(u, lang);
      }));
      var streams = [];
      var seenStreams = {};
      for (var ri = 0; ri < resolved.length; ri++) {
        if (resolved[ri].status !== "fulfilled" || !resolved[ri].value)
          continue;
        var stream = resolved[ri].value;
        if (seenStreams[stream.url])
          continue;
        seenStreams[stream.url] = true;
        streams.push(stream);
      }
      if (streams.length)
        return streams;
    }
    return [];
  });
}

function resolveServerSet(post, servers, playerType, referer) {
  return __async(this, null, function* () {
    if (!servers.length)
      return [];
    var groups = yield collectEmbeds(post, servers, playerType, referer);
    console.log("[DeTodoPeliculas] Embeds: LAT=" + groups.LAT.length + " ESP=" + groups.ESP.length + " SUB=" + groups.SUB.length);
    return resolveGroups(groups);
  });
}

// --- language helpers ---

function langCode(value) {
  var l = (value || "").toLowerCase();
  if (l.indexOf("lat") !== -1)
    return "LAT";
  if (l.indexOf("cas") !== -1 || l.indexOf("cast") !== -1 || l.indexOf("esp") !== -1)
    return "ESP";
  if (l.indexOf("sub") !== -1)
    return "SUB";
  return "LAT";
}

// --- entry point ---

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    if (mediaType === "tv" && (!season || !episode))
      return [];
    var started = Date.now();
    console.log("[DeTodoPeliculas] Buscando: TMDB " + tmdbId + " (" + mediaType + ")" + (mediaType === "tv" ? " S" + season + "E" + episode : ""));
    try {
      var info = yield getTmdbInfo(tmdbId, mediaType);
      if (!info || !info.titles.length) {
        console.log("[DeTodoPeliculas] Sin títulos TMDB");
        return [];
      }
      var media = yield findMediaPage(info, mediaType);
      if (!media) {
        console.log("[DeTodoPeliculas] Página no encontrada");
        return [];
      }
      console.log("[DeTodoPeliculas] ✓ " + media.url);

      var post;
      var servers;
      var referer = media.url;
      if (mediaType === "movie") {
        var parsed = parseMovieServers(media.text);
        if (!parsed) {
          console.log("[DeTodoPeliculas] Sin FV2_PL");
          return [];
        }
        post = parsed.post;
        servers = parsed.servers;
      } else {
        var ep = yield getEpisode(media.url, parseInt(season, 10), parseInt(episode, 10));
        if (!ep) {
          console.log("[DeTodoPeliculas] Episodio no encontrado");
          return [];
        }
        post = ep.post;
        servers = ep.servers;
        if (ep.href)
          referer = ep.href;
      }
      if (!servers || !servers.length) {
        console.log("[DeTodoPeliculas] Sin servidores");
        return [];
      }
      // The embed host is only known after asking the player endpoint, and the
      // `clean` flag is not a reliable signal (e.g. Hope lists Vidara as
      // clean:false and a dead savefiles link as clean:true). So query every
      // server in a single round; only Vidara/Vidsonic embeds are then
      // resolved, and the other hosts are never contacted.
      var valid = [];
      for (var si = 0; si < servers.length; si++) {
        if (servers[si] && servers[si].nume)
          valid.push(servers[si]);
      }
      if (!valid.length) {
        console.log("[DeTodoPeliculas] Sin servidores válidos");
        return [];
      }
      console.log("[DeTodoPeliculas] " + valid.length + " servidores, consultando players...");

      var playerType = mediaType === "movie" ? "movie" : "tv";
      var streams = yield resolveServerSet(post, valid, playerType, referer);

      if (streams.length) {
        var elapsed = ((Date.now() - started) / 1000).toFixed(2);
        console.log("[DeTodoPeliculas] ✓ " + streams.length + " streams (" + elapsed + "s)");
        return streams;
      }
      console.log("[DeTodoPeliculas] Sin streams resolubles");
      return [];
    } catch (e) {
      console.log("[DeTodoPeliculas] Error: " + ((e && e.message) || e));
      return [];
    }
  });
}
