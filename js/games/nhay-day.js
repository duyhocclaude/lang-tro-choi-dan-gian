window.LG = window.LG || {};

// ===================== NHẢY DÂY =====================
// Hai bạn hai bên quay dây, người chơi đứng giữa bấm nhảy đúng lúc dây quét qua chân.
//
// Cách mô phỏng dây quay: dùng một góc θ (theta) tăng dần theo thời gian.
//   θ = 0 (hoặc 2π, 4π...): dây ở sát đất (dưới chân)
//   θ = π: dây ở trên đầu
// Mỗi lần θ vượt qua một bội số của 2π là lúc dây quét qua chân -> kiểm tra người chơi
// có đang ở trên không không.
(function (LG) {
  'use strict';

  var ui = LG.ui, C = ui.C, U = LG.util;

  var TWO_PI = Math.PI * 2;
  var GROUND = 440;
  var HOLDER_SCALE = 1.1;
  var LEFT_FOOT = 215, RIGHT_FOOT = 745, PLAYER_X = 480;
  var ARM_BASE = 2.1;                    // góc tay của người quay dây (giơ chếch lên)
  var HAND_Y = GROUND - 52 * HOLDER_SCALE + Math.cos(ARM_BASE) * 22 * HOLDER_SCALE;
  var ROPE_R = GROUND - 6 - HAND_Y;      // dây võng xuống tới sát đất
  var JUMP_TIME = 0.44, JUMP_H = 62;
  var SAFE_HEIGHT = 14;                  // chân phải cao hơn mức này khi dây quét qua
  var PERFECT_WINDOW = 0.06;             // lệch khỏi đỉnh cú nhảy dưới 0.06 giây = Hoàn hảo
  var START_RPS = 0.55, MAX_RPS = 1.7;   // vòng quay mỗi giây
  var LIVES = 3;

  function JumpRope(api) {
    this.api = api;
    this.t = 0;
    this.theta = Math.PI;      // bắt đầu với dây ở trên đầu
    this.rps = START_RPS;
    this.jumpT = -1;           // thời gian đã nhảy; -1 = đang đứng dưới đất
    this.lives = LIVES;
    this.score = 0;
    this.jumps = 0;
    this.combo = 0;
    this.ready = 1.6;          // "Chuẩn bị..." trước khi dây quay
    this.stun = 0;             // thời gian khựng lại sau khi vướng dây
    this.popups = new ui.Popups();
  }

  JumpRope.prototype.height = function () {
    if (this.jumpT < 0) return 0;
    var u = this.jumpT / JUMP_TIME;
    return 4 * JUMP_H * u * (1 - u);     // đường parabol: lên rồi xuống
  };

  JumpRope.prototype.jump = function () {
    if (this.jumpT >= 0 || this.stun > 0) return;
    this.jumpT = 0;
    LG.audio.play('jump');
  };

  JumpRope.prototype.onKeyDown = function (code, e) {
    if (e.repeat) return;
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') this.jump();
  };

  JumpRope.prototype.onPointerDown = function () { this.jump(); };

  JumpRope.prototype.update = function (dt) {
    this.t += dt;
    this.popups.update(dt);

    if (this.jumpT >= 0) {
      this.jumpT += dt;
      if (this.jumpT >= JUMP_TIME) this.jumpT = -1;
    }

    if (this.stun > 0) {
      this.stun -= dt;
      if (this.stun <= 0) {
        if (this.lives <= 0) { this.sendResult(); return; }
        this.theta = Math.PI;
        this.ready = 1.0;
      }
      return;
    }

    if (this.ready > 0) {
      this.ready -= dt;
      return;
    }

    var prev = this.theta;
    this.theta += TWO_PI * this.rps * dt;

    // Dây qua đỉnh đầu: kêu "tích" để người chơi bắt nhịp
    if (Math.floor((prev - Math.PI) / TWO_PI) !== Math.floor((this.theta - Math.PI) / TWO_PI)) {
      LG.audio.play('tick');
    }
    // Dây quét qua chân
    if (Math.floor(prev / TWO_PI) !== Math.floor(this.theta / TWO_PI)) {
      this.ropeAtFeet();
    }
  };

  JumpRope.prototype.ropeAtFeet = function () {
    if (this.height() > SAFE_HEIGHT) {
      var offset = Math.abs(this.jumpT - JUMP_TIME / 2);
      var pts, label, color;
      this.jumps++;
      this.combo++;
      if (offset < PERFECT_WINDOW) {
        pts = 3; label = 'Hoàn hảo!'; color = C.gold;
        LG.audio.play('perfect');
      } else {
        pts = 1; label = 'Tốt'; color = '#ffffff';
        LG.audio.play('thump');
      }
      if (this.combo >= 5) pts += 1;
      this.score += pts;
      this.popups.add(label + ' +' + pts, PLAYER_X, 300, { color: color, size: 26 });

      this.rps = Math.min(MAX_RPS, this.rps + 0.025);
      // Thỉnh thoảng đổi nhịp cho bất ngờ
      if (this.jumps % 8 === 0) {
        var f = U.pick([0.82, 1.18]);
        this.rps = U.clamp(this.rps * f, START_RPS, MAX_RPS);
        this.popups.add(f > 1 ? 'Dây quay nhanh hơn!' : 'Dây quay chậm lại!', 480, 250, { color: '#ffd27a', size: 24, life: 1.4 });
      }
    } else {
      this.lives--;
      this.combo = 0;
      this.stun = 1.2;
      this.jumpT = -1;
      this.rps = Math.max(START_RPS, this.rps * 0.88);
      this.popups.add('Vướng dây!', PLAYER_X, 300, { color: '#ff7b6b', size: 30, life: 1.2 });
      LG.audio.play('fail');
    }
  };

  JumpRope.prototype.sendResult = function () {
    var msg = 'Bạn đã nhảy qua dây ' + this.jumps + ' lần.';
    if (this.jumps >= 30) msg += ' Đôi chân thật dẻo dai!';
    else if (this.jumps >= 15) msg += ' Giỏi lắm!';
    else msg += ' Hãy lắng nghe tiếng "tích" để bắt nhịp nhé.';
    this.api.end({ win: this.jumps >= 15, title: 'Hết lượt!', message: msg, score: this.score });
  };

  // Vị trí bàn tay của người quay dây (khớp với công thức trong ui.drawKidSide)
  function handPos(footX, flip, armAngle) {
    return {
      x: footX + (flip ? -1 : 1) * Math.sin(armAngle) * 22 * HOLDER_SCALE,
      y: GROUND - 52 * HOLDER_SCALE + Math.cos(armAngle) * 22 * HOLDER_SCALE
    };
  }

  function drawRope(ctx, hl, hr, midY, front) {
    var cx = (hl.x + hr.x) / 2;
    var cy = 2 * midY - (hl.y + hr.y) / 2;   // điểm điều khiển để giữa đường cong đi qua midY
    ctx.save();
    ctx.strokeStyle = front ? '#7a3b1e' : 'rgba(122,59,30,0.7)';
    ctx.lineWidth = front ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(hl.x, hl.y);
    ctx.quadraticCurveTo(cx, cy, hr.x, hr.y);
    ctx.stroke();
    ctx.restore();
  }

  JumpRope.prototype.render = function (ctx) {
    ui.drawVillage(ctx, this.t);
    var h = this.height();

    // bóng người chơi
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(PLAYER_X, GROUND + 3, Math.max(8, 22 - h * 0.15), 5, 0, 0, TWO_PI);
    ctx.fill();

    var arm = ARM_BASE + 0.35 * Math.sin(this.theta);
    var hl = handPos(LEFT_FOOT, false, arm);
    var hr = handPos(RIGHT_FOOT, true, arm);
    var midY = HAND_Y + ROPE_R * Math.cos(this.theta);
    var behind = Math.sin(this.theta) > 0;     // nửa vòng sau: dây ở sau lưng người chơi

    if (behind) drawRope(ctx, hl, hr, midY, false);

    ui.drawKidSide(ctx, LEFT_FOOT, GROUND, { scale: HOLDER_SCALE, armAngle: arm, shirt: C.blue });
    ui.drawKidSide(ctx, RIGHT_FOOT, GROUND, { scale: HOLDER_SCALE, armAngle: arm, shirt: '#8e44ad', flip: true });
    ui.drawKidSide(ctx, PLAYER_X, GROUND - h, {
      scale: 1.1,
      shirt: '#2f8f6f',
      legSpread: h > 5 ? 3 : 6,
      armAngle: h > 5 ? 1.1 : 0.4,
      lean: this.stun > 0 ? 0.45 : 0
    });

    if (!behind) drawRope(ctx, hl, hr, midY, true);

    this.renderHud(ctx);
    this.popups.render(ctx);
  };

  JumpRope.prototype.renderHud = function (ctx) {
    ui.panel(ctx, 20, 12, 300, 60, { radius: 10, borderWidth: 3 });
    ui.text(ctx, 'Điểm: ' + this.score, 36, 31, { size: 20, weight: 'bold', align: 'left' });
    ui.text(ctx, 'Số lần nhảy: ' + this.jumps + (this.combo >= 5 ? '   Chuỗi x' + this.combo : ''), 36, 56, { size: 15, align: 'left', color: C.earth });

    ui.panel(ctx, 600, 12, 230, 60, { radius: 10, borderWidth: 3 });
    var hearts = '';
    for (var i = 0; i < LIVES; i++) hearts += i < this.lives ? '♥ ' : '♡ ';
    ui.text(ctx, hearts, 715, 31, { size: 22, color: C.red, weight: 'bold' });
    ui.text(ctx, 'Tốc độ dây: x' + (this.rps / START_RPS).toFixed(1), 715, 56, { size: 15, color: C.earth });

    if (this.ready > 0 && this.stun <= 0) {
      ui.text(ctx, this.lives < LIVES ? 'Chuẩn bị lại…' : 'Chuẩn bị…', 480, 200, { size: 44, weight: 'bold', color: C.cream, stroke: C.earthDark, strokeWidth: 6 });
    }
    ui.text(ctx, 'Bấm Space / ↑ / chạm màn hình để nhảy — nhảy ngay khi dây sắp chạm đất', 480, 516, { size: 16, color: C.cream, stroke: C.earthDark });
  };

  JumpRope.prototype.destroy = function () {};

  LG.registerGame({
    id: 'nhay-day',
    name: 'Nhảy dây',
    intro: 'Nhảy dây là trò chơi quen thuộc ở sân trường và ngõ xóm, chỉ cần một sợi dây thừng hoặc dây chun. Trò chơi giúp rèn sức bền, sự khéo léo và khả năng giữ nhịp, đồng thời gắn kết các bạn nhỏ với nhau.',
    rules: [
      'Hai bạn hai bên quay dây, bạn đứng giữa phải nhảy lên đúng lúc dây quét qua chân.',
      'Bấm Space, phím ↑ hoặc chạm vào màn hình để nhảy.',
      'Nhảy đúng lúc nhất được "Hoàn hảo" (+3 điểm), nhảy qua được là "Tốt" (+1). Nhảy liền 5 lần trở lên được thưởng thêm.',
      'Dây quay nhanh dần, thỉnh thoảng đổi nhịp. Tiếng "tích" vang lên khi dây ở trên đầu.',
      'Vướng dây 3 lần là hết lượt.'
    ],
    drawIcon: function (ctx, cx, cy, s, t) {
      var k = s / 100;
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      var phase = (t || 0) * 3;
      var hop = Math.max(0, Math.sin(phase)) * 12;
      ctx.strokeStyle = '#7a3b1e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-46, 0);
      ctx.quadraticCurveTo(0, -80 * Math.cos(phase) + 0, 46, 0);
      ctx.stroke();
      ui.drawKidSide(ctx, 0, 44 - hop, { scale: 0.7, shirt: '#2f8f6f', armAngle: 1.1, legSpread: hop > 3 ? 3 : 6 });
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 46, 14, 3, 0, 0, TWO_PI);
      ctx.fill();
    },
    create: function (api) { return new JumpRope(api); }
  });
})(window.LG);
