import axios from 'axios'
import dayjs from 'dayjs'
import QRCode from 'qrcode'
import * as cfg from './config.js'

const BASE = 'https://app.pakasir.com'

export function generateOrderId(uid) {
  const ts   = dayjs().format('YYYYMMDDHHmmss')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `FIX${uid}${ts}${rand}`
}

export function generatePayId() {
  const ts   = dayjs().format('YYMMDDHHmm')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `MP${ts}${rand}`
}

/**
 * Buat URL pembayaran Pakasir
 */
export function createPaymentUrl(uid, amount) {
  const orderId = generateOrderId(uid)
  const url = `${BASE}/pay/${cfg.PAKASIR_SLUG}/${amount}?order_id=${orderId}&redirect=${cfg.REDIRECT_URL}${orderId}`
  return { url, orderId }
}

/**
 * Cek status pembayaran ke Pakasir
 */
export async function checkPayment(orderId, amount) {
  try {
    const { data } = await axios.get(`${BASE}/api/transactiondetail`, {
      params: {
        project: cfg.PAKASIR_SLUG,
        order_id: orderId,
        amount,
        api_key: cfg.PAKASIR_API_KEY,
      },
      timeout: 10000,
    })
    return data?.transaction?.status === 'completed'
  } catch (e) {
    console.error('[Payment] checkPayment error:', e.message)
    return false
  }
}

/**
 * Hitung harga akhir dengan promo code
 */
export function applyPromo(amount, promo) {
  if (!promo) return amount
  const discount = Math.floor((amount * promo.discount_pct) / 100)
  return Math.max(0, amount - discount)
}

/**
 * Ambil QRIS langsung dari halaman pembayaran Pakasir.
 *
 * Strategi (urut):
 * 1. Coba fetch HTML halaman pembayaran, cari:
 *    - data URL gambar (data:image/...;base64,...)
 *    - tag <img src="..."> yang mengandung kata "qr" / "qris"
 *    - string QRIS mentah (00020101...) → encode jadi PNG sendiri
 * 2. Kalau semua gagal → generate QR code lokal dari URL pembayaran (user scan → buka link → bayar)
 *
 * Return: { buffer: Buffer, source: 'pakasir'|'fallback' }
 */
export async function fetchPakasirQris(payUrl) {
  try {
    const res = await axios.get(payUrl, {
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    const html = String(res.data || '')

    // 1) Data URL → langsung decode
    const dataMatch = html.match(/data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+)/i)
    if (dataMatch) {
      return { buffer: Buffer.from(dataMatch[2], 'base64'), source: 'pakasir' }
    }

    // 2) QRIS string mentah (EMV format dimulai dari 00020101...)
    const qrisStr = html.match(/(00020101[0-9A-Za-z]{50,})/)?.[1]
    if (qrisStr) {
      const buffer = await QRCode.toBuffer(qrisStr, {
        type: 'png', errorCorrectionLevel: 'M', margin: 2, width: 512,
      })
      return { buffer, source: 'pakasir' }
    }

    // 3) <img> dengan src yang mengandung qr / qris
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
    let m
    while ((m = imgRegex.exec(html)) !== null) {
      const src = m[1]
      if (/qr|qris/i.test(src)) {
        const abs = src.startsWith('http')
          ? src
          : src.startsWith('//') ? 'https:' + src
          : src.startsWith('/')  ? `${BASE}${src}`
          : `${BASE}/${src}`
        try {
          const imgRes = await axios.get(abs, {
            responseType: 'arraybuffer', timeout: 15000,
          })
          return { buffer: Buffer.from(imgRes.data), source: 'pakasir' }
        } catch (e) {
          console.warn('[fetchPakasirQris] img fetch fail:', abs, e.message)
        }
      }
    }
  } catch (e) {
    console.error('[fetchPakasirQris] fetch fail:', e.message)
  }

  // Fallback: QR code lokal yang isinya URL pembayaran
  try {
    const buffer = await QRCode.toBuffer(payUrl, {
      type: 'png', errorCorrectionLevel: 'M', margin: 2, width: 512,
    })
    return { buffer, source: 'fallback' }
  } catch (e) {
    console.error('[fetchPakasirQris] fallback fail:', e.message)
    return null
  }
}
