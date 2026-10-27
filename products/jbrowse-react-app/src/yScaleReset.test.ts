import { waitFor } from '@testing-library/react'

import createViewState from './createViewState.ts'

jest.mock('./makeWorkerInstance', () => () => {})

const assemblies = [
  {
    name: 'volvox',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox_refseq',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'a',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  },
]

interface ScaleDisplay {
  manualMaxScore: number | undefined
  scaleTitle: string
  scoreRules: { value: number }[]
  setMaxScore: (max: number) => void
  setScoreRules: (rules: number[]) => void
  resetYScale: () => void
}

interface View {
  launchTrack: (trackId: string) => Promise<unknown>
  getTrack: (trackId: string) => { displays: ScaleDisplay[] } | undefined
}

interface Session {
  addSessionTrackConf: (conf: Record<string, unknown>) => unknown
  addView: (type: string, snap: Record<string, unknown>) => View
}

const y = { scale: { domainMax: 9 }, axis: { title: 'AF' }, rules: [3] }

// the alignments display's value axis is its coverage band's
const baseOf = (displayType: string) =>
  displayType === 'LinearAlignmentsDisplay'
    ? { coverage: { encoding: { y } } }
    : { encoding: { y } }

test.each([
  ['QuantitativeTrack', 'LinearWiggleDisplay', 'BigWigAdapter', 'config'],
  ['AlignmentsTrack', 'LinearAlignmentsDisplay', 'BamAdapter', 'config'],
  ['FeatureTrack', 'LinearMarkDisplay', 'BedTabixAdapter', 'config'],
  ['QuantitativeTrack', 'LinearWiggleDisplay', 'BigWigAdapter', 'session'],
])(
  'a %s base written encoding.y is what its %s resets to (%s, %s base)',
  async (type, displayType, adapterType, source) => {
    const track = {
      type,
      trackId: 't',
      name: 't',
      assemblyNames: ['volvox'],
      adapter: { type: adapterType, uri: 'x' },
      displays: [
        {
          type: displayType,
          displayId: `t-${displayType}`,
          ...baseOf(displayType),
        },
      ],
    }
    const state = createViewState({
      config: {
        assemblies,
        tracks: source === 'config' ? [track] : [],
      },
    })
    const session = state.session as unknown as Session
    if (source === 'session') {
      session.addSessionTrackConf(track)
    }
    const view = session.addView('LinearGenomeView', {
      displayedRegions: [
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10 },
      ],
    })
    await view.launchTrack('t')
    await waitFor(() => {
      expect(view.getTrack('t')).toBeTruthy()
    })
    const display = view.getTrack('t')!.displays[0]!
    display.setMaxScore(50)
    display.setScoreRules([])
    display.resetYScale()
    expect(display.manualMaxScore).toBe(9)
    expect(display.scaleTitle).toBe('AF')
    expect(display.scoreRules).toEqual([{ value: 3 }])
  },
)
