window.LG = window.LG || {};

// ===================== Ô ĂN QUAN =====================
// Bàn cờ gồm 12 ô xếp thành một vòng, đánh số theo chiều kim đồng hồ:
//
//            1    2    3    4    5            <- hàng trên: Người 2 / Máy
//      (0)                            (6)     <- hai ô quan ở hai đầu
//           11   10    9    8    7            <- hàng dưới: Người 1 (bạn)
//
// Phần LUẬT (applyMove, prepareTurn...) tách riêng, không dính gì tới việc vẽ,
// nên máy có thể "chơi thử" hàng nghìn nước trong đầu để chọn nước tốt nhất.
(function (LG) {
  'use strict';

  var ui = LG.ui, C = ui.C, U = LG.util;

  // ---------------- LUẬT CHƠI ----------------
  var QUAN_VALUE = 10;      // 1 quan = 10 điểm
  var QUAN_NON = 5;         // ô quan còn ít hơn 5 quân dân là "quan non", chưa được ăn
  var START_DAN = 5;        // mỗi ô dân lúc đầu có 5 quân
  var MAX_MOVES = 400;      // chặn trường hợp hiếm gặp: ván kéo dài vô tận

  function isQuanCell(i) { return i === 0 || i === 6; }
  function ownerOf(i) { return i >= 7 ? 0 : (i >= 1 && i <= 5 ? 1 : -1); }
  function rowOf(p) { return p === 0 ? [7, 8, 9, 10, 11] : [1, 2, 3, 4, 5]; }
  function next(i, dir) { return (i + dir + 12) % 12; }
  function isEmpty(c) { return c.dan === 0 && !c.quan; }
  function cellValue(c) { return c.dan + (c.quan ? QUAN_VALUE : 0); }
  function canCapture(c) { return !isEmpty(c) && !(c.quan && c.dan < QUAN_NON); }

  function newState() {
    var cells = [];
    for (var i = 0; i < 12; i++) {
      cells.push(isQuanCell(i) ? { dan: 0, quan: true } : { dan: START_DAN, quan: false });
    }
    return { cells: cells, score: [0, 0], debt: [0, 0], turn: 0, over: false, moves: 0 };
  }

  function cloneCells(cells) {
    return cells.map(function (c) { return { dan: c.dan, quan: c.quan }; });
  }

  function cloneState(s) {
    return { cells: cloneCells(s.cells), score: s.score.slice(), debt: s.debt.slice(), turn: s.turn, over: s.over, moves: s.moves };
  }

  function validMoves(s) {
    var moves = [];
    rowOf(s.turn).forEach(function (i) {
      if (s.cells[i].dan > 0) {
        moves.push({ cell: i, dir: 1 });
        moves.push({ cell: i, dir: -1 });
      }
    });
    return moves;
  }

  // Kết thúc ván: mỗi bên thu quân còn lại trên hàng của mình, rồi trả nợ đã vay
  function endGame(s, emit) {
    for (var p = 0; p < 2; p++) {
      rowOf(p).forEach(function (i) {
        s.score[p] += s.cells[i].dan;
        s.cells[i].dan = 0;
      });
    }
    for (p = 0; p < 2; p++) {
      s.score[p] -= s.debt[p];
      s.score[1 - p] += s.debt[p];
      s.debt[p] = 0;
    }
    s.over = true;
    emit('end', -1, 0, 0);
  }

  // Đầu lượt: nếu 5 ô của mình đều trống thì lấy 5 quân đã ăn ra rải mỗi ô một quân.
  // Không đủ thì vay của đối thủ (cuối ván trả lại).
  function prepareTurn(s, emit) {
    var p = s.turn, row = rowOf(p);
    for (var k = 0; k < row.length; k++) {
      if (s.cells[row[k]].dan > 0) return;
    }
    var fromSelf = Math.min(Math.max(0, s.score[p]), 5);
    var borrow = 5 - fromSelf;
    if (borrow > 0 && s.score[1 - p] < borrow) {
      // cả hai bên đều không còn quân để rải: kết thúc ván
      endGame(s, emit);
      return;
    }
    s.score[p] -= fromSelf;
    if (borrow > 0) {
      s.score[1 - p] -= borrow;
      s.debt[p] += borrow;
    }
    row.forEach(function (i) { s.cells[i].dan = 1; });
    emit('refill', row[2], borrow, 0);
  }

  function endTurn(s, emit) {
    // Hết quan, tàn dân, thu quân, kéo về
    if ((isEmpty(s.cells[0]) && isEmpty(s.cells[6])) || s.moves >= MAX_MOVES) {
      endGame(s, emit);
      return;
    }
    s.turn = 1 - s.turn;
    prepareTurn(s, emit);
  }

  // Thực hiện một nước đi: bốc ô `start`, rải theo chiều `dir` (+1 / -1).
  // record (có thể null): hàm nhận từng bước để làm hoạt ảnh.
  function applyMove(s, start, dir, record) {
    var cells = s.cells, p = s.turn;
    var hand = 0;
    function emit(type, cell, amount, h) {
      if (record) {
        record({
          type: type, cell: cell, amount: amount, hand: h, player: p,
          snap: { cells: cloneCells(cells), score: s.score.slice(), debt: s.debt.slice() }
        });
      }
    }

    s.moves++;
    hand = cells[start].dan;
    cells[start].dan = 0;
    emit('pick', start, hand, hand);
    var i = start, guard = 0;

    while (true) {
      // 1) Rải lần lượt mỗi ô một quân
      while (hand > 0) {
        i = next(i, dir);
        cells[i].dan++;
        hand--;
        emit('drop', i, 1, hand);
      }
      var n = next(i, dir);

      // 2) Ô kế tiếp còn quân
      if (!isEmpty(cells[n])) {
        if (isQuanCell(n)) {           // gặp ô quan: không được bốc, mất lượt
          emit('stop', n, 0, 0);
          break;
        }
        hand = cells[n].dan;           // bốc ô đó lên rải tiếp
        cells[n].dan = 0;
        i = n;
        emit('pick', n, hand, hand);
        if (++guard > 300) break;
        continue;
      }

      // 3) Ô kế tiếp trống: được ăn ô sau nó, rồi xét ăn tiếp theo kiểu "cách một ô trống"
      var m = next(n, dir), ate = false;
      while (isEmpty(cells[n]) && canCapture(cells[m])) {
        var value = cellValue(cells[m]);
        s.score[p] += value;
        cells[m].dan = 0;
        cells[m].quan = false;
        emit('capture', m, value, 0);
        ate = true;
        n = next(m, dir);
        m = next(n, dir);
      }
      if (!ate) emit('stop', isEmpty(cells[m]) ? n : m, 0, 0);
      break;
    }
    endTurn(s, emit);
  }

  // ---------------- MÁY CHƠI ----------------
  // Đánh giá thế cờ theo góc nhìn người chơi `me`: điểm của mình trừ điểm đối thủ
  // (tính cả nợ) + một chút cho số quân đang có trên hàng mình.
  function evaluate(s, me) {
    var other = 1 - me;
    var mine = s.score[me] - s.debt[me] + s.debt[other];
    var theirs = s.score[other] - s.debt[other] + s.debt[me];
    var v = mine - theirs;
    if (s.over) return v + (v > 0 ? 500 : v < 0 ? -500 : 0);
    var onBoard = 0;
    rowOf(me).forEach(function (i) { onBoard += s.cells[i].dan; });
    rowOf(other).forEach(function (i) { onBoard -= s.cells[i].dan; });
    return v + onBoard * 0.3;
  }

  // KHÁI NIỆM - Minimax: máy thử mọi nước của mình, với mỗi nước lại thử mọi nước đáp trả
  // của đối thủ... rồi giả sử đối thủ luôn đi nước tệ nhất cho máy. Chọn nước an toàn nhất.
  function minimax(s, depth, me) {
    if (depth <= 0 || s.over) return evaluate(s, me);
    var moves = validMoves(s);
    if (!moves.length) return evaluate(s, me);
    var maximizing = s.turn === me;
    var best = maximizing ? -Infinity : Infinity;
    for (var i = 0; i < moves.length; i++) {
      var c = cloneState(s);
      applyMove(c, moves[i].cell, moves[i].dir, null);
      var v = minimax(c, depth - 1, me);
      best = maximizing ? Math.max(best, v) : Math.min(best, v);
    }
    return best;
  }

  function chooseAiMove(s, level) {
    var moves = validMoves(s);
    if (level === 'de' && Math.random() < 0.5) return U.pick(moves);
    var depth = level === 'kho' ? 3 : 1;
    var me = s.turn, best = moves[0], bestVal = -Infinity;
    moves.forEach(function (m) {
      var c = cloneState(s);
      applyMove(c, m.cell, m.dir, null);
      var v = minimax(c, depth - 1, me) + Math.random() * 0.01;
      if (v > bestVal) { bestVal = v; best = m; }
    });
    return best;
  }

  // ---------------- GIAO DIỆN ----------------
  var CELL = 96, BX = 240, BY = 176;   // bàn cờ: ô dân 96x96, góc trên trái ở (240, 176)
  var STEP_DELAY = { pick: 0.3, drop: 0.17, capture: 0.55, stop: 0.45, refill: 0.8, end: 0.6 };
  var PEBBLE_COLORS = ['#e8e2d0', '#cfc6b0', '#b9b2a0', '#f0d9a8', '#d8c8a8'];

  function cellRect(i) {
    if (i >= 1 && i <= 5) return { x: BX + (i - 1) * CELL, y: BY, w: CELL, h: CELL };
    if (i >= 7 && i <= 11) return { x: BX + (11 - i) * CELL, y: BY + CELL, w: CELL, h: CELL };
    return null;
  }

  function cellCenter(i) {
    if (i === 0) return { x: BX - CELL * 0.45, y: BY + CELL };
    if (i === 6) return { x: BX + 5 * CELL + CELL * 0.45, y: BY + CELL };
    var r = cellRect(i);
    return { x: r.x + CELL / 2, y: r.y + CELL / 2 };
  }

  // Thứ tự các ô của một người từ trái sang phải trên màn hình
  function visualRow(p) { return p === 0 ? [11, 10, 9, 8, 7] : [1, 2, 3, 4, 5]; }

  // "Rải sang trái/phải" trên màn hình đổi thành chiều +1/-1 của vòng ô
  function visualToDir(p, side) {
    if (p === 0) return side === 'left' ? 1 : -1;
    return side === 'left' ? -1 : 1;
  }

  function OAnQuan(api, mode) {
    var self = this;
    this.api = api;
    this.ai = mode && mode.ai ? mode.ai : null;   // null = 2 người
    this.t = 0;
    this.state = newState();
    this.view = { cells: cloneCells(this.state.cells), score: [0, 0], debt: [0, 0] };
    this.anim = null;
    this.fast = false;
    this.cursor = -1;
    this.hand = 0;
    this.selected = -1;
    this.aiTimer = 0;
    this.endTimer = 0;
    this.ended = false;
    this.animOn = LG.storage.get('oaq.anim', true) !== false;
    this.popups = new ui.Popups();
    this.animButton = new ui.Button({
      x: 20, y: 14, w: 200, h: 40, size: 16, label: '',
      onClick: function () { self.toggleAnim(); }
    });
    this.updateAnimLabel();
  }

  OAnQuan.prototype.playerName = function (p) {
    if (this.ai) return p === 0 ? 'Bạn' : 'Máy';
    return p === 0 ? 'Người 1' : 'Người 2';
  };

  OAnQuan.prototype.toggleAnim = function () {
    this.animOn = !this.animOn;
    LG.storage.set('oaq.anim', this.animOn);
    this.updateAnimLabel();
  };

  OAnQuan.prototype.updateAnimLabel = function () {
    this.animButton.label = 'Hoạt ảnh rải: ' + (this.animOn ? 'Bật' : 'Tắt');
  };

  OAnQuan.prototype.isHumanTurn = function () {
    return !this.anim && !this.state.over && (!this.ai || this.state.turn === 0);
  };

  OAnQuan.prototype.doMove = function (cell, dir) {
    var events = [];
    applyMove(this.state, cell, dir, function (e) { events.push(e); });
    this.selected = -1;
    if (this.animOn) {
      this.anim = { events: events, i: 0, timer: 0 };
      this.fast = false;
    } else {
      // không hoạt ảnh: vẫn báo ăn quân, rải quân mới
      var self = this;
      events.forEach(function (e) {
        if (e.type === 'capture') self.showCapture(e);
        else if (e.type === 'refill') self.showRefill(e);
      });
      this.afterMove();
    }
  };

  OAnQuan.prototype.showCapture = function (e) {
    var c = cellCenter(e.cell);
    this.popups.add('+' + e.amount, c.x, c.y - 20, { color: C.gold, size: 30, life: 1.2 });
    LG.audio.play('capture');
  };

  OAnQuan.prototype.showRefill = function (e) {
    var p = ownerOf(e.cell);
    var c = cellCenter(e.cell);
    var msg = this.playerName(p) + ' rải quân mới' + (e.amount > 0 ? ' (vay ' + e.amount + ')' : '');
    this.popups.add(msg, c.x, p === 0 ? c.y + 70 : c.y - 70, { color: '#fff3c0', size: 22, life: 1.8, rise: 15 });
    LG.audio.play('beep');
  };

  OAnQuan.prototype.stepAnim = function () {
    var a = this.anim;
    var e = a.events[a.i++];
    if (!e) {
      this.anim = null;
      this.afterMove();
      return;
    }
    this.view = e.snap;
    this.cursor = e.cell;
    this.hand = e.hand;
    if (e.type === 'drop') LG.audio.play('pebble');
    else if (e.type === 'pick') LG.audio.play('select');
    else if (e.type === 'capture') this.showCapture(e);
    else if (e.type === 'stop') LG.audio.play('tick');
    else if (e.type === 'refill') this.showRefill(e);
    a.timer += STEP_DELAY[e.type] || 0.2;
  };

  OAnQuan.prototype.afterMove = function () {
    var s = this.state;
    this.view = { cells: cloneCells(s.cells), score: s.score.slice(), debt: s.debt.slice() };
    this.cursor = -1;
    this.hand = 0;
    this.fast = false;
    if (s.over) this.endTimer = 1.2;
    else if (this.ai && s.turn === 1) this.aiTimer = 0.7;
  };

  OAnQuan.prototype.update = function (dt) {
    this.t += dt;
    this.popups.update(dt);

    if (this.anim) {
      this.anim.timer -= dt * (this.fast ? 5 : 1);
      while (this.anim && this.anim.timer <= 0) this.stepAnim();
      return;
    }

    if (this.state.over) {
      if (!this.ended) {
        this.endTimer -= dt;
        if (this.endTimer <= 0) {
          this.ended = true;
          this.sendResult();
        }
      }
      return;
    }

    if (this.ai && this.state.turn === 1) {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        var mv = chooseAiMove(this.state, this.ai);
        if (mv) this.doMove(mv.cell, mv.dir);
      }
    }
  };

  OAnQuan.prototype.sendResult = function () {
    var s0 = this.state.score[0], s1 = this.state.score[1];
    var r;
    if (this.ai) {
      r = {
        win: s0 > s1,
        title: s0 > s1 ? 'Bạn thắng!' : s0 < s1 ? 'Máy thắng!' : 'Hòa!',
        message: 'Bạn: ' + s0 + ' điểm  ·  Máy: ' + s1 + ' điểm. (1 quan = 10 điểm, 1 dân = 1 điểm)',
        score: Math.max(0, s0)
      };
    } else {
      r = {
        win: s0 !== s1,
        title: s0 > s1 ? 'Người 1 thắng!' : s0 < s1 ? 'Người 2 thắng!' : 'Hòa!',
        message: 'Người 1: ' + s0 + ' điểm  ·  Người 2: ' + s1 + ' điểm.',
        record: false
      };
    }
    this.api.end(r);
  };

  // ----- Điều khiển -----
  OAnQuan.prototype.arrowRects = function (cell) {
    var r = cellRect(cell);
    var y = ownerOf(cell) === 0 ? r.y + CELL + 8 : r.y - 48;
    return {
      left: { x: r.x + 4, y: y, w: 42, h: 40 },
      right: { x: r.x + 50, y: y, w: 42, h: 40 }
    };
  };

  OAnQuan.prototype.cellAt = function (x, y) {
    if (x < BX || x >= BX + 5 * CELL) return -1;
    var col = Math.floor((x - BX) / CELL);
    if (y >= BY && y < BY + CELL) return 1 + col;
    if (y >= BY + CELL && y < BY + 2 * CELL) return 11 - col;
    return -1;
  };

  OAnQuan.prototype.sow = function (side) {
    if (this.selected < 0 || !this.isHumanTurn()) return;
    this.doMove(this.selected, visualToDir(this.state.turn, side));
  };

  function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  OAnQuan.prototype.onPointerDown = function (x, y) {
    if (ui.clickButtons([this.animButton], x, y)) return;
    if (this.anim) { this.fast = true; return; }   // nhấp khi đang rải = tua nhanh
    if (!this.isHumanTurn()) return;

    if (this.selected >= 0) {
      var ar = this.arrowRects(this.selected);
      if (inRect(ar.left, x, y)) { this.sow('left'); return; }
      if (inRect(ar.right, x, y)) { this.sow('right'); return; }
    }
    var c = this.cellAt(x, y);
    if (c >= 0 && ownerOf(c) === this.state.turn && this.state.cells[c].dan > 0) {
      this.selected = c;
      LG.audio.play('select');
    } else {
      this.selected = -1;
    }
  };

  OAnQuan.prototype.onKeyDown = function (code) {
    if (code === 'KeyT') { this.toggleAnim(); return; }
    if (this.anim) {
      if (code === 'Space' || code === 'Enter') this.fast = true;
      return;
    }
    if (!this.isHumanTurn()) return;
    var cells = this.state.cells;
    var row = visualRow(this.state.turn).filter(function (i) { return cells[i].dan > 0; });
    if (!row.length) return;
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
      var idx = row.indexOf(this.selected);
      if (idx < 0) idx = code === 'ArrowLeft' ? row.length - 1 : 0;
      else idx = (idx + (code === 'ArrowLeft' ? -1 : 1) + row.length) % row.length;
      this.selected = row[idx];
      LG.audio.play('select');
    } else if (code === 'KeyZ') {
      this.sow('left');
    } else if (code === 'KeyX') {
      this.sow('right');
    }
  };

  // ----- Vẽ -----
  function drawPebbles(ctx, i, n, cx, cy, spread) {
    var shown = Math.min(n, 30);
    for (var k = 0; k < shown; k++) {
      var seed = i * 101 + k * 7;
      var a = U.hash(seed) * Math.PI * 2;
      var r = Math.sqrt(U.hash(seed + 3)) * spread;
      var px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (isQuanCell(i)) px = cx + (i === 0 ? -1 : 1) * Math.abs(px - cx) * 0.8 + (i === 0 ? 8 : -8);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ui.circle(ctx, px + 1.5, py + 2, 6);
      ctx.fillStyle = PEBBLE_COLORS[Math.floor(U.hash(seed + 9) * PEBBLE_COLORS.length)];
      ui.circle(ctx, px, py, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ui.circle(ctx, px - 2, py - 2, 1.8);
    }
  }

  function drawQuanStone(ctx, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, 21, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    var g = ctx.createRadialGradient(x - 6, y - 6, 3, x, y, 22);
    g.addColorStop(0, '#7a7a86');
    g.addColorStop(1, '#2e2e36');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, 21, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  OAnQuan.prototype.render = function (ctx) {
    var v = this.view;

    // sân gạch
    ctx.fillStyle = '#b5653f';
    ctx.fillRect(0, 0, 960, 540);
    ctx.strokeStyle = 'rgba(80,30,15,0.3)';
    ctx.lineWidth = 2;
    for (var y = 0; y < 540; y += 30) {
      ui.line(ctx, 0, y, 960, y);
      for (var x = (y / 30) % 2 ? 0 : 30; x < 960; x += 60) ui.line(ctx, x, y, x, y + 30);
    }

    // ô được chọn / ô đang rải
    var activeTurn = this.anim ? this.anim.events[0].player : this.state.turn;
    if (this.isHumanTurn()) {
      visualRow(this.state.turn).forEach(function (i) {
        if (v.cells[i].dan > 0) {
          var r = cellRect(i);
          ctx.fillStyle = 'rgba(255,240,180,0.12)';
          ctx.fillRect(r.x, r.y, CELL, CELL);
        }
      });
    }
    if (this.selected >= 0) {
      var sr = cellRect(this.selected);
      ctx.fillStyle = 'rgba(255,230,120,0.35)';
      ctx.fillRect(sr.x, sr.y, CELL, CELL);
    }
    if (this.cursor >= 0) {
      ctx.save();
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 5;
      var cr = cellRect(this.cursor);
      if (cr) {
        ctx.strokeRect(cr.x + 4, cr.y + 4, CELL - 8, CELL - 8);
      } else {
        var qc = cellCenter(this.cursor);
        ctx.beginPath();
        ctx.arc(qc.x, qc.y, 40, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // kẻ bàn bằng phấn
    ctx.save();
    ctx.strokeStyle = 'rgba(255,253,240,0.92)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeRect(BX, BY, 5 * CELL, 2 * CELL);
    ui.line(ctx, BX, BY + CELL, BX + 5 * CELL, BY + CELL);
    for (var c = 1; c < 5; c++) ui.line(ctx, BX + c * CELL, BY, BX + c * CELL, BY + 2 * CELL);
    ctx.beginPath();
    ctx.arc(BX, BY + CELL, CELL, Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(BX + 5 * CELL, BY + CELL, CELL, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.restore();

    // quân
    for (var i = 0; i < 12; i++) {
      var cell = v.cells[i];
      var center = cellCenter(i);
      if (isQuanCell(i)) {
        var qx = i === 0 ? BX - 58 : BX + 5 * CELL + 58;
        if (cell.quan) drawQuanStone(ctx, qx, BY + CELL - 22);
        drawPebbles(ctx, i, cell.dan, center.x, BY + CELL + 22, 22);
        var labelX = i === 0 ? BX - 50 : BX + 5 * CELL + 50;
        var label = (cell.quan ? 'Quan + ' : '') + cell.dan;
        ui.text(ctx, label, labelX, BY - 14, { size: 17, weight: 'bold', color: '#fff8e0', stroke: 'rgba(60,20,10,0.7)', strokeWidth: 3 });
        if (cell.quan && cell.dan < QUAN_NON) {
          ui.text(ctx, '(quan non)', labelX, BY + 2 * CELL + 16, { size: 14, color: '#ffe0c0', stroke: 'rgba(60,20,10,0.6)', strokeWidth: 3 });
        }
      } else {
        drawPebbles(ctx, i, cell.dan, center.x, center.y + 4, 30);
        var rr = cellRect(i);
        ui.text(ctx, String(cell.dan), rr.x + CELL - 14, rr.y + 15, { size: 16, weight: 'bold', color: '#fff8e0', stroke: 'rgba(60,20,10,0.7)', strokeWidth: 3 });
      }
    }

    // mũi tên chọn hướng rải
    if (this.selected >= 0 && this.isHumanTurn()) {
      var ar = this.arrowRects(this.selected);
      [['left', '◀'], ['right', '▶']].forEach(function (pair) {
        var r = ar[pair[0]];
        var hover = !LG.input.usingTouch && inRect(r, LG.input.pointer.x, LG.input.pointer.y);
        ui.panel(ctx, r.x, r.y, r.w, r.h, { radius: 8, borderWidth: hover ? 4 : 3, shadow: false, fill: hover ? '#fff' : C.cream });
        ui.text(ctx, pair[1], r.x + r.w / 2, r.y + r.h / 2 + 1, { size: 20, weight: 'bold', color: C.redDark });
      });
    }

    // số quân trên tay khi đang rải
    if (this.anim && this.cursor >= 0 && this.hand > 0) {
      var hc = cellCenter(this.cursor);
      ui.text(ctx, 'Trên tay: ' + this.hand, hc.x, activeTurn === 0 ? BY + 2 * CELL + 24 : BY - 22, { size: 18, weight: 'bold', color: '#fff', stroke: C.earthDark });
    }

    this.renderHud(ctx, activeTurn);
    this.popups.render(ctx);
  };

  OAnQuan.prototype.renderHud = function (ctx, activeTurn) {
    var v = this.view;
    var self = this;
    function playerPanel(p, y) {
      var active = !self.state.over && activeTurn === p;
      ui.panel(ctx, 330, y, 300, 56, {
        radius: 12, borderWidth: active ? 5 : 3, border: active ? C.red : C.earth,
        fill: active ? '#fff8dc' : C.strawLight
      });
      var debt = v.debt[p] ? '  (nợ ' + v.debt[p] + ')' : '';
      ui.text(ctx, self.playerName(p) + ': ' + v.score[p] + ' điểm' + debt, 480, y + 22, { size: 20, weight: 'bold' });
      var sub = '';
      if (self.state.over) sub = 'Ván đã kết thúc';
      else if (active) sub = self.anim ? 'Đang rải quân…' : (self.ai && p === 1 ? 'Máy đang nghĩ…' : 'Đến lượt — chọn một ô của mình');
      ui.text(ctx, sub, 480, y + 43, { size: 14, color: active ? C.red : C.earth });
    }
    playerPanel(1, 64);
    playerPanel(0, 432);

    this.animButton.render(ctx);
    if (!LG.input.usingTouch) {
      ui.text(ctx, 'Chuột: nhấp ô rồi chọn ◀ ▶  ·  Phím: ←/→ chọn ô, Z rải trái, X rải phải  ·  Đang rải: nhấp để tua nhanh', 480, 516, { size: 13, color: '#fff3d6', stroke: 'rgba(40,15,5,0.7)', strokeWidth: 3 });
    } else {
      ui.text(ctx, 'Chạm một ô của mình, rồi chạm ◀ hoặc ▶ để chọn hướng rải', 480, 516, { size: 15, color: '#fff3d6', stroke: 'rgba(40,15,5,0.7)', strokeWidth: 3 });
    }
  };

  OAnQuan.prototype.destroy = function () {};

  LG.registerGame({
    id: 'o-an-quan',
    name: 'Ô ăn quan',
    intro: 'Ô ăn quan là trò chơi dân gian lâu đời của trẻ em Việt Nam: chỉ cần kẻ ô trên sân đất và nhặt sỏi làm quân. Trò chơi rèn khả năng tính toán và suy nghĩ trước nhiều bước. Câu "Hết quan, tàn dân, thu quân, kéo về" là lúc ván cờ kết thúc.',
    rules: [
      'Bàn có 10 ô dân (mỗi ô 5 quân) và 2 ô quan ở hai đầu (mỗi ô có 1 quan). Hàng dưới là của bạn. 1 quân dân = 1 điểm, 1 quan = 10 điểm.',
      'Đến lượt: chọn một ô của mình còn quân, chọn hướng rồi rải lần lượt mỗi ô một quân. Rải hết mà ô kế tiếp còn quân thì bốc lên rải tiếp; nếu ô kế tiếp là ô quan thì mất lượt.',
      'Ô kế tiếp trống mà ô sau đó có quân thì được ăn hết ô đó; sau đó cứ cách một ô trống lại có quân thì ăn tiếp. Gặp hai ô trống liền nhau thì mất lượt.',
      'Quan non: ô quan còn ít hơn 5 quân dân thì chưa được ăn.',
      'Đến lượt mà 5 ô của mình đều trống: lấy 5 quân đã ăn ra rải mỗi ô một quân; không đủ thì vay đối thủ, cuối ván trả lại.',
      'Khi cả hai ô quan đã bị ăn hết thì ván kết thúc: mỗi bên thu quân còn trên hàng mình. Bên nhiều điểm hơn thắng.'
    ],
    modes: [
      { label: '2 người', value: { ai: null } },
      { label: 'Máy - Dễ', value: { ai: 'de' } },
      { label: 'Máy - Khó', value: { ai: 'kho' } }
    ],
    drawIcon: function (ctx, cx, cy, s) {
      var k = s / 100;
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      var cw = 16;
      ctx.strokeStyle = C.earthDark;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-40, -cw, 80, cw * 2);
      ui.line(ctx, -40, 0, 40, 0);
      for (var i = 1; i < 5; i++) ui.line(ctx, -40 + i * cw, -cw, -40 + i * cw, cw);
      ctx.beginPath();
      ctx.arc(-40, 0, cw, Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(40, 0, cw, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      for (i = 0; i < 10; i++) {
        var col = i % 5, row = Math.floor(i / 5);
        for (var p = 0; p < 3; p++) {
          ctx.fillStyle = PEBBLE_COLORS[(i + p) % PEBBLE_COLORS.length];
          ui.circle(ctx, -40 + col * cw + 5 + p * 3, -cw + row * cw + 6 + (p % 2) * 4, 2.6);
        }
      }
      ctx.fillStyle = '#3a3a44';
      ui.circle(ctx, -48, 0, 6);
      ui.circle(ctx, 48, 0, 6);
    },
    create: function (api, mode) { return new OAnQuan(api, mode); }
  });

  // Mở cho file kiểm thử dùng (không ảnh hưởng game)
  LG.oAnQuanRules = { newState: newState, applyMove: applyMove, validMoves: validMoves, chooseAiMove: chooseAiMove, cloneState: cloneState };
})(window.LG);
