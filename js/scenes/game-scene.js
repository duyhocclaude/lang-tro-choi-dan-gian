window.LG = window.LG || {};

// Cảnh "bọc" quanh mọi mini-game. Nó lo phần giống nhau ở tất cả các trò:
// màn giới thiệu, tạm dừng, màn kết thúc, lưu kỷ lục, nút Chơi lại / Về menu.
// Nhờ vậy mỗi file game chỉ cần viết phần chơi.
//
// KHÁI NIỆM - Quản lý trạng thái (state machine): biến `state` cho biết cảnh đang ở
// giai đoạn nào: 'intro' -> 'play' <-> 'paused' -> 'over'. Mỗi trạng thái
// vẽ khác nhau và xử lý phím khác nhau, nhờ vậy code không rối.
(function (LG) {
  'use strict';

  var ui = LG.ui, C = ui.C;
  var PAUSE_BTN = { x: 852, y: 10, w: 44, h: 44 };
  var TEXT_X = 112, TEXT_W = 736, TEXT_TOP = 104, TEXT_BOTTOM = 414;

  LG.scenes = LG.scenes || {};

  LG.scenes.game = function (def) {
    var state = 'intro';
    var instance = null;      // đối tượng game đang chạy (tạo mới mỗi lần chơi)
    var api = null;
    var currentMode = null;
    var result = null;
    var newRecord = false;
    var overTime = 0;
    var t = 0;
    var introSize = 0;        // cỡ chữ màn giới thiệu, tự thu nhỏ cho vừa khung

    var modes = def.modes && def.modes.length ? def.modes : [{ label: 'Bắt đầu', value: null }];

    // ----- Các nút -----
    var introButtons = [];
    (function () {
      var bw = 180, gap = 14;
      var total = modes.length * bw + (modes.length - 1) * gap;
      var x0 = 480 - total / 2;
      modes.forEach(function (m, i) {
        introButtons.push(new ui.Button({
          x: x0 + i * (bw + gap), y: 428, w: bw, h: 54, label: m.label, primary: true, size: 19,
          onClick: function () { startGame(m); }
        }));
      });
      introButtons.push(new ui.Button({ x: 96, y: 50, w: 120, h: 38, label: '← Menu', size: 17, onClick: backToMenu }));
    })();

    var pauseButtons = [
      new ui.Button({ x: 380, y: 215, w: 200, h: 52, label: 'Tiếp tục', primary: true, onClick: resume }),
      new ui.Button({ x: 380, y: 280, w: 200, h: 52, label: 'Chơi lại', onClick: restart }),
      new ui.Button({ x: 380, y: 345, w: 200, h: 52, label: 'Về menu', onClick: backToMenu })
    ];

    var overButtons = [
      new ui.Button({ x: 268, y: 382, w: 200, h: 54, label: 'Chơi lại', primary: true, onClick: restart }),
      new ui.Button({ x: 492, y: 382, w: 200, h: 54, label: 'Về menu', onClick: backToMenu })
    ];

    // ----- Điều khiển vòng đời game -----
    function createApi() {
      var a = {
        alive: true,
        // Game gọi api.end({ win, title, message, score, record }) khi kết thúc
        end: function (r) {
          if (!a.alive) return;
          a.alive = false;
          finish(r || {});
        }
      };
      return a;
    }

    function destroyInstance() {
      if (instance && typeof instance.destroy === 'function') {
        try { instance.destroy(); } catch (e) { console.error(e); }
      }
      instance = null;
      if (api) api.alive = false;
      LG.input.setVirtualButtons([]);
    }

    function startGame(mode) {
      destroyInstance();
      currentMode = mode;
      result = null;
      newRecord = false;
      api = createApi();
      instance = def.create(api, mode.value);
      state = 'play';
    }

    function restart() { startGame(currentMode || modes[0]); }
    function resume() { state = 'play'; }

    function pause() {
      if (state === 'play') {
        state = 'paused';
        LG.audio.play('click');
      }
    }

    function finish(r) {
      result = r;
      state = 'over';
      overTime = 0;
      newRecord = false;
      if (typeof r.score === 'number' && r.record !== false && r.score > 0) {
        newRecord = LG.storage.submitScore(def.id, r.score);
      }
      LG.audio.play(r.win ? 'win' : 'lose');
    }

    function backToMenu() {
      destroyInstance();
      state = 'leaving';
      LG.engine.goto(LG.scenes.menu());
    }

    // ----- Màn giới thiệu -----
    // Vẽ (hoặc chỉ đo) phần chữ; trả về toạ độ y cuối cùng
    function layoutIntroText(ctx, size, draw) {
      var y = TEXT_TOP;
      var lh = Math.round(size * 1.38);
      var opt = { size: size, lineHeight: lh, measureOnly: !draw };

      if (draw) ui.text(ctx, 'Đôi nét về trò chơi', TEXT_X, y + size * 0.6, { size: size + 2, weight: 'bold', align: 'left', color: C.redDark });
      y += Math.round(size * 1.7);
      y += ui.paragraph(ctx, def.intro, TEXT_X, y, TEXT_W, Object.assign({}, opt, { weight: 'italic', color: '#4a3020' })) + 8;

      if (draw) ui.text(ctx, 'Cách chơi', TEXT_X, y + size * 0.6, { size: size + 2, weight: 'bold', align: 'left', color: C.redDark });
      y += Math.round(size * 1.7);
      for (var i = 0; i < def.rules.length; i++) {
        if (draw) ui.text(ctx, '•', TEXT_X + 6, y + lh / 2, { size: size, weight: 'bold' });
        y += ui.paragraph(ctx, def.rules[i], TEXT_X + 22, y, TEXT_W - 22, opt) + 3;
      }
      return y;
    }

    function renderIntro(ctx) {
      ui.drawVillage(ctx, t);
      ui.overlay(ctx, 0.25);
      ui.panel(ctx, 80, 36, 800, 468);
      ui.text(ctx, def.name, 480, 70, { size: 34, weight: 'bold', color: C.redDark });
      ui.text(ctx, 'Kỷ lục: ' + LG.storage.getHighScore(def.id), 856, 70, { size: 16, align: 'right', color: C.earth });

      if (!introSize) {
        introSize = 18;
        while (introSize > 12 && layoutIntroText(ctx, introSize, false) > TEXT_BOTTOM) introSize--;
      }
      layoutIntroText(ctx, introSize, true);
      ui.renderButtons(ctx, introButtons);
    }

    function renderPause(ctx) {
      ui.overlay(ctx, 0.55);
      ui.panel(ctx, 330, 140, 300, 280);
      ui.text(ctx, 'Tạm dừng', 480, 180, { size: 30, weight: 'bold', color: C.redDark });
      ui.renderButtons(ctx, pauseButtons);
    }

    function renderOver(ctx) {
      var r = result || {};
      ui.overlay(ctx, 0.55 * Math.min(1, overTime * 3));
      ui.panel(ctx, 230, 110, 500, 346);
      ui.text(ctx, r.title || 'Kết thúc', 480, 152, { size: 34, weight: 'bold', color: r.win ? '#2e7d32' : C.redDark });
      var y = 188;
      if (r.message) {
        y += ui.paragraph(ctx, r.message, 480, y, 440, { size: 18, align: 'center' }) + 12;
      }
      if (typeof r.score === 'number') {
        ui.text(ctx, 'Điểm: ' + r.score, 480, y + 22, { size: 30, weight: 'bold' });
        y += 52;
        if (r.record !== false) {
          if (newRecord) {
            var pulse = 1 + 0.06 * Math.sin(t * 8);
            ctx.save();
            ctx.translate(480, y + 14);
            ctx.scale(pulse, pulse);
            ui.text(ctx, '★ Kỷ lục mới! ★', 0, 0, { size: 24, weight: 'bold', color: '#c77d00' });
            ctx.restore();
          } else {
            ui.text(ctx, 'Kỷ lục: ' + LG.storage.getHighScore(def.id), 480, y + 14, { size: 18, color: C.earth });
          }
        }
      }
      ui.renderButtons(ctx, overButtons);
    }

    // ----- Cảnh -----
    return {
      update: function (dt) {
        t += dt;
        LG.input.virtualEnabled = state === 'play';
        if (state === 'play' && instance) instance.update(dt);
        else if (state === 'over') overTime += dt;
      },

      render: function (ctx) {
        if (state === 'intro') { renderIntro(ctx); return; }

        if (instance) {
          ctx.save();
          instance.render(ctx);
          ctx.restore();
          ctx.globalAlpha = 1;
        } else {
          ui.drawVillage(ctx, t);
        }

        if (state === 'play') {
          if (LG.input.usingTouch) LG.input.renderVirtualButtons(ctx);
          ui.iconButton(ctx, PAUSE_BTN, 'pause');
        } else if (state === 'paused') {
          renderPause(ctx);
        } else if (state === 'over') {
          renderOver(ctx);
        }
      },

      onKeyDown: function (code, e) {
        if (state === 'intro') {
          if (code === 'Enter' || code === 'Space') startGame(modes[0]);
          else if (code === 'Escape') backToMenu();
          else if (/^Digit[1-9]$/.test(code)) {
            var m = modes[Number(code.slice(5)) - 1];
            if (m) startGame(m);
          }
        } else if (state === 'play') {
          if (code === 'Escape' || code === 'KeyP') pause();
          else if (instance && instance.onKeyDown) instance.onKeyDown(code, e || {});
        } else if (state === 'paused') {
          if (code === 'Escape' || code === 'KeyP' || code === 'Enter') resume();
        } else if (state === 'over' && overTime > 0.6) {
          // Không dùng Space để chơi lại: tránh lỡ tay khi đang bấm Space liên tục trong game
          if (code === 'Enter') restart();
          else if (code === 'Escape') backToMenu();
        }
      },

      onKeyUp: function (code, e) {
        if (state === 'play' && instance && instance.onKeyUp) instance.onKeyUp(code, e || {});
      },

      onPointerDown: function (x, y, e) {
        if (state === 'intro') {
          ui.clickButtons(introButtons, x, y);
        } else if (state === 'play') {
          if (x >= PAUSE_BTN.x && x <= PAUSE_BTN.x + PAUSE_BTN.w && y >= PAUSE_BTN.y && y <= PAUSE_BTN.y + PAUSE_BTN.h) pause();
          else if (instance && instance.onPointerDown) instance.onPointerDown(x, y, e);
        } else if (state === 'paused') {
          ui.clickButtons(pauseButtons, x, y);
        } else if (state === 'over' && overTime > 0.6) {
          ui.clickButtons(overButtons, x, y);
        }
      },

      onPointerMove: function (x, y, e) {
        if (state === 'play' && instance && instance.onPointerMove) instance.onPointerMove(x, y, e);
      },

      onPointerUp: function (x, y, e) {
        if (state === 'play' && instance && instance.onPointerUp) instance.onPointerUp(x, y, e);
      },

      onBlur: function () { pause(); },

      exit: function () { destroyInstance(); }
    };
  };
})(window.LG);
