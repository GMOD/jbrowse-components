import { applyDisplayOpts } from './applyTrackOpts.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The snapshot each modifier list hands launchTrack, and the read filter it
// writes onto the opened display. What a real display makes of a read filter
// is readFilterModifiers.test.ts.

// `configured`, given, is the display config of a display with no
// `setFilterFields`, as every one but alignments is
function fakeView(configured?: Record<string, unknown>) {
  const calls: unknown[] = []
  const filters: unknown[] = []
  const display = configured
    ? {}
    : {
        setFilterFields(patch: unknown) {
          filters.push(patch)
        },
      }
  const track = {
    configuration: { trackId: 't' },
    displays: [display],
    activeDisplay: { configuration: configured ?? {} },
  }
  const view = {
    centerLineInfo: undefined,
    tracks: [] as (typeof track)[],
    showTrack(_id: string, _t: unknown, snap: unknown) {
      calls.push(snap)
      return track
    },
    async launchTrack(_id: string, _t: unknown, snap: unknown) {
      calls.push(snap)
      view.tracks = [track]
      return track
    },
  }
  return { view: view as unknown as LinearGenomeViewModel, calls, filters }
}

// A filter in the open snapshot would replace the configured list, so every
// display takes it by field once open
test("a feature track's filter merges by field, its shorthand read", async () => {
  const { view, calls } = fakeView({})
  await applyDisplayOpts(view, 't', 'LinearBasicDisplay', [
    '{"filter":["geneLike"]}',
  ])
  expect(calls).toEqual([{}, { filter: [{ field: 'geneLike', equal: true }] }])
})

test("a variant track's launch filter keeps the configured fields it does not name", async () => {
  const { view, calls } = fakeView({
    filter: [
      { field: 'minorAlleleFrequency', gte: 0.05 },
      { field: 'QUAL', gte: 10 },
    ],
  })
  await applyDisplayOpts(view, 't', 'LinearVariantDisplay', [
    '{"filter":[{"field":"QUAL","gte":30}]}',
  ])
  expect(calls.at(-1)).toEqual({
    filter: [
      { field: 'minorAlleleFrequency', gte: 0.05 },
      { field: 'QUAL', gte: 30 },
    ],
  })
})

// A read filter in the open snapshot would replace the configured list, so it
// is written onto the opened display by field instead
test('a read filter follows the open, the other settings ride the snapshot', async () => {
  const { view, calls, filters } = fakeView()
  await applyDisplayOpts(view, 't', 'LinearAlignmentsDisplay', [
    'height:400',
    'split:only',
  ])
  expect(calls).toEqual([{ height: 400 }])
  expect(filters).toEqual([{ split: [{ field: 'split', equal: true }] }])
})

test('every read filter modifier lands in the one write after the open', async () => {
  const { view, calls, filters } = fakeView()
  await applyDisplayOpts(view, 't', 'LinearAlignmentsDisplay', [
    'mapq:20',
    'filterTag:RG:lane3',
    'filterTag:RG:lane4',
    'alone:all',
  ])
  expect(calls).toEqual([{}])
  expect(filters).toEqual([
    {
      mapq: [{ field: 'mapq', gte: 20 }],
      'tags.RG': [{ field: 'tags.RG', oneOf: ['lane3', 'lane4'] }],
      alone: [],
    },
  ])
})

describe("batch's one-row junction", () => {
  it('draws an alignments track’s read arcs, the SV evidence first, unless the track says otherwise', async () => {
    const snapOf = async (
      modifiers: string[],
      displayType = 'LinearAlignmentsDisplay',
    ) => {
      const { view, calls } = fakeView()
      await applyDisplayOpts(view, 't', displayType, modifiers, undefined, true)
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
    expect(await snapOf([], 'LinearBasicDisplay')).toEqual({})
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
    await applyDisplayOpts(view, 't', 'LinearAlignmentsDisplay', [], sortAt)
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
      await applyDisplayOpts(
        view,
        't',
        'LinearAlignmentsDisplay',
        [modifier],
        sortAt,
      )
      expect(calls[0]).toEqual({
        ...expected,
        sort: { ...sortAt, refName: 'chr3' },
      })
    }
  })

  it('yields to a sort the track states', async () => {
    const { view, calls } = sortableView()
    await applyDisplayOpts(
      view,
      't',
      'LinearAlignmentsDisplay',
      ['sort:strand'],
      sortAt,
    )
    expect(calls[0]).toMatchObject({
      sort: { field: 'strand' },
      heightMode: 'grow',
      growMaxHeight: 250,
    })
  })

  it('leaves a track of another kind alone', async () => {
    const { view, calls } = sortableView()
    await applyDisplayOpts(view, 't', 'LinearVariantDisplay', [], sortAt)
    expect(calls[0]).toEqual({})
  })
})

test('a track the view could not open names the display it was asked for', async () => {
  const { view } = fakeView()
  ;(view as { launchTrack: unknown }).launchTrack = async () => undefined
  await expect(
    applyDisplayOpts(view, 't', 'LinearAlignmentsDisplay', ['display:marks']),
  ).rejects.toThrow('Failed to open track "t" with display "LinearMarkDisplay"')
})
