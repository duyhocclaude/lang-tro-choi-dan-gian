window.LG = window.LG || {};

// Âm thanh tạo hoàn toàn bằng Web Audio API (không cần file .mp3).
//
// KHÁI NIỆM: Web Audio hoạt động như một "dây chuyền" các nút (node):
//   nguồn âm (Oscillator / tiếng ồn) -> bộ lọc -> âm lượng (Gain) -> loa
// Muốn có âm thanh thật sau này: nạp file bằng fetch + decodeAudioData,
// rồi thay nội dung hàm tương ứng trong bảng SOUNDS bên dưới.
//
// Lưu ý: trình duyệt chỉ cho phát tiếng sau thao tác đầu tiên của người chơi
// (nhấp chuột / nhấn phím), nên unlock() được gọi trong input.js.
(function (LG) {
  'use strict';

  var MASTER_VOLUME = 0.6;
  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var muted = !!LG.storage.get('muted', false);
  var viVoice = null; // giọng đọc tiếng Việt của hệ điều hành (nếu có)

  function unlock() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : MASTER_VOLUME;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
        return;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function ready() {
    return !!ctx && !muted;
  }

  // Nối node vào loa, có thể đặt lệch trái (-1) / phải (+1)
  function connectOut(node, pan) {
    if (pan != null && ctx.createStereoPanner) {
      var panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(panner);
      panner.connect(master);
    } else {
      node.connect(master);
    }
  }

  // Một nốt nhạc: tần số (Hz), độ dài (giây)
  function tone(freq, duration, o) {
    if (!ready()) return;
    o = o || {};
    var t0 = ctx.currentTime + (o.delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + duration);

    var vol = Math.max(0.0001, o.volume == null ? 0.25 : o.volume);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.015, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain);
    connectOut(gain, o.pan);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function getNoiseBuffer() {
    if (!noiseBuffer) {
      var len = ctx.sampleRate;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  // Tiếng ồn đã lọc: dùng cho tiếng đập, tiếng vỡ, tiếng gió...
  function noise(duration, o) {
    if (!ready()) return;
    o = o || {};
    var t0 = ctx.currentTime + (o.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer();
    var filter = ctx.createBiquadFilter();
    filter.type = o.filter || 'bandpass';
    filter.frequency.value = o.freq || 1000;
    filter.Q.value = o.q || 1;
    var gain = ctx.createGain();
    var vol = Math.max(0.0001, o.volume == null ? 0.3 : o.volume);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    connectOut(gain, o.pan);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  function melody(notes, step, o) {
    notes.forEach(function (freq, i) {
      tone(freq, step * 1.6, Object.assign({}, o, { delay: i * step }));
    });
  }

  // Cao độ cho từng câu hò của đám đông (Đập niêu)
  var SHOUT_PATTERNS = {
    'Trái!': [330, 262],
    'Phải!': [262, 392],
    'Tiến lên!': [392, 392],
    'Gần lắm rồi!': [440, 494, 523],
    'Đập đi!': [523, 659],
    'Quay lại!': [294, 220],
    'Lùi lại!': [262, 220]
  };

  // Bảng âm thanh dùng trong game: LG.audio.play('ten')
  var SOUNDS = {
    click: function () { tone(660, 0.07, { type: 'square', volume: 0.08 }); },
    select: function () { tone(880, 0.06, { type: 'triangle', volume: 0.15 }); },
    pebble: function () { tone(1100 + Math.random() * 500, 0.05, { type: 'triangle', volume: 0.12 }); },
    capture: function () {
      tone(523, 0.12, { type: 'triangle' });
      tone(784, 0.2, { type: 'triangle', delay: 0.09 });
    },
    tick: function () { tone(1200, 0.035, { type: 'square', volume: 0.06 }); },
    beep: function () { tone(660, 0.15, { volume: 0.25 }); },
    go: function () { tone(990, 0.35, { volume: 0.3 }); },
    pull: function (o) { noise(0.06, { freq: 500, volume: 0.15, pan: o && o.pan }); },
    jump: function () { tone(400, 0.15, { slideTo: 700, volume: 0.15 }); },
    thump: function () {
      noise(0.07, { freq: 250, volume: 0.35 });
      tone(110, 0.1, { volume: 0.2 });
    },
    perfect: function () {
      SOUNDS.thump();
      tone(1046, 0.15, { type: 'triangle', volume: 0.18, delay: 0.02 });
    },
    success: function () { melody([523, 659, 784], 0.08, { type: 'triangle', volume: 0.2 }); },
    fail: function () { tone(300, 0.35, { type: 'sawtooth', slideTo: 140, volume: 0.12 }); },
    // Giai điệu ngũ cung nghe "dân gian" hơn
    win: function () { melody([523, 587, 698, 784, 880, 1047], 0.11, { type: 'triangle', volume: 0.2 }); },
    lose: function () { melody([440, 392, 349, 294], 0.16, { volume: 0.2 }); },
    whoosh: function () { noise(0.25, { freq: 900, q: 0.7, volume: 0.25 }); },
    crash: function () {
      noise(0.5, { freq: 2500, q: 0.5, volume: 0.4 });
      noise(0.25, { freq: 400, volume: 0.4 });
      tone(180, 0.2, { volume: 0.2 });
    },
    step: function () { noise(0.04, { freq: 300, volume: 0.08 }); },
    cheer: function () {
      noise(0.9, { freq: 1500, q: 0.4, volume: 0.12 });
      melody([784, 880, 1047], 0.1, { type: 'triangle', volume: 0.12 });
    },
    shout: function (o) {
      var pattern = SHOUT_PATTERNS[o && o.word] || [392, 330];
      melody(pattern, 0.12, { type: 'square', volume: 0.06, pan: o && o.pan });
    }
  };

  // Tiếng dê kêu "be-e-e". pan: -1 (trái) .. 1 (phải), volume: 0..1, pitch: hệ số cao độ
  function bleat(pan, volume, pitch) {
    if (!ready()) return;
    var t0 = ctx.currentTime;
    var base = 420 * (pitch || 1);

    var osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, t0);
    osc.frequency.linearRampToValueAtTime(base * 1.15, t0 + 0.15);
    osc.frequency.linearRampToValueAtTime(base * 0.9, t0 + 0.6);

    // LFO: dao động nhanh làm giọng "rung rung" như dê
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 28;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = base * 0.06;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = base * 2.5;
    filter.Q.value = 1.2;

    var gain = ctx.createGain();
    var vol = Math.max(0.0001, volume);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.05);
    gain.gain.setValueAtTime(vol, t0 + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);

    osc.connect(filter);
    filter.connect(gain);
    connectOut(gain, pan);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + 0.7);
    lfo.stop(t0 + 0.7);
  }

  // Đọc chữ bằng giọng tiếng Việt của máy (nếu máy có cài giọng vi-VN)
  function findVietnameseVoice() {
    try {
      var voices = window.speechSynthesis.getVoices();
      for (var i = 0; i < voices.length; i++) {
        if (/^vi/i.test(voices[i].lang)) return voices[i];
      }
    } catch (e) { /* bỏ qua */ }
    return null;
  }

  if (window.speechSynthesis) {
    viVoice = findVietnameseVoice();
    try {
      window.speechSynthesis.addEventListener('voiceschanged', function () {
        viVoice = findVietnameseVoice();
      });
    } catch (e) { /* trình duyệt cũ */ }
  }

  function say(text) {
    if (muted || !viVoice) return false;
    try {
      var u = new window.SpeechSynthesisUtterance(text);
      u.voice = viVoice;
      u.lang = viVoice.lang;
      u.rate = 1.25;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }

  LG.audio = {
    unlock: unlock,
    tone: tone,
    noise: noise,
    bleat: bleat,
    say: say,
    play: function (name, opts) {
      if (!ready() || !SOUNDS[name]) return;
      try { SOUNDS[name](opts); } catch (e) { /* không để lỗi âm thanh làm dừng game */ }
    },
    available: function () {
      return !!(window.AudioContext || window.webkitAudioContext);
    },
    isMuted: function () { return muted; },
    toggleMute: function () {
      muted = !muted;
      LG.storage.set('muted', muted);
      if (master) master.gain.value = muted ? 0 : MASTER_VOLUME;
      if (muted && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (e) { /* bỏ qua */ }
      }
    }
  };
})(window.LG);
