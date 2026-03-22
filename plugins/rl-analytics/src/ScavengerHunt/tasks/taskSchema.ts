import type { TaskConfig } from '../../RLPipeline/types.ts'

export interface TaskSet {
  id: string
  name: string
  description: string
  tasks: TaskConfig[]
  randomizeOrder: boolean
  attentionCheckIndices: number[]
}

export interface ValidationResult {
  valid: boolean
  reason?: string
}
