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

export interface TaskConfig {
  id: string
  type: 'navigate' | 'identify' | 'compare' | 'freeform'
  tier: 1 | 2 | 3
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
}
