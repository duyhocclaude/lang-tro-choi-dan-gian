window.LG = window.LG || {};

// Xử lý bàn phím, chuột và cảm ứng.
// Chuột và cảm ứng dùng chung "Pointer Events" nên chỉ cần viết một lần.
//
// Có hai cách để game đọc input:
//  1. Sự kiện: onKeyDown / onPointerDown... được engine gọi khi có thao tác
//     (hợp với hành động một lần: nhảy, đập, chọn ô).
//  2. Trạng thái: LG.input.isDown('ArrowLeft') hỏi "phím này có đang giữ không?"
//     (hợp với hành động liên tục: đi lại, xoay người).
//
// "Nút ảo" là nút vẽ trên màn hình cho điện thoại; chạm vào nó giống hệt nhấn phím.
(function (LG) {
  'use strict';

  var keys = {};            // phím đang giữ, theo e.code ('KeyA', 'Space', 'ArrowLeft'...)
  var virtualDown = {};     // phím ảo đang giữ: code -> số ngón tay đang chạm
  var virtualButtons = [];
  var pointerVirtual = {};  // pointerId -> code của nút ảo mà ngón tay đó đang giữ
  var PREVENT_DEFAULT = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1 };

  var input = {
    pointer: { x: -1000, y: -1000, down: false },
    usingTouch: false,      // true khi người chơi đang dùng cảm ứng -> hiện nút ảo
    virtualEnabled: false,  // màn chơi bật/tắt nút ảo (tắt khi đang tạm dừng)

    isDown: function (code) {
      return !!keys[code] || (virtualDown[code] || 0) > 0;
    },

    anyDown: function (codes) {
      for (var i = 0; i < codes.length; i++) {
        if (input.isDown(codes[i])) return true;
      }
      return false;
    },

    // Hướng di chuyển (vector độ dài 1) từ phím mũi tên / WASD,
    // hoặc hướng tới chỗ đang giữ chuột/ngón tay nếu không bấm phím.
    moveVector: function (fromX, fromY) {
      var x = 0, y = 0;
      if (input.anyDown(['ArrowLeft', 'KeyA'])) x -= 1;
      if (input.anyDown(['ArrowRight', 'KeyD'])) x += 1;
      if (input.anyDown(['ArrowUp', 'KeyW'])) y -= 1;
      if (input.anyDown(['ArrowDown', 'KeyS'])) y += 1;
      if (x === 0 && y === 0 && input.pointer.down && fromX != null) {
        var dx = input.pointer.x - fromX, dy = input.pointer.y - fromY;
        if (Math.hypot(dx, dy) > 12) { x = dx; y = dy; }
      }
      var len = Math.hypot(x, y);
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },

    // list: [{ x, y, w, h, label, code, size }]
    setVirtualButtons: function (list) {
      virtualButtons = list || [];
      virtualDown = {};
      pointerVirtual = {};
    },

    renderVirtualButtons: function (ctx) {
      virtualButtons.forEach(function (b) {
        var pressed = (virtualDown[b.code] || 0) > 0;
        ctx.save();
        ctx.globalAlpha = pressed ? 0.9 : 0.6;
        LG.ui.roundRect(ctx, b.x, b.y, b.w, b.h, 14);
        ctx.fillStyle = pressed ? '#f2b533' : '#fff6e0';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#3e2614';
        ctx.stroke();
        ctx.globalAlpha = 1;
        LG.ui.text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2, { size: b.size || 26, weight: 'bold' });
        ctx.restore();
      });
    },

    // Gắn sự kiện. h: các hàm của engine (keydown, keyup, pointerdown, ... , toLogical)
    attach: function (canvas, h) {
      function findVirtual(x, y) {
        if (!input.virtualEnabled || !input.usingTouch) return null;
        for (var i = 0; i < virtualButtons.length; i++) {
          var b = virtualButtons[i];
          if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
        }
        return null;
      }

      window.addEventListener('keydown', function (e) {
        LG.audio.unlock();
        if (PREVENT_DEFAULT[e.code]) e.preventDefault();
        keys[e.code] = true;
        h.keydown(e.code, e);
      });

      window.addEventListener('keyup', function (e) {
        keys[e.code] = false;
        h.keyup(e.code, e);
      });

      // Mất focus cửa sổ thì coi như thả hết phím (tránh nhân vật tự chạy mãi)
      window.addEventListener('blur', function () { keys = {}; });

      canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        LG.audio.unlock();
        if (e.pointerType === 'touch') input.usingTouch = true;
        else if (e.pointerType === 'mouse') input.usingTouch = false;

        var p = h.toLogical(e.clientX, e.clientY);
        var vb = findVirtual(p.x, p.y);
        if (vb) {
          pointerVirtual[e.pointerId] = vb.code;
          virtualDown[vb.code] = (virtualDown[vb.code] || 0) + 1;
          h.keydown(vb.code, { code: vb.code, repeat: false, virtual: true });
          return;
        }

        input.pointer.x = p.x;
        input.pointer.y = p.y;
        input.pointer.down = true;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
        h.pointerdown(p.x, p.y, e);
      });

      canvas.addEventListener('pointermove', function (e) {
        if (pointerVirtual[e.pointerId]) return;
        var p = h.toLogical(e.clientX, e.clientY);
        input.pointer.x = p.x;
        input.pointer.y = p.y;
        h.pointermove(p.x, p.y, e);
      });

      function release(e) {
        var code = pointerVirtual[e.pointerId];
        if (code) {
          delete pointerVirtual[e.pointerId];
          virtualDown[code] = Math.max(0, (virtualDown[code] || 0) - 1);
          h.keyup(code, { code: code, virtual: true });
          return;
        }
        var p = h.toLogical(e.clientX, e.clientY);
        input.pointer.down = false;
        h.pointerup(p.x, p.y, e);
      }

      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
  };

  LG.input = input;
})(window.LG);
