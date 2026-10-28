# MahjongIn-Server — Multiplayer Game Server (144 Ubin)

Backend game server *real-time* berbasis **Node.js, TypeScript, dan Socket.io** untuk permainan Mahjong 4 pemain gaya Hong Kong (144 Ubin) yang populer di lounge/kafe Jakarta.

Server ini menggunakan arsitektur **Authoritative Server** (server memegang state ubin tembok, validasi giliran, dan menyembunyikan ubin lawan dari setiap klien untuk mencegah cheat).

## Fitur Utama

- **Branch Default**: `master`.
- **144 Ubin Lengkap**: Mengelola ubin karakter, lingkaran, bambu, angin, naga, dan 8 ubin bunga & musim.
- **Penggantian Bunga Otomatis**: Server otomatis memajang ubin bunga dan menarik ubin pengganti.
- **Room Management**: Pemain dapat membuat room dengan 4-karakter Room Code (`ABCD`), bergabung bersama teman, atau mengisi kursi kosong dengan bot (`room:fill-bots`).
- **Kalkulasi Nilai Fan**: Menghitung kombinasi menang Hong Kong (*Ping Hu, Dui Dui Hu, Qing Yi Se, Hun Yi Se, Bunga Kursi, Naga, Angin, Tsumo*).
- **Anti-Cheat State Masking**: Data `myHand` hanya dikirim ke pemilik kursi. Lawan hanya menerima jumlah ubin (`tileCount`), ubin bunga terbuka, dan buangan publik.

Baru pertama kali main Mahjong? Baca [TUTORIAL.md](TUTORIAL.md).

## Instalasi dan Menjalankan

```sh
cd /Users/zachrandikasyahreza/Project/MahjongIn-Server

# Instal dependensi
npm install

# Menjalankan dalam mode dev (watch)
npm run dev

# Menjalankan build TypeScript
npm run build

# Menjalankan pengujian logika aturan
npm test
```

## Spesifikasi Event WebSocket (Socket.io)

### Client -> Server

| Event | Payload | Keterangan |
| :--- | :--- | :--- |
| `room:create` | `{ name: string }` | Membuat room baru dan menempati Kursi 0 (Timur). |
| `room:join` | `{ roomCode: string, name: string }` | Bergabung ke room yang sudah ada. |
| `room:fill-bots`| `{}` | Mengisi sisa kursi kosong dengan bot. |
| `game:start` | `{}` | Memulai pembagian 13 ubin dan giliran pertama. |
| `game:draw` | `{}` | Mengambil 1 ubin dari tembok saat giliran draw. |
| `game:discard` | `{ tile: number }` | Membuang ubin dari tangan. |
| `game:claim` | `{ kind: 'chi'\|'pon'\|'kan'\|'ron', index?: number }` | Mengklaim ubin buangan lawan. |
| `game:pass` | `{}` | Melewati kesempatan klaim ubin. |

### Server -> Client

| Event | Payload | Keterangan |
| :--- | :--- | :--- |
| `room:joined` | `{ roomCode, seat }` | Konfirmasi berhasil masuk ke room dan nomor kursi. |
| `game:state` | `ClientGameState` | Sinkronisasi state meja, ubin pribadi, dan info publik lawan. |
| `game:over` | `{ winner, fanSummary }` | Notifikasi kemenangan ronde dan rincian Fan. |
| `error` | `string` | Pesan kesalahan (misal: room penuh atau tidak ditemukan). |

## Deploy Online Gratis (Render.com)

Server ini telah dilengkapi file konfigurasi `render.yaml` untuk deploy 1-klik di **Render.com** (Free Tier):

1. Login ke [dashboard.render.com](https://dashboard.render.com) menggunakan akun GitHub (`alifsyr`).
2. Klik **New +** -> **Blueprint**.
3. Pilih repository `alifsyr/MahjongIn-Server`.
4. Render akan otomatis membaca konfigurasi:
   - **Region**: Singapore (latensi rendah ke Indonesia).
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
5. Klik **Apply**. Dalam 2 menit server Anda akan aktif dengan URL publik HTTPS (contoh: `https://mahjongin-server.onrender.com`).

## CI/CD Otomatis dengan GitHub Actions

Pipeline CI/CD otomatis telah terpasang di [`.github/workflows/deploy.yml`](file:///.github/workflows/deploy.yml):

* **Alur**: Setiap kali ada `git push` ke branch `master`:
  1. Menjalankan `npm ci` & kompilasi TypeScript (`npm run build`).
  2. Menjalankan seluruh pengujian unit logika aturan (`npm test`).
  3. Jika semua lulus, otomatis memicu deployment ke Render via Deploy Hook.
* **Setup Secret**:
  1. Di Render Dashboard: Masuk ke Service Anda -> tab **Settings** -> bagian **Deploy Hook**.
  2. Salin URL Deploy Hook (format: `https://api.render.com/deploy/srv-...`).
  3. Di GitHub: Masuk ke **Settings** -> **Secrets and variables** -> **Actions**.
  4. Tambahkan secret baru bernama `RENDER_DEPLOY_HOOK_URL` dan isi nilainya dengan URL tersebut.

## Skills Terpasang

Repositori ini telah dilengkapi dengan skill agen pada `.agents/skills/`:
- **antislop**: Menjaga kebersihan kode dan arsitektur tanpa kode boilerplate AI yang tidak perlu.
- **ponytail**: Pola pikir minimalis senior developer (YAGNI & kode paling ringkas yang berfungsi penuh).
