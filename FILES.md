# Peta file Soalin Portable

| Mau ubah / debug | File |
|---|---|
| Teks UI EN/ID | `js/i18n.js` |
| Konstanta, util, tema, progres LocalStorage | `js/core.js` |
| State global, library paket (IndexedDB), upload .docx | `js/state.js` |
| Klik jawaban, timer, mulai/reset Tentamen | `js/handlers.js` |
| Kartu soal, soal rusak, soal isian | `js/render-cards.js` |
| Header, mode bar, Mode Latihan | `js/render-latihan.js` |
| Mode Tentamen (setup/running/hasil) | `js/render-tentamen.js` |
| Pemilih paket, pengaturan, Custom Quiz | `js/render-picker.js` |
| Parser .docx -> soal | `js/convert.js` |
| render() utama, event listener, boot | `js/main.js` |
| Gamepad | `js/gamepad.js` |
| Token warna, tema terang | `css/base.css` |
| Header, filter, tracker, ring fokus gamepad | `css/layout.css` |
| Kartu & soal Mode Latihan | `css/latihan.css` |
| Mode Tentamen | `css/tentamen.css` |
| Pemilih paket, Custom Quiz, pengaturan | `css/picker.css` |

Urutan `<script>` di `index.html` wajib dipertahankan: skrip klasik (bukan module) yang saling berbagi variabel global. `convert.js` harus sebelum `main.js` karena `main.js` memanggil `boot()`.
