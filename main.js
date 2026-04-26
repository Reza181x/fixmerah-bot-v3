import 'dotenv/config'
import { Bot, session } from 'grammy'
import cron from 'node-cron'
import { BOT_TOKEN, BRAND, VERSION } from './config.js'
import { backupDb, loadDb } from './database.js'
import { setupHandlers, STATES } from './handlers.js'

async function main() {
  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN belum diset di environment.')
    process.exit(1)
  }

  const bot = new Bot(BOT_TOKEN)

  // ── Session (in-memory, state conversation) ──
  bot.use(session({
    initial: () => ({ state: STATES.IDLE, data: {} }),
  }))

  // ── Global error handler ──
  bot.catch((err) => {
    const ctx = err.ctx
    console.error(`[Error] Update ${ctx?.update?.update_id}:`, err.error?.message || err.error)
    ctx?.reply?.('❌ Terjadi kesalahan sistem. Coba lagi.').catch(() => {})
  })

  // ── Handlers ──
  setupHandlers(bot)

  // ── Preload DB ──
  await loadDb()
  console.log('✅ Database loaded.')

  // ── Scheduler backup (00:00 & 12:00 WIB) ──
  cron.schedule('0 0 * * *', () => backupDb().catch(console.error), { timezone: 'Asia/Jakarta' })
  cron.schedule('0 12 * * *', () => backupDb().catch(console.error), { timezone: 'Asia/Jakarta' })

  console.log(`🤖 ${BRAND} ${VERSION} berjalan...`)

  // Start with drop_pending_updates so we don't process old queued updates on restart
  await bot.start({
    drop_pending_updates: true,
    onStart: (info) => console.log(`🚀 Polling aktif sebagai @${info.username}`),
  })
}

process.once('SIGINT', () => process.exit(0))
process.once('SIGTERM', () => process.exit(0))

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
