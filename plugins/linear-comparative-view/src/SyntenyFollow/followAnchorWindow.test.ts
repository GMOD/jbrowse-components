import {
  followAnchorWindow,
  followAnchorWindows,
  followPlacedWindows,
} from './followAnchorWindow.ts'

import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

function block({
  refName,
  start,
  end,
  widthPx,
}: {
  refName: string
  start: number
  end: number
  widthPx: number
}): ContentBlock {
  return {
    type: 'ContentBlock',
    key: `${refName}:${start}-${end}`,
    offsetPx: 0,
    widthPx,
    assemblyName: 'hg002mat',
    refName,
    start,
    end,
  }
}

test('a panel showing one contig yields that contig and its visible span', () => {
  expect(
    followAnchorWindow([
      block({ refName: 'chr1', start: 100, end: 200, widthPx: 800 }),
    ]),
  ).toEqual({
    refName: 'chr1',
    start: 100,
    end: 200,
  })
})

test('an empty panel has no window', () => {
  expect(followAnchorWindow([])).toBeUndefined()
})

test('blocks of one contig union into a single span', () => {
  // a contig split by an inter-region padding block still reads as one stretch
  expect(
    followAnchorWindow([
      block({ refName: 'chr1', start: 100, end: 200, widthPx: 400 }),
      block({ refName: 'chr1', start: 300, end: 500, widthPx: 400 }),
    ]),
  ).toMatchObject({ refName: 'chr1', start: 100, end: 500 })
})

test('the contig occupying the most screen wins, not the most bp', () => {
  // the huge contig is off in a corner of the viewport; the eye reads the view
  // as being on the small one, and so does the follow
  expect(
    followAnchorWindow([
      block({ refName: 'chrBig', start: 0, end: 10_000_000, widthPx: 50 }),
      block({ refName: 'chrSmall', start: 0, end: 1000, widthPx: 750 }),
    ]),
  ).toMatchObject({ refName: 'chrSmall' })
})

test('summed width decides, not the widest single block', () => {
  expect(
    followAnchorWindow([
      block({ refName: 'chrA', start: 0, end: 100, widthPx: 300 }),
      block({ refName: 'chrA', start: 200, end: 300, widthPx: 300 }),
      block({ refName: 'chrB', start: 0, end: 100, widthPx: 400 }),
    ]),
  ).toMatchObject({ refName: 'chrA', start: 0, end: 300 })
})

test('a panel showing several contigs yields one window each, widest first', () => {
  expect(
    followAnchorWindows([
      block({ refName: 'chr2', start: 0, end: 1000, widthPx: 200 }),
      block({ refName: 'chr1', start: 0, end: 3000, widthPx: 600 }),
    ]),
  ).toEqual([
    { refName: 'chr1', start: 0, end: 3000 },
    { refName: 'chr2', start: 0, end: 1000 },
  ])
})

// a whole-genome view of a scaffold-level assembly has thousands of contigs on
// screen, most of them thinner than a pixel, and the answer is an interval
// spanning what is kept — so a sub-pixel scaffold falls between two neighbours
// rather than out of the picture
test('a contig with less than a pixel on screen is not one of the windows', () => {
  expect(
    followAnchorWindows([
      block({ refName: 'chr1', start: 0, end: 3000, widthPx: 799.5 }),
      block({ refName: 'scaffold_9021', start: 0, end: 10, widthPx: 0.5 }),
    ]).map(w => w.refName),
  ).toEqual(['chr1'])
})

test('the count of windows is capped, keeping the widest', () => {
  const windows = followAnchorWindows(
    Array.from({ length: 200 }, (_, i) =>
      block({ refName: `ctg${i}`, start: 0, end: 100, widthPx: i + 1 }),
    ),
  )
  expect(windows).toHaveLength(64)
  expect(windows[0]).toMatchObject({ refName: 'ctg199' })
  expect(windows.at(-1)).toMatchObject({ refName: 'ctg136' })
})

// The COUNT of these decides the multi-contig rung, whose answer is an interval
// spanning everything the windows map to. A panel that is one contig plus the
// tail of the one being scrolled off is not a place that interval describes:
// where the two assemblies order their contigs differently, that tail's mate
// sits a genome away, and the moving row zoomed out to span both — mid-drag,
// over a sliver the reader had stopped looking at.
describe('a sliver beside a full panel', () => {
  test('is not one of the windows, so the panel reads as one contig', () => {
    expect(
      followAnchorWindows([
        block({ refName: 'chrA', start: 59_000, end: 60_000, widthPx: 2 }),
        block({ refName: 'chrB', start: 0, end: 60_000, widthPx: 798 }),
      ]),
    ).toEqual([{ refName: 'chrB', start: 0, end: 60_000 }])
  })

  // RELATIVE TO THE WIDEST, not to the panel: a two-contig assembly is
  // legitimately lopsided — volvox is 89% ctgA — and a panel showing all of both
  // is an overview, which is the case the rung above exists for.
  test('but a whole small contig beside a whole large one is', () => {
    expect(
      followAnchorWindows([
        block({ refName: 'ctgA', start: 0, end: 50_001, widthPx: 713 }),
        block({ refName: 'ctgB', start: 0, end: 6_079, widthPx: 87 }),
      ]).map(w => w.refName),
    ).toEqual(['ctgA', 'ctgB'])
  })

  test('and so is a contig taking a decent share of the panel', () => {
    expect(
      followAnchorWindows([
        block({ refName: 'chrA', start: 40_000, end: 60_000, widthPx: 240 }),
        block({ refName: 'chrB', start: 0, end: 45_000, widthPx: 560 }),
      ]).map(w => w.refName),
    ).toEqual(['chrB', 'chrA'])
  })

  test('a scaffold-level overview keeps every contig of a comparable size', () => {
    expect(
      followAnchorWindows([
        block({ refName: 'chr1', start: 0, end: 60_000, widthPx: 300 }),
        block({ refName: 'chr2', start: 0, end: 40_000, widthPx: 200 }),
        ...Array.from({ length: 600 }, (_, i) =>
          block({ refName: `scaffold_${i}`, start: 0, end: 100, widthPx: 0.5 }),
        ),
      ]).map(w => w.refName),
    ).toEqual(['chr1', 'chr2'])
  })
})

// The windows for the level BEYOND a row this pass placed, which are the spans
// it was placed ON rather than the contigs it ended up showing. A row spanning
// two mapped contigs also shows every contig between them, and read back off
// the blocks that filler is a window like any other — one that maps somewhere
// of its own and widens the next level's answer to reach it.
describe('the windows carried to the next level', () => {
  test('are the mapped contigs, not the ones an interval had to span', () => {
    // what the row shows is chr1..chr9; what mapped is the two ends
    expect(
      followPlacedWindows([
        { refName: 'chr1', start: 0, end: 1000 },
        { refName: 'chr9', start: 500, end: 900 },
      ]).map(w => w.refName),
    ).toEqual(['chr1', 'chr9'])
  })

  test('one contig answered by two tracks is one window', () => {
    // `followWindowsMapping` slots blocks by refName id, so a second window on
    // one refName takes the slot and the first answers nothing
    expect(
      followPlacedWindows([
        { refName: 'chr1', start: 200, end: 800 },
        { refName: 'chr1', start: 100, end: 400 },
      ]),
    ).toEqual([{ refName: 'chr1', start: 100, end: 800 }])
  })

  test('a small mapped span is kept where a small block is not', () => {
    // no share floor here: a 100bp span is a small alignment, which is a fact
    // about the data, where a 2px block is a contig being scrolled off
    expect(
      followPlacedWindows([
        { refName: 'chr1', start: 0, end: 1_000_000 },
        { refName: 'chr9', start: 0, end: 100 },
      ]).map(w => w.refName),
    ).toEqual(['chr1', 'chr9'])
  })

  test('the count is capped the same way, keeping the widest', () => {
    const windows = followPlacedWindows(
      Array.from({ length: 200 }, (_, i) => ({
        refName: `ctg${i}`,
        start: 0,
        end: i + 1,
      })),
    )
    expect(windows).toHaveLength(64)
    expect(windows[0]).toMatchObject({ refName: 'ctg199' })
  })
})
