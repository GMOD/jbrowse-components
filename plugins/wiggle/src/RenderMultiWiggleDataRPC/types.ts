import type { WiggleFeatureArrays } from '../util.ts'

export type MultiWiggleSourceData = WiggleFeatureArrays & {
  name: string
  color?: string
}

export interface MultiWiggleDataResult {
  sources: MultiWiggleSourceData[]
}
