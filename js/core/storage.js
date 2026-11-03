window.LG = window.LG || {};

// Lưu điểm cao và cài đặt vào localStorage.
// Mọi thao tác đều bọc try/catch: trong chế độ ẩn danh hoặc khi trình duyệt chặn
// lưu trữ, game vẫn chạy bình thường, chỉ là không nhớ được điểm.
(function (LG) {
  'use strict';

  var PREFIX = 'langTroChoi.';

  function read(key, fallback) {
    try {
      var raw = window.localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  LG.storage = {
    get: read,
    set: write,

    getHighScore: function (gameId) {
      var v = read('high.' + gameId, 0);
      return typeof v === 'number' && isFinite(v) ? v : 0;
    },

    // Ghi điểm nếu cao hơn kỷ lục cũ. Trả về true nếu là kỷ lục mới.
    submitScore: function (gameId, score) {
      if (score > this.getHighScore(gameId)) {
        write('high.' + gameId, score);
        return true;
      }
      return false;
    }
  };
})(window.LG);
