import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'

import { MIN_BORDER } from '../DotplotView/components/util.ts'
import { defaultHeight } from '../DotplotView/model.ts'
import { buildDotplotReadVsRefSpec } from './buildDotplotReadVsRefSpec.ts'

import type { Feature } from '@jbrowse/core/util'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'

export function onClick(feature: Feature, self: LinearAlignmentsDisplayModel) {
  const session = getSession(self)
  try {
    const { parentTrack } = self
    const [trackAssembly] = getConf(parentTrack, 'assemblyNames') as string[]
    if (!trackAssembly) {
      throw new Error('track has no assembly')
    }
    // The dotplot has no width until it is laid out, so the initial bpPerPx is
    // sized against the geometry it will come up in: the width of the view the
    // read was clicked in (the new view docks into the same column) and the
    // dotplot's own default height, each less the axis border floor.
    const { width } = getContainingView(self) as { width: number }
    const assembly = session.assemblyManager.get(trackAssembly)

    const { temporaryAssembly, viewSpec } = buildDotplotReadVsRefSpec({
      feature,
      trackAssembly,
      plotWidth: Math.max(width - MIN_BORDER, MIN_BORDER),
      plotHeight: Math.max(defaultHeight - MIN_BORDER, MIN_BORDER),
      getCanonicalRefName: refName => assembly?.getCanonicalRefName(refName),
      now: () => Date.now(),
    })

    session.addTemporaryAssembly?.(temporaryAssembly)
    session.addView('DotplotView', viewSpec)
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}
