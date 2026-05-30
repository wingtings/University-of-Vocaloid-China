/* ============================================================
   自建卡片音乐播放器（网易云歌单）
   功能：双歌单合并 / 3D 鼠标倾斜 / 可拖动 + 位置记忆 / 颜色设置
        进度条可拖动 + 时长显示 / 列表·单曲·随机三种播放模式 / 同步歌词字幕
   公共 API 不稳定时只需更换 META_API；歌单见 PLAYLISTS
   ============================================================ */
(function () {
  "use strict";

  var META_API = "https://api.injahow.cn/meting/?type=playlist&id=";
  var PLAYLISTS = [
    { id: "17402410685", name: "歌研社推歌 · 中文术力口" },
    { id: "13451605652", name: "歌研社推歌 · 日文术力口" }
  ];
  var TILT_MAX = 8;
  var POS_KEY = "vstc-mp-pos";
  var COLOR_KEY = "vstc-mp-color";
  var MODE_KEY = "vstc-mp-mode";
  var PRESETS = ["#4a9fe0", "#66ccff", "#9b6cff", "#ff6fa5", "#36c6a0", "#ff8a3d"];
  var MODE_ORDER = ["list", "one", "shuffle"];
  var MODE_LABEL = { list: "列表循环", one: "单曲循环", shuffle: "随机播放" };

  var ICONS = {
    prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>',
    music: '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/></svg>',
    palette: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0 0 18 1.5 1.5 0 0 0 1.5-1.5c0-.39-.15-.74-.39-1-.23-.26-.39-.61-.39-1a1.5 1.5 0 0 1 1.5-1.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8zM6.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>',
    one: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>'
  };

  var songs = [];
  var index = 0;
  var mode = "list";
  var dragging = false;
  var seeking = false;
  var seekRatio = null;
  var lrc = [];
  var lrcIdx = -1;
  var els = {};
  var audio = new Audio();
  audio.preload = "none";
  audio.volume = 0.7;

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function escapeHtml(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; }
  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  /* ---------- 颜色 ---------- */
  function shade(hex, pct) {
    var c = hex.replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var n = parseInt(c, 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var t = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
    r = Math.round((t - r) * p) + r;
    g = Math.round((t - g) * p) + g;
    b = Math.round((t - b) * p) + b;
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function applyColor(hex) {
    if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) return;
    if (hex[0] !== "#") hex = "#" + hex;
    els.wrap.style.setProperty("--vc", hex);
    els.wrap.style.setProperty("--vc-l", shade(hex, 20));
    els.wrap.style.setProperty("--vc-d", shade(hex, -12));
    try { localStorage.setItem(COLOR_KEY, hex); } catch (e) {}
  }
  function restoreColor() {
    var c;
    try { c = localStorage.getItem(COLOR_KEY); } catch (e) { return; }
    if (c) applyColor(c);
  }

  /* ---------- 播放模式 ---------- */
  function setMode(m) {
    if (MODE_ORDER.indexOf(m) < 0) m = "list";
    mode = m;
    els.bMode.innerHTML = ICONS[m];
    els.bMode.title = "播放模式：" + MODE_LABEL[m];
    try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
  }
  function restoreMode() {
    var m;
    try { m = localStorage.getItem(MODE_KEY); } catch (e) {}
    setMode(m || "list");
  }
  function randIdx() {
    if (songs.length <= 1) return index;
    var n;
    do { n = Math.floor(Math.random() * songs.length); } while (n === index);
    return n;
  }

  /* ---------- 歌词 ---------- */
  function parseLrc(text) {
    var out = [];
    text.split(/\r?\n/).forEach(function (line) {
      var re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g, m, times = [], last = 0;
      while ((m = re.exec(line))) {
        var frac = m[3] ? parseInt(m[3], 10) / (m[3].length === 3 ? 1000 : 100) : 0;
        times.push(parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac);
        last = re.lastIndex;
      }
      var txt = line.slice(last).trim();
      if (times.length && txt) times.forEach(function (t) { out.push({ t: t, text: txt }); });
    });
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }
  function loadLrc(url) {
    lrc = []; lrcIdx = -1;
    els.lrc.textContent = "";
    els.lrc.classList.remove("show");
    if (!url) return;
    fetch(url).then(function (r) { return r.text(); }).then(function (text) {
      lrc = parseLrc(text);
      if (lrc.length) els.lrc.classList.add("show");
    }).catch(function () {});
  }
  function syncLrc() {
    if (!lrc.length) return;
    var ct = audio.currentTime, i = -1;
    for (var k = 0; k < lrc.length; k++) { if (lrc[k].t <= ct) i = k; else break; }
    if (i !== lrcIdx) { lrcIdx = i; els.lrc.textContent = i >= 0 ? lrc[i].text : ""; }
  }

  /* ---------- UI ---------- */
  function buildUI(mount) {
    var cover = h("div", "vstc-mp-cover");
    var coverImg = h("img"); coverImg.alt = "";
    cover.appendChild(coverImg);

    var info = h("div", "vstc-mp-info");
    var title = h("div", "vstc-mp-title", "加载中…");
    var artist = h("div", "vstc-mp-artist", "");
    info.appendChild(title); info.appendChild(artist);

    var eq = h("div", "vstc-mp-eq", "<span></span><span></span><span></span><span></span>");

    var colorBtn = h("button", "vstc-mp-color", ICONS.palette);
    colorBtn.title = "更换播放器颜色";
    var colorPop = h("div", "vstc-mp-colors");
    PRESETS.forEach(function (c) {
      var sw = h("button", "vstc-mp-sw");
      sw.style.background = c;
      sw.addEventListener("click", function () { applyColor(c); });
      colorPop.appendChild(sw);
    });
    var colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "vstc-mp-color-input";
    colorInput.addEventListener("input", function () { applyColor(colorInput.value); });
    colorPop.appendChild(colorInput);

    var head = h("div", "vstc-mp-head");
    head.appendChild(cover); head.appendChild(info); head.appendChild(eq); head.appendChild(colorBtn);

    var lrcLine = h("div", "vstc-mp-lrc");

    var track = h("div", "vstc-mp-track");
    var played = h("div", "vstc-mp-played");
    track.appendChild(played);
    var prog = h("div", "vstc-mp-progress");
    prog.appendChild(track);
    var time = h("span", "vstc-mp-time", "0:00 / 0:00");
    var bar = h("div", "vstc-mp-bar");
    bar.appendChild(prog); bar.appendChild(time);

    var pill = h("button", "vstc-mp-pill", '<span class="vstc-mp-pill-text">歌单</span>' + ICONS.chevron);
    var bMode = h("button", "vstc-mp-btn", ICONS.list);
    var bPrev = h("button", "vstc-mp-btn", ICONS.prev);
    var bPlay = h("button", "vstc-mp-btn vstc-mp-play", ICONS.play);
    var bNext = h("button", "vstc-mp-btn", ICONS.next);
    var ctrl = h("div", "vstc-mp-ctrl");
    ctrl.appendChild(bMode); ctrl.appendChild(bPrev); ctrl.appendChild(bPlay); ctrl.appendChild(bNext);
    var foot = h("div", "vstc-mp-foot");
    foot.appendChild(pill); foot.appendChild(ctrl);

    var card = h("div", "vstc-mp-card");
    card.appendChild(head); card.appendChild(lrcLine); card.appendChild(bar); card.appendChild(foot); card.appendChild(colorPop);

    var panel = h("div", "vstc-mp-panel");
    var list = h("ul", "vstc-mp-list");
    panel.appendChild(list);

    var fab = h("button", "vstc-mp-fab", ICONS.music);

    var wrap = h("div", "vstc-mp");
    wrap.appendChild(panel); wrap.appendChild(card); wrap.appendChild(fab);
    mount.appendChild(wrap);

    els = {
      wrap: wrap, card: card, coverImg: coverImg, title: title, artist: artist,
      lrc: lrcLine, track: track, played: played, time: time,
      pillText: pill.querySelector(".vstc-mp-pill-text"), bMode: bMode, bPlay: bPlay,
      panel: panel, list: list
    };

    bMode.addEventListener("click", function () { setMode(MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % 3]); });
    bPrev.addEventListener("click", function () { go(-1); });
    bNext.addEventListener("click", function () { go(1); });
    bPlay.addEventListener("click", toggle);
    pill.addEventListener("click", function () { panel.classList.toggle("open"); });
    cover.addEventListener("click", function () { setCollapsed(true); });
    fab.addEventListener("click", function () { setCollapsed(false); });
    colorBtn.addEventListener("click", function () { colorPop.classList.toggle("open"); });
    prog.addEventListener("pointerdown", startSeek);

    enableTilt(card);
    enableDrag(wrap, card);
    restorePos(wrap);
    restoreColor();
    restoreMode();

    if (window.matchMedia("(max-width: 76.1875em)").matches) setCollapsed(true);
  }

  function setCollapsed(v) { els.wrap.classList.toggle("collapsed", v); }

  function renderList() {
    els.list.innerHTML = "";
    songs.forEach(function (s, i) {
      var li = h("li", i === index ? "active" : "",
        '<span class="vstc-mp-li-name">' + escapeHtml(s.name) + "</span>" +
        '<span class="vstc-mp-li-art">' + escapeHtml(s.artist) + "</span>");
      li.addEventListener("click", function () { load(i, true); els.panel.classList.remove("open"); });
      els.list.appendChild(li);
    });
  }

  function load(i, autoplay) {
    if (!songs.length) return;
    index = (i % songs.length + songs.length) % songs.length;
    var s = songs[index];
    els.coverImg.src = s.cover || "";
    els.title.textContent = s.name || "未知曲目";
    els.title.title = s.name || "";
    els.artist.textContent = s.artist || "";
    els.pillText.textContent = s.listName || "歌单";
    els.time.textContent = "0:00 / 0:00";
    els.played.style.width = "0%";
    audio.src = s.url;
    loadLrc(s.lrc);
    renderList();
    if (autoplay) audio.play().catch(function () {});
  }

  function go(dir) {
    if (mode === "shuffle") { load(randIdx(), true); return; }
    load(index + dir, true);
  }

  function toggle() {
    if (!songs.length) { els.title.textContent = "加载中…"; loadSongs(); return; }
    if (!audio.src) { load(index, true); return; }
    if (audio.paused) audio.play().catch(function () {}); else audio.pause();
  }

  /* ---------- 进度条拖动 ---------- */
  function startSeek(e) {
    if (e.button !== 0) return;
    seeking = true;
    scrub(e);
    document.addEventListener("pointermove", scrub);
    document.addEventListener("pointerup", endSeek);
  }
  function scrub(e) {
    var r = els.track.getBoundingClientRect();
    seekRatio = clamp((e.clientX - r.left) / r.width, 0, 1);
    els.played.style.width = seekRatio * 100 + "%";
    if (audio.duration) els.time.textContent = fmt(seekRatio * audio.duration) + " / " + fmt(audio.duration);
  }
  function endSeek() {
    seeking = false;
    document.removeEventListener("pointermove", scrub);
    document.removeEventListener("pointerup", endSeek);
    if (audio.duration && seekRatio != null) audio.currentTime = seekRatio * audio.duration;
  }

  /* ---------- 倾斜 / 拖动 ---------- */
  function enableTilt(card) {
    if (window.matchMedia("(hover: none)").matches) return;
    card.addEventListener("pointermove", function (e) {
      if (dragging) return;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = "rotateX(" + (-py * TILT_MAX).toFixed(2) + "deg) rotateY(" + (px * TILT_MAX).toFixed(2) + "deg)";
    });
    card.addEventListener("pointerleave", function () { card.style.transform = ""; });
  }

  function enableDrag(wrap, card) {
    var sx, sy, ox, oy, moved;
    function onDown(e) {
      if (e.button !== 0) return;
      if (e.target.closest("button, .vstc-mp-progress, .vstc-mp-list, .vstc-mp-cover, .vstc-mp-colors")) return;
      dragging = true; moved = false;
      var r = wrap.getBoundingClientRect();
      wrap.style.left = r.left + "px"; wrap.style.top = r.top + "px";
      wrap.style.right = "auto"; wrap.style.bottom = "auto";
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      card.style.transform = "";
      wrap.classList.add("dragging");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }
    function onMove(e) {
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      wrap.style.left = clamp(ox + dx, 4, window.innerWidth - wrap.offsetWidth - 4) + "px";
      wrap.style.top = clamp(oy + dy, 4, window.innerHeight - wrap.offsetHeight - 4) + "px";
    }
    function onUp() {
      dragging = false;
      wrap.classList.remove("dragging");
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      if (moved) savePos(wrap);
    }
    card.addEventListener("pointerdown", onDown);
  }

  function savePos(wrap) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ left: parseFloat(wrap.style.left), top: parseFloat(wrap.style.top) }));
    } catch (e) {}
  }
  function restorePos(wrap) {
    var raw;
    try { raw = localStorage.getItem(POS_KEY); } catch (e) { return; }
    if (!raw) return;
    var p;
    try { p = JSON.parse(raw); } catch (e) { return; }
    if (!p || typeof p.left !== "number" || typeof p.top !== "number") return;
    wrap.style.left = clamp(p.left, 4, window.innerWidth - wrap.offsetWidth - 4) + "px";
    wrap.style.top = clamp(p.top, 4, window.innerHeight - wrap.offsetHeight - 4) + "px";
    wrap.style.right = "auto"; wrap.style.bottom = "auto";
  }

  /* ---------- 音频事件 ---------- */
  audio.addEventListener("timeupdate", function () {
    if (!seeking && audio.duration) {
      els.played.style.width = audio.currentTime / audio.duration * 100 + "%";
      els.time.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration);
    }
    syncLrc();
  });
  audio.addEventListener("loadedmetadata", function () {
    if (els.time) els.time.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration);
  });
  audio.addEventListener("ended", function () {
    if (mode === "one") { audio.currentTime = 0; audio.play().catch(function () {}); }
    else go(1);
  });
  audio.addEventListener("play", function () {
    if (!els.bPlay) return;
    els.bPlay.innerHTML = ICONS.pause;
    els.wrap.classList.add("playing");
  });
  audio.addEventListener("pause", function () {
    if (!els.bPlay) return;
    els.bPlay.innerHTML = ICONS.play;
    els.wrap.classList.remove("playing");
  });

  function loadSongs() {
    Promise.all(PLAYLISTS.map(function (p) {
      return fetch(META_API + p.id).then(function (r) { return r.json(); }).then(function (list) {
        return (Array.isArray(list) ? list : []).map(function (s) {
          return { name: s.name, artist: s.artist, url: s.url, cover: s.pic, lrc: s.lrc, listName: p.name };
        });
      }).catch(function () { return []; });
    })).then(function (parts) {
      songs = parts.reduce(function (a, b) { return a.concat(b); }, []);
      if (!songs.length) {
        els.title.textContent = "歌单加载失败，点 ▶ 重试";
        els.artist.textContent = "";
        return;
      }
      load(0, false);
    });
  }

  function init() {
    var mount = document.getElementById("vstc-player");
    if (!mount || mount.dataset.inited) return;
    mount.dataset.inited = "1";
    buildUI(mount);
    loadSongs();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
