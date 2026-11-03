window.LG = window.LG || {};

// ===================== BỊT MẮT BẮT DÊ =====================
// Màn hình gần như tối hẳn. Con dê thỉnh thoảng kêu "be-e-e":
//   - tiếng TO hay NHỎ cho biết dê ở GẦN hay XA (GainNode)
//   - tiếng lệch TAI TRÁI hay TAI PHẢI cho biết dê ở bên trái hay bên phải (StereoPannerNode)
//   - tiếng CAO hơn bình thường nghĩa là dê ở PHÍA TRÊN, trầm hơn là ở PHÍA DƯỚI
// Chế độ hỗ trợ vẽ thêm vòng sóng âm chỉ hướng, dành cho người không nghe được.
(function (LG) {
  'use strict';

  var ui = LG.ui, C = ui.C, U = LG.util;

  var FIELD = { x: 20, y: 76, w: 920, h: 444 };
  var PLAYER_R = 16, GOAT_R = 14;
  var PLAYER_SPEED = 175;
  var GOAT_WANDER_SPEED = 45, GOAT_FLEE_SPEED = 95, FLEE_DIST = 130;
  var GAME_TIME = 60;
  var LIGHT_R = 70;

  function BlindGoat(api, mode) {
    this.api = api;
    this.assist = !!(mode && mode.assist);
    this.t = 0;
    this.timeLeft = GAME_TIME;
    this.caught = 0;
    this.score = 0;
    this.intro = 2.6;
    this.freeze = 0;
    this.bleatTimer = 0.8;
    this.lastBleat = null;
    this.lastTick = 99;
    this.player = { x: 480, y: 300, angle: -Math.PI / 2 };
    this.goat = {};
    this.popups = new ui.Popups();
    this.spawnGoat();
  }

  BlindGoat.prototype.spawnGoat = function () {
    var g = this.goat, pl = this.player;
    for (var tries = 0; tries < 60; tries++) {
      g.x = U.rand(FIELD.x + 40, FIELD.x + FIELD.w - 40);
      g.y = U.rand(FIELD.y + 40, FIELD.y + FIELD.h - 40);
      if (U.dist(g.x, g.y, pl.x, pl.y) >= 320) break;
    }
    g.angle = U.rand(0, Math.PI * 2);
    g.turnTimer = U.rand(1, 2.5);
    g.spawnTime = this.t;
  };

  BlindGoat.prototype.bleat = function () {
    var g = this.goat, pl = this.player;
    var dx = g.x - pl.x, dy = g.y - pl.y, d = Math.hypot(dx, dy);
    var pan = U.clamp(dx / 300, -1, 1);
    var closeness = U.clamp(1 - d / 750, 0, 1);
    var volume = 0.04 + 0.7 * closeness * closeness;
    var pitch = 1 + U.clamp(-dy / 400, -1, 1) * 0.28;
    LG.audio.bleat(pan, volume, pitch);
    this.lastBleat = { time: this.t, angle: Math.atan2(dy, dx), loud: closeness };
  };

  BlindGoat.prototype.update = function (dt) {
    this.t += dt;
    this.popups.update(dt);

    if (this.intro > 0) { this.intro -= dt; return; }
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (this.freeze <= 0) {
        this.spawnGoat();
        this.bleatTimer = 0.6;
      }
      return;
    }

    this.timeLeft -= dt;
    var sec = Math.ceil(this.timeLeft);
    if (sec <= 5 && sec !== this.lastTick && sec > 0) { this.lastTick = sec; LG.audio.play('tick'); }
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.sendResult();
      return;
    }

    // người chơi
    var pl = this.player;
    var mv = LG.input.moveVector(pl.x, pl.y);
    if (mv.x || mv.y) {
      pl.x += mv.x * PLAYER_SPEED * dt;
      pl.y += mv.y * PLAYER_SPEED * dt;
      pl.angle = Math.atan2(mv.y, mv.x);
    }
    pl.x = U.clamp(pl.x, FIELD.x + PLAYER_R, FIELD.x + FIELD.w - PLAYER_R);
    pl.y = U.clamp(pl.y, FIELD.y + PLAYER_R, FIELD.y + FIELD.h - PLAYER_R);

    // con dê: đi lang thang, nghe thấy người tới gần thì chạy
    var g = this.goat;
    var d = U.dist(g.x, g.y, pl.x, pl.y);
    var speed = GOAT_WANDER_SPEED;
    if (d < FLEE_DIST) {
      var away = Math.atan2(g.y - pl.y, g.x - pl.x);
      g.angle += U.clamp(U.angleDiff(g.angle, away), -3 * dt, 3 * dt);
      speed = GOAT_FLEE_SPEED;
    } else {
      g.turnTimer -= dt;
      if (g.turnTimer <= 0) {
        g.angle += U.rand(-1.5, 1.5);
        g.turnTimer = U.rand(1, 2.5);
      }
    }
    g.x += Math.cos(g.angle) * speed * dt;
    g.y += Math.sin(g.angle) * speed * dt;
    // chạm rào thì quay lại (phản xạ như quả bóng)
    var minX = FIELD.x + GOAT_R, maxX = FIELD.x + FIELD.w - GOAT_R;
    var minY = FIELD.y + GOAT_R, maxY = FIELD.y + FIELD.h - GOAT_R;
    if (g.x < minX || g.x > maxX) { g.x = U.clamp(g.x, minX, maxX); g.angle = Math.PI - g.angle; }
    if (g.y < minY || g.y > maxY) { g.y = U.clamp(g.y, minY, maxY); g.angle = -g.angle; }

    this.bleatTimer -= dt;
    if (this.bleatTimer <= 0) {
      this.bleat();
      this.bleatTimer = U.rand(1.1, 2.0);
    }

    if (U.dist(g.x, g.y, pl.x, pl.y) < PLAYER_R + GOAT_R) {
      this.caught++;
      var bonus = Math.max(0, Math.round(50 - (this.t - g.spawnTime) * 3));
      this.score += 100 + bonus;
      this.freeze = 1.3;
      this.popups.add('Bắt được dê! +' + (100 + bonus), g.x, g.y - 30, { color: C.gold, size: 26, life: 1.3 });
      LG.audio.play('success');
      LG.audio.bleat(0, 0.6, 1.1);
    }
  };

  BlindGoat.prototype.sendResult = function () {
    this.api.end({
      win: this.caught > 0,
      title: 'Hết giờ!',
      message: this.caught > 0
        ? 'Bạn đã bắt được ' + this.caught + ' con dê chỉ bằng đôi tai. Thính tai thật!'
        : 'Chưa bắt được con dê nào. Hãy đeo tai nghe và đi về phía tiếng kêu to dần nhé.',
      score: this.score
    });
  };

  function drawGoatTop(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8d2c4';
    ui.circle(ctx, 15, 0, 7);
    ctx.strokeStyle = '#7a6a50';
    ctx.lineWidth = 2.5;
    ui.line(ctx, 16, -4, 22, -8);
    ui.line(ctx, 16, 4, 22, 8);
    ctx.fillStyle = '#d8d2c4';
    ui.circle(ctx, -16, 0, 3);
    ctx.restore();
  }

  function drawGoatSide(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = '#6b5a40';
    ctx.lineWidth = 3;
    ui.line(ctx, -10, 6, -11, 20);
    ui.line(ctx, -4, 6, -4, 20);
    ui.line(ctx, 6, 6, 6, 20);
    ui.line(ctx, 11, 6, 12, 20);
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(18, -9, 7, 6, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a6a50';
    ui.line(ctx, 17, -14, 13, -21);
    ctx.fillStyle = '#222';
    ui.circle(ctx, 20, -10, 1.5);
    ctx.restore();
  }

  BlindGoat.prototype.render = function (ctx) {
    var pl = this.player, g = this.goat;

    ctx.fillStyle = '#0d0b12';
    ctx.fillRect(0, 0, 960, 540);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 3;
    ui.roundRect(ctx, FIELD.x, FIELD.y, FIELD.w, FIELD.h, 16);
    ctx.stroke();

    // vùng cảm nhận quanh người chơi
    var grad = ctx.createRadialGradient(pl.x, pl.y, 10, pl.x, pl.y, LIGHT_R);
    grad.addColorStop(0, 'rgba(255,225,170,0.32)');
    grad.addColorStop(1, 'rgba(255,225,170,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(pl.x - LIGHT_R, pl.y - LIGHT_R, LIGHT_R * 2, LIGHT_R * 2);

    // dê chỉ hiện khi đã rất gần (chạm tay tới) hoặc vừa bị bắt
    var d = U.dist(g.x, g.y, pl.x, pl.y);
    var vis = this.freeze > 0 ? 1 : U.clamp((LIGHT_R + 10 - d) / 40, 0, 1);
    if (vis > 0) {
      ctx.globalAlpha = vis;
      drawGoatTop(ctx, g.x, g.y, g.angle);
      ctx.globalAlpha = 1;
    }

    ui.drawKidTop(ctx, pl.x, pl.y, { angle: pl.angle, r: PLAYER_R, shirt: '#3f7fbf', blindfold: true });

    // gợi ý khi dê kêu
    if (this.lastBleat) {
      var age = this.t - this.lastBleat.time;
      if (age < 0.9) {
        var a = 1 - age / 0.9;
        ui.text(ctx, '♪ Be-e-e!', 480, 96, { size: 20, weight: 'bold', color: 'rgba(255,230,160,' + a + ')' });
        if (this.assist) {
          var lb = this.lastBleat;
          ctx.save();
          ctx.strokeStyle = 'rgba(255,210,90,' + a * (0.35 + 0.65 * lb.loud) + ')';
          ctx.lineWidth = 3 + 8 * lb.loud;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(pl.x, pl.y, 34 + age * 45, lb.angle - 0.5, lb.angle + 0.5);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    this.renderHud(ctx);
    this.popups.render(ctx);
  };

  BlindGoat.prototype.renderHud = function (ctx) {
    ui.panel(ctx, 20, 12, 560, 52, { radius: 10, borderWidth: 3 });
    ui.text(ctx, 'Còn ' + Math.ceil(this.timeLeft) + ' giây', 40, 38, { size: 20, weight: 'bold', align: 'left', color: this.timeLeft <= 5 ? C.red : C.ink });
    ui.text(ctx, 'Bắt được: ' + this.caught, 220, 38, { size: 20, weight: 'bold', align: 'left' });
    ui.text(ctx, 'Điểm: ' + this.score, 390, 38, { size: 20, weight: 'bold', align: 'left' });
    if (this.assist) ui.text(ctx, 'Chế độ hỗ trợ', 836, 38, { size: 15, align: 'right', color: '#ffd27a' });

    var warn = '';
    if (!LG.audio.available()) warn = 'Trình duyệt không phát được âm thanh. Hãy chọn "Chế độ hỗ trợ".';
    else if (LG.audio.isMuted()) warn = 'Âm thanh đang tắt! Bấm nút loa ở góc phải hoặc phím M để bật.';
    if (warn) ui.text(ctx, warn, 480, 510, { size: 17, weight: 'bold', color: '#ff9b8b' });

    if (this.intro > 0) {
      ui.text(ctx, 'Hãy đeo tai nghe để nghe rõ hướng', 480, 220, { size: 30, weight: 'bold', color: C.cream });
      ui.text(ctx, 'To = gần · Lệch tai trái/phải = dê ở bên trái/phải · Cao giọng = dê ở phía trên', 480, 265, { size: 18, color: '#e6d6b0' });
      ui.text(ctx, 'Di chuyển: phím mũi tên / WASD, hoặc giữ chuột / ngón tay', 480, 300, { size: 16, color: '#bfae8a' });
    }
  };

  BlindGoat.prototype.destroy = function () {};

  LG.registerGame({
    id: 'bit-mat-bat-de',
    name: 'Bịt mắt bắt dê',
    intro: 'Bịt mắt bắt dê là trò chơi quen thuộc trong các dịp hội hè và giờ ra chơi. Người bịt mắt phải dựa vào đôi tai để tìm "con dê" đang vừa chạy vừa kêu "be be". Trò chơi rèn sự tập trung, khả năng định hướng bằng âm thanh và mang lại nhiều tiếng cười.',
    rules: [
      'Bạn bị bịt mắt, màn hình gần như tối hẳn. Con dê kêu "be-e-e" sau mỗi một, hai giây.',
      'Nghe tiếng để đoán: tiếng TO là dê ở gần, lệch TAI TRÁI hoặc TAI PHẢI là dê ở bên đó, tiếng CAO hơn là dê ở phía trên, trầm hơn là ở phía dưới. Nên đeo tai nghe.',
      'Di chuyển bằng phím mũi tên hoặc WASD, hoặc giữ chuột / ngón tay. Chạm vào dê là bắt được; dê nghe tiếng chân sẽ chạy trốn.',
      'Có 60 giây để bắt càng nhiều dê càng tốt. Bắt càng nhanh càng được thưởng thêm điểm.',
      '"Chế độ hỗ trợ" vẽ thêm vòng sóng chỉ hướng tiếng kêu, dành cho người khó nghe hoặc máy không có loa.'
    ],
    modes: [
      { label: 'Bình thường', value: { assist: false } },
      { label: 'Chế độ hỗ trợ', value: { assist: true } }
    ],
    drawIcon: function (ctx, cx, cy, s) {
      var k = s / 100;
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.fillStyle = '#2a2233';
      ui.roundRect(ctx, -52, -46, 104, 92, 14);
      ctx.fill();
      ui.drawKidSide(ctx, -20, 40, { scale: 0.75, shirt: '#3f7fbf', blindfold: true, armAngle: 1.5 });
      drawGoatSide(ctx, 26, 22, 0.9);
      ui.text(ctx, '♪', 30, -24, { size: 22, weight: 'bold', color: '#ffe08a' });
    },
    create: function (api, mode) { return new BlindGoat(api, mode); }
  });
})(window.LG);
