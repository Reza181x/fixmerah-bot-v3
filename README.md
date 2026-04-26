# ❤️‍🔥 𝗔𝗻𝘇𝗮𝗷𝘂𝗻 𝗙𝗶𝘅𝗺𝗲𝗿𝗮𝗵 🩸 — Bot v3.0

Bot Telegram untuk banding nomor WhatsApp terblokir, dengan sistem tier (Free / Premium / Permanent / Owner), kode promo, dan pembayaran QRIS otomatis + manual.

## ✨ Fitur Baru di v3.0

- **Owner Panel terpisah** — owner dapat menu khusus (broadcast, statistik, kelola promo, set harga, set QRIS, dll)
- **Tier yang jelas**: Free / Premium / Permanent / Owner — tiap tier dapat fitur beda
- **Harga premium baru**: 5K (7 hari), 10K (15 hari), 15K (Permanent)
- **2 Metode Bayar**: 🟢 Otomatis (QRIS via Pakasir) + 💳 Manual (transfer + upload bukti, owner approve)
- **Kode Promo** — owner buat kode diskon, member redeem saat beli premium
- **Bot lebih responsif** — animasi tetap ada tapi lebih cepat dan tidak block
- **Bug fix**: typo `tq` → `tz`, mismatched backtick, undeclared variables, dll

## 🚀 Cara Jalanin

```bash
cd bot
npm install
cp .env.example .env  # isi sendiri
npm start
```

## 📁 Struktur File

```
bot/
├── main.js          # Entry point
├── config.js        # Konfigurasi & konstanta
├── database.js      # JSON DB (data.json)
├── handlers.js      # Semua command & callback handler
├── payment.js       # Pakasir integration
├── templates.js     # Template email banding multi-bahasa
├── utils.js         # Helper (email, time, format, dll)
├── package.json
└── .env             # Secret/credential
```

## 🏷️ Tier & Fitur

| Fitur | Free | Premium | Permanent | Owner |
|---|---|---|---|---|
| Kuota harian | 5 | 10 (2x) | 15 (2x) | ∞ |
| Gmail random | ❌ | ✅ | ✅ | ✅ |
| Set delay/limit | ❌ | ✅ | ✅ | ✅ |
| Saldo & withdraw | ❌ | ✅ | ✅ | ✅ |
| Referral reward | ❌ | ✅ | ✅ | ✅ |
| Owner Panel | ❌ | ❌ | ❌ | ✅ |

## 👑 Owner Panel

Akses via tombol "👑 OWNER PANEL" di menu utama atau command `/admin`:

- 📈 Statistik bot
- 🏆 Leaderboard mingguan
- 📢 Broadcast ke semua user
- 💳 Approve/reject pembayaran manual
- 💸 Lihat & tandai withdraw selesai
- 🎁 Buat & kelola kode promo
- 💰 Set harga premium
- 🏦 Set rekening manual
- 📷 Upload foto QRIS
- 👤 Lihat info user via UID
- 🎯 Kasih premium gratis ke user

## 💳 Metode Pembayaran

**🟢 Otomatis** — bot kirim foto QRIS + URL Pakasir, user bayar, klik "Cek Pembayaran", premium aktif otomatis.

**💳 Manual** — bot tampilin rekening owner, user transfer + upload foto bukti, foto diteruskan ke owner dengan tombol APPROVE/REJECT.

## 🎁 Kode Promo

Owner buat kode via Owner Panel → Kelola Promo → Buat Kode Baru. Kode bisa diskon 1–100% dengan max pemakaian, expired 30 hari otomatis.

Member redeem saat beli premium → diskon otomatis dihitung di harga.
