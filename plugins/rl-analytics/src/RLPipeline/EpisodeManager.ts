import type { ClassifiedAction } from '../ActionLogger/ActionTypes.ts'

import StateEncoder from './StateEncoder.ts'

import type { BrowserState, Episode, Step } from './types.ts'

export default class EpisodeManager {
  private currentEpisode: Episode | null = null
  private completedEpisodes: Episode[] = []
  private inactivityTimeout: number
  private maxEpisodes: number
  private inactivityTimer: ReturnType<typeof setInterval> | null = null
  stateEncoder = new StateEncoder()
  private lastActionTimestamp = 0
  private recentActionTimestamps: number[] = []
  private cachedState: BrowserState | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getView: (() => any) | null = null

  constructor(inactivityTimeoutMs = 300_000, maxEpisodes = 100) {
    this.inactivityTimeout = inactivityTimeoutMs
    this.maxEpisodes = maxEpisodes
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setViewAccessor(fn: () => any) {
    this.getView = fn
  }

  startEpisode() {
    if (this.currentEpisode) {
      this.endEpisode('abandoned')
    }
    this.cachedState = null
    this.currentEpisode = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      steps: [],
      outcome: 'in_progress',
      metadata: {},
    }
    const view = this.getView?.()
    if (view) {
      this.cachedState = this.stateEncoder.extractState(view, 0, 0)
    }
    this.startInactivityTimer()
  }

  recordAction(action: ClassifiedAction) {
    if (!this.currentEpisode) {
      this.startEpisode()
    }

    const now = Date.now()
    this.recentActionTimestamps = this.recentActionTimestamps.filter(
      t => now - t < 5000,
    )
    this.recentActionTimestamps.push(now)

    const view = this.getView?.()
    if (!view) {
      return
    }

    // Track action in state encoder
    this.stateEncoder.recordAction(action.type)

    const prevState =
      this.cachedState ??
      this.stateEncoder.extractState(
        view,
        this.lastActionTimestamp,
        this.recentActionTimestamps.length - 1,
      )

    const nextState = this.stateEncoder.extractState(
      view,
      now,
      this.recentActionTimestamps.length,
    )

    const step: Step = {
      timestamp: now,
      state: prevState,
      action: action.type,
      actionMetadata: action.metadata,
      reward: 0,
      nextState,
      terminal: false,
    }

    this.currentEpisode!.steps.push(step)
    this.lastActionTimestamp = now
    this.cachedState = nextState
    this.restartInactivityTimer()

    return {
      step,
      prevState,
      nextState,
      episodeId: this.currentEpisode!.id,
    }
  }

  get currentEpisodeId(): string | null {
    return this.currentEpisode?.id ?? null
  }

  endEpisode(outcome: Episode['outcome']) {
    if (!this.currentEpisode) {
      return
    }
    this.currentEpisode.endTime = Date.now()
    this.currentEpisode.outcome = outcome
    this.completedEpisodes.push(this.currentEpisode)
    // Evict oldest episodes if over limit
    while (this.completedEpisodes.length > this.maxEpisodes) {
      this.completedEpisodes.shift()
    }
    this.currentEpisode = null
    this.cachedState = null
    this.stopInactivityTimer()
  }

  getCompletedEpisodes(): Episode[] {
    return [...this.completedEpisodes]
  }

  getAllEpisodes(): Episode[] {
    const episodes = [...this.completedEpisodes]
    if (this.currentEpisode) {
      episodes.push(this.currentEpisode)
    }
    return episodes
  }

  get currentEpisodeStepCount(): number {
    return this.currentEpisode?.steps.length ?? 0
  }

  private startInactivityTimer() {
    this.stopInactivityTimer()
    this.inactivityTimer = setInterval(() => {
      this.checkInactivity()
    }, 30_000)
  }

  private restartInactivityTimer() {
    this.startInactivityTimer()
  }

  private stopInactivityTimer() {
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer)
      this.inactivityTimer = null
    }
  }

  private checkInactivity() {
    if (!this.currentEpisode) {
      return
    }
    const lastStep = this.currentEpisode.steps.at(-1)
    if (lastStep && Date.now() - lastStep.timestamp > this.inactivityTimeout) {
      this.endEpisode('timeout')
    }
  }

  dispose() {
    this.stopInactivityTimer()
  }
}
