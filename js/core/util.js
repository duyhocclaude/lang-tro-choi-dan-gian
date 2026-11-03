// Toàn bộ game dùng chung một "namespace" là window.LG (Làng Game)
// để các file không giẫm lên biến của nhau.
window.LG = window.LG || {};

(function (LG) {
  'use strict';

  LG.util = {
    // Giới hạn v trong khoảng [min, max]
    clamp: function (v, min, max) {
      return v < min ? min : v > max ? max : v;
    },

    // Nội suy tuyến tính: t = 0 -> a, t = 1 -> b
    lerp: function (a, b, t) {
      return a + (b - a) * t;
    },

    rand: function (min, max) {
      return min + Math.random() * (max - min);
    },

    randInt: function (min, max) {
      return Math.floor(min + Math.random() * (max - min + 1));
    },

    pick: function (arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    },

    dist: function (x1, y1, x2, y2) {
      return Math.hypot(x2 - x1, y2 - y1);
    },

    // Hiệu của hai góc (b - a), luôn đưa về khoảng [-π, π]
    angleDiff: function (a, b) {
      var d = (b - a) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return d;
    },

    // Số "giả ngẫu nhiên" trong [0, 1) nhưng luôn giống nhau với cùng một n.
    // Dùng để rải sỏi, cỏ... ở vị trí cố định, không nhảy lung tung mỗi khung hình.
    hash: function (n) {
      var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    }
  };
})(window.LG);
