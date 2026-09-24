import { recordPatches } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { createViewState } from './index.ts'

jest.mock('./makeWorkerInstance', () => () => {})

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        { refName: 'ctgA', uniqueId: 'x', start: 0, end: 8, seq: 'cattgttg' },
      ],
    },
  },
}

const ID = 'cohort'
const track = {
  type: 'VariantTrack',
  trackId: ID,
  name: 'Cohort',
  assemblyNames: ['volvox'],
  adapter: { type: 'VcfTabixAdapter', uri: 'cohort.vcf.gz' },
  displays: [
    {
      type: 'LinearMultiSampleVariantDisplay',
      displayId: `${ID}-LinearMultiSampleVariantDisplay`,
    },
  ],
}

interface SampleDisplay {
  adapterConfig: Record<string, unknown>
  adapterSamples: { name: string }[] | undefined
  setSources: (sources: { name: string }[]) => void
  setRowOrder: (rows: { name: string }[]) => void
}

// An undo rebuilds the track's working copy, so the display holds an equal
// adapter config that is a new object, and the sample-list read declines to
// run again for it.
test.each(['session', 'config'] as const)(
  'undoing a reorder on a %s track keeps its sample list',
  async kind => {
    const state = createViewState({
      assembly,
      tracks: kind === 'config' ? [track] : [],
    })
    if (kind === 'session') {
      const session = state.session as unknown as {
        addSessionTrackConf: (conf: Record<string, unknown>) => unknown
      }
      session.addSessionTrackConf(track)
    }
    const { view } = state.session
    view.showTrack(ID)
    await waitFor(() => {
      expect(view.getTrack(ID)).toBeTruthy()
    })
    const display = () =>
      view.getTrack(ID)!.displays[0] as unknown as SampleDisplay
    display().setSources([{ name: 'A' }, { name: 'B' }])
    const before = display().adapterConfig

    const recorder = recordPatches(state.session)
    display().setRowOrder([{ name: 'B' }, { name: 'A' }])
    recorder.stop()
    recorder.undo()

    expect(display().adapterConfig).not.toBe(before)
    expect(display().adapterSamples?.map(s => s.name)).toEqual(['A', 'B'])
  },
)
