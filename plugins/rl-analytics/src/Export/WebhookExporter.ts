import type { Step } from '../RLPipeline/types.ts'

export default class WebhookExporter {
  private url: string
  private batchSize: number
  private intervalMs: number
  private buffer: Record<string, unknown>[] = []
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(url: string, batchSize = 50, intervalMs = 5000) {
    this.url = url
    this.batchSize = batchSize
    this.intervalMs = intervalMs
  }

  start() {
    if (!this.url) {
      return
    }
    this.timer = setInterval(() => {
      void this.flush()
    }, this.intervalMs)
  }

  push(step: Step, episodeId: string, taskId?: string) {
    this.buffer.push({
      episode_id: episodeId,
      task_id: taskId,
      timestamp: step.timestamp,
      observation: step.state,
      action: step.action,
      action_metadata: step.actionMetadata,
      reward: step.reward,
      next_observation: step.nextState,
      terminated: step.terminal,
    })

    if (this.buffer.length >= this.batchSize) {
      void this.flush()
    }
  }

  async flush() {
    if (this.buffer.length === 0 || !this.url) {
      return
    }

    const batch = this.buffer.splice(0, this.batchSize)
    try {
      await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: batch }),
      })
    } catch {
      // On failure, put items back at the front
      this.buffer.unshift(...batch)
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  dispose() {
    this.stop()
    // Best-effort flush remaining
    if (this.buffer.length > 0 && this.url) {
      const body = JSON.stringify({ steps: this.buffer })
      this.buffer = []
      // Use sendBeacon for reliable delivery on page unload
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(this.url, body)
      }
    }
  }
}
