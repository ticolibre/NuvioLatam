// 7Movies provider for Nuvio (7movies.ac).
//
// 7movies.ac plays through VidRift (embed.vidrift.net). Its boot endpoint gives
// us a signed BigBang HLS master, a Vexon URL and a playback token. When a title
// has no BigBang copy, the site still has other servers (Orion, Titan, Atlas,
// Lyra, ...). Orion in particular exposes explicit "Spanish" and "Latin
// American Spanish" dubs, so we ask /api/source for them instead of returning
// nothing. `x-embed-parent` is required by boot; Orion manifests need a Referer.
//
// Hermes-safe: Promise chains only, no async/await, no optional chaining.

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var EMBED = "https://embed.vidrift.net";
var BOOT_API = EMBED + "/api/boot";
var SOURCE_API = EMBED + "/api/source";
var PLAYER_REF = EMBED + "/embed2/play";
var PARENT = "https://7movies.ac";

var BOOT_HEADERS = {
  "User-Agent": UA,
  "Accept": "application/json",
  "x-embed-parent": PARENT,
  "Origin": PARENT,
  "Referer": PARENT + "/"
};
var SOURCE_HEADERS = {
  "User-Agent": UA,
  "Accept": "application/json, text/plain, */*",
  "x-embed-parent": PARENT,
  "Origin": EMBED,
  "Referer": PLAYER_REF
};
var PLAY_HEADERS = {
  "User-Agent": UA,
  "Origin": EMBED,
  "Referer": PLAYER_REF
};

// Servers worth asking when the baked BigBang URL is missing or has no Spanish
// audio. "vela" is left out because it falls back to "titan" server-side.
var PROVIDERS = ["orion", "titan", "atlas", "lyra", "selfhost", "evion", "vexon"];

function sourcePath(mediaType, tmdbId, season, episode) {
  if (mediaType === "tv") {
    return "tv/" + tmdbId + "/" + parseInt(season, 10) + "/" + parseInt(episode, 10);
  }
  return "movie/" + tmdbId;
}

function qualityFromDimensions(width, height) {
  if (!width && !height) return "HD";
  if (width >= 3000 || height >= 2000) return "4K";
  if (width >= 1800 || height >= 1000) return "1080p";
  if (width >= 1200 || height >= 700) return "720p";
  if (width >= 800 || height >= 400) return "480p";
  return (height || width) + "p";
}

function qualityFromRes(res) {
  if (!res) return "";
  var n = parseInt(res, 10);
  if (!n) return "";
  return qualityFromDimensions(n >= 1000 ? 0 : n, n >= 1000 ? n : 0);
}

function qualityFromRungs(rungs) {
  if (!Array.isArray(rungs) || !rungs.length) return "";
  var maxW = 0;
  var maxH = 0;
  for (var i = 0; i < rungs.length; i++) {
    var w = parseInt(rungs[i] && rungs[i].width, 10) || 0;
    var h = parseInt(rungs[i] && rungs[i].height, 10) || 0;
    if (w > maxW) maxW = w;
    if (h > maxH) maxH = h;
  }
  return qualityFromDimensions(maxW, maxH);
}

function providerLabel(id) {
  var key = String(id || "").toLowerCase();
  if (key === "bigbang") return "BigBang";
  if (key === "orion") return "Orion";
  if (key === "vexon") return "Vexon";
  if (key === "evion") return "Evion";
  if (key === "titan") return "Titan";
  if (key === "atlas") return "Atlas";
  if (key === "lyra") return "Lyra";
  if (key === "selfhost") return "Direct";
  if (key === "vela") return "Vela";
  if (key === "prime") return "Prime";
  if (key === "turbo") return "Turbo";
  if (key === "cine") return "Cine";
  if (key === "comet") return "Comet";
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : "";
}

function detectLanguage(label) {
  if (!label) return "";
  var text = String(label);
  if (/latin\s*(american)?\s*spanish|spanish\s*latin|latino/i.test(text)) return "Latino";
  if (/spanish|espa\u00F1ol|castellano|espa\u00F1a/i.test(text)) return "Espa\u00F1ol";
  if (/multi[\s-]*audio/i.test(text)) return "Multi-audio";
  if (/original/i.test(text)) return "Original";
  if (/english|ingl\u00E9s/i.test(text)) return "Ingl\u00E9s";
  var parts = text.split("\xB7");
  if (parts.length > 1) return parts[1].trim();
  return "";
}

function isSpanish(language) {
  return language === "Latino" || language === "Espa\u00F1ol";
}

function absolutize(url) {
  if (!url) return "";
  return url.charAt(0) === "/" ? EMBED + url : url;
}

function parseMaster(text) {
  var info = { quality: "HD", language: "" };
  if (!text) return info;

  var maxW = 0;
  var maxH = 0;
  var variantRe = /#EXT-X-STREAM-INF:[^\n]*RESOLUTION=(\d+)x(\d+)/gi;
  var vm;
  while ((vm = variantRe.exec(text)) !== null) {
    var w = parseInt(vm[1], 10);
    var h = parseInt(vm[2], 10);
    if (w > maxW) maxW = w;
    if (h > maxH) maxH = h;
  }
  if (maxW || maxH) info.quality = qualityFromDimensions(maxW, maxH);

  var mediaRe = /#EXT-X-MEDIA:TYPE=AUDIO[^\n]*/gi;
  var mm;
  while ((mm = mediaRe.exec(text)) !== null) {
    var nameMatch = mm[0].match(/NAME="([^"]+)"/i);
    var name = nameMatch ? nameMatch[1] : "";
    if (/spanish\s*latin/i.test(name)) {
      info.language = "Latino";
      break;
    }
    if (/^spanish$/i.test(name) || /spanish\s*(es|castellano)/i.test(name)) {
      if (!info.language) info.language = "Espa\u00F1ol";
    } else if (/^english$/i.test(name) && !info.language) {
      info.language = "Ingl\u00E9s";
    }
  }
  return info;
}

function fetchJson(url, headers) {
  return fetch(url, { headers: headers, redirect: "follow" })
    .then(function (res) {
      if (!res || !res.ok) return null;
      return res.json().catch(function () {
        return null;
      });
    })
    .catch(function () {
      return null;
    });
}

function fetchText(url, headers) {
  return fetch(url, { headers: headers, redirect: "follow" })
    .then(function (res) {
      return res && res.ok ? res.text() : "";
    })
    .catch(function () {
      return "";
    });
}

function bigbangSubtitles(meta) {
  var subs = [];
  var raw = meta && Array.isArray(meta.bigbangSubtitles) ? meta.bigbangSubtitles : [];
  for (var i = 0; i < raw.length; i++) {
    var sub = raw[i];
    if (!sub || !sub.url) continue;
    if (String(sub.lang || "").toLowerCase() !== "es") continue;
    subs.push({
      url: sub.url,
      language: "es",
      name: sub.label || "Espa\u00F1ol"
    });
  }
  return subs;
}

function toStream(item, fallbackProvider) {
  if (!item || !item.url) return null;
  var providerId = String(item.provider || fallbackProvider || "").toLowerCase();
  var label = item.name || providerLabel(providerId);
  var language = detectLanguage(label);
  var quality = qualityFromRungs(item.rungs) || qualityFromRes(item.res) || "HD";
  var providerName = providerLabel(providerId);
  var titleParts = [quality];
  if (language) titleParts.push(language);
  if (providerName) titleParts.push(providerName);

  var stream = {
    name: "7Movies",
    title: titleParts.join(" \xB7 "),
    url: absolutize(item.url),
    quality: quality
  };
  if (language) stream.language = language;
  if (item.type) stream.type = item.type;
  if (stream.url.indexOf("/api/orion/") !== -1) stream.headers = PLAY_HEADERS;
  if (item.subtitleListUrl) stream._subtitleListUrl = absolutize(item.subtitleListUrl);
  return stream;
}

function resolveProvider(mediaType, tmdbId, season, episode, token, provider) {
  if (!token) return Promise.resolve([]);
  var url = SOURCE_API + "/" + sourcePath(mediaType, tmdbId, season, episode) +
    "?token=" + encodeURIComponent(token) +
    "&provider=" + encodeURIComponent(provider) +
    "&parent=" + encodeURIComponent("7movies.ac");
  return fetchJson(url, SOURCE_HEADERS).then(function (data) {
    if (!data || !Array.isArray(data.streams)) return [];
    var out = [];
    for (var i = 0; i < data.streams.length; i++) {
      var stream = toStream(data.streams[i], provider);
      if (stream) out.push(stream);
    }
    return out;
  });
}

function attachOrionSubtitles(streams) {
  var picks = [];
  for (var i = 0; i < streams.length && picks.length < 2; i++) {
    var s = streams[i];
    if (!s._subtitleListUrl || !isSpanish(s.language)) continue;
    picks.push(s);
  }
  if (!picks.length) return Promise.resolve(streams);

  return Promise.all(
    picks.map(function (stream) {
      return fetchJson(stream._subtitleListUrl, PLAY_HEADERS).then(function (data) {
        var tracks = data && Array.isArray(data.tracks) ? data.tracks : [];
        var subs = [];
        for (var t = 0; t < tracks.length; t++) {
          var track = tracks[t];
          if (!track || !track.url) continue;
          if (String(track.lang || "").toLowerCase() !== "es") continue;
          subs.push({
            url: absolutize(track.url),
            language: "es",
            name: track.label || "Espa\u00F1ol",
            headers: PLAY_HEADERS
          });
        }
        if (subs.length) stream.subtitles = subs;
      });
    })
  ).then(function () {
    return streams;
  });
}

function languageScore(language) {
  if (language === "Latino") return 0;
  if (language === "Espa\u00F1ol") return 1;
  if (language === "Original") return 2;
  if (language === "Multi-audio") return 3;
  return language ? 4 : 5;
}

function qualityScore(quality) {
  if (quality === "4K") return 4;
  if (quality === "1080p") return 3;
  if (quality === "720p") return 2;
  if (quality === "480p") return 1;
  return 0;
}

function finish(streams, started) {
  var seen = {};
  var out = [];
  for (var i = 0; i < streams.length; i++) {
    var s = streams[i];
    if (!s || !s.url || seen[s.url]) continue;
    seen[s.url] = true;
    delete s._subtitleListUrl;
    out.push(s);
  }
  out.sort(function (a, b) {
    var lang = languageScore(a.language) - languageScore(b.language);
    if (lang !== 0) return lang;
    return qualityScore(b.quality) - qualityScore(a.quality);
  });

  var elapsed = ((Date.now() - started) / 1e3).toFixed(2);
  var spanish = out.filter(function (s) {
    return isSpanish(s.language);
  }).length;
  console.log("[7Movies] \u2713 " + out.length + " stream(s), " + spanish +
    " en espa\u00F1ol, en " + elapsed + "s");
  return out;
}

function getStreams(tmdbId, mediaType, season, episode) {
  if (!tmdbId || (mediaType !== "movie" && mediaType !== "tv")) return Promise.resolve([]);
  if (mediaType === "tv" && (!season || !episode)) return Promise.resolve([]);

  var started = Date.now();
  console.log("[7Movies] Buscando: TMDB " + tmdbId + " (" + mediaType + ")" +
    (mediaType === "tv" ? " S" + season + "E" + episode : ""));

  var bootUrl = BOOT_API + "/" + sourcePath(mediaType, tmdbId, season, episode) + "?shell=1";
  return fetchJson(bootUrl, BOOT_HEADERS).then(function (boot) {
    var meta = boot && boot.meta;
    if (!meta) {
      console.log("[7Movies] Respuesta sin meta");
      return [];
    }

    var streams = [];
    var spanish = 0;

    function add(list) {
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        if (!s || !s.url) continue;
        streams.push(s);
        if (isSpanish(s.language)) spanish++;
      }
    }

    // 1) BigBang master baked into the boot response. Read the master to get
    //    the real top quality and whether Spanish audio is inside.
    var bigbang = null;
    if (meta.bigbangUrl) {
      bigbang = {
        name: "7Movies",
        title: "BigBang",
        url: meta.bigbangUrl,
        quality: "HD"
      };
      var subs = bigbangSubtitles(meta);
      if (subs.length) bigbang.subtitles = subs;
      add([bigbang]);
    }

    // 2) Vexon (absolute URL, no headers needed).
    if (meta.vexonUrl) {
      add([{
        name: "7Movies",
        title: "Vexon",
        url: meta.vexonUrl,
        quality: "HD",
        type: "hls"
      }]);
    }

    // 3) Orion's baked dub list: often includes "Latin American Spanish" and
    //    "Spanish" even when BigBang has none.
    if (Array.isArray(meta.orionStreams) && meta.orionStreams.length) {
      var orion = [];
      for (var i = 0; i < meta.orionStreams.length; i++) {
        var stream = toStream(meta.orionStreams[i], "orion");
        if (stream) orion.push(stream);
      }
      add(orion);
    }

    var refine = bigbang
      ? fetchText(bigbang.url, { "User-Agent": UA }).then(function (text) {
          var info = parseMaster(text);
          if (info.quality) bigbang.quality = info.quality;
          if (info.language) bigbang.language = info.language;
          bigbang.title = [info.quality, info.language, "BigBang"].filter(Boolean).join(" \xB7 ");
        })
      : Promise.resolve();

    return refine.then(function () {
      spanish = streams.filter(function (s) {
        return isSpanish(s.language);
      }).length;

      // 4) Nothing Spanish yet? Ask the site's other servers one by one until
      //    a Spanish dub shows up (or at least one stream is found).
      if (spanish > 0) return streams;

      var token = meta.playbackToken || "";
      var queue = PROVIDERS.slice();
      function next() {
        if (!queue.length) return Promise.resolve();
        if (streams.length > 0 && spanish === 0) {
          // keep going: a later server may still carry Spanish audio
        }
        var provider = queue.shift();
        return resolveProvider(mediaType, tmdbId, season, episode, token, provider).then(function (list) {
          add(list);
          spanish = streams.filter(function (s) {
            return isSpanish(s.language);
          }).length;
          if (spanish > 0) return;
          return next();
        });
      }
      return next().then(function () {
        return streams;
      });
    });
  }).then(function (streams) {
    if (!streams || !streams.length) return [];
    return attachOrionSubtitles(streams).then(function (withSubs) {
      return finish(withSubs, started);
    });
  }).catch(function (err) {
    console.log("[7Movies] Error: " + ((err && err.message) || err));
    return [];
  });
}

module.exports = { getStreams: getStreams };
