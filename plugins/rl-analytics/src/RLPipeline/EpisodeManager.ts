import type { ClassifiedAction } from '../ActionLogger/ActionTypes.ts'

import RewardCalculator from './RewardCalculator.ts'
import StateEncoder from './StateEncoder.ts'

import type { BrowserState, Episode, Step, TaskConfig } from './types.ts'

export default class EpisodeManager {
  private currentEpisode: Episode | null = null
  private completedEpisodes: Episode[] = []
  private inactivityTimeout: number
  private inactivityTimer: ReturnType<typeof setInterval> | null = null
  private stateEncoder = new StateEncoder()
  private rewardCalculator = new RewardCalculator()
  private lastActionTimestamp = 0
  private recentActionTimestamps: number[] = []
  private cachedState: BrowserState | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getView: (() => any) | null = null
  private activeTaskConfig?: TaskConfig

  constructor(inactivityTimeoutMs = 300_000) {
    this.inactivityTimeout = inactivityTimeoutMs
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setViewAccessor(fn: () => any) {
    this.getView = fn
  }

  setTaskConfig(taskConfig?: TaskConfig) {
    this.activeTaskConfig = taskConfig
  }

  startEpisode(taskConfig?: TaskConfig) {
    if (this.currentEpisode) {
      this.endEpisode('abandoned')
    }
    this.activeTaskConfig = taskConfig
    this.rewardCalculator.reset()
    this.cachedState = null
    this.currentEpisode = {
      id: crypto.randomUUID(),
      taskId: taskConfig?.id,
      startTime: Date.now(),
      steps: [],
      outcome: 'in_progress',
      metadata: { taskConfig },
    }
    // Capture initial state
    const view = this.getView?.()
    if (view) {
      this.cachedState = this.stateEncoder.extractState(
        view,
        0,
        0,
        this.activeTaskConfig,
      )
    }
    this.startInactivityTimer()
  }

  recordAction(action: ClassifiedAction) {
    if (!this.currentEpisode) {
      this.startEpisode(this.activeTaskConfig)
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

    // prevState comes from cache (state BEFORE this patch)
    // If no cache, extract current (best effort — first step of episode)
    const prevState =
      this.cachedState ??
      this.stateEncoder.extractState(
        view,
        this.lastActionTimestamp,
        this.recentActionTimestamps.length - 1,
        this.activeTaskConfig,
      )

    // nextState is the current view state (patch already applied)
    const nextState = this.stateEncoder.extractState(
      view,
      now,
      this.recentActionTimestamps.length,
      this.activeTaskConfig,
    )

    const reward = this.rewardCalculator.calculate(
      prevState,
      action,
      nextState,
      this.activeTaskConfig,
    )

    const terminal =
      this.activeTaskConfig?.type === 'navigate' &&
      !!nextState.targetFullyVisible

    const step: Step = {
      timestamp: now,
      state: prevState,
      action: action.type,
      actionMetadata: action.metadata,
      reward,
      nextState,
      terminal,
    }

    this.currentEpisode!.steps.push(step)
    this.lastActionTimestamp = now
    // Cache current state as prevState for next action
    this.cachedState = nextState
    this.restartInactivityTimer()

    if (terminal) {
      this.endEpisode('completed')
    }
  }

  endEpisode(outcome: Episode['outcome']) {
    if (!this.currentEpisode) {
      return
    }
    this.currentEpisode.endTime = Date.now()
    this.currentEpisode.outcome = outcome
    this.completedEpisodes.push(this.currentEpisode)
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
