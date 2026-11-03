window.LG = window.LG || {};

// Các hàm vẽ dùng chung: chữ, khung gỗ, nút bấm, phong cảnh làng quê, nhân vật.
// Muốn thay hình khối bằng ảnh thật: sửa bên trong drawKidSide / drawKidTop / drawVillage...
// (ví dụ dùng ctx.drawImage), các game sẽ tự đổi theo.
(function (LG) {
  'use strict';

  var FONT_FAMILY = '"Segoe UI", Tahoma, Arial, "Helvetica Neue", sans-serif';

  // Bảng màu làng quê
  var C = {
    earth: '#6b4226',
    earthDark: '#3e2614',
    earthLight: '#a0673c',
    straw: '#e8c872',
    strawLight: '#f6e6b4',
    cream: '#fff6e0',
    bamboo: '#5a8f3c',
    bambooDark: '#3d6b27',
    bambooLight: '#8dbb5e',
    red: '#b8322a',
    redDark: '#7d1f19',
    gold: '#f2b533',
    ink: '#2b1d12',
    blue: '#2f6f9f',
    skin: '#f1c27d',
    tile: '#9a4429'
  };

  function font(size, weight) {
    return (weight || 'normal') + ' ' + size + 'px ' + FONT_FAMILY;
  }

  // o: { size, weight, color, align, baseline, stroke, strokeWidth }
  function text(ctx, str, x, y, o) {
    o = o || {};
    ctx.font = font(o.size || 20, o.weight);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.baseline || 'middle';
    if (o.stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.strokeWidth || 4;
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || C.ink;
    ctx.fillText(str, x, y);
  }

  function wrapLines(ctx, str, maxWidth) {
    var words = String(str).split(' ');
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Đoạn văn tự xuống dòng. Trả về chiều cao đã dùng.
  // o: { size, weight, color, align, lineHeight, measureOnly }
  function paragraph(ctx, str, x, y, maxWidth, o) {
    o = o || {};
    var size = o.size || 18;
    var lh = o.lineHeight || Math.round(size * 1.4);
    ctx.font = font(size, o.weight);
    var lines = wrapLines(ctx, str, maxWidth);
    if (!o.measureOnly) {
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = o.color || C.ink;
      for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + i * lh);
    }
    return lines.length * lh;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Khung màu rơm viền nâu (bảng gỗ). o: { fill, fill2, border, borderWidth, radius, shadow }
  function panel(ctx, x, y, w, h, o) {
    o = o || {};
    var r = o.radius == null ? 14 : o.radius;
    ctx.save();
    if (o.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      roundRect(ctx, x + 4, y + 6, w, h, r);
      ctx.fill();
    }
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.fill || C.strawLight);
    g.addColorStop(1, o.fill2 || C.straw);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.lineWidth = o.borderWidth || 4;
    ctx.strokeStyle = o.border || C.earth;
    ctx.stroke();
    ctx.restore();
  }

  function overlay(ctx, alpha) {
    ctx.fillStyle = 'rgba(20,12,6,' + alpha + ')';
    ctx.fillRect(0, 0, 960, 540);
  }

  // ---------- Nút bấm ----------
  // new LG.ui.Button({ x, y, w, h, label, onClick, primary, size })
  function Button(o) {
    this.x = o.x;
    this.y = o.y;
    this.w = o.w || 200;
    this.h = o.h || 52;
    this.label = o.label;
    this.onClick = o.onClick;
    this.primary = !!o.primary;
    this.size = o.size || 22;
    this.visible = o.visible !== false;
  }

  Button.prototype.contains = function (px, py) {
    return this.visible && px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  };

  Button.prototype.isHover = function () {
    var p = LG.input.pointer;
    return !LG.input.usingTouch && this.contains(p.x, p.y);
  };

  Button.prototype.render = function (ctx) {
    if (!this.visible) return;
    var hover = this.isHover();
    var y = this.y - (hover ? 2 : 0);
    panel(ctx, this.x, y, this.w, this.h, {
      radius: 12,
      fill: this.primary ? '#d9483b' : C.cream,
      fill2: this.primary ? C.redDark : C.straw,
      border: this.primary ? '#5a1510' : C.earth,
      borderWidth: hover ? 4 : 3
    });
    text(ctx, this.label, this.x + this.w / 2, y + this.h / 2 + 1, {
      size: this.size, weight: 'bold', color: this.primary ? '#fff' : C.ink
    });
  };

  // Kiểm tra cú nhấp trên danh sách nút; trả về true nếu trúng nút nào đó
  function clickButtons(buttons, x, y) {
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].contains(x, y)) {
        LG.audio.play('click');
        buttons[i].onClick();
        return true;
      }
    }
    return false;
  }

  function renderButtons(ctx, buttons) {
    for (var i = 0; i < buttons.length; i++) buttons[i].render(ctx);
  }

  // Nút vuông nhỏ có biểu tượng: 'pause' | 'sound' | 'muted'
  function iconButton(ctx, r, kind) {
    panel(ctx, r.x, r.y, r.w, r.h, { radius: 10, borderWidth: 3, shadow: false });
    var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.save();
    ctx.fillStyle = C.ink;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    if (kind === 'pause') {
      ctx.fillRect(cx - 9, cy - 11, 6, 22);
      ctx.fillRect(cx + 3, cy - 11, 6, 22);
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - 13, cy - 5);
      ctx.lineTo(cx - 7, cy - 5);
      ctx.lineTo(cx, cy - 12);
      ctx.lineTo(cx, cy + 12);
      ctx.lineTo(cx - 7, cy + 5);
      ctx.lineTo(cx - 13, cy + 5);
      ctx.closePath();
      ctx.fill();
      if (kind === 'muted') {
        ctx.strokeStyle = C.red;
        line(ctx, cx + 5, cy - 6, cx + 14, cy + 6);
        line(ctx, cx + 14, cy - 6, cx + 5, cy + 6);
      } else {
        ctx.beginPath(); ctx.arc(cx + 2, cy, 7, -0.9, 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + 2, cy, 13, -0.9, 0.9); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---------- Chữ nổi bay lên (+10, Hoàn hảo!...) ----------
  function Popups() { this.items = []; }

  Popups.prototype.add = function (str, x, y, o) {
    o = o || {};
    var life = o.life || 1;
    this.items.push({ str: str, x: x, y: y, life: life, max: life, color: o.color || '#fff', size: o.size || 28, rise: o.rise == null ? 40 : o.rise });
  };

  Popups.prototype.update = function (dt) {
    for (var i = this.items.length - 1; i >= 0; i--) {
      var p = this.items[i];
      p.life -= dt;
      p.y -= p.rise * dt;
      if (p.life <= 0) this.items.splice(i, 1);
    }
  };

  Popups.prototype.render = function (ctx) {
    ctx.save();
    for (var i = 0; i < this.items.length; i++) {
      var p = this.items[i];
      ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
      text(ctx, p.str, p.x, p.y, { size: p.size, weight: 'bold', color: p.color, stroke: 'rgba(30,15,5,0.75)', strokeWidth: 5 });
    }
    ctx.restore();
  };

  // ---------- Phong cảnh ----------
  function drawBamboo(ctx, x, baseY, t, dir) {
    ctx.save();
    ctx.lineCap = 'round';
    for (var k = 0; k < 3; k++) {
      var bx = x + dir * k * 20;
      var top = 30 + k * 35;
      var sway = Math.sin(t * 0.8 + k) * 6;
      ctx.strokeStyle = k % 2 ? C.bambooDark : C.bamboo;
      ctx.lineWidth = 9 - k;
      ctx.beginPath();
      ctx.moveTo(bx, baseY);
      ctx.quadraticCurveTo(bx, (baseY + top) / 2, bx + sway, top);
      ctx.stroke();

      // đốt tre
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      for (var y = baseY - 40; y > top + 20; y -= 42) {
        var f = (baseY - y) / (baseY - top);
        var sx = bx + sway * f * f;
        line(ctx, sx - 5, y, sx + 5, y);
      }

      // lá tre
      ctx.fillStyle = k % 2 ? C.bamboo : C.bambooLight;
      for (var j = 0; j < 6; j++) {
        var ly = top + j * 18;
        var f2 = (baseY - ly) / (baseY - top);
        var lx = bx + sway * f2 * f2;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate((j % 2 ? -1 : 1) * (0.6 + 0.2 * Math.sin(t + j)) + (dir < 0 ? Math.PI : 0));
        ctx.beginPath();
        ctx.ellipse(18, 0, 18, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // Trời chiều, núi xa, lũy tre, sân đất. o: { groundY, bamboo }
  function drawVillage(ctx, t, o) {
    o = o || {};
    var W = 960, H = 540;
    var gy = o.groundY || 330;

    var sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#fbe7b5');
    sky.addColorStop(1, '#f4b97d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, gy);

    ctx.fillStyle = 'rgba(255,240,190,0.9)';
    circle(ctx, 760, gy - 150, 46);

    // núi xa
    ctx.fillStyle = '#c98d5f';
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (var x = 0; x <= W; x += 40) {
      ctx.lineTo(x, gy - 60 - Math.sin(x * 0.011) * 30 - Math.sin(x * 0.027) * 15);
    }
    ctx.lineTo(W, gy);
    ctx.fill();

    // lũy tre xa
    ctx.fillStyle = '#6f9a4a';
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (x = 0; x <= W; x += 12) {
      ctx.lineTo(x, gy - 22 - Math.abs(Math.sin(x * 0.09)) * 14);
    }
    ctx.lineTo(W, gy);
    ctx.fill();

    // sân đất
    var g = ctx.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, '#c99a5b');
    g.addColorStop(1, '#a8743f');
    ctx.fillStyle = g;
    ctx.fillRect(0, gy, W, H - gy);

    if (o.bamboo !== false) {
      drawBamboo(ctx, 30, gy + 40, t, 1);
      drawBamboo(ctx, 930, gy + 40, t, -1);
    }
  }

  // Mái đình cong với hai đầu đao vểnh lên
  function drawRoof(ctx, cx, y, w, h) {
    ctx.save();
    var L = cx - w / 2, R = cx + w / 2;
    ctx.beginPath();
    ctx.moveTo(L - 20, y + h - 26);
    ctx.quadraticCurveTo(L + 10, y + h, L + 40, y + h);
    ctx.lineTo(R - 40, y + h);
    ctx.quadraticCurveTo(R - 10, y + h, R + 20, y + h - 26);
    ctx.quadraticCurveTo(R - 30, y + h * 0.55, R - 60, y + 8);
    ctx.lineTo(L + 60, y + 8);
    ctx.quadraticCurveTo(L + 30, y + h * 0.55, L - 20, y + h - 26);
    ctx.closePath();
    ctx.fillStyle = C.tile;
    ctx.fill();

    // hàng ngói
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(60,20,10,0.35)';
    ctx.lineWidth = 2;
    for (var i = 1; i < 6; i++) line(ctx, L - 30, y + 8 + i * (h - 8) / 6, R + 30, y + 8 + i * (h - 8) / 6);
    for (var xx = L; xx < R; xx += 18) line(ctx, xx, y, xx + (xx - cx) * 0.08, y + h);
    ctx.restore();

    // bờ nóc + hai con giống ở hai đầu
    ctx.fillStyle = '#5c2a19';
    roundRect(ctx, L + 50, y, w - 100, 12, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(L + 52, y + 2, 9, Math.PI, Math.PI * 2.2);
    ctx.arc(R - 52, y + 2, 9, Math.PI * 0.8, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.gold;
    circle(ctx, cx, y - 4, 8);
    ctx.restore();
  }

  // ---------- Nhân vật ----------
  // Đứa trẻ nhìn ngang, đứng tại (x, footY).
  // o: { scale, flip, lean, shirt, pants, armAngle, legSpread, blindfold }
  // armAngle: góc tay tính từ phương thẳng đứng hướng xuống (0 = buông thõng, π/2 = đưa ngang ra trước)
  function drawKidSide(ctx, x, footY, o) {
    o = o || {};
    var s = o.scale || 1;
    ctx.save();
    ctx.translate(x, footY);
    ctx.scale(s * (o.flip ? -1 : 1), s);
    ctx.rotate(o.lean || 0);
    ctx.lineCap = 'round';

    // chân
    var spread = o.legSpread == null ? 6 : o.legSpread;
    ctx.strokeStyle = o.pants || '#3b3b6d';
    ctx.lineWidth = 7;
    line(ctx, -2, -30, -spread, 0);
    line(ctx, 2, -30, spread, 0);

    // thân áo
    ctx.fillStyle = o.shirt || C.red;
    roundRect(ctx, -10, -58, 20, 30, 6);
    ctx.fill();

    // tay
    var a = o.armAngle == null ? 0.3 : o.armAngle;
    ctx.strokeStyle = C.skin;
    ctx.lineWidth = 5;
    line(ctx, 0, -52, Math.sin(a) * 22, -52 + Math.cos(a) * 22);

    // đầu + tóc
    ctx.fillStyle = C.skin;
    circle(ctx, 0, -70, 12);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(0, -72, 12.5, Math.PI, Math.PI * 2);
    ctx.fill();
    if (o.blindfold) {
      ctx.fillStyle = C.red;
      ctx.fillRect(-13, -75, 26, 6);
    }
    ctx.restore();
  }

  // Đứa trẻ nhìn từ trên xuống, tâm tại (x, y).
  // o: { angle (hướng mặt, 0 = sang phải), shirt, r, blindfold, cross }
  function drawKidTop(ctx, x, y, o) {
    o = o || {};
    var r = o.r || 14;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.angle || 0);
    // bóng
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(3, 4, r * 0.75, r * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    // hai bàn tay
    ctx.fillStyle = C.skin;
    circle(ctx, r * 0.55, -r * 0.85, r * 0.28);
    circle(ctx, r * 0.55, r * 0.85, r * 0.28);
    // vai áo
    ctx.fillStyle = o.shirt || C.red;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.6, r, 0, 0, Math.PI * 2);
    ctx.fill();
    if (o.cross) {
      ctx.fillStyle = C.red;
      ctx.fillRect(-r * 0.45, -r * 0.12, r * 0.3, r * 0.24);
      ctx.fillRect(-r * 0.42, -r * 0.27, r * 0.24, r * 0.54);
    }
    // đầu (tóc đen)
    ctx.fillStyle = '#222';
    circle(ctx, r * 0.05, 0, r * 0.52);
    if (o.blindfold) {
      ctx.fillStyle = C.red;
      ctx.fillRect(r * 0.18, -r * 0.55, r * 0.26, r * 1.1);
    }
    ctx.restore();
  }

  LG.ui = {
    C: C,
    font: font,
    text: text,
    wrapLines: wrapLines,
    paragraph: paragraph,
    roundRect: roundRect,
    line: line,
    circle: circle,
    panel: panel,
    overlay: overlay,
    Button: Button,
    clickButtons: clickButtons,
    renderButtons: renderButtons,
    iconButton: iconButton,
    Popups: Popups,
    drawBamboo: drawBamboo,
    drawVillage: drawVillage,
    drawRoof: drawRoof,
    drawKidSide: drawKidSide,
    drawKidTop: drawKidTop
  };
})(window.LG);
