window.LG = window.LG || {};

// Điểm khởi động: chờ trang tải xong rồi mở menu chính.
(function (LG) {
  'use strict';

  window.addEventListener('load', function () {
    LG.engine.start(LG.scenes.menu());
  });
})(window.LG);
