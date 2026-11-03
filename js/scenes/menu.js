window.LG = window.LG || {};

// Menu chính: "sân đình" với mái đình, biển tên và các thẻ trò chơi.
(function (LG) {
  'use strict';

  var ui = LG.ui, C = ui.C;
  var CARD_W = 250, CARD_H = 170, GAP_X = 24, GAP_Y = 20, COLS = 3, TOP = 160;

  LG.scenes = LG.scenes || {};

  LG.scenes.menu = function () {
    var selected = LG.scenes.menu.lastSelected || 0;
    var t = 0;

    function cardRect(i) {
      var col = i % COLS, row = Math.floor(i / COLS);
      var totalW = COLS * CARD_W + (COLS - 1) * GAP_X;
      return {
        x: (960 - totalW) / 2 + col * (CARD_W + GAP_X),
        y: TOP + row * (CARD_H + GAP_Y),
        w: CARD_W,
        h: CARD_H
      };
    }

    function hitCard(x, y) {
      for (var i = 0; i < LG.games.length; i++) {
        var r = cardRect(i);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
      }
      return -1;
    }

    function open(i) {
      LG.scenes.menu.lastSelected = i;
      LG.audio.play('click');
      LG.engine.goto(LG.scenes.game(LG.games[i]));
    }

    return {
      update: function (dt) {
        t += dt;
        // Rê chuột lên thẻ nào thì chọn thẻ đó
        var p = LG.input.pointer;
        if (!LG.input.usingTouch) {
          var h = hitCard(p.x, p.y);
          if (h >= 0) selected = h;
        }
      },

      render: function (ctx) {
        ui.drawVillage(ctx, t);
        ui.drawRoof(ctx, 480, 14, 560, 66);

        ui.panel(ctx, 250, 84, 460, 52, { fill: '#c9412f', fill2: C.redDark, border: '#5a1510', radius: 10 });
        ui.text(ctx, 'LÀNG TRÒ CHƠI DÂN GIAN', 480, 111, { size: 30, weight: 'bold', color: C.gold, stroke: '#5a1510' });
        ui.text(ctx, 'Chọn một trò chơi: nhấp chuột, chạm, hoặc dùng phím mũi tên + Enter', 480, 149, { size: 14, color: C.earthDark });

        for (var i = 0; i < LG.games.length; i++) {
          var g = LG.games[i];
          var r = cardRect(i);
          var sel = i === selected;
          var y = r.y - (sel ? 5 : 0);
          ui.panel(ctx, r.x, y, r.w, r.h, { border: sel ? C.red : C.earth, borderWidth: sel ? 5 : 4 });

          ctx.save();
          try { g.drawIcon(ctx, r.x + r.w / 2, y + 64, 92, t); } catch (e) { console.error(e); }
          ctx.restore();

          ui.text(ctx, g.name, r.x + r.w / 2, y + 126, { size: 22, weight: 'bold' });
          ui.text(ctx, 'Kỷ lục: ' + LG.storage.getHighScore(g.id), r.x + r.w / 2, y + 152, { size: 16, color: C.earth });
        }
      },

      onKeyDown: function (code) {
        var n = LG.games.length;
        if (!n) return;
        if (code === 'ArrowLeft') selected = (selected - 1 + n) % n;
        else if (code === 'ArrowRight') selected = (selected + 1) % n;
        else if (code === 'ArrowUp') selected = (selected - COLS + n) % n;
        else if (code === 'ArrowDown') selected = (selected + COLS) % n;
        else if (code === 'Enter' || code === 'Space') { open(selected); return; }
        else return;
        LG.audio.play('select');
      },

      onPointerDown: function (x, y) {
        var i = hitCard(x, y);
        if (i >= 0) open(i);
      }
    };
  };
})(window.LG);
