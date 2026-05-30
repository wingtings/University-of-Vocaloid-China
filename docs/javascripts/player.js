/* ============================================================
   固定迷你音乐播放器（APlayer + 网易云歌单）
   - 通过 meting 公共 API 拉取两个网易云歌单，合并为一个播放列表
   - 音频经 API 代理，规避网易云防盗链
   - 公共 API 不稳定时只需更换 META_API；歌单 ID 见 PLAYLISTS
   ============================================================ */
(function () {
  "use strict";

  var META_API = "https://api.injahow.cn/meting/?type=playlist&id=";
  var PLAYLISTS = ["17402410685", "13451605652"]; // 网易云歌单 ID
  var THEME = "#42b8dd"; // 术力口青色

  function init() {
    var holder = document.getElementById("vstc-aplayer");
    if (!holder || typeof APlayer === "undefined") return;
    if (holder.dataset.inited) return; // 防重复初始化
    holder.dataset.inited = "1";

    Promise.all(
      PLAYLISTS.map(function (id) {
        return fetch(META_API + id)
          .then(function (r) { return r.json(); })
          .catch(function () { return []; });
      })
    ).then(function (lists) {
      var audio = [];
      lists.forEach(function (list) {
        if (!Array.isArray(list)) return;
        list.forEach(function (s) {
          audio.push({
            name: s.name,
            artist: s.artist,
            url: s.url,
            cover: s.pic,
            lrc: s.lrc,
            theme: THEME
          });
        });
      });
      if (!audio.length) return; // 拉取失败则不显示播放器，不影响页面

      new APlayer({
        container: holder,
        fixed: true,
        mini: true,
        autoplay: false,
        theme: THEME,
        loop: "all",
        order: "random",
        preload: "none",
        volume: 0.6,
        listFolded: true,
        listMaxHeight: "14rem",
        lrcType: 3,
        audio: audio
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
