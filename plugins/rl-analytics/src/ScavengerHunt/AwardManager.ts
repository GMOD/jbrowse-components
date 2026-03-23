import { ActionType, type ClassifiedAction } from '../ActionLogger/ActionTypes.ts'

import type { AwardDefinition, BrowserState } from '../RLPipeline/types.ts'

export type AwardCallback = (award: AwardDefinition) => void

export default class AwardManager {
  private awards: AwardDefinition[] = []
  private earned = new Set<string>()
  private callbacks: AwardCallback[] = []
  private actionHistory: ActionType[] = []
  private keywordBuffer: string[] = []

  loadAwards(awards: AwardDefinition[]) {
    this.awards = awards
  }

  onAwardEarned(cb: AwardCallback) {
    this.callbacks.push(cb)
  }

  getEarnedAwards(): string[] {
    return [...this.earned]
  }

  hasAward(id: string): boolean {
    return this.earned.has(id)
  }

  hasAllAwards(ids: string[]): boolean {
    return ids.every(id => this.earned.has(id))
  }

  /** Check awards after an action is recorded */
  checkAction(action: ClassifiedAction, state: BrowserState) {
    this.actionHistory.push(action.type)

    for (const award of this.awards) {
      if (this.earned.has(award.id)) {
        continue
      }
      if (this.checkTrigger(award, action, state)) {
        this.earn(award)
      }
    }
  }

  /** Check awards after a text answer is submitted */
  checkTextAnswer(text: string) {
    this.keywordBuffer.push(text.toLowerCase())

    for (const award of this.awards) {
      if (this.earned.has(award.id)) {
        continue
      }
      if (
        award.triggerCondition.type === 'keyword_match' &&
        award.triggerCondition.keywords
      ) {
        const allText = this.keywordBuffer.join(' ')
        const matches = award.triggerCondition.keywords.filter(kw =>
          allText.includes(kw.toLowerCase()),
        )
        if (matches.length >= 2) {
          this.earn(award)
        }
      }
    }
  }

  /** Force-grant an award (e.g., from awardOnComplete) */
  grant(awardId: string) {
    const award = this.awards.find(a => a.id === awardId)
    if (award && !this.earned.has(awardId)) {
      this.earn(award)
    }
  }

  private checkTrigger(
    award: AwardDefinition,
    action: ClassifiedAction,
    state: BrowserState,
  ): boolean {
    const { triggerCondition } = award

    switch (triggerCondition.type) {
      case 'action_type':
        return action.type === triggerCondition.actionType

      case 'state_threshold': {
        const field = triggerCondition.stateField as keyof BrowserState
        const value = state[field]
        if (typeof value !== 'number' || triggerCondition.threshold === undefined) {
          return false
        }
        switch (triggerCondition.comparator) {
          case 'lt':
            return value < triggerCondition.threshold
          case 'gt':
            return value > triggerCondition.threshold
          case 'eq':
            return value === triggerCondition.threshold
          default:
            return false
        }
      }

      default:
        return false
    }
  }

  private earn(award: AwardDefinition) {
    this.earned.add(award.id)
    for (const cb of this.callbacks) {
      try {
        cb(award)
      } catch {
        // don't break
      }
    }
  }

  reset() {
    this.earned.clear()
    this.actionHistory = []
    this.keywordBuffer = []
  }
}
