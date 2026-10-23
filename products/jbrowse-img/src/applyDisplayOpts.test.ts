import { applyDisplayOpts } from './applyTrackOpts.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The snapshot each modifier list hands launchTrack, and the read filter it
// writes onto the opened display. What a real display makes of a read filter
// is readFilterModifiers.test.ts.

function fakeView() {
  const calls: unknown[] = []
  const filters: unknown[] = []
  const display = {
    applyFilterObject(filter: unknown) {
      filters.push(filter)
    },
  }
  const view = {
    centerLineInfo: undefined,
    showTrack(_id: string, _t: unknown, snap: unknown) {
      calls.push(snap)
      return { displays: [display] }
    },
    async launchTrack(_id: string, _t: unknown, snap: unknown) {
      calls.push(snap)
      return { displays: [display] }
    },
  }
  return { view: view as unknown as LinearGenomeViewModel, calls, filters }
}

test("a feature track's filter object rides in on the snapshot", async () => {
  const { view, calls } = fakeView()
  await applyDisplayOpts(view, 't', 'feature', ['{"filter":["geneLike"]}'])
  expect(calls[0]).toEqual({ filter: ['geneLike'] })
})

// A read filter in the open snapshot would replace the configured list, so it
// is written onto the opened display by field instead
test('a read filter follows the open, the other settings ride the snapshot', async () => {
  const { view, calls, filters } = fakeView()
  await applyDisplayOpts(view, 't', 'alignments', ['height:400', 'split:only'])
  expect(calls).toEqual([{ height: 400 }])
  expect(filters).toEqual([{ split: 'only' }])
})

test('every read filter modifier lands in the one write after the open', async () => {
  const { view, calls, filters } = fakeView()
  await applyDisplayOpts(view, 't', 'alignments', [
    'mapq:20',
    'filterTag:RG:lane3',
  ])
  expect(calls).toEqual([{}])
  expect(filters).toEqual([
    { minMapq: 20, tags: [{ tag: 'RG', value: 'lane3' }] },
  ])
})

describe("batch's one-row junction", () => {
  it('draws an alignments track’s read arcs, the SV evidence first, unless the track says otherwise', async () => {
    const snapOf = async (modifiers: string[], category = 'alignments') => {
      const { view, calls } = fakeView()
      await applyDisplayOpts(
        view,
        't',
        category as 'alignments',
        modifiers,
        undefined,
        true,
      )
      return calls[0]
    }
    expect(await snapOf([])).toEqual({
      readConnections: { show: true, mark: 'link' },
      sort: 'svSignal',
    })
    expect(await snapOf(['arcs:off', 'sort=position'])).toEqual({
      readConnections: { show: false },
      sort: 'position',
    })
    expect(await snapOf(['{"readConnections":{"height":100}}'])).toEqual({
      readConnections: { show: true, mark: 'link', height: 100 },
      sort: 'svSignal',
    })
    expect(await snapOf([], 'feature')).toEqual({})
  })
})

describe("batch's per-record sort", () => {
  const sortAt = { field: 'insertion', pos: 3000 } as const
  const center = { refName: 'chr3', assemblyName: 'hg38', offset: 2960 }

  function sortableView() {
    const { view, calls } = fakeView()
    Object.assign(view, {
      displayedRegions: [
        { refName: 'chr3', assemblyName: 'hg38', start: 2959, end: 3040 },
      ],
      centerLineInfo: center,
    })
    return { view, calls }
  }

  it('sorts an alignments track at the variant, in the view’s refName', async () => {
    const { view, calls } = sortableView()
    await applyDisplayOpts(view, 't', 'alignments', [], sortAt)
    expect(calls[0]).toEqual({
      sort: { ...sortAt, refName: 'chr3' },
      heightMode: 'grow',
      growMaxHeight: 250,
    })
  })

  it('grows the track to its pileup unless the track states a height', async () => {
    for (const [modifier, expected] of [
      ['height:300', { height: 300 }],
      ['heightMode:fit', { heightMode: 'fit' }],
    ] as const) {
      const { view, calls } = sortableView()
      await applyDisplayOpts(view, 't', 'alignments', [modifier], sortAt)
      expect(calls[0]).toEqual({
        ...expected,
        sort: { ...sortAt, refName: 'chr3' },
      })
    }
  })

  it('yields to a sort the track states', async () => {
    const { view, calls } = sortableView()
    await applyDisplayOpts(view, 't', 'alignments', ['sort:strand'], sortAt)
    expect(calls[0]).toMatchObject({
      sort: { field: 'strand' },
      heightMode: 'grow',
      growMaxHeight: 250,
    })
  })

  it('leaves a track of another kind alone', async () => {
    const { view, calls } = sortableView()
    await applyDisplayOpts(view, 't', 'variant', [], sortAt)
    expect(calls[0]).toEqual({})
  })
})

test('a track the view could not open names the display it was asked for', async () => {
  const { view } = fakeView()
  ;(view as { launchTrack: unknown }).launchTrack = async () => undefined
  await expect(
    applyDisplayOpts(view, 't', 'alignments', ['display:marks']),
  ).rejects.toThrow('Failed to open track "t" with display "LinearMarkDisplay"')
})
