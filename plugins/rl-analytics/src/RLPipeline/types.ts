import type { ActionType } from '../ActionLogger/ActionTypes.ts'

export interface BrowserState {
  // Viewport (continuous)
  bpPerPx: number
  offsetPx: number
  viewWidthPx: number

  // Genomic context
  assemblyName: string
  refName: string
  startBp: number
  endBp: number
  viewportBp: number

  // Track state
  activeTracks: string[]
  numTracks: number

  // Task context (if scavenger hunt active)
  taskActive: boolean
  targetRefName?: string
  targetStartBp?: number
  targetEndBp?: number
  distanceToTargetBp?: number
  targetVisible?: boolean
  targetFullyVisible?: boolean

  // Temporal features
  timeSinceLastAction: number
  actionsInLast5Seconds: number
}

export interface Step {
  timestamp: number
  state: BrowserState
  action: ActionType
  actionMetadata: Record<string, unknown>
  reward: number
  nextState: BrowserState
  terminal: boolean
}

export interface Episode {
  id: string
  taskId?: string
  startTime: number
  endTime?: number
  steps: Step[]
  outcome: 'completed' | 'abandoned' | 'timeout' | 'in_progress'
  metadata: {
    workerId?: string
    assignmentId?: string
    taskConfig?: TaskConfig
  }
}

export interface NavigationConstraint {
  requiredActionTypes?: string[]
  forbiddenActionTypes?: { type: string; mode: 'soft' | 'hard' }[]
  zoomRange?: { min?: number; max?: number }
  minActions?: number
  minActionDiversity?: number
}

export interface AnswerValidation {
  mode: 'exact' | 'fuzzy' | 'keyword_set' | 'any_nonempty'
  keywords?: string[]
  minLength?: number
  fuzzyThreshold?: number
}

export interface TaskConfig {
  id: string
  type:
    | 'navigate'
    | 'navigate_constrained'
    | 'action_required'
    | 'identify'
    | 'compare'
    | 'freeform'
  tier: 0 | 1 | 2 | 3 | 4
  title: string
  description: string
  hints: string[]
  target?: {
    assemblyName: string
    refName: string
    start: number
    end: number
  }
  expectedAnswer?: string
  answerChoices?: string[]
  validationFn?: string
  minTimeSeconds?: number
  maxTimeSeconds?: number
  requiredTracks?: string[]
  completionReward: number
  requiredAwards?: string[]
  navigationConstraints?: NavigationConstraint
  searchPenalty?: number
  awardOnComplete?: string
  answerValidation?: AnswerValidation
  maxRetries?: number
  autoAdvanceOnFail?: boolean
  coaching?: {
    message: string
    highlightElement?: string
  }
}

export interface AwardDefinition {
  id: string
  name: string
  description: string
  flavorText?: string
  triggerCondition: {
    type: 'action_type' | 'state_threshold' | 'task_complete' | 'keyword_match'
    actionType?: string
    stateField?: string
    threshold?: number
    comparator?: 'lt' | 'gt' | 'eq'
    keywords?: string[]
  }
}
