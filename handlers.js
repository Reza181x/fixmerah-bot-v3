import { InlineKeyboard, InputFile } from 'grammy'
import {
  loadDb, saveDb, getUser, setUser, getTier, getQuota, useQuota,
  addGmail, deleteGmail, markGmailBlocked, getUserGmails, getAvailableGmail,
  addReferralReward, getReferralLink, updateLeaderboard, getLeaderboard,
  requestWithdraw, addPendingPayment, addManualPayment, approveManualPayment,
  rejectManualPayment, completePremium, getStats,
  createPromoCode, deletePromoCode, validatePromoCode,
} from './database.js'
import {
  randomName, formatPhone, isValidEmail, isValidAmount, rupiah,
  sendEmail, testGmailCredential,
  HEADER, LINE, tierBadge, quotaBar, sleep, isRateLimited, todayStr, randomId,
} from './utils.js'
import { getRandomTemplate, fillTemplate } from './templates.js'
import { createPaymentUrl, checkPayment, applyPromo, generatePayId, fetchPakasirQris } from './payment.js'
import {
  BRAND, VERSION, OWNER_ID, CHANNEL_ID, GROUP_ID,
  CHANNEL_USERNAME, GROUP_USERNAME, PAKET_LABEL, PAKET_DURASI,
  WA_SUPPORT_EMAIL, MIN_WITHDRAW,
} from './config.js'

// ─── State constants ───────────────────────────────────────────────────────────
export const STATES = {
  IDLE: 'IDLE',
  ADD_EMAIL: 'ADD_EMAIL',
  ADD_PASS: 'ADD_PASS',
  SET_NAME: 'SET_NAME',
  INPUT_PHONE: 'INPUT_PHONE',
  SET_DELAY: 'SET_DELAY',
  SET_LIMIT: 'SET_LIMIT',
  REK_BANK: 'REK_BANK',
  REK_NOMOR: 'REK_NOMOR',
  REK_NAMA: 'REK_NAMA',
  WITHDRAW_AMOUNT: 'WITHDRAW_AMOUNT',
  WITHDRAW_REKENING: 'WITHDRAW_REKENING',
  BROADCAST_MSG: 'BROADCAST_MSG',

  // Promo
  PROMO_REDEEM: 'PROMO_REDEEM',
  PROMO_NEW_CODE: 'PROMO_NEW_CODE',
  PROMO_NEW_PCT: 'PROMO_NEW_PCT',
  PROMO_NEW_USES: 'PROMO_NEW_USES',

  // Manual payment
  MANUAL_UPLOAD: 'MANUAL_UPLOAD',
  REJECT_REASON: 'REJECT_REASON',

  // Owner setting
  SET_HARGA_VAL: 'SET_HARGA_VAL',
  QRIS_UPLOAD: 'QRIS_UPLOAD',
  USER_LOOKUP: 'USER_LOOKUP',
  GIVE_PREMIUM_UID: 'GIVE_PREMIUM_UID',
}

const isOwner = (uid) => Number(uid) === OWNER_ID

// ─── Keyboards ─────────────────────────────────────────────────────────────────

function mainMenu(uid, tier) {
  const kb = new InlineKeyboard()
    .text('🚀 MULAI BANDING', 'start_banding').row()
    .text('➕ TAMBAH GMAIL', 'add_gmail').text('📜 LIST GMAIL', 'list_gmail').row()
    .text('📊 CEK KUOTA', 'check_quota').text('✏️ ATUR NAMA', 'set_name').row()

  // Premium-only
  if (tier === 'premium' || tier === 'permanent') {
    kb.text('⚙️ SET DELAY', 'set_delay').text('🔢 SET LIMIT', 'set_limit').row()
    kb.text('💰 SALDO & WITHDRAW', 'saldo').text('👥 REFERRAL', 'referral').row()
  }

  kb.text('✅ TANDAI DIBALAS', 'mark_replied').row()

  // Owner doesn't need to buy premium — show owner panel instead
  if (tier === 'owner') {
    kb.text('👑 OWNER PANEL', 'owner_panel').row()
  } else {
    kb.text('🛒 BELI PREMIUM', 'buy_premium').row()
  }

  kb.text('ℹ️ INFO BOT', 'info_bot')
  return kb
}

function ownerMenu() {
  return new InlineKeyboard()
    .text('📈 STATISTIK', 'admin_stats').text('🏆 LEADERBOARD', 'leaderboard').row()
    .text('📢 BROADCAST', 'admin_broadcast').row()
    .text('💳 PEMBAYARAN MANUAL', 'admin_manual_pay').text('💸 WITHDRAW PENDING', 'admin_withdraw').row()
    .text('🎁 KELOLA PROMO', 'admin_promo').text('💰 SET HARGA', 'admin_harga').row()
    .text('🏦 SET REKENING', 'set_rekening').text('📷 SET QRIS', 'admin_qris').row()
    .text('👤 KELOLA USER', 'admin_user').text('🎯 KASIH PREMIUM', 'admin_give_prem').row()
    .text('🔙 Kembali', 'back_main')
}

function langKeyboard() {
  return new InlineKeyboard()
    .text('🇮🇩 Indonesia', 'lang_id').text('🇬🇧 English', 'lang_en').row()
    .text('🇪🇸 Español', 'lang_es').text('🇸🇦 Arabic', 'lang_ar').row()
    .text('🌏 Lainnya (Random)', 'lang_mix').row()
    .text('🔙 Kembali', 'back_main')
}

function backBtn(data = 'back_main') {
  return new InlineKeyboard().text('🔙 Kembali', data)
}

// ─── Join Checker ──────────────────────────────────────────────────────────────

async function checkJoin(ctx) {
  if (!CHANNEL_ID || !GROUP_ID) return true
  if (isOwner(ctx.from.id)) return true
  try {
    const [ch, gr] = await Promise.all([
      ctx.api.getChatMember(CHANNEL_ID, ctx.from.id),
      ctx.api.getChatMember(GROUP_ID, ctx.from.id),
    ])
    const left = ['left', 'kicked']
    return !left.includes(ch.status) && !left.includes(gr.status)
  } catch {
    return false
  }
}

async function requireJoin(ctx) {
  const joined = await checkJoin(ctx)
  if (!joined) {
    const kb = new InlineKeyboard()
      .url('📢 JOIN CHANNEL', `https://t.me/${CHANNEL_USERNAME.replace('@', '')}`).row()
      .url('👥 JOIN GRUP', `https://t.me/${GROUP_USERNAME.replace('@', '')}`).row()
      .text('✅ SUDAH JOIN', 'sudah_join')
    await ctx.reply(
      `${HEADER('AKSES DITOLAK')}\n\n⚠️ Kamu wajib join Channel & Grup dulu sebelum pakai bot ini!\n${LINE()}`,
      { parse_mode: 'HTML', reply_markup: kb }
    )
    return false
  }
  return true
}

// ─── Setup ─────────────────────────────────────────────────────────────────────

export function setupHandlers(bot) {
  bot.command('start', handleStart)
  bot.command('admin', handleAdminCmd)
  bot.command('panel', handleAdminCmd)
  bot.command('menu', handleStart)

  bot.on('callback_query:data', async (ctx) => {
    if (isRateLimited(ctx.from.id, 'cb', 300)) {
      return ctx.answerCallbackQuery('⏳ Terlalu cepat!').catch(() => {})
    }
    // Track agar answerCallbackQuery hanya dipanggil sekali — patch instance method
    let answered = false
    const orig = ctx.answerCallbackQuery.bind(ctx)
    ctx.answerCallbackQuery = async (...args) => {
      if (answered) return
      answered = true
      return orig(...args).catch(() => {})
    }
    try {
      await routeCallback(ctx)
    } catch (e) {
      console.error('[CB Error]', e)
      if (!answered) await orig('❌ Terjadi kesalahan.').catch(() => {})
    } finally {
      if (!answered) await orig().catch(() => {})
    }
  })

  bot.on('message:photo', async (ctx) => {
    try {
      await routePhoto(ctx)
    } catch (e) {
      console.error('[PHOTO Error]', e)
      await ctx.reply('❌ Gagal memproses foto.').catch(() => {})
    }
  })

  bot.on('message:text', async (ctx) => {
    try {
      await routeMessage(ctx)
    } catch (e) {
      console.error('[MSG Error]', e)
      await ctx.reply('❌ Terjadi kesalahan. Coba /start.').catch(() => {})
    }
  })
}

// ─── /start ────────────────────────────────────────────────────────────────────

async function handleStart(ctx) {
  const uid  = ctx.from.id
  const args = ctx.message?.text?.split(' ') || []
  const param = args[1] || ''
  const db   = await loadDb()

  // Cek pembayaran via deep link
  if (param.startsWith('cek_')) {
    return handleCekBayarDeep(ctx, param.slice(4))
  }

  // Referral handler
  if (param.startsWith('ref_')) {
    const refId = parseInt(param.slice(4))
    if (refId && refId !== uid && !getUser(db, uid)) {
      await setUser(db, uid, { referred_by: refId, tier: 'free', saldo: 0, name: '' })
    }
  }

  if (!(await requireJoin(ctx))) return

  ctx.session.state = STATES.IDLE
  ctx.session.data  = {}

  const tier = getTier(db, uid)
  let user   = getUser(db, uid)
  if (!user) {
    user = { name: randomName(), tier: 'free', saldo: 0, daily_quota: 5, date: '' }
    await setUser(db, uid, user)
  }
  const name = user.name || randomName()

  await ctx.reply(
    `${HEADER(BRAND)}\n\n` +
    `👤 <b>${name}</b>\n` +
    `🆔 <code>${uid}</code>\n` +
    `🏅 ${tierBadge(tier)}\n` +
    (tier === 'premium' && user.premium_expiry ? `⏰ Expired: ${new Date(user.premium_expiry).toLocaleDateString('id-ID')}\n` : '') +
    `💰 Saldo: ${rupiah(user.saldo || 0)}\n` +
    `${LINE()}\n` +
    `📅 ${todayStr()}\n` +
    `⚡ ${VERSION}`,
    { parse_mode: 'HTML', reply_markup: mainMenu(uid, tier) }
  )
}

async function handleAdminCmd(ctx) {
  if (!isOwner(ctx.from.id)) return ctx.reply('❌ Akses ditolak.')
  const db = await loadDb()
  const s  = getStats(db)
  await ctx.reply(
    `${HEADER('👑 OWNER PANEL')}\n\n` +
    `👥 User: <b>${s.total}</b> | Premium: <b>${s.premium}</b>\n` +
    `📨 Total banding: <b>${s.bandings}</b>\n` +
    `📧 Gmail: <b>${s.gmails}</b>\n` +
    `🎁 Kode promo: <b>${s.promo_codes}</b>\n` +
    `💳 Manual pending: <b>${s.pendingManual}</b>\n` +
    `💸 Withdraw pending: <b>${s.pendingWithdraw}</b>\n` +
    `${LINE()}`,
    { parse_mode: 'HTML', reply_markup: ownerMenu() }
  )
}

// ─── Routers ───────────────────────────────────────────────────────────────────

async function routeCallback(ctx) {
  const data = ctx.callbackQuery.data
  const uid  = ctx.from.id

  const routes = {
    sudah_join:        handleSudahJoin,
    add_gmail:         handleAddGmailStart,
    list_gmail:        handleListGmail,
    start_banding:     handleStartBanding,
    check_quota:       handleCheckQuota,
    set_name:          handleSetNameStart,
    set_delay:         handleSetDelayStart,
    set_limit:         handleSetLimitStart,
    mark_replied:      handleMarkReplied,
    referral:          handleReferral,
    saldo:             handleSaldo,
    buy_premium:       handleBuyPremium,
    redeem_promo:      handleRedeemPromoStart,
    clear_promo:       handleClearPromo,
    info_bot:          handleInfoBot,

    // Owner panel
    owner_panel:       handleOwnerPanel,
    set_rekening:      handleSetRekeningStart,
    leaderboard:       handleLeaderboard,
    admin_broadcast:   handleBroadcastStart,
    admin_stats:       handleAdminStats,
    admin_manual_pay:  handleAdminManualPay,
    admin_withdraw:    handleAdminWithdraw,
    admin_promo:       handleAdminPromo,
    admin_promo_new:   handleAdminPromoNewStart,
    admin_promo_list:  handleAdminPromoList,
    admin_harga:       handleAdminHarga,
    admin_qris:        handleAdminQrisStart,
    admin_user:        handleAdminUserStart,
    admin_give_prem:   handleAdminGivePremStart,

    back_main:         handleBackMain,
    withdraw:          handleWithdrawStart,
    gmail_random:      handleGmailRandom,
    gmail_pick:        handleGmailPick,
  }

  if (routes[data]) return routes[data](ctx)
  if (data.startsWith('lang_'))         return handleLangSelect(ctx, data.slice(5))
  if (data.startsWith('setgmail_'))     return handleSetGmailSpecific(ctx, data.slice(9))
  if (data.startsWith('del_gmail_'))    return handleDeleteGmail(ctx, data.slice(10))
  if (data.startsWith('pickpkg_'))      return handlePickPackage(ctx, data.slice(8))
  if (data.startsWith('paymtd_'))       return handlePayMethod(ctx, data.slice(7))
  if (data.startsWith('cek_bayar_'))    return handleCekBayar(ctx, data.slice(10))
  if (data.startsWith('mp_approve_'))   return handleManualApprove(ctx, data.slice(11))
  if (data.startsWith('mp_reject_'))    return handleManualRejectStart(ctx, data.slice(10))
  if (data.startsWith('promo_del_'))    return handlePromoDelete(ctx, data.slice(10))
  if (data.startsWith('harga_'))        return handleHargaPick(ctx, data.slice(6))
  if (data.startsWith('wd_done_'))      return handleWithdrawDone(ctx, data.slice(8))
}

async function routeMessage(ctx) {
  const state = ctx.session.state
  const map = {
    [STATES.ADD_EMAIL]:         handleAddEmail,
    [STATES.ADD_PASS]:          handleAddPass,
    [STATES.SET_NAME]:          handleSetName,
    [STATES.INPUT_PHONE]:       handleInputPhone,
    [STATES.SET_DELAY]:         handleSetDelay,
    [STATES.SET_LIMIT]:         handleSetLimit,
    [STATES.REK_BANK]:          handleRekBank,
    [STATES.REK_NOMOR]:         handleRekNomor,
    [STATES.REK_NAMA]:          handleRekNama,
    [STATES.WITHDRAW_AMOUNT]:   handleWithdrawAmount,
    [STATES.WITHDRAW_REKENING]: handleWithdrawRekening,
    [STATES.BROADCAST_MSG]:     handleBroadcastMsg,
    [STATES.PROMO_REDEEM]:      handlePromoRedeemMsg,
    [STATES.PROMO_NEW_CODE]:    handlePromoNewCode,
    [STATES.PROMO_NEW_PCT]:     handlePromoNewPct,
    [STATES.PROMO_NEW_USES]:    handlePromoNewUses,
    [STATES.SET_HARGA_VAL]:     handleSetHargaVal,
    [STATES.REJECT_REASON]:     handleRejectReason,
    [STATES.USER_LOOKUP]:       handleUserLookup,
    [STATES.GIVE_PREMIUM_UID]:  handleGivePremiumUid,
  }
  if (map[state]) return map[state](ctx)
}

async function routePhoto(ctx) {
  const state = ctx.session.state
  if (state === STATES.MANUAL_UPLOAD) return handleManualUpload(ctx)
  if (state === STATES.QRIS_UPLOAD)   return handleQrisUpload(ctx)
}

// ─── Common ────────────────────────────────────────────────────────────────────

async function handleSudahJoin(ctx) {
  const joined = await checkJoin(ctx)
  if (!joined) {
    return ctx.answerCallbackQuery({ text: '❌ Kamu belum join!', show_alert: true })
  }
  await ctx.answerCallbackQuery('✅ Berhasil!')
  await ctx.editMessageText('✅ Verifikasi berhasil! Silakan ketik /start lagi.').catch(() => {})
}

async function handleBackMain(ctx) {
  await ctx.answerCallbackQuery().catch(() => {})
  const uid  = ctx.from.id
  const db   = await loadDb()
  const tier = getTier(db, uid)
  const user = getUser(db, uid)
  ctx.session.state = STATES.IDLE
  ctx.session.data  = {}
  await ctx.editMessageText(
    `${HEADER(BRAND)}\n\n👤 <b>${user?.name || '-'}</b>\n🆔 <code>${uid}</code>\n🏅 ${tierBadge(tier)}\n💰 ${rupiah(user?.saldo || 0)}\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: mainMenu(uid, tier) }
  ).catch(async () => {
    await ctx.reply(
      `${HEADER(BRAND)}\n\n👤 <b>${user?.name || '-'}</b>\n🆔 <code>${uid}</code>\n🏅 ${tierBadge(tier)}\n${LINE()}`,
      { parse_mode: 'HTML', reply_markup: mainMenu(uid, tier) }
    )
  })
}

async function handleInfoBot(ctx) {
  await ctx.editMessageText(
    `${HEADER('INFO BOT')}\n\n` +
    `🤖 ${BRAND}\n` +
    `📦 ${VERSION}\n\n` +
    `<b>Fitur:</b>\n` +
    `• 🚀 Banding nomor WA terblokir\n` +
    `• 🌐 25+ template multi-bahasa\n` +
    `• ⭐ Premium: kuota 2x sehari, gmail random\n` +
    `• 💎 Permanent: kuota max + selamanya\n` +
    `• 🎁 Kode promo diskon\n` +
    `• 💳 Bayar otomatis (QRIS) / manual\n` +
    `${LINE()}\n` +
    `<i>Powered by Anzajun Tech</i>`,
    { parse_mode: 'HTML', reply_markup: backBtn() }
  )
}

// ─── Add Gmail ─────────────────────────────────────────────────────────────────

async function handleAddGmailStart(ctx) {
  ctx.session.state = STATES.ADD_EMAIL
  ctx.session.data  = {}
  await ctx.editMessageText(
    `${HEADER('TAMBAH GMAIL')}\n\n📧 Kirim alamat Gmail kamu:\n\n<i>Contoh: contoh@gmail.com</i>\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn() }
  )
}

async function handleAddEmail(ctx) {
  const email = ctx.message.text.trim().toLowerCase()
  if (!isValidEmail(email) || !email.endsWith('@gmail.com')) {
    return ctx.reply('❌ Format Gmail tidak valid. Harus @gmail.com')
  }
  ctx.session.data.email = email
  ctx.session.state = STATES.ADD_PASS
  await ctx.reply(
    `✅ Gmail: <code>${email}</code>\n\n🔑 Sekarang kirim <b>App Password</b> Gmail kamu (16 karakter).\n\n<i>Cara buat:\nGoogle Account → Security → 2-Step Verification → App Passwords</i>`,
    { parse_mode: 'HTML' }
  )
}

async function handleAddPass(ctx) {
  const uid   = ctx.from.id
  const pass  = ctx.message.text.trim().replace(/\s/g, '')
  const email = ctx.session.data.email

  if (!email) {
    ctx.session.state = STATES.IDLE
    return ctx.reply('❌ Sesi expired. Mulai lagi.')
  }

  const loading = await ctx.reply('⚡ Memverifikasi credential...')
  const result  = await testGmailCredential(email, pass)
  await ctx.api.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {})

  // Hanya tolak kalau credential MEMANG salah (auth error).
  // Network timeout / SMTP terblokir hosting → tetap save, biar nanti dicoba pas banding.
  if (!result.ok && result.reason === 'auth') {
    return ctx.reply(
      '❌ <b>App Password salah!</b>\n\nPastikan:\n• Pakai <b>App Password</b> Google (bukan password Gmail biasa)\n• 2-Step Verification sudah aktif di akun Gmail\n• 16 karakter, spasi boleh ada (bot otomatis hapus spasi)',
      { parse_mode: 'HTML' }
    )
  }

  const db = await loadDb()
  const ok = await addGmail(db, uid, email, pass)

  ctx.session.state = STATES.IDLE
  ctx.session.data  = {}

  if (!ok) return ctx.reply('⚠️ Gmail ini sudah pernah ditambahkan.')

  const tier = getTier(db, uid)

  let warn = ''
  if (!result.ok && result.reason === 'network') {
    warn = `\n\n⚠️ <i>Verifikasi via SMTP gak bisa dilakukan (hosting block port 465/587). Gmail tetap disimpan — kalau kirim banding nanti gagal auth, otomatis ditandai blocked.</i>`
  } else if (!result.ok) {
    warn = `\n\n⚠️ <i>Verifikasi gagal: ${(result.error || 'unknown').slice(0, 120)}. Gmail tetap disimpan, akan dicoba saat banding.</i>`
  }

  await ctx.reply(
    `✅ <b>Gmail berhasil ditambahkan!</b>\n\n📧 ${email}${warn}\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: mainMenu(uid, tier) }
  )
}

// ─── List Gmail ────────────────────────────────────────────────────────────────

async function handleListGmail(ctx) {
  const uid = ctx.from.id
  const db  = await loadDb()
  // Owner sees all gmails
  const list = isOwner(uid) ? (db.gmails || []) : getUserGmails(db, uid)

  if (!list.length) {
    return ctx.editMessageText(
      '📭 Belum ada Gmail.\n\nTambah dulu via ➕ TAMBAH GMAIL.',
      { reply_markup: backBtn() }
    )
  }

  const kb = new InlineKeyboard()
  list.forEach(g => {
    const label = g.blocked ? `🚫 ${g.email}` : `✅ ${g.email}`
    kb.text(label, `del_gmail_${g.email}`).row()
  })
  kb.text('🔙 Kembali', 'back_main')

  const text = list.map((g, i) =>
    `${i + 1}. ${g.blocked ? '🚫' : '✅'} <code>${g.email}</code>${isOwner(uid) ? ` (uid: ${g.owner_id})` : ''}`
  ).join('\n')

  await ctx.editMessageText(
    `${HEADER('LIST GMAIL')}\n\n${text}\n\n<i>Ketuk email untuk hapus</i>\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

async function handleDeleteGmail(ctx, email) {
  const uid = ctx.from.id
  const db  = await loadDb()
  const ok  = await deleteGmail(db, uid, email)
  if (ok) await ctx.answerCallbackQuery(`🗑️ ${email} dihapus.`, { show_alert: true })
  else    await ctx.answerCallbackQuery('❌ Gagal hapus.', { show_alert: true })
  await handleListGmail(ctx)
}

// ─── Set Name ──────────────────────────────────────────────────────────────────

async function handleSetNameStart(ctx) {
  ctx.session.state = STATES.SET_NAME
  await ctx.editMessageText(
    `${HEADER('ATUR NAMA')}\n\n✏️ Kirim nama baru yang ingin dipakai di email banding:\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn() }
  )
}

async function handleSetName(ctx) {
  const uid  = ctx.from.id
  const name = ctx.message.text.trim()
  if (name.length < 2 || name.length > 50) {
    return ctx.reply('❌ Nama harus 2–50 karakter.')
  }
  const db   = await loadDb()
  const user = getUser(db, uid) || { tier: 'free' }
  user.name  = name
  await setUser(db, uid, user)
  ctx.session.state = STATES.IDLE
  const tier = getTier(db, uid)
  await ctx.reply(
    `✅ Nama diubah ke: <b>${name}</b>`,
    { parse_mode: 'HTML', reply_markup: mainMenu(uid, tier) }
  )
}

// ─── Check Quota ───────────────────────────────────────────────────────────────

async function handleCheckQuota(ctx) {
  const uid  = ctx.from.id
  const db   = await loadDb()
  const tier = getTier(db, uid)
  const { current, max, sesi } = await getQuota(db, uid)
  const user = getUser(db, uid)

  await ctx.editMessageText(
    `${HEADER('KUOTA KAMU')}\n\n` +
    `🏅 Tier: ${tierBadge(tier)}\n` +
    (tier === 'owner'
      ? `📊 Kuota: <b>UNLIMITED</b>\n`
      : `📊 Kuota ${sesi}: ${quotaBar(current, max)}\n`) +
    `📨 Total banding: ${user?.total_bandings || 0}x\n` +
    `${LINE()}\n` +
    (tier === 'free' ? `<i>💡 Upgrade premium untuk kuota lebih banyak!</i>` : ''),
    { parse_mode: 'HTML', reply_markup: backBtn() }
  )
}

// ─── Start Banding ─────────────────────────────────────────────────────────────

async function handleStartBanding(ctx) {
  const uid = ctx.from.id
  const db  = await loadDb()
  const { current } = await getQuota(db, uid)
  const tier = getTier(db, uid)

  if (current <= 0 && tier !== 'owner') {
    return ctx.editMessageText(
      `❌ <b>Kuota habis!</b>\n\nKuota kamu sudah habis.\nCoba lagi nanti atau upgrade premium.\n${LINE()}`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🛒 Upgrade Premium', 'buy_premium').row().text('🔙 Kembali', 'back_main') }
    )
  }

  if (tier !== 'free') {
    const kb = new InlineKeyboard()
      .text('🎲 Gmail Random', 'gmail_random').row()
      .text('📋 Pilih Gmail Sendiri', 'gmail_pick').row()
      .text('🔙 Kembali', 'back_main')
    return ctx.editMessageText(
      `${HEADER('MULAI BANDING')}\n\n📬 Pilih sumber Gmail:\n\n• 🎲 <b>Random</b> — pakai gmail dari pool\n• 📋 <b>Sendiri</b> — pakai gmail kamu\n${LINE()}`,
      { parse_mode: 'HTML', reply_markup: kb }
    )
  }

  // Free user: harus pakai gmail miliknya sendiri
  const gmail = getAvailableGmail(db, uid, true)
  if (!gmail) {
    return ctx.editMessageText(
      '⚠️ Kamu belum punya Gmail.\nTambah dulu via ➕ TAMBAH GMAIL.',
      { reply_markup: new InlineKeyboard().text('➕ Tambah Gmail', 'add_gmail').row().text('🔙 Kembali', 'back_main') }
    )
  }
  ctx.session.data = { gmail, lang: 'id' }
  ctx.session.state = STATES.INPUT_PHONE
  await ctx.editMessageText(
    `${HEADER('MULAI BANDING')}\n\n📱 Masukkan nomor WA yang mau dibanding:\n<i>Contoh: 628123456789</i>\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn('start_banding') }
  )
}

async function handleGmailRandom(ctx) {
  const uid = ctx.from.id
  const db  = await loadDb()
  const gmail = getAvailableGmail(db, uid)
  if (!gmail) {
    return ctx.editMessageText('❌ Tidak ada Gmail tersedia.', { reply_markup: backBtn() })
  }
  ctx.session.data = { gmail }
  await ctx.editMessageText(
    `${HEADER('PILIH BAHASA')}\n\n🌐 Pilih bahasa email banding:\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: langKeyboard() }
  )
}

async function handleGmailPick(ctx) {
  const uid = ctx.from.id
  const db  = await loadDb()
  const gmails = getUserGmails(db, uid).filter(g => !g.blocked)

  if (!gmails.length) {
    return ctx.editMessageText('⚠️ Kamu belum punya Gmail aktif.', { reply_markup: backBtn() })
  }

  const kb = new InlineKeyboard()
  gmails.forEach(g => kb.text(`📧 ${g.email}`, `setgmail_${g.email}`).row())
  kb.text('🔙 Kembali', 'start_banding')

  await ctx.editMessageText(
    `${HEADER('PILIH GMAIL')}\n\n📋 Pilih Gmail yang ingin dipakai:\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

async function handleSetGmailSpecific(ctx, email) {
  const uid = ctx.from.id
  const db  = await loadDb()
  const gmail = getUserGmails(db, uid).find(g => g.email === email)
  if (!gmail) return ctx.answerCallbackQuery('❌ Gmail tidak ditemukan.', { show_alert: true })

  ctx.session.data = { ...ctx.session.data, gmail }
  await ctx.editMessageText(
    `${HEADER('PILIH BAHASA')}\n\n✅ Gmail: <code>${email}</code>\n\n🌐 Pilih bahasa:\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: langKeyboard() }
  )
}

async function handleLangSelect(ctx, lang) {
  ctx.session.data = { ...ctx.session.data, lang }
  ctx.session.state = STATES.INPUT_PHONE
  await ctx.editMessageText(
    `${HEADER('MULAI BANDING')}\n\n📱 Masukkan nomor WA yang mau dibanding:\n<i>Contoh: 628123456789</i>\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn('start_banding') }
  )
}

async function handleInputPhone(ctx) {
  const uid   = ctx.from.id
  const phone = formatPhone(ctx.message.text)

  if (!phone) {
    return ctx.reply('❌ Nomor tidak valid. Hanya angka, 7–15 digit.\n<i>Contoh: 628123456789</i>', { parse_mode: 'HTML' })
  }

  const { gmail, lang } = ctx.session.data || {}
  if (!gmail) {
    ctx.session.state = STATES.IDLE
    return ctx.reply('❌ Sesi expired. Mulai lagi.')
  }

  // Reset state lebih dulu supaya user gak bisa spam
  ctx.session.state = STATES.IDLE

  const db   = await loadDb()
  const user = getUser(db, uid)
  const name = user?.name || randomName()
  const date = todayStr()
  const tpl  = getRandomTemplate(lang || 'id')
  const body = fillTemplate(tpl, { name, number: phone, date })

  // ── Animasi progress (cepat & ringan) ──
  const loading = await ctx.reply(
    `${HEADER('🚀 PROSES BANDING')}\n\n` +
    `📱 Nomor: <code>${phone}</code>\n` +
    `[⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜] 0%\n` +
    `<i>Menyiapkan...</i>`,
    { parse_mode: 'HTML' }
  )

  // Kick off email send + animasi paralel — animasi tidak block email send
  const sendPromise = sendEmail(gmail.email, gmail.password, WA_SUPPORT_EMAIL, `Appeal - ${phone}`, body)

  const steps = [
    { pct: 20, txt: '📝 Menyusun template...' },
    { pct: 45, txt: '📡 Konek ke Gmail...' },
    { pct: 70, txt: '✉️ Kirim email...' },
    { pct: 90, txt: '🔍 Verifikasi...' },
  ]

  for (const s of steps) {
    await sleep(280)
    const filled = '🟦'.repeat(Math.round(s.pct / 10))
    const empty  = '⬜'.repeat(10 - Math.round(s.pct / 10))
    await ctx.api.editMessageText(
      ctx.chat.id, loading.message_id,
      `${HEADER('🚀 PROSES BANDING')}\n\n` +
      `📱 Nomor: <code>${phone}</code>\n` +
      `[${filled}${empty}] ${s.pct}%\n` +
      `<i>${s.txt}</i>`,
      { parse_mode: 'HTML' }
    ).catch(() => {})
  }

  const { ok, error, reason } = await sendPromise

  if (!ok) {
    if (reason === 'auth') {
      await markGmailBlocked(db, gmail.email)
      await ctx.api.editMessageText(
        ctx.chat.id, loading.message_id,
        `${HEADER('❌ GAGAL — App Password salah')}\n\n` +
        `📧 ${gmail.email}\n\n` +
        `Gmail ini ditandai <b>blocked</b>. Hapus & tambah ulang dengan App Password yang valid.\n` +
        `${LINE()}`,
        { parse_mode: 'HTML', reply_markup: mainMenu(uid, getTier(db, uid)) }
      ).catch(() => {})
      return
    }

    if (reason === 'network') {
      await ctx.api.editMessageText(
        ctx.chat.id, loading.message_id,
        `${HEADER('❌ HOSTING BLOCK SMTP')}\n\n` +
        `Bot udah coba 4 port SMTP Gmail (465, 587, 25, 2525) — semuanya kena <b>connection timeout</b>.\n\n` +
        `Ini <b>bukan bug bot</b> dan <b>bukan masalah credential</b>. Hosting kamu (<code>web.id/server</code>) memblokir koneksi SMTP keluar buat cegah spam.\n\n` +
        `<b>💡 Solusi:</b>\n` +
        `1️⃣ Pindah ke hosting yang gak block SMTP:\n` +
        `   • Railway.app (free tier)\n` +
        `   • Render.com\n` +
        `   • Fly.io\n` +
        `   • VPS murah (Contabo, Vultr, Hetzner)\n` +
        `   • Replit Deployments\n\n` +
        `2️⃣ Atau hubungi support hosting kamu, minta unblock outbound port 465/587\n\n` +
        `<i>Detail error: ${(error || '').slice(0, 100)}</i>\n` +
        `${LINE()}`,
        { parse_mode: 'HTML', reply_markup: mainMenu(uid, getTier(db, uid)) }
      ).catch(() => {})
      return
    }

    await ctx.api.editMessageText(
      ctx.chat.id, loading.message_id,
      `❌ <b>Gagal Mengirim!</b>\n\n<code>${(error || '').slice(0, 200)}</code>\n${LINE()}`,
      { parse_mode: 'HTML', reply_markup: mainMenu(uid, getTier(db, uid)) }
    ).catch(() => {})
    return
  }

  await useQuota(db, uid)
  await updateLeaderboard(db, uid)
  const { current: sisa, max } = await getQuota(db, uid)
  const tier = getTier(db, uid)

  ctx.session.data = {}

  await ctx.api.editMessageText(
    ctx.chat.id, loading.message_id,
    `${HEADER('✅ FIX TERKIRIM!')}\n\n` +
    `[🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩] 100%\n\n` +
    `📱 Nomor: <code>${phone}</code>\n` +
    `📧 Via: <code>${gmail.email}</code>\n` +
    `📝 Template: ${tpl.name}\n` +
    `🌐 Bahasa: ${lang || 'id'}\n` +
    `${LINE()}\n` +
    (tier === 'owner' ? `⏳ Sisa kuota: <b>UNLIMITED</b>\n` : `⏳ Sisa kuota: <b>${sisa}/${max}</b>\n`) +
    `<i>Tunggu balasan WhatsApp 1–3 hari kerja</i>`,
    { parse_mode: 'HTML', reply_markup: mainMenu(uid, tier) }
  ).catch(() => {})
}

// ─── Set Delay ─────────────────────────────────────────────────────────────────

async function handleSetDelayStart(ctx) {
  const uid = ctx.from.id
  const db  = await loadDb()
  const tier = getTier(db, uid)
  if (tier === 'free') return ctx.answerCallbackQuery('❌ Fitur premium.', { show_alert: true })
  ctx.session.state = STATES.SET_DELAY
  await ctx.editMessageText(
    `${HEADER('SET DELAY')}\n\n⏱️ Delay saat ini: <b>${db.delay || 10} detik</b>\n\nKirim angka baru (1–60 detik):\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn() }
  )
}

async function handleSetDelay(ctx) {
  const uid = ctx.from.id
  const db  = await loadDb()
  const val = parseInt(ctx.message.text.trim())
  if (isNaN(val) || val < 1 || val > 60) return ctx.reply('❌ Angka harus 1–60.')
  if (getTier(db, uid) === 'free') return ctx.reply('❌ Fitur premium.')
  db.delay = val
  await saveDb(db)
  ctx.session.state = STATES.IDLE
  await ctx.reply(`✅ Delay diset ke <b>${val} detik</b>`, { parse_mode: 'HTML', reply_markup: mainMenu(uid, getTier(db, uid)) })
}

// ─── Set Limit ─────────────────────────────────────────────────────────────────

async function handleSetLimitStart(ctx) {
  const uid = ctx.from.id
  const db  = await loadDb()
  if (getTier(db, uid) === 'free') return ctx.answerCallbackQuery('❌ Fitur premium.', { show_alert: true })
  const user = getUser(db, uid)
  ctx.session.state = STATES.SET_LIMIT
  await ctx.editMessageText(
    `${HEADER('SET LIMIT GMAIL')}\n\n📊 Limit saat ini: <b>${user?.gmail_limit || 'Tak terbatas'}</b>\n\nKirim angka baru (1–50), 0 = tak terbatas:\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn() }
  )
}

async function handleSetLimit(ctx) {
  const uid = ctx.from.id
  const db  = await loadDb()
  const val = parseInt(ctx.message.text.trim())
  if (isNaN(val) || val < 0 || val > 50) return ctx.reply('❌ Angka harus 0–50.')
  if (getTier(db, uid) === 'free') return ctx.reply('❌ Fitur premium.')
  const user = getUser(db, uid)
  user.gmail_limit = val === 0 ? null : val
  await setUser(db, uid, user)
  ctx.session.state = STATES.IDLE
  await ctx.reply(
    `✅ Limit Gmail diset ke: <b>${val === 0 ? 'Tak terbatas' : val}</b>`,
    { parse_mode: 'HTML', reply_markup: mainMenu(uid, getTier(db, uid)) }
  )
}

// ─── Mark Replied ──────────────────────────────────────────────────────────────

async function handleMarkReplied(ctx) {
  await ctx.editMessageText(
    `${HEADER('TANDAI DIBALAS')}\n\n✅ Fitur ini untuk mencatat nomor yang sudah dibalas WhatsApp.\n\n<i>Coming soon — kirim nomor untuk catatan manual.</i>\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn() }
  )
}

// ─── Referral ──────────────────────────────────────────────────────────────────

async function handleReferral(ctx) {
  const uid  = ctx.from.id
  const db   = await loadDb()
  const tier = getTier(db, uid)
  if (tier === 'free') return ctx.answerCallbackQuery('❌ Fitur premium.', { show_alert: true })

  const user = getUser(db, uid)
  const link = getReferralLink(uid)
  const refs = Object.values(db.users).filter(u => String(u.referred_by) === String(uid)).length

  await ctx.editMessageText(
    `${HEADER('REFERRAL')}\n\n` +
    `🔗 Link referral kamu:\n<code>${link}</code>\n\n` +
    `👥 Total referral: <b>${refs} orang</b>\n` +
    `💰 Total reward: <b>${rupiah(user?.reward_total || 0)}</b>\n` +
    `${LINE()}\n` +
    `<i>💡 Dapat Rp500–1.500 setiap referral beli premium!</i>`,
    { parse_mode: 'HTML', reply_markup: backBtn() }
  )
}

// ─── Saldo ─────────────────────────────────────────────────────────────────────

async function handleSaldo(ctx) {
  const uid  = ctx.from.id
  const db   = await loadDb()
  const user = getUser(db, uid)
  const saldo = user?.saldo || 0

  const kb = new InlineKeyboard()
  if (saldo >= MIN_WITHDRAW) kb.text('💸 Withdraw', 'withdraw').row()
  kb.text('🔙 Kembali', 'back_main')

  await ctx.editMessageText(
    `${HEADER('SALDO KAMU')}\n\n` +
    `💰 Saldo: <b>${rupiah(saldo)}</b>\n` +
    `🎁 Total reward: <b>${rupiah(user?.reward_total || 0)}</b>\n` +
    `${LINE()}\n` +
    `<i>Min. withdraw: ${rupiah(MIN_WITHDRAW)}</i>`,
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

async function handleWithdrawStart(ctx) {
  const uid  = ctx.from.id
  const db   = await loadDb()
  const user = getUser(db, uid)
  if ((user?.saldo || 0) < MIN_WITHDRAW) {
    return ctx.answerCallbackQuery(`❌ Saldo min ${rupiah(MIN_WITHDRAW)}`, { show_alert: true })
  }
  ctx.session.state = STATES.WITHDRAW_AMOUNT
  await ctx.editMessageText(
    `${HEADER('WITHDRAW')}\n\n💰 Saldo: <b>${rupiah(user.saldo)}</b>\n\nMasukkan jumlah withdraw (min ${rupiah(MIN_WITHDRAW)}):\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn('saldo') }
  )
}

async function handleWithdrawAmount(ctx) {
  const uid  = ctx.from.id
  const db   = await loadDb()
  const user = getUser(db, uid)
  const raw  = ctx.message.text.replace(/\D/g, '')
  const amount = parseInt(raw)

  if (isNaN(amount) || amount < MIN_WITHDRAW) {
    return ctx.reply(`❌ Min ${rupiah(MIN_WITHDRAW)}`)
  }
  if (amount > (user?.saldo || 0)) {
    return ctx.reply('❌ Saldo tidak cukup.')
  }
  ctx.session.data = { withdraw_amount: amount }
  ctx.session.state = STATES.WITHDRAW_REKENING
  await ctx.reply(
    `✅ Jumlah: <b>${rupiah(amount)}</b>\n\nMasukkan rekening tujuan:\n<i>Format: Bank|NomorRek|Atas Nama\nContoh: BCA|1234567890|Andi Budi</i>`,
    { parse_mode: 'HTML' }
  )
}

async function handleWithdrawRekening(ctx) {
  const uid      = ctx.from.id
  const db       = await loadDb()
  const rekening = ctx.message.text.trim()
  const amount   = ctx.session.data?.withdraw_amount

  if (!amount) { ctx.session.state = STATES.IDLE; return ctx.reply('❌ Sesi expired.') }

  const ok = await requestWithdraw(db, uid, amount, rekening)
  ctx.session.state = STATES.IDLE
  ctx.session.data  = {}

  if (!ok) return ctx.reply('❌ Gagal. Cek saldo.')

  await ctx.api.sendMessage(OWNER_ID,
    `💸 <b>WITHDRAW REQUEST</b>\n\n👤 UID: <code>${uid}</code>\n💰 ${rupiah(amount)}\n🏦 ${rekening}\n📅 ${todayStr()}`,
    { parse_mode: 'HTML' }
  ).catch(() => {})

  await ctx.reply(
    `✅ <b>Withdraw Diajukan!</b>\n\n💰 ${rupiah(amount)}\n🏦 ${rekening}\n\n<i>Owner akan proses dalam 1×24 jam</i>`,
    { parse_mode: 'HTML', reply_markup: mainMenu(uid, getTier(db, uid)) }
  )
}

// ─── Buy Premium (member) ──────────────────────────────────────────────────────

async function handleBuyPremium(ctx) {
  const uid = ctx.from.id
  const db  = await loadDb()
  const tier = getTier(db, uid)

  if (tier === 'owner') {
    return ctx.answerCallbackQuery('Owner gak perlu beli, lo udah punya semua. 😉', { show_alert: true })
  }
  if (tier === 'permanent') {
    return ctx.answerCallbackQuery('Kamu sudah PERMANENT. Gak perlu beli lagi 💎', { show_alert: true })
  }

  const promoCode = ctx.session.data?.promo_code
  const promo     = promoCode ? db.promo_codes?.[promoCode] : null
  const validPromo = promo && (!promo.expires || new Date(promo.expires) > new Date())

  const harga = db.harga
  const pkgs  = ['premium_7', 'premium_15', 'permanent']

  const kb = new InlineKeyboard()
  pkgs.forEach(key => {
    const orig  = harga[key]
    const final = validPromo ? applyPromo(orig, promo) : orig
    const label = validPromo
      ? `${PAKET_LABEL[key]} — ${rupiah(final)} (was ${rupiah(orig)})`
      : `${PAKET_LABEL[key]} — ${rupiah(orig)}`
    kb.text(label, `pickpkg_${key}`).row()
  })

  if (validPromo) {
    kb.text(`🎁 Promo aktif: ${promoCode} (-${promo.discount_pct}%)`, 'clear_promo').row()
  } else {
    kb.text('🎁 Pakai Kode Promo', 'redeem_promo').row()
  }
  kb.text('🔙 Kembali', 'back_main')

  await ctx.editMessageText(
    `${HEADER('🛒 BELI PREMIUM')}\n\n` +
    `<b>Keuntungan Premium:</b>\n` +
    `• ⭐ Kuota 10 banding <b>2x sehari</b>\n` +
    `• 💎 Permanent: 15 banding 2x sehari + selamanya\n` +
    `• 🎲 Akses gmail random (pool bersama)\n` +
    `• ⚙️ Set delay & limit gmail\n` +
    `• 👥 Program referral (Rp500–1.500/orang)\n` +
    `• 💰 Saldo & withdraw\n` +
    `${LINE()}\n` +
    (validPromo ? `🎁 <b>Promo aktif:</b> <code>${promoCode}</code> diskon ${promo.discount_pct}%\n` : '') +
    `Pilih paket:`,
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

async function handleRedeemPromoStart(ctx) {
  ctx.session.state = STATES.PROMO_REDEEM
  await ctx.editMessageText(
    `${HEADER('🎁 REDEEM KODE PROMO')}\n\nKirim kode promo kamu (huruf besar):\n\n<i>Contoh: HEMAT20</i>\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn('buy_premium') }
  )
}

async function handlePromoRedeemMsg(ctx) {
  const uid  = ctx.from.id
  const code = ctx.message.text.trim().toUpperCase()
  const db   = await loadDb()
  const v    = validatePromoCode(db, code, uid)
  ctx.session.state = STATES.IDLE

  if (!v.ok) {
    return ctx.reply(`❌ ${v.reason}`, { reply_markup: new InlineKeyboard().text('🔙 Kembali', 'buy_premium') })
  }
  ctx.session.data = { ...ctx.session.data, promo_code: code }
  await ctx.reply(
    `✅ <b>Kode promo aktif!</b>\n\n🎁 <code>${code}</code> — diskon ${v.promo.discount_pct}%\n\n<i>Diskon akan diterapkan saat memilih paket.</i>`,
    { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🛒 Lanjut Pilih Paket', 'buy_premium') }
  )
}

async function handleClearPromo(ctx) {
  if (ctx.session.data) ctx.session.data.promo_code = null
  await ctx.answerCallbackQuery('Promo dihapus.')
  await handleBuyPremium(ctx)
}

async function handlePickPackage(ctx, key) {
  const uid = ctx.from.id
  const db  = await loadDb()
  const harga = db.harga
  if (!harga[key]) return ctx.answerCallbackQuery('Paket tidak valid.')

  const promoCode = ctx.session.data?.promo_code
  const promo     = promoCode ? db.promo_codes?.[promoCode] : null
  const validPromo = promo && (!promo.expires || new Date(promo.expires) > new Date())
  const orig  = harga[key]
  const final = validPromo ? applyPromo(orig, promo) : orig

  ctx.session.data = { ...ctx.session.data, picked_pkg: key, picked_amount: final }

  const kb = new InlineKeyboard()
    .text('🟢 BAYAR OTOMATIS (QRIS)', `paymtd_auto`).row()
    .text('💳 BAYAR MANUAL (Transfer)', `paymtd_manual`).row()
    .text('🔙 Kembali', 'buy_premium')

  await ctx.editMessageText(
    `${HEADER('PILIH METODE BAYAR')}\n\n` +
    `📦 Paket: <b>${PAKET_LABEL[key]}</b>\n` +
    `💰 Total: <b>${rupiah(final)}</b>` + (validPromo ? ` <s>${rupiah(orig)}</s>\n🎁 Promo: <code>${promoCode}</code> (-${promo.discount_pct}%)\n` : '\n') +
    `${LINE()}\n\n` +
    `<b>🟢 Otomatis</b> — scan QRIS, bayar via app, akun aktif otomatis dalam 1 menit\n\n` +
    `<b>💳 Manual</b> — transfer ke rekening owner, upload bukti, owner approve manual`,
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

async function handlePayMethod(ctx, method) {
  const uid    = ctx.from.id
  const db     = await loadDb()
  const pkg    = ctx.session.data?.picked_pkg
  const amount = ctx.session.data?.picked_amount
  const promoCode = ctx.session.data?.promo_code || null

  if (!pkg || !amount) return ctx.answerCallbackQuery('Sesi expired.', { show_alert: true })

  if (method === 'auto') {
    const { url, orderId } = createPaymentUrl(uid, amount)
    await addPendingPayment(db, uid, orderId, pkg, amount, promoCode)

    // Loading message
    const loading = await ctx.editMessageText(
      `⚡ Membuat QRIS pembayaran...`,
      { parse_mode: 'HTML' }
    ).catch(() => null)

    // Ambil QRIS langsung dari Pakasir (real QR yang bisa di-scan banking app)
    const qris = await fetchPakasirQris(url)

    const kb = new InlineKeyboard()
      .text('✅ Cek Pembayaran', `cek_bayar_${orderId}`).row()
      .url('🌐 Buka di Pakasir (opsional)', url).row()
      .text('🔙 Kembali', 'buy_premium')

    const caption =
      `${HEADER('🟢 BAYAR OTOMATIS (QRIS)')}\n\n` +
      `📦 ${PAKET_LABEL[pkg]}\n` +
      `💰 Total: <b>${rupiah(amount)}</b>\n` +
      `🔑 Order: <code>${orderId}</code>\n` +
      `${LINE()}\n\n` +
      `<b>Cara bayar:</b>\n` +
      `1️⃣ <b>Scan QRIS di atas</b> pakai aplikasi bank/e-wallet\n` +
      `   (Dana, Gopay, OVO, ShopeePay, BCA, BRI, dll)\n` +
      `2️⃣ Bayar tepat <b>${rupiah(amount)}</b>\n` +
      `3️⃣ Tekan <b>"✅ Cek Pembayaran"</b>\n` +
      `4️⃣ Premium auto aktif!\n\n` +
      (qris?.source === 'fallback'
        ? `<i>⚠️ QRIS Pakasir tidak bisa diambil otomatis. Scan QR ini → buka link → bayar di Pakasir.</i>`
        : `<i>⏰ QRIS valid 30 menit. Pastikan nominal tepat.</i>`)

    // Hapus pesan loading sebelumnya supaya QR muncul fresh
    if (loading) {
      await ctx.api.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {})
    }

    if (qris?.buffer) {
      await ctx.replyWithPhoto(new InputFile(qris.buffer, `qris_${orderId}.png`), {
        caption, parse_mode: 'HTML', reply_markup: kb,
      }).catch(async (e) => {
        console.error('[QRIS sendPhoto]', e.message)
        await ctx.reply(caption + `\n\n🔗 Bayar manual: ${url}`, { parse_mode: 'HTML', reply_markup: kb })
      })
    } else {
      await ctx.reply(caption + `\n\n🔗 Bayar di sini: ${url}`, {
        parse_mode: 'HTML', reply_markup: kb,
      })
    }
    return
  }

  if (method === 'manual') {
    const rek = db.manual_rekening
    if (!rek?.bank) {
      return ctx.editMessageText('❌ Owner belum set rekening manual. Pakai bayar otomatis ya.', { reply_markup: backBtn('buy_premium') })
    }
    const payId = generatePayId()
    ctx.session.data = { ...ctx.session.data, manual_pay_id: payId }
    ctx.session.state = STATES.MANUAL_UPLOAD

    await ctx.editMessageText(
      `${HEADER('💳 BAYAR MANUAL')}\n\n` +
      `📦 ${PAKET_LABEL[pkg]}\n` +
      `💰 Total: <b>${rupiah(amount)}</b>\n` +
      `🔑 ID: <code>${payId}</code>\n` +
      `${LINE()}\n\n` +
      `<b>Transfer ke:</b>\n` +
      `🏦 Bank: <b>${rek.bank}</b>\n` +
      `📱 No: <code>${rek.nomor}</code>\n` +
      `👤 a.n: <b>${rek.nama}</b>\n` +
      `💵 Nominal: <code>${amount}</code>\n` +
      `${LINE()}\n\n` +
      `📸 Setelah transfer, <b>upload foto bukti pembayaran</b> di chat ini.\n` +
      `Owner akan verifikasi & aktifkan premium kamu.`,
      { parse_mode: 'HTML', reply_markup: backBtn('buy_premium') }
    )
    return
  }
}

async function handleManualUpload(ctx) {
  const uid    = ctx.from.id
  const db     = await loadDb()
  const payId  = ctx.session.data?.manual_pay_id
  const pkg    = ctx.session.data?.picked_pkg
  const amount = ctx.session.data?.picked_amount
  const promoCode = ctx.session.data?.promo_code || null

  if (!payId || !pkg || !amount) {
    ctx.session.state = STATES.IDLE
    return ctx.reply('❌ Sesi expired. Mulai lagi via menu Beli Premium.')
  }

  const photos = ctx.message.photo
  const photo  = photos[photos.length - 1]
  if (!photo) return ctx.reply('❌ Kirim foto, bukan jenis lain.')

  await addManualPayment(db, payId, uid, pkg, amount, photo.file_id, promoCode)

  ctx.session.state = STATES.IDLE
  ctx.session.data  = {}

  // Notif ke owner
  const user = getUser(db, uid)
  const ownerKb = new InlineKeyboard()
    .text('✅ APPROVE', `mp_approve_${payId}`)
    .text('❌ REJECT', `mp_reject_${payId}`).row()

  await ctx.api.sendPhoto(OWNER_ID, photo.file_id, {
    caption:
      `${HEADER('💳 PEMBAYARAN MANUAL')}\n\n` +
      `🔑 ID: <code>${payId}</code>\n` +
      `👤 ${user?.name || '-'} (<code>${uid}</code>)\n` +
      `📦 ${PAKET_LABEL[pkg]}\n` +
      `💰 ${rupiah(amount)}\n` +
      (promoCode ? `🎁 Promo: ${promoCode}\n` : '') +
      `📅 ${todayStr()}\n${LINE()}`,
    parse_mode: 'HTML',
    reply_markup: ownerKb,
  }).catch(e => console.error('[Notif owner]', e.message))

  await ctx.reply(
    `${HEADER('✅ BUKTI DITERIMA')}\n\n` +
    `🔑 ID: <code>${payId}</code>\n` +
    `📦 ${PAKET_LABEL[pkg]}\n` +
    `💰 ${rupiah(amount)}\n` +
    `${LINE()}\n` +
    `<i>Owner akan verifikasi maks 1×24 jam.\nKamu akan dapat notif kalau premium sudah aktif.</i>`,
    { parse_mode: 'HTML', reply_markup: mainMenu(uid, getTier(db, uid)) }
  )
}

async function handleManualApprove(ctx, payId) {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery('❌ Bukan owner.', { show_alert: true })
  const db = await loadDb()
  const p  = await approveManualPayment(db, payId)
  if (!p) return ctx.answerCallbackQuery('❌ Tidak ditemukan / sudah diproses.', { show_alert: true })

  await ctx.editMessageCaption({
    caption: ctx.callbackQuery.message.caption + `\n\n✅ <b>APPROVED</b> oleh owner`,
    parse_mode: 'HTML',
  }).catch(() => {})

  // Notif ke user
  await ctx.api.sendMessage(p.uid,
    `${HEADER('🎉 PREMIUM AKTIF!')}\n\n` +
    `✅ Pembayaran kamu sudah di-approve owner!\n` +
    `📦 ${PAKET_LABEL[p.tier]}\n` +
    `💰 ${rupiah(p.amount)}\n` +
    `${LINE()}\n` +
    `Selamat menikmati fitur premium! 🚀`,
    { parse_mode: 'HTML' }
  ).catch(() => {})

  await ctx.answerCallbackQuery('✅ Approved!').catch(() => {})
}

async function handleManualRejectStart(ctx, payId) {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery('❌ Bukan owner.', { show_alert: true })
  ctx.session.state = STATES.REJECT_REASON
  ctx.session.data  = { reject_pay_id: payId }
  await ctx.reply(
    `Kirim alasan reject untuk <code>${payId}</code>:\n<i>(ketik "skip" jika tanpa alasan)</i>`,
    { parse_mode: 'HTML' }
  )
}

async function handleRejectReason(ctx) {
  if (!isOwner(ctx.from.id)) return
  const reason = ctx.message.text.trim()
  const payId  = ctx.session.data?.reject_pay_id
  if (!payId) { ctx.session.state = STATES.IDLE; return }

  const db = await loadDb()
  const p  = await rejectManualPayment(db, payId, reason === 'skip' ? '' : reason)
  ctx.session.state = STATES.IDLE
  ctx.session.data  = {}

  if (!p) return ctx.reply('❌ Tidak ditemukan.')

  await ctx.api.sendMessage(p.uid,
    `${HEADER('❌ PEMBAYARAN DITOLAK')}\n\n` +
    `🔑 ID: <code>${payId}</code>\n` +
    `📦 ${PAKET_LABEL[p.tier]}\n` +
    `💰 ${rupiah(p.amount)}\n` +
    (reason && reason !== 'skip' ? `📝 Alasan: ${reason}\n` : '') +
    `${LINE()}\n<i>Hubungi owner kalau ada pertanyaan.</i>`,
    { parse_mode: 'HTML' }
  ).catch(() => {})

  await ctx.reply(`✅ Reject dikirim ke user ${p.uid}.`)
}

async function handleCekBayar(ctx, orderId) {
  const db      = await loadDb()
  const pending = db.pending_payments?.[orderId]
  if (!pending) return ctx.answerCallbackQuery('❌ Order tidak ditemukan.', { show_alert: true })

  const paid = await checkPayment(orderId, pending.amount)
  if (!paid) return ctx.answerCallbackQuery('⏳ Pembayaran belum terdeteksi. Tunggu sebentar.', { show_alert: true })

  await completePremium(db, pending.uid, pending.tier, pending.promo_code)
  delete db.pending_payments[orderId]
  await saveDb(db)

  const tier = getTier(db, pending.uid)
  await ctx.answerCallbackQuery('✅ Pembayaran berhasil!', { show_alert: true })

  const text =
    `${HEADER('🎉 PEMBAYARAN BERHASIL!')}\n\n` +
    `✅ Akun kamu sudah diupgrade!\n` +
    `🏅 Tier: ${tierBadge(tier)}\n` +
    `${LINE()}\n` +
    `Terima kasih sudah membeli premium! 🙏`

  // Edit caption (jika foto QRIS) atau text
  try {
    await ctx.editMessageCaption({ caption: text, parse_mode: 'HTML', reply_markup: mainMenu(ctx.from.id, tier) })
  } catch {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: mainMenu(ctx.from.id, tier) }).catch(() => {})
  }
}

async function handleCekBayarDeep(ctx, orderId) {
  const db      = await loadDb()
  const pending = db.pending_payments?.[orderId]
  if (!pending) return ctx.reply('❌ Order tidak ditemukan atau sudah diproses.')

  const paid = await checkPayment(orderId, pending.amount)
  if (!paid) {
    return ctx.reply('⏳ Pembayaran belum terdeteksi. Tunggu beberapa menit.')
  }

  await completePremium(db, pending.uid, pending.tier, pending.promo_code)
  delete db.pending_payments[orderId]
  await saveDb(db)

  const tier = getTier(db, pending.uid)
  await ctx.reply(
    `${HEADER('🎉 PREMIUM AKTIF!')}\n\n✅ Akun diupgrade ke ${tierBadge(tier)}\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: mainMenu(ctx.from.id, tier) }
  )
}

// ─── OWNER PANEL ───────────────────────────────────────────────────────────────

async function handleOwnerPanel(ctx) {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery('❌ Bukan owner.', { show_alert: true })
  const db = await loadDb()
  const s  = getStats(db)
  await ctx.editMessageText(
    `${HEADER('👑 OWNER PANEL')}\n\n` +
    `👥 User: <b>${s.total}</b> | Premium: <b>${s.premium}</b>\n` +
    `📨 Total banding: <b>${s.bandings}</b>\n` +
    `📧 Gmail: <b>${s.gmails}</b>\n` +
    `🎁 Promo aktif: <b>${s.promo_codes}</b>\n` +
    `💳 Manual pending: <b>${s.pendingManual}</b>\n` +
    `💸 Withdraw pending: <b>${s.pendingWithdraw}</b>\n` +
    `${LINE()}`,
    { parse_mode: 'HTML', reply_markup: ownerMenu() }
  )
}

async function handleAdminStats(ctx) {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery('❌ Bukan owner.', { show_alert: true })
  const db  = await loadDb()
  const s   = getStats(db)
  const rek = db.manual_rekening
  const harga = db.harga

  await ctx.editMessageText(
    `${HEADER('📈 STATISTIK BOT')}\n\n` +
    `👥 Total user: <b>${s.total}</b>\n` +
    `⭐ Premium: <b>${s.premium}</b>\n` +
    `📨 Total banding: <b>${s.bandings}</b>\n` +
    `📧 Total Gmail: <b>${s.gmails}</b>\n` +
    `🎁 Kode promo: <b>${s.promo_codes}</b>\n` +
    `💳 Manual pending: <b>${s.pendingManual}</b>\n` +
    `💸 Withdraw pending: <b>${s.pendingWithdraw}</b>\n` +
    `${LINE()}\n` +
    `<b>💰 Harga aktif:</b>\n` +
    `• 7 hari: ${rupiah(harga.premium_7)}\n` +
    `• 15 hari: ${rupiah(harga.premium_15)}\n` +
    `• Permanent: ${rupiah(harga.permanent)}\n` +
    `${LINE()}\n` +
    `🏦 Rekening: ${rek?.bank ? `${rek.bank} | ${rek.nomor} | ${rek.nama}` : 'Belum diset'}\n` +
    `📷 QRIS: ${db.qris_image_id ? '✅ Sudah upload' : '❌ Belum upload'}`,
    { parse_mode: 'HTML', reply_markup: backBtn('owner_panel') }
  )
}

// ── Manual payments queue ──
async function handleAdminManualPay(ctx) {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery('❌ Bukan owner.', { show_alert: true })
  const db = await loadDb()
  const pending = Object.entries(db.manual_payments || {}).filter(([_, p]) => p.status === 'pending')

  if (!pending.length) {
    return ctx.editMessageText('📭 Tidak ada pembayaran manual pending.', { reply_markup: backBtn('owner_panel') })
  }

  const lines = pending.slice(0, 20).map(([id, p], i) => {
    const u = getUser(db, p.uid)
    return `${i + 1}. <code>${id}</code> | ${u?.name || p.uid} | ${PAKET_LABEL[p.tier]} | ${rupiah(p.amount)}`
  })

  await ctx.editMessageText(
    `${HEADER('💳 PEMBAYARAN MANUAL PENDING')}\n\n${lines.join('\n')}\n${LINE()}\n<i>Foto bukti dikirim langsung saat user upload — cek chat owner sebelumnya.</i>`,
    { parse_mode: 'HTML', reply_markup: backBtn('owner_panel') }
  )
}

// ── Withdraw queue ──
async function handleAdminWithdraw(ctx) {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery('❌ Bukan owner.', { show_alert: true })
  const db = await loadDb()
  const pending = (db.withdraw_requests || []).filter(w => w.status === 'pending')

  if (!pending.length) {
    return ctx.editMessageText('📭 Tidak ada withdraw pending.', { reply_markup: backBtn('owner_panel') })
  }

  const kb = new InlineKeyboard()
  pending.slice(0, 10).forEach((w, i) => {
    kb.text(`✅ Tandai #${i + 1} selesai`, `wd_done_${i}`).row()
  })
  kb.text('🔙 Kembali', 'owner_panel')

  const lines = pending.slice(0, 10).map((w, i) => {
    const u = getUser(db, w.uid)
    return `${i + 1}. ${u?.name || w.uid} | ${rupiah(w.amount)} | ${w.rekening}`
  })

  await ctx.editMessageText(
    `${HEADER('💸 WITHDRAW PENDING')}\n\n${lines.join('\n')}\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

async function handleWithdrawDone(ctx, idx) {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery('❌ Bukan owner.', { show_alert: true })
  const db = await loadDb()
  const pending = (db.withdraw_requests || []).filter(w => w.status === 'pending')
  const w = pending[Number(idx)]
  if (!w) return ctx.answerCallbackQuery('❌ Not found.', { show_alert: true })
  w.status = 'done'
  w.done_at = new Date().toISOString()
  await saveDb(db)
  await ctx.api.sendMessage(w.uid,
    `✅ Withdraw kamu sebesar <b>${rupiah(w.amount)}</b> sudah dikirim ke <code>${w.rekening}</code>.\nTerima kasih! 🙏`,
    { parse_mode: 'HTML' }
  ).catch(() => {})
  await ctx.answerCallbackQuery('✅ Selesai.')
  await handleAdminWithdraw(ctx)
}

// ── Promo Management ──
async function handleAdminPromo(ctx) {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery('❌ Bukan owner.', { show_alert: true })
  const kb = new InlineKeyboard()
    .text('➕ Buat Kode Baru', 'admin_promo_new').row()
    .text('📋 Lihat Semua Kode', 'admin_promo_list').row()
    .text('🔙 Kembali', 'owner_panel')

  await ctx.editMessageText(
    `${HEADER('🎁 KELOLA PROMO')}\n\nBuat & kelola kode promo diskon premium.\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

async function handleAdminPromoNewStart(ctx) {
  if (!isOwner(ctx.from.id)) return
  ctx.session.state = STATES.PROMO_NEW_CODE
  ctx.session.data  = {}
  await ctx.editMessageText(
    `${HEADER('➕ BUAT KODE PROMO')}\n\nKirim <b>kode</b> (huruf besar, tanpa spasi):\n<i>Contoh: HEMAT20, NEWUSER, BLACKFRIDAY</i>\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn('admin_promo') }
  )
}

async function handlePromoNewCode(ctx) {
  if (!isOwner(ctx.from.id)) return
  const code = ctx.message.text.trim().toUpperCase().replace(/\s/g, '')
  if (code.length < 3 || code.length > 20) return ctx.reply('❌ Kode harus 3–20 karakter.')
  ctx.session.data.code = code
  ctx.session.state = STATES.PROMO_NEW_PCT
  await ctx.reply(`✅ Kode: <code>${code}</code>\n\nKirim <b>persentase diskon</b> (1-100):`, { parse_mode: 'HTML' })
}

async function handlePromoNewPct(ctx) {
  if (!isOwner(ctx.from.id)) return
  const pct = parseInt(ctx.message.text.trim())
  if (isNaN(pct) || pct < 1 || pct > 100) return ctx.reply('❌ Persen harus 1–100.')
  ctx.session.data.pct = pct
  ctx.session.state = STATES.PROMO_NEW_USES
  await ctx.reply(`✅ Diskon: ${pct}%\n\nKirim <b>max pemakaian</b> (angka, 0 = unlimited):`, { parse_mode: 'HTML' })
}

async function handlePromoNewUses(ctx) {
  if (!isOwner(ctx.from.id)) return
  const uses = parseInt(ctx.message.text.trim())
  if (isNaN(uses) || uses < 0) return ctx.reply('❌ Angka tidak valid.')
  const { code, pct } = ctx.session.data
  const db = await loadDb()
  await createPromoCode(db, code, pct, uses === 0 ? null : uses, 30)
  ctx.session.state = STATES.IDLE
  ctx.session.data  = {}
  await ctx.reply(
    `✅ <b>Kode promo dibuat!</b>\n\n🎁 <code>${code}</code>\n📉 Diskon: ${pct}%\n♾️ Max pakai: ${uses === 0 ? 'Unlimited' : uses}\n📅 Expired: 30 hari`,
    { parse_mode: 'HTML', reply_markup: ownerMenu() }
  )
}

async function handleAdminPromoList(ctx) {
  if (!isOwner(ctx.from.id)) return
  const db = await loadDb()
  const codes = Object.entries(db.promo_codes || {})
  if (!codes.length) {
    return ctx.editMessageText('📭 Belum ada kode promo.', { reply_markup: backBtn('admin_promo') })
  }
  const kb = new InlineKeyboard()
  const lines = codes.map(([code, p]) => {
    kb.text(`🗑️ ${code}`, `promo_del_${code}`).row()
    const usedTxt = p.max_uses ? `${p.used}/${p.max_uses}` : `${p.used}/∞`
    return `🎁 <code>${code}</code> — ${p.discount_pct}% — ${usedTxt} pakai`
  })
  kb.text('🔙 Kembali', 'admin_promo')

  await ctx.editMessageText(
    `${HEADER('📋 LIST KODE PROMO')}\n\n${lines.join('\n')}\n${LINE()}\n<i>Tap untuk hapus</i>`,
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

async function handlePromoDelete(ctx, code) {
  if (!isOwner(ctx.from.id)) return
  const db = await loadDb()
  const ok = await deletePromoCode(db, code)
  await ctx.answerCallbackQuery(ok ? `🗑️ ${code} dihapus.` : '❌ Gagal.', { show_alert: true })
  await handleAdminPromoList(ctx)
}

// ── Set Harga ──
async function handleAdminHarga(ctx) {
  if (!isOwner(ctx.from.id)) return
  const db = await loadDb()
  const h  = db.harga
  const kb = new InlineKeyboard()
    .text(`7 Hari: ${rupiah(h.premium_7)}`, 'harga_premium_7').row()
    .text(`15 Hari: ${rupiah(h.premium_15)}`, 'harga_premium_15').row()
    .text(`Permanent: ${rupiah(h.permanent)}`, 'harga_permanent').row()
    .text('🔙 Kembali', 'owner_panel')

  await ctx.editMessageText(
    `${HEADER('💰 SET HARGA PREMIUM')}\n\nTap paket untuk ubah harganya:\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: kb }
  )
}

async function handleHargaPick(ctx, key) {
  if (!isOwner(ctx.from.id)) return
  ctx.session.state = STATES.SET_HARGA_VAL
  ctx.session.data  = { harga_key: key }
  const db = await loadDb()
  await ctx.editMessageText(
    `${HEADER('💰 SET HARGA')}\n\nPaket: <b>${PAKET_LABEL[key]}</b>\nHarga sekarang: <b>${rupiah(db.harga[key])}</b>\n\nKirim harga baru (angka rupiah):`,
    { parse_mode: 'HTML', reply_markup: backBtn('admin_harga') }
  )
}

async function handleSetHargaVal(ctx) {
  if (!isOwner(ctx.from.id)) return
  const val = parseInt(ctx.message.text.replace(/\D/g, ''))
  const key = ctx.session.data?.harga_key
  if (isNaN(val) || val < 1000 || !key) return ctx.reply('❌ Harga min Rp1.000')
  const db = await loadDb()
  db.harga[key] = val
  await saveDb(db)
  ctx.session.state = STATES.IDLE
  ctx.session.data  = {}
  await ctx.reply(`✅ Harga ${PAKET_LABEL[key]} diubah ke <b>${rupiah(val)}</b>`, { parse_mode: 'HTML', reply_markup: ownerMenu() })
}

// ── QRIS Upload ──
async function handleAdminQrisStart(ctx) {
  if (!isOwner(ctx.from.id)) return
  ctx.session.state = STATES.QRIS_UPLOAD
  await ctx.editMessageText(
    `${HEADER('📷 SET QRIS')}\n\n📸 Upload foto QRIS sekarang (kirim sebagai foto, bukan file).\n\nFoto ini akan ditampilkan ke user saat bayar otomatis.\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn('owner_panel') }
  )
}

async function handleQrisUpload(ctx) {
  if (!isOwner(ctx.from.id)) return
  const photos = ctx.message.photo
  const photo  = photos[photos.length - 1]
  if (!photo) return ctx.reply('❌ Kirim foto.')
  const db = await loadDb()
  db.qris_image_id = photo.file_id
  await saveDb(db)
  ctx.session.state = STATES.IDLE
  await ctx.reply('✅ QRIS berhasil disimpan!', { reply_markup: ownerMenu() })
}

// ── Kelola User ──
async function handleAdminUserStart(ctx) {
  if (!isOwner(ctx.from.id)) return
  ctx.session.state = STATES.USER_LOOKUP
  await ctx.editMessageText(
    `${HEADER('👤 KELOLA USER')}\n\nKirim UID Telegram user yang ingin dilihat:\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn('owner_panel') }
  )
}

async function handleUserLookup(ctx) {
  if (!isOwner(ctx.from.id)) return
  const uid = ctx.message.text.trim()
  const db  = await loadDb()
  const u   = getUser(db, uid)
  ctx.session.state = STATES.IDLE
  if (!u) return ctx.reply('❌ User tidak ditemukan.')
  const tier = getTier(db, uid)
  await ctx.reply(
    `${HEADER('👤 USER INFO')}\n\n` +
    `🆔 <code>${uid}</code>\n` +
    `👤 Nama: ${u.name || '-'}\n` +
    `🏅 Tier: ${tierBadge(tier)}\n` +
    (u.premium_expiry ? `⏰ Expired: ${u.premium_expiry === 'permanent' ? 'PERMANENT' : new Date(u.premium_expiry).toLocaleString('id-ID')}\n` : '') +
    `💰 Saldo: ${rupiah(u.saldo || 0)}\n` +
    `📨 Total banding: ${u.total_bandings || 0}\n` +
    `🎁 Reward total: ${rupiah(u.reward_total || 0)}\n` +
    `${LINE()}`,
    { parse_mode: 'HTML', reply_markup: ownerMenu() }
  )
}

// ── Give Premium (manual) ──
async function handleAdminGivePremStart(ctx) {
  if (!isOwner(ctx.from.id)) return
  ctx.session.state = STATES.GIVE_PREMIUM_UID
  await ctx.editMessageText(
    `${HEADER('🎯 KASIH PREMIUM')}\n\nKirim format:\n<code>UID|paket</code>\n\n<i>Paket: premium_7 / premium_15 / permanent</i>\n\nContoh: <code>123456789|premium_7</code>\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn('owner_panel') }
  )
}

async function handleGivePremiumUid(ctx) {
  if (!isOwner(ctx.from.id)) return
  const txt = ctx.message.text.trim()
  const [uid, pkg] = txt.split('|').map(s => s?.trim())
  if (!uid || !['premium_7', 'premium_15', 'permanent'].includes(pkg)) {
    return ctx.reply('❌ Format salah. Contoh: <code>123|premium_7</code>', { parse_mode: 'HTML' })
  }
  const db = await loadDb()
  const u  = getUser(db, uid)
  if (!u) return ctx.reply('❌ User belum pernah /start bot.')
  await completePremium(db, uid, pkg, null)
  ctx.session.state = STATES.IDLE
  await ctx.reply(`✅ Premium ${pkg} diaktifkan untuk UID ${uid}`, { reply_markup: ownerMenu() })
  await ctx.api.sendMessage(uid,
    `${HEADER('🎁 HADIAH PREMIUM!')}\n\nOwner memberikan kamu <b>${PAKET_LABEL[pkg]}</b> 🎉\n${LINE()}`,
    { parse_mode: 'HTML' }
  ).catch(() => {})
}

// ─── Rekening (Owner) ──────────────────────────────────────────────────────────

async function handleSetRekeningStart(ctx) {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery('❌ Bukan owner.', { show_alert: true })
  ctx.session.state = STATES.REK_BANK
  ctx.session.data  = {}
  await ctx.editMessageText(
    `${HEADER('🏦 SET REKENING')}\n\nKirim nama bank:\n<i>Contoh: BCA / DANA / BRI / GoPay</i>`,
    { parse_mode: 'HTML', reply_markup: backBtn('owner_panel') }
  )
}

async function handleRekBank(ctx) {
  if (!isOwner(ctx.from.id)) return
  ctx.session.data.bank = ctx.message.text.trim()
  ctx.session.state = STATES.REK_NOMOR
  await ctx.reply('Kirim nomor rekening / nomor HP:')
}

async function handleRekNomor(ctx) {
  if (!isOwner(ctx.from.id)) return
  ctx.session.data.nomor = ctx.message.text.trim()
  ctx.session.state = STATES.REK_NAMA
  await ctx.reply('Kirim nama pemilik rekening:')
}

async function handleRekNama(ctx) {
  if (!isOwner(ctx.from.id)) return
  const { bank, nomor } = ctx.session.data
  const nama = ctx.message.text.trim()
  const db   = await loadDb()
  db.manual_rekening = { bank, nomor, nama }
  await saveDb(db)
  ctx.session.state = STATES.IDLE
  ctx.session.data  = {}
  await ctx.reply(
    `✅ Rekening tersimpan:\n\n🏦 ${bank}\n📱 ${nomor}\n👤 ${nama}`,
    { reply_markup: ownerMenu() }
  )
}

// ─── Leaderboard ───────────────────────────────────────────────────────────────

async function handleLeaderboard(ctx) {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery('❌ Bukan owner.', { show_alert: true })
  const db   = await loadDb()
  const list = getLeaderboard(db)

  if (!list.length) {
    return ctx.editMessageText('📊 Leaderboard kosong minggu ini.', { reply_markup: backBtn('owner_panel') })
  }

  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟']
  const text = list.map(([uid, count], i) => {
    const user = getUser(db, uid)
    const name = user?.name || `User ${uid}`
    return `${medals[i]} ${name} — <b>${count} banding</b>`
  }).join('\n')

  await ctx.editMessageText(
    `${HEADER('🏆 LEADERBOARD MINGGU INI')}\n\n${text}\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn('owner_panel') }
  )
}

// ─── Broadcast ─────────────────────────────────────────────────────────────────

async function handleBroadcastStart(ctx) {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery('❌ Bukan owner.', { show_alert: true })
  ctx.session.state = STATES.BROADCAST_MSG
  await ctx.editMessageText(
    `${HEADER('📢 BROADCAST')}\n\nKirim pesan yang ingin di-broadcast ke semua user.\n<i>HTML formatting didukung.</i>\n${LINE()}`,
    { parse_mode: 'HTML', reply_markup: backBtn('owner_panel') }
  )
}

async function handleBroadcastMsg(ctx) {
  if (!isOwner(ctx.from.id)) return
  const msg  = ctx.message.text
  const db   = await loadDb()
  const uids = Object.keys(db.users)

  ctx.session.state = STATES.IDLE
  const status = await ctx.reply(`📢 Mengirim ke ${uids.length} user...`)

  let success = 0, failed = 0
  for (const uid of uids) {
    try {
      await ctx.api.sendMessage(uid, msg, { parse_mode: 'HTML' })
      success++
    } catch {
      failed++
    }
    await sleep(40) // Anti-flood
  }

  db.broadcast_stats = { total: success, last: new Date().toISOString() }
  await saveDb(db)
  await ctx.api.editMessageText(ctx.chat.id, status.message_id,
    `✅ Broadcast selesai!\n\n📤 Berhasil: ${success}\n❌ Gagal: ${failed}`,
  )
}
