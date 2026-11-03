window.LG = window.LG || {};

// ===================== KÉO CO =====================
// Hai đội kéo một sợi dây; dải lụa đỏ buộc giữa dây bị kéo qua vạch bên nào thì đội đó thắng.
// Người chơi bấm xen kẽ hai phím; bấm trùng phím (A, A) là "sai nhịp", không kéo được.
(function (LG) {
  'use strict';

  var ui = LG.ui, C = ui.C, U = LG.util;

  var WIN_DIST = 160;      // dải lụa lệch quá khoảng này (pixel) về một phía là thắng
  var PULL = 7;            // mỗi lần bấm đúng nhịp kéo dây được bao nhiêu pixel
  var TIME_LIMIT = 40;     // giây
  var FOOT_Y = 430;
  var KID_SCALE = 1.1;
  var ROPE_Y = FOOT_Y - 52 * KID_SCALE;   // ngang tầm tay các bạn nhỏ
  var AI_LEVELS = {
    de: { name: 'Dễ', rate: 4.5, bonus: 1 },
    vua: { name: 'Vừa', rate: 6.5, bonus: 2 },
    kho: { name: 'Khó', rate: 8.5, bonus: 3 }
  };
  var P1_KEYS = ['KeyA', 'KeyD'];
  var P2_KEYS = ['ArrowLeft', 'ArrowRight'];
  var TEAM_COLORS = [C.red, C.blue];

  function TugOfWar(api, mode) {
    this.api = api;
    this.ai = mode && mode.ai ? AI_LEVELS[mode.ai] : null;
    this.t = 0;
    this.offset = 0;          // âm = lệch về đội Đỏ (trái), dương = lệch về đội Xanh (phải)
    this.shownOffset = 0;     // vị trí vẽ, đuổi theo offset cho mượt
    this.countdown = 3;
    this.lastCount = 4;
    this.timeLeft = TIME_LIMIT;
    this.teams = [{ lastKey: -1, pulse: 0, wrong: 0 }, { lastKey: -1, pulse: 0, wrong: 0 }];
    this.aiTimer = 0.4;
    this.finished = false;
    this.endTimer = 0;
    this.winner = -1;
    this.popups = new ui.Popups();

    var vb = [
      { x: 20, y: 440, w: 100, h: 86, label: 'A', code: 'KeyA' },
      { x: 130, y: 440, w: 100, h: 86, label: 'D', code: 'KeyD' }
    ];
    if (!this.ai) {
      vb.push({ x: 730, y: 440, w: 100, h: 86, label: '←', code: 'ArrowLeft' },
              { x: 840, y: 440, w: 100, h: 86, label: '→', code: 'ArrowRight' });
    }
    LG.input.setVirtualButtons(vb);
  }

  TugOfWar.prototype.onKeyDown = function (code, e) {
    if (e.repeat || this.countdown > 0 || this.finished) return;
    var k1 = P1_KEYS.indexOf(code), k2 = P2_KEYS.indexOf(code);
    if (k1 >= 0) this.pull(0, k1);
    // Chơi với máy: người chơi được dùng cả phím mũi tên
    else if (k2 >= 0) this.pull(this.ai ? 0 : 1, k2);
  };

  // keyIndex: 0 = phím thứ nhất, 1 = phím thứ hai. Phải xen kẽ 0,1,0,1...
  TugOfWar.prototype.pull = function (team, keyIndex) {
    var tm = this.teams[team];
    if (tm.lastKey === keyIndex) {
      tm.wrong = 0.4;
      if (team === 0 || !this.ai) LG.audio.play('tick');
      return;
    }
    tm.lastKey = keyIndex;
    tm.pulse = 1;
    this.offset += team === 0 ? -PULL : PULL;
    LG.audio.play('pull', { pan: team === 0 ? -0.6 : 0.6 });
  };

  TugOfWar.prototype.update = function (dt) {
    this.t += dt;
    this.popups.update(dt);
    for (var i = 0; i < 2; i++) {
      this.teams[i].pulse = Math.max(0, this.teams[i].pulse - dt * 4);
      this.teams[i].wrong = Math.max(0, this.teams[i].wrong - dt);
    }
    this.shownOffset = U.lerp(this.shownOffset, this.offset, Math.min(1, dt * 12));

    if (this.finished) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.sendResult();
      return;
    }

    // Đếm ngược 3 - 2 - 1 - Kéo!
    if (this.countdown > 0) {
      this.countdown -= dt;
      var c = Math.ceil(this.countdown);
      if (c !== this.lastCount && c > 0) {
        this.lastCount = c;
        LG.audio.play('beep');
      }
      if (this.countdown <= 0) {
        LG.audio.play('go');
        this.popups.add('Kéo!', 480, 220, { size: 70, color: C.gold, life: 0.8 });
      }
      return;
    }

    this.timeLeft -= dt;

    // Máy kéo theo nhịp, lúc nhanh lúc chậm như người thật
    if (this.ai) {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        var rate = this.ai.rate * (1 + 0.25 * Math.sin(this.t * 0.9));
        this.aiTimer = (1 / rate) * U.rand(0.8, 1.2);
        this.pull(1, this.teams[1].lastKey === 0 ? 1 : 0);
      }
    }

    if (this.offset <= -WIN_DIST) this.finish(0);
    else if (this.offset >= WIN_DIST) this.finish(1);
    else if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.finish(this.offset < 0 ? 0 : this.offset > 0 ? 1 : -1);
    }
  };

  TugOfWar.prototype.finish = function (winner) {
    this.finished = true;
    this.winner = winner;
    this.endTimer = 1.4;
    LG.audio.play('cheer');
  };

  TugOfWar.prototype.sendResult = function () {
    var w = this.winner, r;
    if (this.ai) {
      if (w === 0) {
        r = {
          win: true, title: 'Bạn thắng!',
          message: 'Đội Đỏ đã kéo dải lụa qua vạch. Máy (' + this.ai.name + ') chịu thua!',
          score: Math.round((100 + this.timeLeft * 10) * this.ai.bonus)
        };
      } else if (w === 1) {
        r = { win: false, title: 'Máy thắng!', message: 'Máy kéo khỏe quá. Hãy bấm A và D xen kẽ thật đều tay nhé!', score: 0 };
      } else {
        r = { win: false, title: 'Hòa!', message: 'Hết giờ mà hai đội vẫn ngang sức ngang tài.', score: 0 };
      }
    } else {
      r = {
        win: w >= 0,
        title: w === 0 ? 'Đội Đỏ thắng!' : w === 1 ? 'Đội Xanh thắng!' : 'Hòa!',
        message: 'Trận kéo co hai người đã kết thúc. Đổi phe đấu lại nào!',
        record: false
      };
    }
    this.api.end(r);
  };

  TugOfWar.prototype.render = function (ctx) {
    ui.drawVillage(ctx, this.t);
    var cx = 480, off = this.shownOffset;

    // vạch giữa và hai vạch thắng
    ctx.save();
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ui.line(ctx, cx, 345, cx, 500);
    ctx.setLineDash([]);
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.red;
    ui.line(ctx, cx - WIN_DIST, 350, cx - WIN_DIST, 500);
    ctx.strokeStyle = C.blue;
    ui.line(ctx, cx + WIN_DIST, 350, cx + WIN_DIST, 500);
    ctx.restore();

    // hai đội, mỗi đội 3 bạn
    for (var team = 0; team < 2; team++) {
      var side = team === 0 ? -1 : 1;
      var tm = this.teams[team];
      var won = this.finished && this.winner === team;
      var lost = this.finished && this.winner >= 0 && this.winner !== team;
      for (var k = 0; k < 3; k++) {
        var x = cx + off + side * (110 + k * 66);
        var jump = won ? Math.abs(Math.sin(this.t * 10 + k)) * 14 : 0;
        var lean = lost ? 0.25 : -0.28 - tm.pulse * 0.12;
        ui.drawKidSide(ctx, x, FOOT_Y - jump, {
          scale: KID_SCALE, flip: team === 1, lean: lean,
          armAngle: Math.PI / 2, shirt: TEAM_COLORS[team], legSpread: 9
        });
      }
      if (tm.wrong > 0) {
        ui.text(ctx, 'Sai nhịp!', cx + off + side * 176, 320, { size: 20, weight: 'bold', color: '#fff', stroke: C.redDark });
      }
    }

    // sợi dây thừng
    var x1 = cx + off - 300, x2 = cx + off + 300;
    ctx.save();
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ui.line(ctx, x1, ROPE_Y, x2, ROPE_Y);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (var rx = x1; rx < x2; rx += 10) ui.line(ctx, rx, ROPE_Y - 3, rx + 5, ROPE_Y + 3);

    // dải lụa đỏ ở giữa dây
    var mx = cx + off, sway = Math.sin(this.t * 6) * 4;
    ctx.fillStyle = '#e0302a';
    ctx.beginPath();
    ctx.moveTo(mx - 8, ROPE_Y);
    ctx.lineTo(mx + 8, ROPE_Y);
    ctx.lineTo(mx + 5 + sway, ROPE_Y + 36);
    ctx.lineTo(mx - 6 + sway, ROPE_Y + 30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    this.renderHud(ctx);
    this.popups.render(ctx);
  };

  TugOfWar.prototype.renderHud = function (ctx) {
    var leftName = this.ai ? 'Đội Đỏ (Bạn)' : 'Đội Đỏ (Người 1)';
    var rightName = this.ai ? 'Đội Xanh (Máy - ' + this.ai.name + ')' : 'Đội Xanh (Người 2)';
    ui.panel(ctx, 20, 12, 260, 44, { radius: 10, borderWidth: 3 });
    ui.text(ctx, leftName, 150, 34, { size: 18, weight: 'bold', color: C.red });
    ui.panel(ctx, 570, 12, 270, 44, { radius: 10, borderWidth: 3 });
    ui.text(ctx, rightName, 705, 34, { size: 18, weight: 'bold', color: C.blue });
    ui.panel(ctx, 400, 12, 160, 44, { radius: 10, borderWidth: 3 });
    ui.text(ctx, 'Còn ' + Math.ceil(this.timeLeft) + ' giây', 480, 34, { size: 18, weight: 'bold' });

    // thanh thế trận
    var bx = 300, bw = 360, by = 70;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ui.roundRect(ctx, bx, by, bw, 14, 7);
    ctx.fill();
    ctx.fillStyle = C.red;
    ctx.fillRect(bx, by + 5, 8, 4);
    ctx.fillStyle = C.blue;
    ctx.fillRect(bx + bw - 8, by + 5, 8, 4);
    var mark = bx + bw / 2 + (this.shownOffset / WIN_DIST) * (bw / 2);
    ctx.fillStyle = '#e0302a';
    ui.circle(ctx, U.clamp(mark, bx, bx + bw), by + 7, 9);

    if (!LG.input.usingTouch) {
      var hint1 = this.ai ? 'Bấm xen kẽ A, D, A, D… (hoặc ←, →)' : 'Người 1: bấm xen kẽ A, D';
      ui.text(ctx, hint1, 30, 516, { size: 17, align: 'left', color: C.cream, stroke: C.earthDark });
      if (!this.ai) ui.text(ctx, 'Người 2: bấm xen kẽ ←, →', 930, 516, { size: 17, align: 'right', color: C.cream, stroke: C.earthDark });
    }

    if (this.countdown > 0) {
      ui.text(ctx, String(Math.ceil(this.countdown)), 480, 220, { size: 90, weight: 'bold', color: C.gold, stroke: C.earthDark, strokeWidth: 8 });
    }
  };

  TugOfWar.prototype.destroy = function () {};

  LG.registerGame({
    id: 'keo-co',
    name: 'Kéo co',
    intro: 'Kéo co là trò chơi tập thể có ở khắp Việt Nam, thường thấy trong lễ hội đầu xuân. Trò chơi thể hiện sức mạnh đoàn kết. Kéo co ở Việt Nam, Hàn Quốc, Campuchia và Philippines đã được UNESCO ghi danh là Di sản văn hóa phi vật thể (năm 2015).',
    rules: [
      'Hai đội nắm hai đầu dây. Dải lụa đỏ ở giữa dây bị kéo qua vạch bên đội nào thì đội đó thắng.',
      'Bấm XEN KẼ hai phím: Người 1 dùng A và D, Người 2 dùng ← và →. Bấm trùng một phím hai lần liền là sai nhịp, không kéo được.',
      'Hết 40 giây mà chưa ai thắng: dải lụa đang lệch về đội nào thì đội đó thắng.',
      'Chơi với máy: thắng càng nhanh, mức khó càng cao thì điểm càng nhiều.',
      'Trên điện thoại: chạm xen kẽ hai nút lớn ở góc màn hình.'
    ],
    modes: [
      { label: '2 người', value: { ai: null } },
      { label: 'Máy - Dễ', value: { ai: 'de' } },
      { label: 'Máy - Vừa', value: { ai: 'vua' } },
      { label: 'Máy - Khó', value: { ai: 'kho' } }
    ],
    drawIcon: function (ctx, cx, cy, s) {
      var k = s / 100;
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = 5;
      ui.line(ctx, -50, 2, 50, 2);
      ui.drawKidSide(ctx, -34, 36, { scale: 0.65, lean: -0.3, armAngle: Math.PI / 2, shirt: C.red });
      ui.drawKidSide(ctx, 34, 36, { scale: 0.65, lean: -0.3, armAngle: Math.PI / 2, shirt: C.blue, flip: true });
      ctx.fillStyle = '#e0302a';
      ctx.beginPath();
      ctx.moveTo(-5, 2);
      ctx.lineTo(5, 2);
      ctx.lineTo(2, 22);
      ctx.lineTo(-4, 19);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ui.line(ctx, 0, 26, 0, 44);
      ctx.setLineDash([]);
    },
    create: function (api, mode) { return new TugOfWar(api, mode); }
  });
})(window.LG);
