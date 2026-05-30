/* ============================================================
   自建卡片音乐播放器（网易云歌单 + 3D 鼠标倾斜）
   - 通过 meting 公共 API 拉取两个网易云歌单，合并为一个播放列表
   - 渐变卡片 UI：封面 / 歌名歌手 / 可视化条 / 歌单下拉 / 播放控制 / 进度条
   - 整块随鼠标做 3D 倾斜（仅桌面端）；移动端默认收起为悬浮按钮
   - 音频走 API 代理，规避网易云防盗链；用 CSS 假可视化条，无 Web Audio 跨域问题
   - 公共 API 不稳定时只需更换 META_API；歌单见 PLAYLISTS
   ============================================================ */
(function () {
  "use strict";

  var META_API = "https://api.injahow.cn/meting/?type=playlist&id=";
  var PLAYLISTS = [
    { id: "17402410685", name: "歌研社推歌 · 中文术力口" },
    { id: "13451605652", name: "歌研社推歌 · 日文术力口" }
  ];
  var TILT_MAX = 8; // 倾斜角度上限（度）

  var ICONS = {
    prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>',
    music: '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/></svg>',
    palette: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0 0 18 1.5 1.5 0 0 0 1.5-1.5c0-.39-.15-.74-.39-1-.23-.26-.39-.61-.39-1a1.5 1.5 0 0 1 1.5-1.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8zM6.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>'
  };

  var COLOR_KEY = "vstc-mp-color";
  var PRESETS = ["#4a9fe0", "#66ccff", "#9b6cff", "#ff6fa5", "#36c6a0", "#ff8a3d"];

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

  var POS_KEY = "vstc-mp-pos";

  var songs = [];
  var index = 0;
  var els = {};
  var dragging = false;
  var audio = new Audio();
  audio.preload = "none";
  audio.volume = 0.7;

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function escapeHtml(t) {
    var d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  function buildUI(mount) {
    var cover = h("div", "vstc-mp-cover");
    var coverImg = h("img");
    coverImg.alt = "";
    cover.appendChild(coverImg);

    var info = h("div", "vstc-mp-info");
    var title = h("div", "vstc-mp-title", "加载中…");
    var artist = h("div", "vstc-mp-artist", "");
    info.appendChild(title);
    info.appendChild(artist);

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
    head.appendChild(cover);
    head.appendChild(info);
    head.appendChild(eq);
    head.appendChild(colorBtn);

    var prog = h("div", "vstc-mp-progress");
    var played = h("div", "vstc-mp-played");
    prog.appendChild(played);

    var pill = h("button", "vstc-mp-pill", '<span class="vstc-mp-pill-text">歌单</span>' + ICONS.chevron);
    var ctrl = h("div", "vstc-mp-ctrl");
    var bPrev = h("button", "vstc-mp-btn", ICONS.prev);
    var bPlay = h("button", "vstc-mp-btn vstc-mp-play", ICONS.play);
    var bNext = h("button", "vstc-mp-btn", ICONS.next);
    ctrl.appendChild(bPrev);
    ctrl.appendChild(bPlay);
    ctrl.appendChild(bNext);

    var foot = h("div", "vstc-mp-foot");
    foot.appendChild(pill);
    foot.appendChild(ctrl);

    var card = h("div", "vstc-mp-card");
    card.appendChild(head);
    card.appendChild(prog);
    card.appendChild(foot);
    card.appendChild(colorPop);

    var panel = h("div", "vstc-mp-panel");
    var list = h("ul", "vstc-mp-list");
    panel.appendChild(list);

    var fab = h("button", "vstc-mp-fab", ICONS.music);

    var wrap = h("div", "vstc-mp");
    wrap.appendChild(panel);
    wrap.appendChild(card);
    wrap.appendChild(fab);
    mount.appendChild(wrap);

    els = {
      wrap: wrap, card: card, coverImg: coverImg, title: title, artist: artist,
      played: played, prog: prog, pillText: pill.querySelector(".vstc-mp-pill-text"),
      bPlay: bPlay, panel: panel, list: list
    };

    bPrev.addEventListener("click", function () { go(-1); });
    bNext.addEventListener("click", function () { go(1); });
    bPlay.addEventListener("click", toggle);
    pill.addEventListener("click", function () { panel.classList.toggle("open"); });
    cover.addEventListener("click", function () { setCollapsed(true); });
    fab.addEventListener("click", function () { setCollapsed(false); });
    prog.addEventListener("click", seek);
    colorBtn.addEventListener("click", function () { colorPop.classList.toggle("open"); });

    enableTilt(card);
    enableDrag(wrap, card);
    restorePos(wrap);
    restoreColor();

    // 移动端默认收起，避免遮挡内容
    if (window.matchMedia("(max-width: 76.1875em)").matches) setCollapsed(true);
  }

  /* 拖动：按住卡片非交互区域拖动整块，位置记忆到 localStorage */
  function enableDrag(wrap, card) {
    var sx, sy, ox, oy, moved;

    function onDown(e) {
      if (e.button !== 0) return;
      if (e.target.closest("button, .vstc-mp-progress, .vstc-mp-list, .vstc-mp-cover, .vstc-mp-colors")) return;
      dragging = true;
      moved = false;
      var r = wrap.getBoundingClientRect();
      wrap.style.left = r.left + "px";
      wrap.style.top = r.top + "px";
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
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
      localStorage.setItem(POS_KEY, JSON.stringify({
        left: parseFloat(wrap.style.left),
        top: parseFloat(wrap.style.top)
      }));
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
    wrap.style.right = "auto";
    wrap.style.bottom = "auto";
  }

  function setCollapsed(v) {
    els.wrap.classList.toggle("collapsed", v);
  }

  function renderList() {
    els.list.innerHTML = "";
    songs.forEach(function (s, i) {
      var li = h("li", i === index ? "active" : "",
        '<span class="vstc-mp-li-name">' + escapeHtml(s.name) + "</span>" +
        '<span class="vstc-mp-li-art">' + escapeHtml(s.artist) + "</span>");
      li.addEventListener("click", function () {
        load(i, true);
        els.panel.classList.remove("open");
      });
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
    audio.src = s.url;
    renderList();
    if (autoplay) audio.play().catch(function () {});
  }

  function go(dir) { load(index + dir, true); }

  function toggle() {
    if (!songs.length) { // 加载失败时点播放 = 重试
      els.title.textContent = "加载中…";
      loadSongs();
      return;
    }
    if (!audio.src) { load(index, true); return; }
    if (audio.paused) audio.play().catch(function () {}); else audio.pause();
  }

  function seek(e) {
    if (!audio.duration) return;
    var r = els.prog.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  }

  function enableTilt(card) {
    if (window.matchMedia("(hover: none)").matches) return; // 触屏不启用
    card.addEventListener("pointermove", function (e) {
      if (dragging) return; // 拖动中不做倾斜
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform =
        "rotateX(" + (-py * TILT_MAX).toFixed(2) + "deg) rotateY(" + (px * TILT_MAX).toFixed(2) + "deg)";
    });
    card.addEventListener("pointerleave", function () { card.style.transform = ""; });
  }

  audio.addEventListener("timeupdate", function () {
    if (els.played && audio.duration) {
      els.played.style.width = (audio.currentTime / audio.duration * 100) + "%";
    }
  });
  audio.addEventListener("ended", function () { go(1); });
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
      return fetch(META_API + p.id)
        .then(function (r) { return r.json(); })
        .then(function (list) {
          return (Array.isArray(list) ? list : []).map(function (s) {
            return { name: s.name, artist: s.artist, url: s.url, cover: s.pic, listName: p.name };
          });
        })
        .catch(function () { return []; });
    })).then(function (parts) {
      songs = parts.reduce(function (a, b) { return a.concat(b); }, []);
      if (!songs.length) {
        // 不再隐藏播放器，避免网络拉取失败时电脑端整个消失；提示点播放重试
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
