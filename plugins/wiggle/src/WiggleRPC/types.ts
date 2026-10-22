import type { Source } from '../util.ts'
import type { Region } from '@jbrowse/core/util'
import type { ScaleTypeCode } from '@jbrowse/render-core/scoreScale'

// The display's log or symlog y scale, resolved as it draws: the domain and the
// symlog constant resolved from it. Absent on a linear axis.
export interface MatrixScale {
  scaleType: ScaleTypeCode
  domain: readonly [number, number]
  symlogConstant: number
}

export interface GetScoreMatrixArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  bpPerPx: number
  sources: Source[]
  yField?: string
  scale?: MatrixScale
}
