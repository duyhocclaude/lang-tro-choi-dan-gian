window.LG = window.LG || {};

// ===================== ĐẬP NIÊU =====================
// Người chơi bị bịt mắt, quay mấy vòng cho chóng mặt rồi cầm gậy đi tìm chiếc niêu đất.
// Đám đông xung quanh hò "Trái! Phải! Tiến lên!" để chỉ đường. Mỗi lượt chỉ được đập một lần.
//
// Điều khiển kiểu "xe tăng": ←/→ xoay người, ↑ bước tới, ↓ lùi lại, Space để đập.
(function (LG) {
  'use strict';

  var ui = LG.ui, C = ui.C, U = LG.util;

  var BOUNDS = { x1: 70, y1: 120, x2: 890, y2: 515 };   // vùng đi được, bên trong vòng người xem
  var START = { x: 480, y: 495 };
  var TURNS = 3, TURN_TIME = 25;
  var MOVE_SPEED = 115, BACK_SPEED = 65, TURN_SPEED = 2.4;
  var HIT_REACH = 46;          // đầu gậy cách người bao xa
  var POT_R = 22, HIT_TOLERANCE = 14;
  var SHOUT_EVERY = 0.85;
  var CROWD_SHIRTS = ['#b8322a', '#2f6f9f', '#2f8f6f', '#8e44ad', '#d35400', '#c0a020'];

  function makeCrowd() {
    var crowd = [];
    var i;
    for (i = 0; i < 8; i++) crowd.push({ x: 140 + i * 97, y: 96 });          // hàng trên
    for (i = 0; i < 4; i++) crowd.push({ x: 34, y: 160 + i * 95 });          // bên trái
    for (i = 0; i < 4; i++) crowd.push({ x: 926, y: 160 + i * 95 });         // bên phải
    crowd.forEach(function (c, k) {
      c.shirt = CROWD_SHIRTS[k % CROWD_SHIRTS.length];
      c.angle = Math.atan2(300 - c.y, 480 - c.x);  // nhìn vào giữa sân
      c.phase = U.rand(0, 6);
    });
    return crowd;
  }

  function PotSmash(api) {
    this.api = api;
    this.t = 0;
    this.turn = 0;
    this.hits = 0;
    this.score = 0;
    this.crowd = makeCrowd();
    this.popups = new ui.Popups();
    LG.input.setVirtualButtons([
      { x: 20, y: 440, w: 90, h: 84, label: '↺', code: 'ArrowLeft', size: 34 },
      { x: 120, y: 440, w: 90, h: 84, label: '↻', code: 'ArrowRight', size: 34 },
      { x: 650, y: 440, w: 90, h: 84, label: '▼', code: 'ArrowDown' },
      { x: 750, y: 440, w: 90, h: 84, label: '▲', code: 'ArrowUp' },
      { x: 850, y: 440, w: 90, h: 84, label: 'ĐẬP', code: 'Space', size: 22 }
    ]);
    this.startTurn();
  }

  PotSmash.prototype.startTurn = function () {
    this.turn++;
    this.player = { x: START.x, y: START.y, angle: -Math.PI / 2 };
    this.pot = { x: U.rand(180, 780), y: U.rand(150, 300), broken: false };
    this.phase = 'spin';               // spin -> walk -> swing -> result
    this.phaseTime = 1.6;
    this.finalAngle = -Math.PI / 2 + U.rand(-2.6, 2.6);   // quay xong không biết mặt hướng về đâu
    this.dizzy = 1;
    this.timeLeft = TURN_TIME;
    this.shoutTimer = 0.6;
    this.shout = null;
    this.stepTimer = 0;
    this.swingT = 0;
    this.swingChecked = false;
    this.reveal = 0;
    this.lastTick = 99;
  };

  PotSmash.prototype.onKeyDown = function (code, e) {
    if (e.repeat) return;
    if ((code === 'Space' || code === 'Enter') && this.phase === 'walk') {
      this.phase = 'swing';
      this.swingT = 0;
      this.swingChecked = false;
      LG.audio.play('whoosh');
    }
  };

  PotSmash.prototype.crowdShout = function () {
    var p = this.player, pot = this.pot;
    var dx = pot.x - p.x, dy = pot.y - p.y, d = Math.hypot(dx, dy);
    // rel > 0: niêu lệch về bên phải hướng mặt; rel < 0: lệch bên trái
    var rel = U.angleDiff(p.angle, Math.atan2(dy, dx));
    var word;
    if (d < HIT_REACH + 18 && Math.abs(rel) < 0.45) word = 'Đập đi!';
    else if (d < HIT_REACH - 12) word = 'Lùi lại!';
    else if (Math.abs(rel) < 0.28) word = d < 150 ? 'Gần lắm rồi!' : 'Tiến lên!';
    else if (Math.abs(rel) > 2.5) word = 'Quay lại!';
    else word = rel > 0 ? 'Phải!' : 'Trái!';

    var who = Math.floor(Math.random() * this.crowd.length);
    this.shout = { word: word, time: this.t, who: who };
    var c = this.crowd[who];
    LG.audio.play('shout', { word: word, pan: (c.x - 480) / 480 });
    LG.audio.say(word.replace('!', ''));
  };

  PotSmash.prototype.update = function (dt) {
    this.t += dt;
    this.popups.update(dt);
    var p = this.player;

    if (this.phase === 'spin') {
      this.phaseTime -= dt;
      p.angle = this.finalAngle + Math.max(0, this.phaseTime) * 7;
      if (this.phaseTime <= 0) {
        this.phase = 'walk';
        LG.audio.play('beep');
      }
      return;
    }

    if (this.phase === 'walk') {
      this.timeLeft -= dt;
      var sec = Math.ceil(this.timeLeft);
      if (sec <= 5 && sec !== this.lastTick && sec > 0) { this.lastTick = sec; LG.audio.play('tick'); }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.popups.add('Hết giờ!', p.x, p.y - 40, { color: '#ff9b8b', size: 30, life: 1.5 });
        LG.audio.play('fail');
        this.toResult();
        return;
      }

      this.dizzy = Math.max(0, this.dizzy - dt * 0.12);
      var input = LG.input;
      if (input.anyDown(['ArrowLeft', 'KeyA'])) p.angle -= TURN_SPEED * dt;
      if (input.anyDown(['ArrowRight', 'KeyD'])) p.angle += TURN_SPEED * dt;
      // chóng mặt: người cứ tự lảo đảo xoay lệch
      p.angle += Math.sin(this.t * 2.3) * this.dizzy * 0.9 * dt;

      var mv = 0;
      if (input.anyDown(['ArrowUp', 'KeyW'])) mv += MOVE_SPEED;
      if (input.anyDown(['ArrowDown', 'KeyS'])) mv -= BACK_SPEED;
      if (mv !== 0) {
        p.x += Math.cos(p.angle) * mv * dt;
        p.y += Math.sin(p.angle) * mv * dt;
        // bước chân xiêu vẹo sang ngang
        var drift = Math.sin(this.t * 1.7) * this.dizzy * 30 * dt;
        p.x += Math.cos(p.angle + Math.PI / 2) * drift;
        p.y += Math.sin(p.angle + Math.PI / 2) * drift;
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) { this.stepTimer = 0.35; LG.audio.play('step'); }
      }
      p.x = U.clamp(p.x, BOUNDS.x1, BOUNDS.x2);
      p.y = U.clamp(p.y, BOUNDS.y1, BOUNDS.y2);

      this.shoutTimer -= dt;
      if (this.shoutTimer <= 0) {
        this.shoutTimer = SHOUT_EVERY;
        this.crowdShout();
      }
      return;
    }

    if (this.phase === 'swing') {
      this.swingT += dt;
      if (!this.swingChecked && this.swingT >= 0.15) {
        this.swingChecked = true;
        var hx = p.x + Math.cos(p.angle) * HIT_REACH;
        var hy = p.y + Math.sin(p.angle) * HIT_REACH;
        if (U.dist(hx, hy, this.pot.x, this.pot.y) < POT_R + HIT_TOLERANCE) {
          var pts = 100 + Math.round(this.timeLeft * 5);
          this.pot.broken = true;
          this.hits++;
          this.score += pts;
          this.popups.add('Vỡ niêu! +' + pts, this.pot.x, this.pot.y - 40, { color: C.gold, size: 30, life: 1.6 });
          LG.audio.play('crash');
          LG.audio.play('cheer');
        } else {
          this.popups.add('Trượt rồi!', hx, hy - 30, { color: '#ff9b8b', size: 28, life: 1.4 });
          LG.audio.play('fail');
        }
      }
      if (this.swingT >= 0.4) this.toResult();
      return;
    }

    if (this.phase === 'result') {
      this.reveal = Math.min(1, this.reveal + dt * 3);
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        if (this.turn >= TURNS) this.sendResult();
        else this.startTurn();
      }
    }
  };

  PotSmash.prototype.toResult = function () {
    this.phase = 'result';
    this.phaseTime = 2;
    this.shout = null;
  };

  PotSmash.prototype.sendResult = function () {
    var msg = 'Bạn đập vỡ ' + this.hits + '/' + TURNS + ' chiếc niêu.';
    if (this.hits === TURNS) msg += ' Không trượt phát nào!';
    else if (this.hits === 0) msg += ' Hãy nghe đám đông hò và xoay người cho thẳng hướng trước khi bước nhé.';
    this.api.end({ win: this.hits > 0, title: 'Hết lượt!', message: msg, score: this.score });
  };

  function drawPot(ctx, x, y, broken, s) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (!broken) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(3, 14, 24, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8b4a2b';
      ctx.beginPath();
      ctx.ellipse(0, 2, 22, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a95f38';
      ctx.beginPath();
      ctx.ellipse(-6, -3, 9, 6, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5e2f18';
      ctx.beginPath();
      ctx.ellipse(0, -14, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // mảnh vỡ và quà bánh văng ra
      for (var i = 0; i < 9; i++) {
        var a = i * 0.7, r = 14 + U.hash(i) * 18;
        ctx.fillStyle = i % 2 ? '#8b4a2b' : '#6e3a20';
        ctx.save();
        ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
        ctx.rotate(a);
        ctx.fillRect(-6, -3, 12, 6);
        ctx.restore();
      }
      var candy = ['#f2b533', '#e0302a', '#2f8f6f', '#ffffff'];
      for (i = 0; i < 6; i++) {
        ctx.fillStyle = candy[i % 4];
        ui.circle(ctx, Math.cos(i * 1.1 + 0.4) * 9, Math.sin(i * 1.1 + 0.4) * 9, 4);
      }
    }
    ctx.restore();
  }

  PotSmash.prototype.render = function (ctx) {
    var p = this.player;

    // sân gạch
    ctx.fillStyle = '#b5653f';
    ctx.fillRect(0, 0, 960, 540);
    ctx.strokeStyle = 'rgba(80,30,15,0.35)';
    ctx.lineWidth = 2;
    for (var y = 0; y < 540; y += 30) {
      ui.line(ctx, 0, y, 960, y);
      for (var x = (y / 30) % 2 ? 0 : 30; x < 960; x += 60) ui.line(ctx, x, y, x, y + 30);
    }

    drawPot(ctx, this.pot.x, this.pot.y, this.pot.broken);

    // bóng tối của tấm khăn bịt mắt (tan dần khi lộ kết quả)
    var dark = 1 - this.reveal;
    if (dark > 0) {
      var grad = ctx.createRadialGradient(p.x, p.y, 18, p.x, p.y, 80);
      grad.addColorStop(0, 'rgba(10,6,4,0)');
      grad.addColorStop(1, 'rgba(10,6,4,' + (0.97 * dark) + ')');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 960, 540);
    }

    // người chơi + cây gậy
    var stickAngle = p.angle + 0.9;  // gậy cầm chếch sang phải
    if (this.phase === 'swing') stickAngle = p.angle + U.lerp(0.9, 0, Math.min(1, this.swingT / 0.15));
    else if (this.phase === 'result' && this.swingChecked) stickAngle = p.angle;
    ctx.save();
    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ui.line(ctx, p.x, p.y, p.x + Math.cos(stickAngle) * HIT_REACH, p.y + Math.sin(stickAngle) * HIT_REACH);
    ctx.restore();
    ui.drawKidTop(ctx, p.x, p.y, { angle: p.angle, r: 17, shirt: '#2f8f6f', blindfold: this.phase !== 'result' });

    // đám đông
    for (var i = 0; i < this.crowd.length; i++) {
      var c = this.crowd[i];
      var shouting = this.shout && this.shout.who === i && this.t - this.shout.time < 0.6;
      var bob = shouting ? Math.sin(this.t * 25) * 3 : Math.sin(this.t * 2 + c.phase) * 1.5;
      ui.drawKidTop(ctx, c.x, c.y + bob, { angle: c.angle, r: 13, shirt: c.shirt });
    }

    // câu hò
    if (this.shout) {
      var age = this.t - this.shout.time;
      if (age < 0.8) {
        var a = 1 - age / 0.8;
        var sc = this.crowd[this.shout.who];
        ctx.globalAlpha = a;
        var bx = U.clamp(sc.x, 90, 870), by = sc.y < 120 ? sc.y + 38 : sc.y - 34;
        ui.panel(ctx, bx - 70, by - 18, 140, 36, { radius: 18, borderWidth: 2, shadow: false });
        ui.text(ctx, this.shout.word, bx, by, { size: 18, weight: 'bold' });
        ctx.globalAlpha = 1;
      }
      // chữ lớn ở giữa trên cho dễ đọc
      ui.text(ctx, this.shout.word, 480, 150, {
        size: 40, weight: 'bold', color: 'rgba(242,181,51,' + Math.max(0, 1 - age / 0.85) + ')',
        stroke: 'rgba(20,10,5,' + Math.max(0, 1 - age / 0.85) * 0.8 + ')', strokeWidth: 6
      });
    }

    this.renderHud(ctx);
    this.popups.render(ctx);
  };

  PotSmash.prototype.renderHud = function (ctx) {
    ui.panel(ctx, 20, 12, 600, 52, { radius: 10, borderWidth: 3 });
    ui.text(ctx, 'Lượt ' + this.turn + '/' + TURNS, 40, 38, { size: 20, weight: 'bold', align: 'left' });
    ui.text(ctx, 'Vỡ: ' + this.hits, 170, 38, { size: 20, weight: 'bold', align: 'left' });
    ui.text(ctx, 'Điểm: ' + this.score, 270, 38, { size: 20, weight: 'bold', align: 'left' });
    ui.text(ctx, 'Còn ' + Math.ceil(this.timeLeft) + ' giây', 440, 38, { size: 20, weight: 'bold', align: 'left', color: this.timeLeft <= 5 ? C.red : C.ink });

    if (this.phase === 'spin') {
      ui.text(ctx, 'Bịt mắt… quay ba vòng…', 480, 300, { size: 34, weight: 'bold', color: C.cream, stroke: '#000', strokeWidth: 6 });
    }
    if (!LG.input.usingTouch && this.phase !== 'result') {
      ui.text(ctx, '←/→ xoay người · ↑ bước tới · ↓ lùi · Space đập', 480, 526, { size: 15, color: C.cream, stroke: '#000', strokeWidth: 3 });
    }
  };

  PotSmash.prototype.destroy = function () {
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* bỏ qua */ }
    }
  };

  LG.registerGame({
    id: 'dap-nieu',
    name: 'Đập niêu',
    intro: 'Đập niêu là trò chơi vui nhộn trong các lễ hội làng và dịp Tết. Người chơi bị bịt mắt, quay vài vòng rồi cầm gậy đi tìm và đập chiếc niêu đất, bên trong thường có quà. Cả làng đứng quanh hò reo chỉ đường, có khi chỉ sai để trêu, khiến ai cũng cười vui.',
    rules: [
      'Bạn bị bịt mắt và quay mấy vòng, nên không biết mình đang quay mặt về hướng nào. Lúc đầu còn chóng mặt nên đi hơi xiêu vẹo.',
      'Nghe và đọc lời đám đông: "Trái!" / "Phải!" (xoay người), "Tiến lên!", "Gần lắm rồi!", "Quay lại!", "Lùi lại!", "Đập đi!".',
      'Phím ← / → để xoay người, ↑ bước tới, ↓ lùi lại, Space để đập. Trên điện thoại dùng các nút ở góc màn hình.',
      'Mỗi lượt chỉ được đập MỘT lần và có 25 giây. Có 3 lượt, mỗi lượt niêu ở một chỗ khác.',
      'Đập vỡ niêu được 100 điểm, cộng thêm điểm theo thời gian còn lại.'
    ],
    drawIcon: function (ctx, cx, cy, s) {
      var k = s / 100;
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      drawPot(ctx, 18, 18, false, 1.2);
      ctx.save();
      ctx.translate(-20, -6);
      ctx.rotate(-0.6);
      ctx.fillStyle = '#6b4226';
      ui.roundRect(ctx, 0, -4, 52, 8, 4);
      ctx.fill();
      ctx.restore();
      ui.drawKidSide(ctx, -32, 44, { scale: 0.7, shirt: '#2f8f6f', blindfold: true, armAngle: 2.4 });
    },
    create: function (api) { return new PotSmash(api); }
  });
})(window.LG);
