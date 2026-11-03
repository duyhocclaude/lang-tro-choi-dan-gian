# Làng Trò Chơi Dân Gian

Game tổng hợp 6 trò chơi dân gian Việt Nam, viết bằng HTML5 Canvas và JavaScript thuần.
Không cần cài đặt gì, không cần server, không cần Internet.

## Cách chạy

Nhấp đúp vào `index.html`, trò chơi sẽ mở trong trình duyệt (Chrome, Edge, Firefox, Safari đều được).

- Phím **M** hoặc nút loa ở góc phải: bật/tắt âm thanh.
- Phím **Esc** / **P** hoặc nút ⏸: tạm dừng.
- Chơi trên điện thoại: chép cả thư mục vào máy rồi mở `index.html`, hoặc đưa thư mục lên một
  trang web tĩnh bất kỳ (GitHub Pages, Netlify...). Khi chạm màn hình, game tự hiện nút ảo.

## Các trò chơi

| Trò | Chế độ | Điều khiển chính |
|---|---|---|
| Ô ăn quan | 2 người / Máy Dễ / Máy Khó | Nhấp ô rồi chọn ◀ ▶ · phím ←/→ chọn ô, Z/X rải trái/phải |
| Rồng rắn lên mây | 1 người, qua màn | Mũi tên / WASD, hoặc giữ chuột / ngón tay |
| Nhảy dây | 1 người | Space / ↑ / chạm màn hình |
| Bịt mắt bắt dê | Bình thường / Chế độ hỗ trợ | Mũi tên / WASD (nên đeo tai nghe) |
| Đập niêu | 1 người, 3 lượt | ←/→ xoay, ↑ tiến, ↓ lùi, Space đập |
| Kéo co | 2 người / Máy Dễ, Vừa, Khó | Bấm xen kẽ A–D (Người 2: ←–→) |

Điểm cao nhất được lưu trong trình duyệt (localStorage).

## Cấu trúc thư mục

```
index.html              Trang chính, nạp các file JS theo thứ tự
css/style.css           Căn giữa canvas, chặn cuộn trang trên điện thoại
js/core/util.js         Hàm toán học nhỏ (clamp, lerp, rand, angleDiff...)
js/core/storage.js      Lưu / đọc kỷ lục (localStorage, có try/catch)
js/core/audio.js        Âm thanh tạo bằng Web Audio API + giọng đọc tiếng Việt (nếu máy có)
js/core/input.js        Bàn phím, chuột, cảm ứng, nút ảo
js/core/ui.js           Vẽ chữ, khung, nút, phong cảnh làng, nhân vật
js/core/engine.js       Vòng lặp game, co giãn màn hình, chuyển cảnh
js/scenes/menu.js       Menu "sân đình"
js/scenes/game-scene.js Khung chung cho mọi mini-game: giới thiệu, tạm dừng, kết thúc, kỷ lục
js/games/*.js           Mỗi trò chơi một file
js/main.js              Khởi động
```

Vì sao không dùng `import` / `export`? Trình duyệt chặn ES modules khi mở file trực tiếp
(`file://`). Thay vào đó, mọi file gắn đồ của mình vào một biến chung là `window.LG`.

## Thêm một trò chơi mới

1. Tạo file `js/games/ten-tro-choi.js` theo mẫu dưới đây.
2. Thêm một dòng vào `index.html`, đặt trước dòng `js/main.js`:
   `<script src="js/games/ten-tro-choi.js"></script>`

Xong! Trò chơi sẽ tự xuất hiện trên menu, có sẵn màn giới thiệu, nút tạm dừng, màn kết thúc và kỷ lục.

```js
window.LG = window.LG || {};

(function (LG) {
  'use strict';
  var ui = LG.ui, C = ui.C;

  // Mỗi lần bấm "Chơi" hoặc "Chơi lại", game tạo một đối tượng MỚI -> không lo sót trạng thái cũ
  function MyGame(api, mode) {
    this.api = api;          // api.end({...}) để báo kết thúc
    this.score = 0;
    this.timeLeft = 10;
  }

  // Gọi khoảng 60 lần/giây. dt = số giây kể từ lần trước
  MyGame.prototype.update = function (dt) {
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.api.end({
        win: this.score >= 10,
        title: 'Hết giờ!',
        message: 'Bạn bấm được ' + this.score + ' lần.',
        score: this.score       // bỏ trống nếu trò không tính điểm; record: false để không lưu kỷ lục
      });
    }
  };

  // Vẽ lại toàn bộ màn hình. Toạ độ luôn là 960 x 540
  MyGame.prototype.render = function (ctx) {
    ui.drawVillage(ctx, 0);
    ui.text(ctx, 'Bấm Space thật nhanh: ' + this.score, 480, 200, { size: 36, weight: 'bold' });
    ui.text(ctx, 'Còn ' + Math.ceil(this.timeLeft) + ' giây', 480, 260, { size: 24 });
  };

  // Không bắt buộc: onKeyDown, onKeyUp, onPointerDown, onPointerMove, onPointerUp, destroy
  MyGame.prototype.onKeyDown = function (code, e) {
    if (code === 'Space' && !e.repeat) this.score++;
  };

  LG.registerGame({
    id: 'bam-nhanh',                       // duy nhất, dùng làm khoá lưu kỷ lục
    name: 'Bấm nhanh',
    intro: 'Vài câu giới thiệu nguồn gốc, ý nghĩa của trò chơi.',
    rules: ['Luật thứ nhất.', 'Luật thứ hai.'],
    modes: [{ label: 'Bắt đầu', value: null }],   // nhiều chế độ thì thêm phần tử
    drawIcon: function (ctx, cx, cy, size, t) {    // hình nhỏ trên thẻ menu
      ctx.fillStyle = C.red;
      ui.circle(ctx, cx, cy, size * 0.3);
    },
    create: function (api, modeValue) { return new MyGame(api, modeValue); }
  });
})(window.LG);
```

Những thứ dùng chung có thể gọi trong game:

- `LG.input.isDown('ArrowLeft')`: phím có đang được giữ không.
- `LG.input.moveVector(x, y)`: hướng di chuyển từ phím mũi tên/WASD hoặc chuột/ngón tay.
- `LG.input.setVirtualButtons([...])`: nút ảo cho điện thoại; mỗi nút giả lập một phím.
- `LG.audio.play('success')`: các tiếng có sẵn nằm trong bảng `SOUNDS` của `audio.js`.
- `new ui.Popups()`: chữ nổi bay lên (+10, Hoàn hảo!...).
- `ui.drawKidSide`, `ui.drawKidTop`: vẽ nhân vật nhìn ngang / nhìn từ trên xuống.

## Thay hình khối bằng ảnh thật

Mọi nhân vật và phong cảnh được vẽ trong vài hàm của `js/core/ui.js`. Ví dụ với nhân vật:

```js
// đầu file ui.js
var kidImage = new Image();
kidImage.src = 'assets/kid.png';

// trong drawKidSide, thay phần vẽ chân, áo, đầu bằng:
ctx.drawImage(kidImage, -20, -90, 40, 90);
```

Mọi trò dùng `drawKidSide` sẽ tự đổi theo. Bạn có thể làm tương tự với `drawVillage`,
`drawRoof`, hay hàm `drawPot` trong `dap-nieu.js`.

## Thay âm thanh bằng file thật

Trong `js/core/audio.js`, mỗi tiếng là một hàm trong bảng `SOUNDS`. Muốn dùng file `.mp3`:

```js
var crashAudio = new Audio('assets/crash.mp3');
SOUNDS.crash = function () { crashAudio.currentTime = 0; crashAudio.play(); };
```

Lưu ý: tiếng dê trong *Bịt mắt bắt dê* cần chỉnh được trái/phải và độ to, nên phải đi qua
Web Audio (`StereoPannerNode`). Xem hàm `bleat()` để biết cách nối.

## Ghi chú về luật Ô ăn quan

Mỗi vùng chơi Ô ăn quan một kiểu. Game dùng luật sau, có thể sửa ở đầu file `o-an-quan.js`:

- `QUAN_VALUE = 10`: một quan bằng 10 dân.
- `QUAN_NON = 5`: ô quan còn ít hơn 5 dân thì chưa được ăn. Đặt về `1` nếu bạn chơi theo luật
  "quan còn trơ trọi thì không được ăn".
- Gặp ô quan khi đang rải tiếp thì mất lượt; hết quân thì rải lại từ quân đã ăn, thiếu thì vay.
