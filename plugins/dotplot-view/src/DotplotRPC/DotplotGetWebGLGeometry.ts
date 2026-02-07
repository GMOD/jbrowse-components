import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import { executeDotplotWebGLGeometry } from './executeDotplotWebGLGeometry.ts'

import type { DotplotFeatureData } from './executeDotplotWebGLGeometry.ts'
import type { ViewSnap } from '@jbrowse/core/util'

export default class DotplotGetWebGLGeometry extends RpcMethodType {
  name = 'DotplotGetWebGLGeometry'

  async execute(
    args: {
      features: DotplotFeatureData[]
      hViewSnap: ViewSnap
      vViewSnap: ViewSnap
      height: number
      minAlignmentLength?: number
    },
  ) {
    return executeDotplotWebGLGeometry(args)
  }
}
