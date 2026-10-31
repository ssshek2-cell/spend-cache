export type LastAt = number | null
export type Task = { usd: number; steps: number }

declare module 'claude-code' {
  interface PluginState {
    'spend-cache': { lastAt: LastAt; tick: number; seen: number; task: Task }
  }
}
