import type { AwardDefinition, TaskConfig } from '../../RLPipeline/types.ts'

export interface TaskSet {
  id: string
  name: string
  description: string
  version?: string
  tasks: TaskConfig[]
  randomizeOrder: boolean
  randomizeWithinTier?: boolean
  attentionCheckIndices: number[]
  awards?: AwardDefinition[]
  defaultView?: {
    refName: string
    start: number
    end: number
    tracks: string[]
  }
}

export interface ValidationResult {
  valid: boolean
  reason?: string
  searchUsed?: boolean
}
