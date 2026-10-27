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

## Skills Terpasang

Repositori ini telah dilengkapi dengan skill agen pada `.agents/skills/`:
- **antislop**: Menjaga kebersihan kode dan arsitektur tanpa kode boilerplate AI yang tidak perlu.
- **ponytail**: Pola pikir minimalis senior developer (YAGNI & kode paling ringkas yang berfungsi penuh).
