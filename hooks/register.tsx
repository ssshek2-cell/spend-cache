import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const lastAt = atom({ plugin: 'spend-cache', key: 'lastAt' } as const, null)
const tick = atom({ plugin: 'spend-cache', key: 'tick' } as const, 0)
// session cost already added to the month total (session-scoped, survives hot reload)
const seen = atom({ plugin: 'spend-cache', key: 'seen' } as const, 0)

type Month = { month: string; total: number }

const TTL_MS = 60 * 60 * 1000
const money = (n: number) => `$${n.toFixed(2)}`
const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7)
const cents = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : money(n))

// month total kept across sessions in $.store; rolls over when the month changes
async function loadMonth($: EngineInterface, now: number): Promise<Month> {
  const month = monthOf(now)
  const saved = (await $.store.get('month2')) as Month | undefined

  return saved && saved.month === month ? saved : { month, total: 0 }
}

export const register: Register = (on, options) => {
  const budget = Number(options.budget ?? 100)
  const price = Number(options.inputPricePerMTok ?? 3)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'spend-set',
      description: 'Sync the month total to the figure shown on claude.ai, e.g. /spend-set 12.34',
    })
    $.clock.every(1000, () => void update($, tick, n => n + 1))

    return next(e)
  })

  on('command.run', { command: 'spend-set' }, async ($, e) => {
    const amount = Number(e.args.replace('$', '').trim())

    if (!Number.isFinite(amount) || amount < 0) {
      return { text: 'Usage: /spend-set 12.34 (the month spend shown on claude.ai)' }
    }

    // anchor so the band shows `amount` now; later turns add on top
    const now = await $.clock.now()
    const cost = (await $.session.usage()).cost?.usd ?? 0
    const counted = await read($, seen)
    const pending = cost >= counted ? cost - counted : cost
    await $.store.set('month2', { month: monthOf(now), total: amount - pending })

    return { text: `Month spend set to ${money(amount)}.` }
  })

  on('turn.complete', async ($, e, next) => {
    const at = await $.clock.now()
    await update($, lastAt, () => at)

    // add this session's new spend to the month total
    const cost = (await $.session.usage()).cost?.usd ?? 0
    const counted = await read($, seen)
    const delta = cost >= counted ? cost - counted : cost
    const held = await loadMonth($, at)
    await $.store.set('month2', { month: held.month, total: held.total + delta })
    await update($, seen, () => cost)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const frame = await read($, tick)
    const last = await read($, lastAt)
    const now = await $.clock.now()
    const usage = await $.session.usage()
    const cost = usage.cost?.usd ?? 0
    const counted = await read($, seen)
    const pending = cost >= counted ? cost - counted : cost
    const held = await loadMonth($, now)
    // the gateway's own spend_limit window is the real figure; local sum is the fallback
    const limit = usage.rateLimits.find(r => r.kind === 'spend_limit')
    const spent = limit ? (limit.percentUsed / 100) * budget : held.total + pending
    const resets = limit?.resetsAt ? new Date(limit.resetsAt).toISOString().slice(0, 10) : ''
    const tokens = usage.context.tokens ?? 0

    const msLeft = last === null ? 0 : last + TTL_MS - now
    const isWarm = msLeft > 0
    const mtok = tokens / 1_000_000
    const next$ = isWarm ? mtok * price * 0.1 : mtok * price * 2
    const minutes = Math.ceil(msLeft / 60000)

    const robot = isWarm ? (frame % 2 === 0 ? '\u{1F916}' : ' \u{1F916}') : '\u{1F916}'
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box>
        <Text>
          {money(spent)} of {money(budget)} spent{resets ? ` (resets ${resets})` : ' this month'}{'  '}
        </Text>
        {isWarm ? (
          <Text color="red">
            {robot} WARM {minutes}m left · next msg ~{cents(next$)}
          </Text>
        ) : (
          <Text color="blue">
            {robot} COLD · next msg ~{cents(next$)} (re-sends whole chat)
          </Text>
        )}
        </Box>
      </Box>
    )
  })
}
