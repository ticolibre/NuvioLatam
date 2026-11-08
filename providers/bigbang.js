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
var bigbang_exports = {};
__export(bigbang_exports, {
  getStreams: () => getStreams
});
function __export(target, all) {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
}
module.exports = __toCommonJS(bigbang_exports);

// BigBang provider for Nuvio.
//
// BigBang is one of the streaming servers behind the vidrift player used by
// 7movies.ac. Its boot endpoint exposes a signed HLS master playlist that
// carries multiple audio tracks (including "Spanish Latin") and subtitle
// renditions. The `x-embed-parent` header is required: without a trusted
// parent the boot payload comes back with an empty bigbangUrl.
//
// Hermes-safe: no require(), no URL/URLSearchParams, no optional chaining.

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var BOOT_API = "https://embed.vidrift.net/api/boot";
var PARENT = "https://7movies.ac";
var HEADERS = {
  "User-Agent": UA,
  "Accept": "application/json",
  "x-embed-parent": PARENT,
  "Origin": PARENT,
  "Referer": PARENT + "/"
};

function buildBootUrl(tmdbId, mediaType, season, episode) {
  if (mediaType === "tv") {
    return BOOT_API + "/tv/" + tmdbId + "/" + parseInt(season, 10) + "/" + parseInt(episode, 10) + "?shell=1";
  }
  return BOOT_API + "/movie/" + tmdbId + "?shell=1";
}

function qualityFromDimensions(width, height) {
  if (!width && !height)
    return "HD";
  if (width >= 3000 || height >= 2000)
    return "4K";
  if (width >= 1800 || height >= 1000)
    return "1080p";
  if (width >= 1200 || height >= 700)
    return "720p";
  if (width >= 800 || height >= 400)
    return "480p";
  return (height || width) + "p";
}

function parseMaster(text) {
  var result = { quality: "HD", hasLatino: false, hasSpanish: false, hasEnglish: false };
  if (!text)
    return result;

  var maxWidth = 0;
  var maxHeight = 0;
  var variantRe = /#EXT-X-STREAM-INF:[^\n]*RESOLUTION=(\d+)x(\d+)/gi;
  var vm;
  while ((vm = variantRe.exec(text)) !== null) {
    var w = parseInt(vm[1], 10);
    var h = parseInt(vm[2], 10);
    if (w > maxWidth)
      maxWidth = w;
    if (h > maxHeight)
      maxHeight = h;
  }
  result.quality = qualityFromDimensions(maxWidth, maxHeight);

  var mediaRe = /#EXT-X-MEDIA:TYPE=AUDIO[^\n]*/gi;
  var mm;
  while ((mm = mediaRe.exec(text)) !== null) {
    var line = mm[0];
    var nameMatch = line.match(/NAME="([^"]+)"/i);
    var name = nameMatch ? nameMatch[1] : "";
    if (/spanish\s*latin/i.test(name))
      result.hasLatino = true;
    else if (/^spanish$/i.test(name) || /spanish\s*(es|castellano)/i.test(name))
      result.hasSpanish = true;
    else if (/^english$/i.test(name))
      result.hasEnglish = true;
  }
  return result;
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId || !mediaType)
      return [];
    if (mediaType !== "movie" && mediaType !== "tv")
      return [];
    if (mediaType === "tv" && (!season || !episode))
      return [];

    var startTime = Date.now();
    console.log("[BigBang] Buscando: TMDB " + tmdbId + " (" + mediaType + ")" + (mediaType === "tv" ? " S" + season + "E" + episode : ""));

    try {
      var bootUrl = buildBootUrl(tmdbId, mediaType, season, episode);
      var bootRes = yield fetch(bootUrl, { headers: HEADERS, redirect: "follow" });
      if (!bootRes.ok) {
        console.log("[BigBang] HTTP " + bootRes.status + " en boot");
        return [];
      }

      var data = yield bootRes.json();
      var meta = data && data.meta ? data.meta : null;
      if (!meta) {
        console.log("[BigBang] Respuesta sin meta");
        return [];
      }

      var streamUrl = meta.bigbangUrl || "";
      if (!streamUrl) {
        console.log("[BigBang] Sin stream para este título");
        return [];
      }

      // The master playlist tells us the real top quality and which audio
      // languages BigBang shipped. If it fails we still return the stream.
      var info = { quality: "HD", hasLatino: false, hasSpanish: false, hasEnglish: false };
      try {
        var masterRes = yield fetch(streamUrl, { headers: { "User-Agent": UA }, redirect: "follow" });
        if (masterRes.ok)
          info = parseMaster(yield masterRes.text());
      } catch (e) {
        console.log("[BigBang] No se pudo leer el master: " + e.message);
      }

      var language = info.hasLatino ? "Latino" : info.hasSpanish ? "Espa\u00F1ol" : info.hasEnglish ? "Ingl\u00E9s" : "";

      var subtitles = [];
      var rawSubs = Array.isArray(meta.bigbangSubtitles) ? meta.bigbangSubtitles : [];
      for (var i = 0; i < rawSubs.length; i++) {
        var sub = rawSubs[i];
        if (!sub || !sub.url)
          continue;
        var lang = String(sub.lang || "").toLowerCase();
        if (lang !== "es")
          continue;
        subtitles.push({
          url: sub.url,
          language: "es",
          name: sub.label || "Espa\u00F1ol"
        });
      }

      var stream = {
        name: "BigBang",
        title: [info.quality, language, "BigBang"].filter(Boolean).join(" \xB7 "),
        url: streamUrl,
        quality: info.quality,
        language: language,
        type: "hls"
      };
      if (subtitles.length)
        stream.subtitles = subtitles;

      var elapsed = ((Date.now() - startTime) / 1e3).toFixed(2);
      console.log("[BigBang] \u2713 1 stream (" + info.quality + (language ? ", " + language : "") + ") en " + elapsed + "s");
      return [stream];
    } catch (err) {
      console.log("[BigBang] Error: " + err.message);
      return [];
    }
  });
}
