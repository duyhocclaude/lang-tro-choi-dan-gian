window.LG = window.LG || {};

// ===================== RỒNG RẮN LÊN MÂY =====================
// Một hàng các bạn nối đuôi nhau (con rồng). Bạn đầu hàng (máy điều khiển) dang tay
// che chắn, người chơi làm "thầy thuốc" phải chạm được vào bạn cuối hàng (khúc đuôi).
//
// Cách làm hàng người uốn lượn: lưu lại "vệt đường" mà người đầu hàng đã đi qua (trail).
// Người thứ i đứng trên vệt đó, cách người đầu đúng i * SPACING pixel -> cả hàng đi
// đúng theo đường của người đầu, giống trò chơi rắn săn mồi.
(function (LG) {
  'use strict';

  var ui = LG.ui, C = ui.C, U = LG.util;

  var FIELD = { x: 30, y: 80, w: 900, h: 440 };
  var PLAYER_R = 16, MEMBER_R = 15, SPACING = 31;
  var PLAYER_SPEED = 215;
  var LEVEL_TIME = 30;
  var SHIRTS = ['#3f7fbf', '#2f8f6f', '#8e44ad', '#d35400'];

  function DragonSnake(api) {
    this.api = api;
    this.t = 0;
    this.level = 1;
    this.score = 0;
    this.popups = new ui.Popups();
    this.startLevel();
  }

  DragonSnake.prototype.startLevel = function () {
    this.count = Math.min(5 + this.level, 10);              // số người, tính cả đầu và đuôi
    this.headSpeed = Math.min(150 + this.level * 13, 245);
    this.turnRate = 3.2 + this.level * 0.25;                // rad/giây: càng lớn càng ngoặt gắt
    this.timeLeft = LEVEL_TIME;
    this.lastTick = 99;
    this.intro = 1.5;
    this.caughtTimer = 0;
    this.player = { x: 480, y: FIELD.y + FIELD.h - 50, angle: -Math.PI / 2 };
    this.head = { x: 480 - (this.count * SPACING) / 2, y: FIELD.y + 110, angle: Math.PI };

    // Vệt đường ban đầu: một đường thẳng phía sau người đầu
    this.trail = [];
    for (var d = 0; d <= this.count * SPACING + 60; d += 4) {
      this.trail.push({ x: this.head.x + d, y: this.head.y });
    }
    this.chain = this.computeChain();
  };

  // Tính vị trí từng người trong hàng bằng cách đi dọc vệt đường
  DragonSnake.prototype.computeChain = function () {
    var res = [{ x: this.head.x, y: this.head.y }];
    var prev = this.head;
    var acc = 0;  // quãng đã đi kể từ người vừa đặt
    for (var i = 0; i < this.trail.length && res.length < this.count; i++) {
      var p = this.trail[i];
      var seg = Math.hypot(p.x - prev.x, p.y - prev.y);
      while (seg > 0 && acc + seg >= SPACING && res.length < this.count) {
        var need = SPACING - acc;
        var f = need / seg;
        var q = { x: prev.x + (p.x - prev.x) * f, y: prev.y + (p.y - prev.y) * f };
        res.push(q);
        seg -= need;
        prev = q;
        acc = 0;
      }
      acc += seg;
      prev = p;
    }
    while (res.length < this.count) res.push({ x: prev.x, y: prev.y });
    return res;
  };

  DragonSnake.prototype.updateHead = function (dt) {
    var head = this.head, pl = this.player;
    var tail = this.chain[this.count - 1];

    // Người đầu muốn đứng chắn giữa thầy thuốc và khúc đuôi
    var dx = tail.x - pl.x, dy = tail.y - pl.y;
    var d = Math.hypot(dx, dy) || 1;
    var tx = pl.x + dx / d * 55, ty = pl.y + dy / d * 55;
    // cộng thêm dao động ngang để hàng người uốn lượn
    var wiggle = Math.sin(this.t * 2.6) * 35;
    tx += -dy / d * wiggle;
    ty += dx / d * wiggle;
    tx = U.clamp(tx, FIELD.x + 40, FIELD.x + FIELD.w - 40);
    ty = U.clamp(ty, FIELD.y + 40, FIELD.y + FIELD.h - 40);

    // Quay đầu dần về hướng mục tiêu (không quay ngoắt ngay lập tức)
    var desired = Math.atan2(ty - head.y, tx - head.x);
    var maxTurn = this.turnRate * dt;
    head.angle += U.clamp(U.angleDiff(head.angle, desired), -maxTurn, maxTurn);

    var distT = Math.hypot(tx - head.x, ty - head.y);
    var speed = this.headSpeed * U.clamp(distT / 70, 0.35, 1);
    head.x = U.clamp(head.x + Math.cos(head.angle) * speed * dt, FIELD.x + MEMBER_R, FIELD.x + FIELD.w - MEMBER_R);
    head.y = U.clamp(head.y + Math.sin(head.angle) * speed * dt, FIELD.y + MEMBER_R, FIELD.y + FIELD.h - MEMBER_R);

    // Ghi vệt đường và cắt bớt phần quá dài
    var last = this.trail[0];
    if (Math.hypot(head.x - last.x, head.y - last.y) >= 3) this.trail.unshift({ x: head.x, y: head.y });
    var maxLen = this.count * SPACING + 40, total = 0;
    for (var i = 1; i < this.trail.length; i++) {
      total += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y);
      if (total > maxLen) { this.trail.length = i + 1; break; }
    }
  };

  DragonSnake.prototype.update = function (dt) {
    this.t += dt;
    this.popups.update(dt);

    if (this.caughtTimer > 0) {
      this.caughtTimer -= dt;
      if (this.caughtTimer <= 0) {
        this.level++;
        this.startLevel();
      }
      return;
    }
    if (this.intro > 0) {
      this.intro -= dt;
      return;
    }

    this.timeLeft -= dt;
    var sec = Math.ceil(this.timeLeft);
    if (sec <= 5 && sec !== this.lastTick && sec > 0) {
      this.lastTick = sec;
      LG.audio.play('tick');
    }
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.sendResult();
      return;
    }

    this.updateHead(dt);
    this.chain = this.computeChain();

    // Thầy thuốc di chuyển
    var pl = this.player;
    var mv = LG.input.moveVector(pl.x, pl.y);
    if (mv.x || mv.y) {
      pl.x += mv.x * PLAYER_SPEED * dt;
      pl.y += mv.y * PLAYER_SPEED * dt;
      pl.angle = Math.atan2(mv.y, mv.x);
    }
    pl.x = U.clamp(pl.x, FIELD.x + PLAYER_R, FIELD.x + FIELD.w - PLAYER_R);
    pl.y = U.clamp(pl.y, FIELD.y + PLAYER_R, FIELD.y + FIELD.h - PLAYER_R);

    // KHÁI NIỆM - Va chạm hình tròn: hai hình tròn chạm nhau khi khoảng cách tâm
    // nhỏ hơn tổng bán kính. Chạm người trong hàng thì bị đẩy ra; chạm đuôi là bắt được.
    var minD = PLAYER_R + MEMBER_R;
    for (var i = 0; i < this.count; i++) {
      var m = this.chain[i];
      var dx = pl.x - m.x, dy = pl.y - m.y, d = Math.hypot(dx, dy);
      if (i === this.count - 1) {
        if (d < minD + 3) { this.catchTail(); return; }
      } else if (d < minD && d > 0.001) {
        pl.x = m.x + dx / d * minD;
        pl.y = m.y + dy / d * minD;
      }
    }
  };

  DragonSnake.prototype.catchTail = function () {
    var gained = 100 * this.level + Math.ceil(this.timeLeft) * 10;
    this.score += gained;
    this.caughtTimer = 1.5;
    var tail = this.chain[this.count - 1];
    this.popups.add('Bắt được đuôi! +' + gained, tail.x, tail.y - 30, { color: C.gold, size: 28, life: 1.4 });
    LG.audio.play('success');
  };

  DragonSnake.prototype.sendResult = function () {
    var caught = this.level - 1;
    this.api.end({
      win: caught > 0,
      title: 'Hết giờ!',
      message: caught > 0
        ? 'Thầy thuốc đã bắt được khúc đuôi ' + caught + ' lần. Con rồng chạy ngày càng nhanh đấy!'
        : 'Con rồng khéo che quá, bạn chưa bắt được khúc đuôi nào. Thử vòng ra sau lưng nó nhé!',
      score: this.score
    });
  };

  DragonSnake.prototype.render = function (ctx) {
    // sân đất có cỏ lốm đốm
    ctx.fillStyle = '#7da34e';
    ctx.fillRect(0, 0, 960, 540);
    ctx.fillStyle = '#c99a5b';
    ui.roundRect(ctx, FIELD.x, FIELD.y, FIELD.w, FIELD.h, 18);
    ctx.fill();
    ctx.fillStyle = 'rgba(90,143,60,0.45)';
    for (var g = 0; g < 40; g++) {
      ctx.beginPath();
      ctx.ellipse(FIELD.x + U.hash(g) * FIELD.w, FIELD.y + U.hash(g + 99) * FIELD.h, 10 + U.hash(g + 7) * 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.earthDark;
    ui.roundRect(ctx, FIELD.x, FIELD.y, FIELD.w, FIELD.h, 18);
    ctx.stroke();

    // tay nắm vai nhau
    ctx.save();
    ctx.strokeStyle = C.skin;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (var i = 1; i < this.count; i++) {
      ui.line(ctx, this.chain[i - 1].x, this.chain[i - 1].y, this.chain[i].x, this.chain[i].y);
    }
    ctx.restore();

    // vẽ từ đuôi lên đầu để người đầu nằm trên cùng
    for (i = this.count - 1; i >= 0; i--) {
      var m = this.chain[i];
      var angle = i === 0 ? this.head.angle : Math.atan2(this.chain[i - 1].y - m.y, this.chain[i - 1].x - m.x);
      var isTail = i === this.count - 1;
      if (isTail) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,220,80,' + (0.5 + 0.4 * Math.sin(this.t * 6)) + ')';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(m.x, m.y, MEMBER_R + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ui.drawKidTop(ctx, m.x, m.y, {
        angle: angle, r: MEMBER_R,
        shirt: i === 0 ? C.gold : isTail ? C.red : SHIRTS[i % SHIRTS.length]
      });
    }
    ui.text(ctx, 'Đầu', this.chain[0].x, this.chain[0].y - 28, { size: 14, weight: 'bold', color: '#fff', stroke: C.earthDark });
    var tl = this.chain[this.count - 1];
    ui.text(ctx, 'Đuôi', tl.x, tl.y - 30, { size: 14, weight: 'bold', color: '#fff3a0', stroke: C.earthDark });

    var pl = this.player;
    ui.drawKidTop(ctx, pl.x, pl.y, { angle: pl.angle, r: PLAYER_R, shirt: '#ffffff', cross: true });
    ui.text(ctx, 'Thầy thuốc', pl.x, pl.y + 30, { size: 13, weight: 'bold', color: '#fff', stroke: C.earthDark });

    this.renderHud(ctx);
    this.popups.render(ctx);
  };

  DragonSnake.prototype.renderHud = function (ctx) {
    ui.panel(ctx, 30, 14, 440, 52, { radius: 10, borderWidth: 3 });
    ui.text(ctx, 'Màn ' + this.level, 50, 40, { size: 20, weight: 'bold', align: 'left' });
    ui.text(ctx, 'Điểm: ' + this.score, 160, 40, { size: 20, weight: 'bold', align: 'left' });
    var low = this.timeLeft <= 5;
    ui.text(ctx, 'Còn ' + Math.ceil(this.timeLeft) + ' giây', 320, 40, { size: 20, weight: 'bold', align: 'left', color: low ? C.red : C.ink });
    ui.text(ctx, 'Di chuyển: phím mũi tên / WASD, hoặc giữ chuột / ngón tay', 830, 40, { size: 13, align: 'right', color: C.cream, stroke: C.earthDark, strokeWidth: 3 });

    if (this.intro > 0) {
      ui.text(ctx, 'Màn ' + this.level, 480, 260, { size: 56, weight: 'bold', color: C.gold, stroke: C.earthDark, strokeWidth: 7 });
      ui.text(ctx, 'Rồng có ' + this.count + ' khúc — bắt lấy khúc đuôi!', 480, 315, { size: 24, weight: 'bold', color: '#fff', stroke: C.earthDark, strokeWidth: 5 });
    }
  };

  DragonSnake.prototype.destroy = function () {};

  LG.registerGame({
    id: 'rong-ran',
    name: 'Rồng rắn lên mây',
    intro: 'Rồng rắn lên mây là trò chơi tập thể của trẻ em miền Bắc, vừa chơi vừa hát bài đồng dao "Rồng rắn lên mây, có cây núc nắc…". Một bạn làm thầy thuốc, các bạn khác nối thành con rồng; trò chơi rèn sự nhanh nhẹn và tinh thần đồng đội.',
    rules: [
      'Bạn là thầy thuốc (áo trắng). Hãy chạm vào khúc đuôi (bạn áo đỏ có vòng sáng) ở cuối hàng.',
      'Bạn đầu hàng (áo vàng) sẽ dang tay che chắn. Bạn không thể đi xuyên qua hàng người.',
      'Di chuyển bằng phím mũi tên hoặc WASD; trên điện thoại hoặc khi dùng chuột thì giữ và kéo về phía muốn đi.',
      'Mỗi màn có 30 giây. Bắt được đuôi thì qua màn mới: rồng dài hơn và chạy nhanh hơn.',
      'Bắt càng nhanh càng nhiều điểm. Hết giờ mà chưa bắt được là kết thúc.'
    ],
    drawIcon: function (ctx, cx, cy, s, t) {
      var k = s / 100;
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      var pts = [];
      for (var i = 0; i < 5; i++) {
        pts.push({ x: -40 + i * 20, y: Math.sin(i * 1.1 + (t || 0) * 2) * 16 });
      }
      ctx.strokeStyle = C.skin;
      ctx.lineWidth = 4;
      for (i = 1; i < pts.length; i++) ui.line(ctx, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      for (i = pts.length - 1; i >= 0; i--) {
        ui.drawKidTop(ctx, pts[i].x, pts[i].y, { angle: Math.PI, r: 11, shirt: i === 0 ? C.gold : i === pts.length - 1 ? C.red : SHIRTS[i % 4] });
      }
      ui.drawKidTop(ctx, 46, 30, { angle: Math.PI * 1.2, r: 12, shirt: '#ffffff', cross: true });
    },
    create: function (api) { return new DragonSnake(api); }
  });
})(window.LG);
