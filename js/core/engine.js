window.LG = window.LG || {};

// Bộ máy chạy game.
//
// KHÁI NIỆM 1 - Game loop (vòng lặp game): khoảng 60 lần mỗi giây, trình duyệt gọi
// hàm frame(). Mỗi lần ta làm 2 việc: update(dt) = tính toán (di chuyển, va chạm, điểm)
// và render(ctx) = vẽ lại toàn bộ màn hình.
//
// KHÁI NIỆM 2 - Delta time (dt): số giây trôi qua kể từ khung hình trước (~0.016s).
// Viết "x += tốc_độ * dt" thì máy nhanh hay chậm, nhân vật vẫn đi cùng một quãng mỗi giây.
//
// KHÁI NIỆM 3 - Cảnh (scene): mỗi màn hình (menu, màn chơi...) là một đối tượng
// có update/render/onKeyDown... Engine chỉ chạy MỘT cảnh tại một thời điểm và
// chuyển cảnh bằng hiệu ứng tối dần rồi sáng dần (fade).
(function (LG) {
  'use strict';

  var W = 960, H = 540;          // độ phân giải "logic": mọi toạ độ trong game dùng hệ này
  var FADE_TIME = 0.28;
  var MUTE_BTN = { x: 906, y: 10, w: 44, h: 44 };

  var canvas, ctx;
  var scene = null, pendingScene = null;
  var fade = 1, fadeDir = -1;    // fadeDir: 1 = đang tối dần, -1 = đang sáng dần, 0 = đứng yên
  var lastTime = 0;

  LG.games = [];
  // Mỗi file game gọi hàm này để tự đăng ký vào menu
  LG.registerGame = function (def) { LG.games.push(def); };

  function inRect(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  // Gọi một hàm của cảnh hiện tại nếu có; lỗi chỉ in ra Console, không làm treo game
  function call(name, a, b, c) {
    if (scene && typeof scene[name] === 'function') {
      try {
        return scene[name](a, b, c);
      } catch (err) {
        console.error('[LG] Lỗi trong ' + name + ':', err);
      }
    }
  }

  // Co giãn canvas vừa cửa sổ mà vẫn giữ tỉ lệ 16:9, và nét trên màn hình độ phân giải cao
  function resize() {
    var scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    var dpr = window.devicePixelRatio || 1;
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
    canvas.width = Math.max(1, Math.floor(W * scale * dpr));
    canvas.height = Math.max(1, Math.floor(H * scale * dpr));
  }

  // Đổi toạ độ chuột trên màn hình sang toạ độ logic 960x540
  function toLogical(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width * W,
      y: (clientY - rect.top) / rect.height * H
    };
  }

  function switchScene() {
    call('exit');
    scene = pendingScene;
    pendingScene = null;
    call('enter');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    // Giới hạn dt tối đa 0.05s: khi chuyển tab rồi quay lại, game không "nhảy cóc"
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;
    engine.time += dt;

    if (fadeDir === 1) {
      fade += dt / FADE_TIME;
      if (fade >= 1) {
        fade = 1;
        switchScene();
        fadeDir = -1;
      }
    } else if (fadeDir === -1) {
      fade -= dt / FADE_TIME;
      if (fade <= 0) {
        fade = 0;
        fadeDir = 0;
      }
    }

    call('update', dt);
    render();
  }

  function render() {
    // Mọi lệnh vẽ sau đây dùng toạ độ 960x540, setTransform tự phóng to cho vừa canvas thật
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2b1d12';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    call('render', ctx);
    ctx.restore();

    LG.ui.iconButton(ctx, MUTE_BTN, LG.audio.isMuted() ? 'muted' : 'sound');

    if (fade > 0) {
      ctx.fillStyle = 'rgba(20,12,6,' + fade + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  var engine = {
    W: W,
    H: H,
    time: 0,

    start: function (firstScene) {
      canvas = document.getElementById('game');
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);

      LG.input.attach(canvas, {
        toLogical: toLogical,
        keydown: function (code, e) {
          if (fadeDir === 1) return;
          if (code === 'KeyM') { LG.audio.toggleMute(); return; }
          call('onKeyDown', code, e);
        },
        keyup: function (code, e) { call('onKeyUp', code, e); },
        pointerdown: function (x, y, e) {
          if (fadeDir === 1) return;
          if (inRect(MUTE_BTN, x, y)) { LG.audio.toggleMute(); return; }
          call('onPointerDown', x, y, e);
        },
        pointermove: function (x, y, e) { call('onPointerMove', x, y, e); },
        pointerup: function (x, y, e) { call('onPointerUp', x, y, e); }
      });

      // Chuyển tab / thu nhỏ cửa sổ -> báo cho cảnh để tự tạm dừng
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) call('onBlur');
      });
      window.addEventListener('blur', function () { call('onBlur'); });

      scene = firstScene;
      call('enter');
      requestAnimationFrame(frame);
    },

    // Chuyển sang cảnh mới (có hiệu ứng mờ dần)
    goto: function (newScene) {
      pendingScene = newScene;
      fadeDir = 1;
    }
  };

  LG.engine = engine;
})(window.LG);
