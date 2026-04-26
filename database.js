import { readFile, writeFile, mkdir, copyFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import weekOfYear from 'dayjs/plugin/weekOfYear.js'
import { DEFAULT_TEMPLATES } from './templates.js'
import { HARGA_DEFAULT, KUOTA, OWNER_ID } from './config.js'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(weekOfYear)

const DATA_FILE  = path.join(process.cwd(), 'data.json')
const BACKUP_DIR = path.join(process.cwd(), 'backup')
export const WIB = 'Asia/Jakarta'

const DEFAULT_DB = {
  users: {},
  gmails: [],
  templates: DEFAULT_TEMPLATES,
  delay: 10,
  manual_rekening: {},
  qris_image_id: null,           // file_id QRIS image yg di-upload owner
  pending_payments: {},          // orderId -> { uid, tier, amount, method, ... }
  manual_payments: {},           // payId -> { uid, tier, amount, photo_id, status }
  promo_codes: {},               // CODE -> { discount_pct, max_uses, used, expires, used_by:[uid] }
  harga: { ...HARGA_DEFAULT },
  leaderboard: {},
  withdraw_requests: [],
  broadcast_stats: { total: 0, last: null },
}

let _db    = null
let _timer = null
let _flushing = false

// ─── Core DB ──────────────────────────────────────────────────────────────────

export async function loadDb() {
  if (_db) return _db
  if (!existsSync(DATA_FILE)) {
    _db = structuredClone(DEFAULT_DB)
    await _flush()
    return _db
  }
  try {
    const raw = await readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    _db = { ...structuredClone(DEFAULT_DB), ...parsed }
    // Pastikan harga selalu ada keynya
    _db.harga = { ...HARGA_DEFAULT, ..._db.harga }
  } catch (e) {
    console.error('[DB] Failed to parse data.json, using defaults:', e.message)
    _db = structuredClone(DEFAULT_DB)
  }
  return _db
}

export async function saveDb(db) {
  _db = db
  if (_timer) clearTimeout(_timer)
  _timer = setTimeout(_flush, 300)
}

async function _flush() {
  if (!_db || _flushing) return
  _flushing = true
  try {
    await writeFile(DATA_FILE, JSON.stringify(_db, null, 2), 'utf-8')
  } catch (e) {
    console.error('[DB] flush error:', e.message)
  } finally {
    _flushing = false
  }
}

export async function backupDb() {
  await _flush()
  if (!existsSync(BACKUP_DIR)) await mkdir(BACKUP_DIR, { recursive: true })
  const fname = `backup_${dayjs().tz(WIB).format('YYYYMMDD_HHmm')}.json`
  await copyFile(DATA_FILE, path.join(BACKUP_DIR, fname))
  console.log(`[Backup] ${fname}`)
}

// ─── User ──────────────────────────────────────────────────────────────────────

export function getUser(db, uid) {
  return db.users[String(uid)] || null
}

export async function setUser(db, uid, data) {
  db.users[String(uid)] = data
  await saveDb(db)
}

/**
 * Tier mapping:
 *  - owner     : OWNER_ID — always
 *  - permanent : permanent premium
 *  - premium   : temporary premium (not yet expired)
 *  - free      : default
 */
export function getTier(db, uid) {
  if (Number(uid) === OWNER_ID) return 'owner'
  const user = getUser(db, uid)
  if (!user) return 'free'
  if (user.premium_expiry === 'permanent') return 'permanent'
  if (user.premium_expiry) {
    const exp = dayjs(user.premium_expiry)
    if (exp.isAfter(dayjs())) return 'premium'
    // Expired — turunkan ke free
    user.premium_expiry = null
    user.tier = 'free'
    db.users[String(uid)] = user
    saveDb(db)
  }
  return user.tier === 'permanent' || user.tier === 'premium' ? 'free' : (user.tier || 'free')
}

export async function getQuota(db, uid) {
  let user = getUser(db, uid)
  if (!user) {
    user = { name: '', tier: 'free', saldo: 0, daily_quota: KUOTA.free, date: '', quota_siang: KUOTA.free, date_siang: '' }
    await setUser(db, uid, user)
  }
  const tier  = getTier(db, uid)
  const today = dayjs().tz(WIB).format('YYYY-MM-DD')
  const jam   = dayjs().tz(WIB).hour()
  const maxQ  = KUOTA[tier] ?? KUOTA.free

  // Owner: unlimited
  if (tier === 'owner') {
    return { current: 999, max: 999, sesi: 'unlimited' }
  }

  if (tier === 'free') {
    if (user.date !== today) { user.daily_quota = maxQ; user.date = today; await setUser(db, uid, user) }
    return { current: user.daily_quota, max: maxQ, sesi: 'harian' }
  }

  // Premium / Permanent: punya 2 sesi (pagi & siang)
  if (jam < 9) {
    if (user.date !== today) { user.daily_quota = maxQ; user.date = today; await setUser(db, uid, user) }
    return { current: user.daily_quota ?? maxQ, max: maxQ, sesi: 'pagi' }
  } else {
    if (user.date_siang !== today) { user.quota_siang = maxQ; user.date_siang = today; await setUser(db, uid, user) }
    return { current: user.quota_siang ?? maxQ, max: maxQ, sesi: 'siang' }
  }
}

export async function useQuota(db, uid) {
  const user = getUser(db, uid)
  if (!user) return
  const tier = getTier(db, uid)
  if (tier === 'owner') {
    user.total_bandings = (user.total_bandings || 0) + 1
    await setUser(db, uid, user)
    return
  }
  const jam = dayjs().tz(WIB).hour()
  if (tier === 'free' || jam < 9) {
    user.daily_quota = Math.max(0, (user.daily_quota || 1) - 1)
  } else {
    user.quota_siang = Math.max(0, (user.quota_siang || 1) - 1)
  }
  user.total_bandings = (user.total_bandings || 0) + 1
  await setUser(db, uid, user)
}

// ─── Referral ──────────────────────────────────────────────────────────────────

export async function addReferralReward(db, uid) {
  const reward = Math.floor(Math.random() * 1001) + 500 // 500–1500
  const user   = getUser(db, uid) || { tier: 'free', saldo: 0, reward_total: 0 }
  user.saldo        = (user.saldo || 0) + reward
  user.reward_total = (user.reward_total || 0) + reward
  await setUser(db, uid, user)
  return reward
}

export function getReferralLink(uid) {
  const username = process.env.BOT_USERNAME || 'anzajunfixbot'
  return `https://t.me/${username}?start=ref_${uid}`
}

// ─── Gmail ─────────────────────────────────────────────────────────────────────

export function getAvailableGmail(db, uid, ownerOnly = false) {
  const list = (db.gmails || []).filter(g => !g.blocked && (ownerOnly ? String(g.owner_id) === String(uid) : true))
  if (!list.length) return null
  return list[Math.floor(Math.random() * list.length)]
}

export function getUserGmails(db, uid) {
  return (db.gmails || []).filter(g => String(g.owner_id) === String(uid))
}

export async function addGmail(db, uid, email, password, label = '') {
  db.gmails = db.gmails || []
  if (db.gmails.find(g => g.email === email)) return false
  db.gmails.push({
    email, password,
    label: label || email,
    owner_id: uid,
    blocked: false,
    added_at: new Date().toISOString(),
  })
  await saveDb(db)
  return true
}

export async function deleteGmail(db, uid, email) {
  const before = db.gmails.length
  // Owner bisa hapus gmail siapapun
  const isOwner = Number(uid) === OWNER_ID
  db.gmails = db.gmails.filter(g => !(g.email === email && (isOwner || String(g.owner_id) === String(uid))))
  if (db.gmails.length !== before) { await saveDb(db); return true }
  return false
}

export async function markGmailBlocked(db, email) {
  const g = db.gmails.find(g => g.email === email)
  if (g) { g.blocked = true; await saveDb(db) }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function updateLeaderboard(db, uid) {
  const week = dayjs().tz(WIB).format('YYYY-[W]WW')
  db.leaderboard = db.leaderboard || {}
  if (!db.leaderboard[week]) db.leaderboard[week] = {}
  db.leaderboard[week][String(uid)] = (db.leaderboard[week][String(uid)] || 0) + 1
  await saveDb(db)
}

export function getLeaderboard(db, topN = 10) {
  const week  = dayjs().tz(WIB).format('YYYY-[W]WW')
  const data  = db.leaderboard?.[week] || {}
  return Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
}

// ─── Withdraw ─────────────────────────────────────────────────────────────────

export async function requestWithdraw(db, uid, amount, rekening) {
  const user = getUser(db, uid)
  if (!user || (user.saldo || 0) < amount) return false
  user.saldo -= amount
  db.withdraw_requests = db.withdraw_requests || []
  db.withdraw_requests.push({
    uid: String(uid),
    amount,
    rekening,
    status: 'pending',
    created_at: new Date().toISOString()
  })
  await setUser(db, uid, user)
  await saveDb(db)
  return true
}

// ─── Promo codes ──────────────────────────────────────────────────────────────

export async function createPromoCode(db, code, discountPct, maxUses, expiresDays = 30) {
  code = String(code).toUpperCase().trim()
  if (!code) return false
  db.promo_codes[code] = {
    discount_pct: Math.min(100, Math.max(1, discountPct)),
    max_uses: maxUses,
    used: 0,
    used_by: [],
    expires: dayjs().add(expiresDays, 'day').toISOString(),
    created_at: new Date().toISOString(),
  }
  await saveDb(db)
  return true
}

export async function deletePromoCode(db, code) {
  code = String(code).toUpperCase().trim()
  if (!db.promo_codes[code]) return false
  delete db.promo_codes[code]
  await saveDb(db)
  return true
}

export function validatePromoCode(db, code, uid) {
  code = String(code).toUpperCase().trim()
  const promo = db.promo_codes?.[code]
  if (!promo) return { ok: false, reason: 'Kode promo tidak ditemukan.' }
  if (promo.expires && dayjs(promo.expires).isBefore(dayjs())) return { ok: false, reason: 'Kode promo sudah kedaluwarsa.' }
  if (promo.max_uses && promo.used >= promo.max_uses) return { ok: false, reason: 'Kode promo sudah habis dipakai.' }
  if ((promo.used_by || []).includes(String(uid))) return { ok: false, reason: 'Kamu sudah pakai kode promo ini.' }
  return { ok: true, promo }
}

export async function consumePromoCode(db, code, uid) {
  code = String(code).toUpperCase().trim()
  const promo = db.promo_codes?.[code]
  if (!promo) return
  promo.used = (promo.used || 0) + 1
  promo.used_by = [...(promo.used_by || []), String(uid)]
  await saveDb(db)
}

// ─── Pending payments (otomatis / Pakasir) ────────────────────────────────────

export async function addPendingPayment(db, uid, orderId, tier, amount, promoCode = null) {
  db.pending_payments[orderId] = {
    uid: String(uid), tier, amount,
    method: 'auto',
    promo_code: promoCode,
    created_at: new Date().toISOString(),
  }
  await saveDb(db)
}

// ─── Manual payments ──────────────────────────────────────────────────────────

export async function addManualPayment(db, payId, uid, tier, amount, photoFileId, promoCode = null) {
  db.manual_payments[payId] = {
    uid: String(uid), tier, amount,
    photo_id: photoFileId,
    promo_code: promoCode,
    status: 'pending',
    created_at: new Date().toISOString(),
  }
  await saveDb(db)
}

export async function approveManualPayment(db, payId) {
  const p = db.manual_payments?.[payId]
  if (!p || p.status !== 'pending') return null
  p.status = 'approved'
  p.approved_at = new Date().toISOString()
  await completePremium(db, p.uid, p.tier, p.promo_code)
  await saveDb(db)
  return p
}

export async function rejectManualPayment(db, payId, reason = '') {
  const p = db.manual_payments?.[payId]
  if (!p || p.status !== 'pending') return null
  p.status = 'rejected'
  p.reject_reason = reason
  p.rejected_at = new Date().toISOString()
  await saveDb(db)
  return p
}

export async function completePremium(db, uid, tier, promoCode = null) {
  const user = getUser(db, uid) || { tier: 'free', saldo: 0 }
  if (tier === 'permanent') {
    user.premium_expiry = 'permanent'
    user.tier = 'permanent'
  } else {
    const days = tier === 'premium_7' ? 7 : tier === 'premium_15' ? 15 : 30
    // Jika belum pernah premium, mulai dari sekarang. Kalau masih aktif, perpanjang
    const base = user.premium_expiry && user.premium_expiry !== 'permanent' && dayjs(user.premium_expiry).isAfter(dayjs())
      ? dayjs(user.premium_expiry)
      : dayjs()
    user.premium_expiry = base.add(days, 'day').toISOString()
    user.tier = 'premium'
  }
  user.last_purchase_at = new Date().toISOString()
  if (promoCode) {
    user.promo_history = [...(user.promo_history || []), { code: promoCode, at: new Date().toISOString() }]
    await consumePromoCode(db, promoCode, uid)
  }
  // Referral reward
  if (user.referred_by && !user.referred_by_rewarded) {
    await addReferralReward(db, user.referred_by)
    user.referred_by_rewarded = true
  }
  await setUser(db, uid, user)
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getStats(db) {
  const users    = Object.values(db.users || {})
  const total    = users.length
  const premium  = users.filter(u => u.tier === 'premium' || u.tier === 'permanent').length
  const bandings = users.reduce((s, u) => s + (u.total_bandings || 0), 0)
  const pendingAuto = Object.keys(db.pending_payments || {}).length
  const pendingManual = Object.values(db.manual_payments || {}).filter(p => p.status === 'pending').length
  const pendingWithdraw = (db.withdraw_requests || []).filter(w => w.status === 'pending').length
  return {
    total, premium, bandings,
    gmails: (db.gmails || []).length,
    pendingAuto, pendingManual, pendingWithdraw,
    promo_codes: Object.keys(db.promo_codes || {}).length,
  }
}
