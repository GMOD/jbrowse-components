import type { Feature } from '@jbrowse/core/util'

export type AlignmentOpsById = ReadonlyMap<string, Uint32Array>

export const NO_OPS: AlignmentOpsById = new Map()

export interface LaneLinks {
  links: Feature[]
  ops: AlignmentOpsById
}

export function lanePairKey(upper: string, lower: string) {
  return `${upper}|${lower}`
}
