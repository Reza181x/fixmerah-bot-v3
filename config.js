import 'dotenv/config'

export const BRAND             = '❤️‍🔥 𝗔𝗻𝘇𝗮𝗷𝘂𝗻 𝗙𝗶𝘅𝗺𝗲𝗿𝗮𝗵 🩸'
export const VERSION           = 'v3.0'

export const BOT_TOKEN         = process.env.BOT_TOKEN
export const BOT_USERNAME      = process.env.BOT_USERNAME || 'anzajunfixbot'
export const PAKASIR_SLUG      = process.env.PAKASIR_SLUG
export const PAKASIR_API_KEY   = process.env.PAKASIR_API_KEY
export const DOMAIN            = process.env.DOMAIN
export const REDIRECT_URL      = process.env.REDIRECT_URL
export const OWNER_ID          = parseInt(process.env.OWNER_ID || '0')
export const CHANNEL_ID        = process.env.CHANNEL_ID
export const GROUP_ID          = process.env.GROUP_ID
export const CHANNEL_USERNAME  = process.env.CHANNEL_USERNAME || ''
export const GROUP_USERNAME    = process.env.GROUP_USERNAME || ''

// Harga paket premium (Rupiah) — bisa di-override owner via panel
export const HARGA_DEFAULT = {
  premium_7:  5000,   // 7 hari
  premium_15: 10000,  // 15 hari
  permanent:  15000,  // Permanent
}

export const PAKET_LABEL = {
  premium_7:  '⭐ Premium 7 Hari',
  premium_15: '⭐ Premium 15 Hari',
  permanent:  '💎 Premium Permanent',
}

export const PAKET_DURASI = {
  premium_7:  7,
  premium_15: 15,
  permanent:  null, // permanent
}

// Kuota harian per tier
export const KUOTA = {
  free:      5,
  premium:   10,
  permanent: 15,
  owner:     999,
}

// Email target WhatsApp support
export const WA_SUPPORT_EMAIL = 'support@whatsapp.com'

// Min saldo untuk withdraw
export const MIN_WITHDRAW = 15000
