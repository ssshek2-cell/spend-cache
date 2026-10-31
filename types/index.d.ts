export type LastAt = number | null

declare module 'claude-code' {
  interface PluginState {
    'spend-cache': { lastAt: LastAt; tick: number; seen: number }
  }
}
