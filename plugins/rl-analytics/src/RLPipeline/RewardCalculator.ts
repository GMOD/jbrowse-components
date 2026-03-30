import type { ClassifiedAction } from '../ActionLogger/ActionTypes.ts'
import { ActionType } from '../ActionLogger/ActionTypes.ts'

import type { BrowserState } from './types.ts'

/**
 * Reward calculator for unsupervised exploration.
 *
 * Without task-specific goals, reward signals are:
 * - Small per-step cost (encourages efficiency)
 * - Oscillation penalty (back-and-forth is confusion)
 * - For offline RL, reward can be reshaped post-hoc from the exported data.
 */
export default class RewardCalculator {
  private recentActions: ActionType[] = []

  calculate(
    _prevState: BrowserState,
    action: ClassifiedAction,
    _nextState: BrowserState,
  ): number {
    let reward = 0

    // Per-step cost
    reward -= 0.01

    // Oscillation penalty
    if (this.isOscillation(action)) {
      reward -= 0.5
    }

    return reward
  }

  private isOscillation(action: ClassifiedAction): boolean {
    this.recentActions.push(action.type)
    if (this.recentActions.length > 6) {
      this.recentActions.shift()
    }

    if (this.recentActions.length >= 4) {
      const last4 = this.recentActions.slice(-4)
      if (
        last4[0] === last4[2] &&
        last4[1] === last4[3] &&
        last4[0] !== last4[1]
      ) {
        return true
      }
    }
    return false
  }

  reset() {
    this.recentActions = []
  }
}
