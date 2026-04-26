import nodemailer from 'nodemailer'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import 'dayjs/locale/id.js'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('id')

export const WIB = 'Asia/Jakarta'

// ─── Time ──────────────────────────────────────────────────────────────────────

export const nowWIB   = () => dayjs().tz(WIB)
export const todayStr = () => nowWIB().format('DD MMMM YYYY, HH:mm') + ' WIB'

// ─── Random Data ───────────────────────────────────────────────────────────────

const NAMA_RANDOM = [
  'Andi','Budi','Citra','Dewi','Eko','Fajar','Gita','Hadi','Indah','Joko',
  'Kartika','Lestari','Mulyono','Nurul','Putri','Rudi','Sinta','Tono','Umar',
  'Vera','Wawan','Yanti','Zainal','James','Emily','David','Sarah','Michael',
  'Jessica','Robert','Aditya','Rizky','Faisal','Dian','Rahma','Wahyu'
]

export const randomName = () => NAMA_RANDOM[Math.floor(Math.random() * NAMA_RANDOM.length)]

// ─── Validation ────────────────────────────────────────────────────────────────

export function formatPhone(raw) {
  if (!raw || typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  return digits
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidAmount(str) {
  const n = parseInt(String(str).replace(/\D/g, ''))
  return !isNaN(n) && n > 0
}

export const rupiah = (n) => 'Rp' + (n || 0).toLocaleString('id-ID')

// ─── Email ─────────────────────────────────────────────────────────────────────

/**
 * Coba kirim email lewat beberapa konfigurasi SMTP Gmail.
 * Banyak hosting murah block port 465/587 — kita coba juga 25 dan 2525 (alternatif).
 * Kalau semua kena timeout → jelas hosting block SMTP outbound, balikin error khusus.
 */
const SMTP_CONFIGS = [
  { host: 'smtp.gmail.com', port: 465, secure: true,  label: '465/SSL'      },
  { host: 'smtp.gmail.com', port: 587, secure: false, label: '587/STARTTLS' },
  { host: 'smtp.gmail.com', port: 25,  secure: false, label: '25/plain'     },
  { host: 'smtp.gmail.com', port: 2525,secure: false, label: '2525/alt'     },
]

function isNetworkErr(msg = '') {
  const m = msg.toLowerCase()
  return m.includes('timeout') || m.includes('etimedout') ||
         m.includes('econnrefused') || m.includes('enetunreach') ||
         m.includes('ehostunreach') || m.includes('connection') && !m.includes('invalid')
}

function isAuthErr(msg = '') {
  const m = msg.toLowerCase()
  return m.includes('invalid login') || m.includes('username and password') ||
         m.includes('authentication') || m.includes('eauth')
}

export async function sendEmail(senderEmail, appPassword, toEmail, subject, body) {
  let lastErr = ''
  let allNetwork = true

  for (const cfg of SMTP_CONFIGS) {
    let t
    try {
      t = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: senderEmail, pass: appPassword },
        connectionTimeout: 8000,
        greetingTimeout: 6000,
        socketTimeout: 10000,
      })
      await t.sendMail({
        from: `"${senderEmail}" <${senderEmail}>`,
        to: toEmail,
        subject,
        text: body,
      })
      return { ok: true, via: cfg.label }
    } catch (e) {
      lastErr = e?.message || String(e)
      console.warn(`[sendEmail] ${cfg.label} →`, lastErr)
      if (isAuthErr(lastErr)) {
        return { ok: false, error: lastErr, reason: 'auth' }
      }
      if (!isNetworkErr(lastErr)) allNetwork = false
    } finally {
      try { t?.close?.() } catch {}
    }
  }

  return {
    ok: false,
    error: lastErr,
    reason: allNetwork ? 'network' : 'unknown',
  }
}

/**
 * Verifikasi credential Gmail.
 * Return:
 *   { ok: true }                       → credential valid
 *   { ok: false, reason: 'auth' }      → credential salah (App Password salah)
 *   { ok: false, reason: 'network' }   → network/SMTP terblokir hosting
 *   { ok: false, reason: 'unknown' }   → error lain
 */
export async function testGmailCredential(email, password) {
  let t
  try {
    t = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: email, pass: password },
      connectionTimeout: 7000,
      greetingTimeout: 5000,
      socketTimeout: 7000,
    })
    await Promise.race([
      t.verify(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('verify timeout')), 8000)),
    ])
    return { ok: true }
  } catch (e) {
    const msg = (e?.message || String(e)).toLowerCase()
    console.warn('[testGmailCredential]', email, '→', e?.message || e)
    if (msg.includes('invalid login') || msg.includes('username and password') || msg.includes('authentication') || msg.includes('eauth')) {
      return { ok: false, reason: 'auth' }
    }
    if (msg.includes('timeout') || msg.includes('econn') || msg.includes('etimedout') || msg.includes('enetunreach') || msg.includes('connection')) {
      return { ok: false, reason: 'network' }
    }
    return { ok: false, reason: 'unknown', error: e?.message }
  } finally {
    try { t?.close?.() } catch {}
  }
}

// ─── UI Helpers ────────────────────────────────────────────────────────────────

export const HEADER = (title) =>
  `╭━━━━━━━━━━━━━━━━━━━╮\n┃  <b>${title}</b>\n╰━━━━━━━━━━━━━━━━━━━╯`

export const LINE = () => '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬'

export function tierBadge(tier) {
  if (tier === 'owner')     return '👑 OWNER'
  if (tier === 'permanent') return '💎 PERMANENT'
  if (tier === 'premium')   return '⭐ PREMIUM'
  return '🆓 FREE'
}

export function quotaBar(current, max) {
  const pct   = max > 0 ? Math.round((current / max) * 10) : 0
  const filled = '█'.repeat(pct)
  const empty  = '░'.repeat(10 - pct)
  return `[${filled}${empty}] ${current}/${max}`
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ─── Rate Limiter (in-memory) — non-blocking, super lightweight ───────────────

const _rateMap = new Map()

export function isRateLimited(uid, action = 'default', limitMs = 400) {
  const key  = `${uid}:${action}`
  const last = _rateMap.get(key) || 0
  const now  = Date.now()
  if (now - last < limitMs) return true
  _rateMap.set(key, now)
  return false
}

setInterval(() => {
  const cutoff = Date.now() - 60000
  for (const [k, v] of _rateMap) {
    if (v < cutoff) _rateMap.delete(k)
  }
}, 60 * 60 * 1000)

// ─── Random ID generator ──────────────────────────────────────────────────────

export function randomId(prefix = '', len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return prefix + s
}
