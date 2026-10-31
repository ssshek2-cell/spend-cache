import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'spend-cache',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false },
} as const

const NOW = Date.UTC(2026, 9, 31, 12, 0, 0)

async function draw($: any, on: any, costs: number[]) {
  let clock = NOW
  on('clock.now', () => ({ value: clock }))
  on('clock.every', () => ({ value: {} }))
  const kv = new Map<string, unknown>()
  on('store.get', (_: any, e: any) => ({ value: kv.get(e.key) }))
  on('store.set', (_: any, e: any) => (kv.set(e.key, e.value), { value: undefined }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 200_000, window: 1_000_000 },
      rateLimits: [],
      cost: { usd: costs[0] ?? 0 },
    },
  }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return { setClock: (ms: number) => (clock = ms) }
}

test('COLD before any turn: blue, price shown', async ($, on) => {
  await draw($, on, [0.32, 0.32])
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /COLD/ }))?.text).toMatch(/next msg ~\$1\.20/)
  expect((await ui.find({ type: 'Text', text: /spent this month/ }))?.text).toMatch(/\$0\.32 of \$100\.00/)
  await ui.unmount()
})

test('WARM after a turn: minutes left, cheap next msg', async ($, on) => {
  const ctl = await draw($, on, [0.5, 0.5, 0.5, 0.5])
  await $.turn.complete({ text: 'x' } as never)
  ctl.setClock(NOW + 18 * 60_000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const warm = await ui.find({ type: 'Text', text: /WARM/ })
  expect(warm?.text).toMatch(/42m left/)
  expect(warm?.text).toMatch(/~\$0\.06/)
  await ui.unmount()
})
