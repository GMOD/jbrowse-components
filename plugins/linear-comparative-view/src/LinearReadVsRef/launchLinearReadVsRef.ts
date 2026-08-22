import { getConf } from '@jbrowse/core/configuration'
import { getSession, launchOrReplaceView } from '@jbrowse/core/util'

import { buildReadVsRefSpec } from './buildReadVsRefSpec.ts'

import type { ReadVsRefLaunchArgs } from '@jbrowse/plugin-alignments'

// The session/MST half of "Linear read vs ref": everything the pure spec
// builder can't do. Thrown errors propagate to the shared dialog, which shows
// them in place rather than closing.
export async function launchLinearReadVsRef({
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
  const sequenceTrackConf = getConf(assembly, 'sequence') as {
    trackId: string
  }

  const { temporaryAssembly, viewSpec } = buildReadVsRefSpec({
    primaryFeature,
    windowSize,
    trackAssembly,
    getCanonicalRefName: assembly.getCanonicalRefName2,
    sequenceTrackConf,
    now: () => Date.now(),
    rand: () => Math.random(),
  })

  session.addTemporaryAssembly?.(temporaryAssembly)
  await launchOrReplaceView({
    session,
    typeName: 'LinearSyntenyView',
    initialState: viewSpec,
    replacing,
  })
}
