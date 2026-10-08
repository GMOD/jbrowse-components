import { applyDisplayOpts } from './applyTrackOpts.ts'

import type { ReadFilterSnapshot } from './applyTrackOpts.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// `filterBy` is the one modifier target that is EDITED rather than stated, so it
// cannot ride in on the display snapshot: the slot is `frozen`, and showTrack
// writes a frozen slot by replacing the whole object. These pin that it reaches
// the display through its own action instead, and composes with what the track's
// config already said.

function fakeView(configured: ReadFilterSnapshot = {}) {
  const display = {
    readFilter: {
      flagInclude: 0,
      flagExclude: 1540,
      ...configured,
    } as ReadFilterSnapshot,
    setReadFilter(f: unknown) {
      this.readFilter = f as typeof this.readFilter
    },
  }
  const calls: unknown[] = []
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
  return { view: view as unknown as LinearGenomeViewModel, display, calls }
}

test('a category edit leaves the flag masks the track config set', async () => {
  // The shape five of the cancer_sv figure specs in this repo use: drop
  // secondary as well. It came back as the schema default 1540, with those
  // alignments silently restored.
  const { view, display } = fakeView({ flagExclude: 1796 })
  await applyDisplayOpts(view, 'reads_vs_der3', 'alignments', ['split:only'])
  expect(display.readFilter).toMatchObject({ flagExclude: 1796, split: 'only' })
})

test('an omitted half of flags keeps the configured mask, as the doc claims', async () => {
  const { view, display } = fakeView({ flagInclude: 2, flagExclude: 1796 })
  await applyDisplayOpts(view, 't', 'alignments', ['flags::256'])
  expect(display.readFilter).toMatchObject({ flagInclude: 2, flagExclude: 256 })
})

test('a tag filter is a second condition, not a replacement', async () => {
  const { view, display } = fakeView({
    tagFilters: [{ tag: 'HP', value: '1' }],
  })
  await applyDisplayOpts(view, 't', 'alignments', ['filterTag:RG:lane3'])
  expect(display.readFilter.tagFilters).toEqual([
    { tag: 'HP', value: '1' },
    { tag: 'RG', value: 'lane3' },
  ])
})

test('filterBy is kept out of the snapshot showTrack replaces slots from', async () => {
  const { view, calls } = fakeView()
  await applyDisplayOpts(view, 't', 'alignments', ['height:400', 'split:only'])
  expect(calls[0]).toEqual({ height: 400 })
})

describe("batch's per-record sort", () => {
  const sortAt = { type: 'insertion', pos: 3000 } as const
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
      sortedBy: { ...sortAt, refName: 'chr3', assemblyName: 'hg38' },
    })
  })

  it('yields to a sort the track states', async () => {
    const { view, calls } = sortableView()
    await applyDisplayOpts(view, 't', 'alignments', ['sort:strand'], sortAt)
    expect(calls[0]).toMatchObject({ sortedBy: { type: 'strand' } })
  })

  it('leaves a track of another kind alone', async () => {
    const { view, calls } = sortableView()
    await applyDisplayOpts(view, 't', 'variant', [], sortAt)
    expect(calls[0]).toEqual({})
  })
})

test('a display with no filterBy says so rather than dropping the option', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  const view = {
    centerLineInfo: undefined,
    showTrack: () => ({ displays: [{}] }),
    launchTrack: async () => ({ displays: [{}] }),
  } as unknown as LinearGenomeViewModel
  await applyDisplayOpts(view, 'wiggle_track', 'alignments', ['split:only'])
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('has no read filter'),
  )
  warn.mockRestore()
})

test('a track the view could not open names the display it was asked for', async () => {
  const { view } = fakeView()
  ;(view as { launchTrack: unknown }).launchTrack = async () => undefined
  await expect(
    applyDisplayOpts(view, 't', 'alignments', ['display:marks']),
  ).rejects.toThrow('Failed to open track "t" with display "LinearMarkDisplay"')
})
