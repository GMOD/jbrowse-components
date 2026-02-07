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
    console.log('DotplotGetWebGLGeometry.execute: called with', args.features?.length, 'features')
    console.log('DotplotGetWebGLGeometry.execute: first feature:', args.features?.[0])
    try {
      const result = executeDotplotWebGLGeometry(args)
      console.log('DotplotGetWebGLGeometry.execute: result=', result)
      return result
    } catch (e) {
      console.error('DotplotGetWebGLGeometry.execute: error:', e)
      throw e
    }
  }
}
