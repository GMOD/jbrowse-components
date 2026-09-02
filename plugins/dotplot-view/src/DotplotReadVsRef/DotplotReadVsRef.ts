import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingView,
  getSession,
  launchOrReplaceView,
} from '@jbrowse/core/util'

import { MIN_BORDER } from '../DotplotView/components/util.ts'
import { defaultHeight } from '../DotplotView/consts.ts'
import { buildDotplotReadVsRefSpec } from './buildDotplotReadVsRefSpec.ts'

import type { ReadVsRefLaunchArgs } from '@jbrowse/plugin-alignments'

// The session/MST half of "Dotplot of read vs ref": everything the pure spec
// builder can't do. Thrown errors propagate to the shared dialog, which shows
// them in place rather than closing.
export async function launchDotplotReadVsRef({
  primaryFeature,
  windowSize,
  track,
  replacing,
}: ReadVsRefLaunchArgs) {
  const session = getSession(track)
  const [trackAssembly] = getConf(track, 'assemblyNames') as string[]
  if (!trackAssembly) {
    throw new Error('track has no assembly')
  }
  const assembly = await session.assemblyManager.waitForAssembly(trackAssembly)
  if (!assembly) {
    throw new Error('assembly not found')
  }
  // The dotplot has no width until it is laid out, so the initial bpPerPx is
  // sized against the geometry it will come up in: the width of the view the
  // read was clicked in (the new view docks into the same column) and the
  // dotplot's own default height, each less the axis border floor.
  const { width } = getContainingView(track) as { width: number }

  const { temporaryAssembly, viewSpec } = buildDotplotReadVsRefSpec({
    feature: primaryFeature,
    windowSize,
    trackAssembly,
    plotWidth: Math.max(width - MIN_BORDER, MIN_BORDER),
    plotHeight: Math.max(defaultHeight - MIN_BORDER, MIN_BORDER),
    getCanonicalRefName: assembly.getCanonicalRefName2,
    now: () => Date.now(),
    rand: () => Math.random(),
  })

  session.addTemporaryAssembly?.(temporaryAssembly)
  await launchOrReplaceView({
    session,
    typeName: 'DotplotView',
    initialState: viewSpec,
    replacing,
  })
}
