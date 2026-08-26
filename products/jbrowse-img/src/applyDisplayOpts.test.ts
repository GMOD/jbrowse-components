import { applyDisplayOpts } from './applyTrackOpts.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// `filterBy` is the one modifier target that is EDITED rather than stated, so it
// cannot ride in on the display snapshot: the slot is `frozen`, and showTrack
// writes a frozen slot by replacing the whole object. These pin that it reaches
// the display through its own action instead, and composes with what the track's
// config already said.

function fakeView(configured: Record<string, unknown> = {}) {
  const display = {
    filterBy: { flagInclude: 0, flagExclude: 1540, ...configured },
    setFilterBy(f: unknown) {
      this.filterBy = f as typeof this.filterBy
    },
  }
  const calls: unknown[] = []
  const view = {
    centerLineInfo: undefined,
    showTrack(_id: string, _t: unknown, snap: unknown) {
      calls.push(snap)
      return { displays: [display] }
    },
  }
  return { view: view as unknown as LinearGenomeViewModel, display, calls }
}

test('a category edit leaves the flag masks the track config set', () => {
  // The shape five of the cancer_sv figure specs in this repo use: drop
  // secondary as well. It came back as the schema default 1540, with those
  // alignments silently restored.
  const { view, display } = fakeView({ flagExclude: 1796 })
  applyDisplayOpts(view, 'reads_vs_der3', 'alignments', ['split:only'])
  expect(display.filterBy).toMatchObject({ flagExclude: 1796, split: 'only' })
})

test('an omitted half of flags keeps the configured mask, as the doc claims', () => {
  const { view, display } = fakeView({ flagInclude: 2, flagExclude: 1796 })
  applyDisplayOpts(view, 't', 'alignments', ['flags::256'])
  expect(display.filterBy).toMatchObject({ flagInclude: 2, flagExclude: 256 })
})

test('a tag filter is a second condition, not a replacement', () => {
  const { view, display } = fakeView({
    tagFilters: [{ tag: 'HP', value: '1' }],
  })
  applyDisplayOpts(view, 't', 'alignments', ['filterTag:RG:lane3'])
  expect(display.filterBy.tagFilters).toEqual([
    { tag: 'HP', value: '1' },
    { tag: 'RG', value: 'lane3' },
  ])
})

test('filterBy is kept out of the snapshot showTrack replaces slots from', () => {
  const { view, calls } = fakeView()
  applyDisplayOpts(view, 't', 'alignments', ['height:400', 'split:only'])
  expect(calls[0]).toEqual({ height: 400 })
})

test('a display with no filterBy says so rather than dropping the option', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  const view = {
    centerLineInfo: undefined,
    showTrack: () => ({ displays: [{}] }),
  } as unknown as LinearGenomeViewModel
  applyDisplayOpts(view, 'wiggle_track', 'alignments', ['split:only'])
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('has no filterBy'))
  warn.mockRestore()
})
