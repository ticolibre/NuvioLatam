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

var LANGUAGE_NAMES = [
  [/latin\s*(american)?\s*spanish|spanish\s*latin|latino|espa\u00F1ol\s*latino/i, "Latino"],
  [/spanish|espa\u00F1ol|castellano/i, "Espa\u00F1ol"],
  [/multi[\s-]*audio/i, "Multi-audio"],
  [/original/i, "Original"],
  [/english|ingl\u00E9s/i, "Ingl\u00E9s"],
  [/french|franc\u00E9s/i, "Franc\u00E9s"],
  [/german|alem\u00E1n/i, "Alem\u00E1n"],
  [/italian|italiano/i, "Italiano"],
  [/portugu/i, "Portugu\u00E9s"],
  [/russian|ruso/i, "Ruso"],
  [/ukrainian|ucraniano/i, "Ucraniano"],
  [/hindi|hind\u00FA/i, "Hindi"],
  [/tamil/i, "Tamil"],
  [/telugu|t\u00E9lugu/i, "T\u00E9lugu"],
  [/malayalam|malabar/i, "Malabar"],
  [/kannada|canar\u00E9s/i, "Canar\u00E9s"],
  [/bengali|bengal\u00ED/i, "Bengal\u00ED"],
  [/marathi/i, "Marathi"],
  [/punjabi/i, "Punjabi"],
  [/gujarati/i, "Gujarati"],
  [/urdu/i, "Urdu"],
  [/arabic|\u00E1rabe/i, "\u00C1rabe"],
  [/turkish|turco/i, "Turco"],
  [/japanese|japon\u00E9s/i, "Japon\u00E9s"],
  [/korean|coreano/i, "Coreano"],
  [/chinese|mandarin|canton\u00E9s|chino/i, "Chino"],
  [/thai|tailand\u00E9s/i, "Tailand\u00E9s"],
  [/vietnamese|vietnamita/i, "Vietnamita"],
  [/indonesian|indonesio/i, "Indonesio"],
  [/filipino|tagalog/i, "Filipino"],
  [/dutch|neerland\u00E9s/i, "Neerland\u00E9s"],
  [/polish|polaco/i, "Polaco"],
  [/swedish|sueco/i, "Sueco"],
  [/norwegian|noruego/i, "Noruego"],
  [/danish|dan\u00E9s/i, "Dan\u00E9s"],
  [/finnish|finland\u00E9s/i, "Finland\u00E9s"],
  [/greek|griego/i, "Griego"],
  [/hebrew|hebreo/i, "Hebreo"],
  [/czech|checo/i, "Checo"],
  [/hungarian|h\u00FAngaro/i, "H\u00FAngaro"],
  [/romanian|rumano/i, "Rumano"],
  [/serbian|serbio/i, "Serbio"],
  [/croatian|croata/i, "Croata"],
  [/bulgarian|b\u00FAlgaro/i, "B\u00FAlgaro"],
  [/slovak|eslovaco/i, "Eslovaco"],
  [/slovenian|esloveno/i, "Esloveno"],
  [/persian|farsi|persa/i, "Persa"],
  [/swahili|suajili/i, "Suajili"],
  [/afrikaans/i, "Afrik\u00E1ans"],
  [/icelandic|island\u00E9s/i, "Island\u00E9s"],
  [/lithuanian|lituano/i, "Lituano"],
  [/latvian|let\u00F3n/i, "Let\u00F3n"],
  [/estonian|estonio/i, "Estonio"],
  [/bosnian|bosnio/i, "Bosnio"],
  [/macedonian|macedonio/i, "Macedonio"],
  [/albanian|alban\u00E9s/i, "Alban\u00E9s"],
  [/georgian|georgiano/i, "Georgiano"],
  [/armenian|armenio/i, "Armenio"],
  [/kazakh|kazajo/i, "Kazajo"],
  [/uzbek|uzbeko/i, "Uzbeko"],
  [/azerbaijani|azer\u00ED/i, "Azer\u00ED"],
  [/nepali|nepal\u00ED/i, "Nepal\u00ED"],
  [/sinhala|cingal\u00E9s/i, "Cingal\u00E9s"],
  [/burmese|birmano/i, "Birmano"],
  [/khmer|jemer/i, "Jemer"],
  [/lao|laosiano/i, "Laosiano"],
  [/mongolian|mongol/i, "Mongol"]
];

var LANGUAGE_CODES = {
  es: "Espa\u00F1ol", spa: "Espa\u00F1ol", "es-mx": "Latino", "es-la": "Latino",
  en: "Ingl\u00E9s", eng: "Ingl\u00E9s", fr: "Franc\u00E9s", fra: "Franc\u00E9s", fre: "Franc\u00E9s",
  de: "Alem\u00E1n", deu: "Alem\u00E1n", ger: "Alem\u00E1n", it: "Italiano", ita: "Italiano",
  pt: "Portugu\u00E9s", por: "Portugu\u00E9s", ru: "Ruso", rus: "Ruso", uk: "Ucraniano", ukr: "Ucraniano",
  hi: "Hindi", hin: "Hindi", ta: "Tamil", tam: "Tamil", te: "T\u00E9lugu", tel: "T\u00E9lugu",
  ml: "Malabar", mal: "Malabar", kn: "Canar\u00E9s", kan: "Canar\u00E9s", bn: "Bengal\u00ED", ben: "Bengal\u00ED",
  ar: "\u00C1rabe", ara: "\u00C1rabe", tr: "Turco", tur: "Turco", ja: "Japon\u00E9s", jpn: "Japon\u00E9s",
  ko: "Coreano", kor: "Coreano", zh: "Chino", zho: "Chino", chi: "Chino", th: "Tailand\u00E9s", tha: "Tailand\u00E9s",
  vi: "Vietnamita", vie: "Vietnamita", id: "Indonesio", ind: "Indonesio", fil: "Filipino", tl: "Filipino",
  nl: "Neerland\u00E9s", nld: "Neerland\u00E9s", dut: "Neerland\u00E9s", pl: "Polaco", pol: "Polaco",
  sv: "Sueco", swe: "Sueco", no: "Noruego", nor: "Noruego", da: "Dan\u00E9s", dan: "Dan\u00E9s",
  fi: "Finland\u00E9s", fin: "Finland\u00E9s", el: "Griego", ell: "Griego", he: "Hebreo", heb: "Hebreo",
  cs: "Checo", ces: "Checo", hu: "H\u00FAngaro", hun: "H\u00FAngaro", ro: "Rumano", ron: "Rumano",
  sr: "Serbio", srp: "Serbio", hr: "Croata", hrv: "Croata", bg: "B\u00FAlgaro", bul: "B\u00FAlgaro",
  sk: "Eslovaco", slk: "Eslovaco", sl: "Esloveno", slv: "Esloveno", fa: "Persa", fas: "Persa", per: "Persa",
  sw: "Suajili", swa: "Suajili", af: "Afrik\u00E1ans", afr: "Afrik\u00E1ans", is: "Island\u00E9s", isl: "Island\u00E9s",
  lt: "Lituano", lit: "Lituano", lv: "Let\u00F3n", lav: "Let\u00F3n", et: "Estonio", est: "Estonio",
  bs: "Bosnio", bos: "Bosnio", mk: "Macedonio", mkd: "Macedonio", sq: "Alban\u00E9s", sqi: "Alban\u00E9s",
  ka: "Georgiano", kat: "Georgiano", hy: "Armenio", hye: "Armenio", kk: "Kazajo", kaz: "Kazajo",
  uz: "Uzbeko", uzb: "Uzbeko", az: "Azer\u00ED", aze: "Azer\u00ED", ne: "Nepal\u00ED", nep: "Nepal\u00ED",
  si: "Cingal\u00E9s", sin: "Cingal\u00E9s", my: "Birmano", mya: "Birmano", km: "Jemer", khm: "Jemer",
  lo: "Laosiano", lao: "Laosiano", mn: "Mongol", mon: "Mongol"
};

function detectLanguages(label) {
  var text = String(label || "");
  if (!text) return [];
  var out = [];

  // "Orion · Hindi Subbed" -> keep the language part only.
  var parts = text.split("\xB7");
  if (parts.length > 1) text = parts[parts.length - 1];

  var tokens = text.toLowerCase().match(/[a-z]{2,3}(?:-[a-z]{2})?/g) || [];
  for (var t = 0; t < tokens.length; t++) {
    var viaCode = LANGUAGE_CODES[tokens[t]];
    if (viaCode && out.indexOf(viaCode) === -1) out.push(viaCode);
  }

  for (var i = 0; i < LANGUAGE_NAMES.length; i++) {
    if (LANGUAGE_NAMES[i][0].test(text)) {
      var lang = LANGUAGE_NAMES[i][1];
      if (out.indexOf(lang) === -1) out.push(lang);
    }
  }

  out.sort(function (a, b) {
    return languageScore(a) - languageScore(b);
  });
  return out;
}

function detectLanguage(label) {
  var langs = detectLanguages(label);
  return langs.length ? langs[0] : "";
}

function languageLabel(languages) {
  if (!languages || !languages.length) return "";
  var ordered = languages.slice().sort(function (a, b) {
    return languageScore(a) - languageScore(b);
  });
  var head = ordered.slice(0, 3).join("/");
  if (ordered.length > 3) head += " +" + (ordered.length - 3);
  return head;
}

function isSpanish(language) {
  return language === "Latino" || language === "Espa\u00F1ol";
}

function absolutize(url) {
  if (!url) return "";
  return url.charAt(0) === "/" ? EMBED + url : url;
}

function parseMaster(text) {
  var info = { quality: "HD", language: "", languages: [] };
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
    var langMatch = mm[0].match(/LANGUAGE="([^"]+)"/i);
    var found = detectLanguages((nameMatch ? nameMatch[1] : "") + " " + (langMatch ? langMatch[1] : ""));
    for (var f = 0; f < found.length; f++) {
      if (info.languages.indexOf(found[f]) === -1) info.languages.push(found[f]);
    }
  }

  for (var s = 0; s < info.languages.length; s++) {
    if (isSpanish(info.languages[s])) {
      info.language = info.languages[s];
      break;
    }
  }
  if (!info.language && info.languages.length) info.language = info.languages[0];
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
  var languages = detectLanguages(label);
  var language = languages.length ? languages[0] : "";
  var quality = qualityFromRungs(item.rungs) || qualityFromRes(item.res) || "HD";
  var providerName = providerLabel(providerId);
  var titleParts = [quality];
  var langText = languageLabel(languages);
  if (langText) titleParts.push(langText);
  if (providerName) titleParts.push(providerName);

  var stream = {
    name: "7Movies",
    title: titleParts.join(" \xB7 "),
    url: absolutize(item.url),
    quality: quality
  };
  if (language) stream.language = language;
  if (languages.length) stream._languages = languages;
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
  var unique = [];
  for (var i = 0; i < streams.length; i++) {
    var s = streams[i];
    if (!s || !s.url || seen[s.url]) continue;
    seen[s.url] = true;
    delete s._subtitleListUrl;
    delete s._languages;
    unique.push(s);
  }

  // Spanish only: when a Spanish track exists, drop every known non-Spanish
  // source. With no Spanish, keep "Multi-audio" / untagged sources because
  // they may hide a Spanish track the player can switch to.
  var spanish = unique.filter(function (s) {
    return isSpanish(s.language);
  });
  var potential = unique.filter(function (s) {
    return s.language === "Multi-audio" || !s.language;
  });
  var out = spanish.length ? spanish : potential;

  out.sort(function (a, b) {
    var lang = languageScore(a.language) - languageScore(b.language);
    if (lang !== 0) return lang;
    return qualityScore(b.quality) - qualityScore(a.quality);
  });

  var elapsed = ((Date.now() - started) / 1e3).toFixed(2);
  var dropped = unique.length - out.length;
  console.log("[7Movies] \u2713 " + out.length + " stream(s), " + spanish.length +
    " en espa\u00F1ol" + (dropped > 0 ? ", " + dropped + " sin espa\u00F1ol descartados" : "") +
    ", en " + elapsed + "s");
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

    // 2) Vexon (absolute URL). Its master lists the audio tracks, so probe it
    //    too instead of guessing from the provider name.
    var vexon = null;
    if (meta.vexonUrl) {
      vexon = {
        name: "7Movies",
        title: "Vexon",
        url: meta.vexonUrl,
        quality: "HD",
        type: "hls"
      };
      add([vexon]);
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

    function refineMaster(stream, providerName) {
      return fetchText(stream.url, { "User-Agent": UA }).then(function (text) {
        var info = parseMaster(text);
        if (info.quality) stream.quality = info.quality;
        if (info.language) stream.language = info.language;
        stream.title = [stream.quality, languageLabel(info.languages), providerName]
          .filter(Boolean).join(" \xB7 ");
      });
    }

    var tasks = [];
    if (bigbang) tasks.push(refineMaster(bigbang, "BigBang"));
    if (vexon) tasks.push(refineMaster(vexon, "Vexon"));
    var refine = tasks.length ? Promise.all(tasks) : Promise.resolve([]);

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
