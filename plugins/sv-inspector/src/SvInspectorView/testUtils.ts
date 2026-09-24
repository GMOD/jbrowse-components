import { createTestSession } from '@jbrowse/web/testUtils'

import type { SvInspectorViewModel } from './model.ts'

const volvox = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: ['ctgA', 'ctgB'].map(refName => ({
        refName,
        uniqueId: refName,
        start: 0,
        end: 10_000,
        seq: 'a'.repeat(10_000),
      })),
    },
  },
}

export async function openInspector(snap: Record<string, unknown> = {}) {
  const session = createTestSession()
  session.addAssemblyConf(volvox)
  const view = (await session.launchView(
    'SvInspectorView',
    snap,
  )) as SvInspectorViewModel
  view.setWidth(1004)
  return { session, view }
}
