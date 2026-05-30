/* ============================================================
   社团运行时计时
   计算社团成立日（2024-09-29）至今的天数，写入页脚 #vstc-runtime
   ============================================================ */
(function () {
  "use strict";

  var FOUNDED = new Date("2024-09-29T00:00:00+08:00");

  function update() {
    var el = document.getElementById("vstc-runtime");
    if (!el) return;
    var days = Math.floor((Date.now() - FOUNDED.getTime()) / 86400000);
    el.textContent = days >= 0 ? days : 0;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", update);
  } else {
    update();
  }
})();
