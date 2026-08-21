import { buildSplitViewFromPath } from './buildSplitViewFromPath.ts'

import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

function candidate(
  segments: { refName: string; start: number; end: number; strand?: number }[],
): DerivativeCandidate {
  return {
    segments: segments.map(s => ({ strand: 1, ...s })),
    readCount: 4,
    pathId: segments.map(s => `${s.refName}:${s.start}:${s.strand}`).join('|'),
    locString: '',
    refNames: [...new Set(segments.map(s => s.refName))],
    extendsOffScreen: false,
  }
}

const track = {
  id: 'track-instance-1',
  type: 'AlignmentsTrack',
  configuration: 'COLO829_tumor_ont',
  displays: [{ id: 'display-instance-1', type: 'LinearAlignmentsDisplay' }],
}

test('one panel per segment, in path order', () => {
  const { viewSnapshot, locStrings } = buildSplitViewFromPath({
    candidate: candidate([
      { refName: 'chr3', start: 25352000, end: 25359568 },
      { refName: 'chr10', start: 58717464, end: 58717662 },
      { refName: 'chr12', start: 72273112, end: 72273294 },
    ]),
    tracks: [track],
    windowSize: 10000,
  })
  expect(viewSnapshot.views).toHaveLength(3)
  expect(locStrings).toEqual([
    'chr3:25354569-25364568',
    'chr10:58712564-58722563',
    'chr12:72268113-72278112',
  ])
})

test('a path that revisits a chromosome gets a panel per visit', () => {
  // The fold-back case, and the reason this is not "one panel per refName": a
  // person filling in the import form types chr9 once.
  const { viewSnapshot, locStrings } = buildSplitViewFromPath({
    candidate: candidate([
      { refName: 'chr9', start: 28030000, end: 28031837 },
      { refName: 'chr9', start: 28059142, end: 28061000, strand: -1 },
    ]),
    tracks: [track],
    windowSize: 10000,
  })
  expect(viewSnapshot.views).toHaveLength(2)
  expect(locStrings).toEqual([
    'chr9:28026838-28036837',
    // arrived at inverted, so the path lands on this segment's END
    'chr9:28056001-28066000',
  ])
  expect(viewSnapshot.displayName).toBe('chr9 → chr9 (inverted)')
})

// An inverted segment is crossed from its high coordinate to its low one, so
// the junction a path arrives at is its `end`. Anchoring on `start` regardless
// put the last panel a segment-length away from where its reads land, and the
// curves into it had nothing on screen to attach to.
test('an inverted segment is anchored on the end the path reaches', () => {
  const forward = buildSplitViewFromPath({
    candidate: candidate([
      { refName: 'chr3', start: 25326821, end: 25359568 },
      { refName: 'chr3', start: 25350000, end: 25358430 },
    ]),
    tracks: [],
    windowSize: 10000,
  }).locStrings
  const inverted = buildSplitViewFromPath({
    candidate: candidate([
      { refName: 'chr3', start: 25326821, end: 25359568 },
      { refName: 'chr3', start: 25350000, end: 25358430, strand: -1 },
    ]),
    tracks: [],
    windowSize: 10000,
  }).locStrings
  expect(forward[1]).toBe('chr3:25345001-25355000')
  expect(inverted[1]).toBe('chr3:25353431-25363430')
})

test('carries the launching view tracks onto every panel, without their ids', () => {
  const { viewSnapshot } = buildSplitViewFromPath({
    candidate: candidate([
      { refName: 'chr3', start: 100, end: 200 },
      { refName: 'chr10', start: 300, end: 400 },
    ]),
    tracks: [track],
  })
  for (const panel of viewSnapshot.views) {
    expect(panel.tracks).toHaveLength(1)
    // ids are stripped so the copies cannot collide with the source track
    expect(panel.tracks[0]).not.toHaveProperty('id')
    expect(
      (panel.tracks[0] as { displays: unknown[] }).displays[0],
    ).not.toHaveProperty('id')
  }
})

// The connecting curves are drawn between panels, so the panels have to be at
// one zoom or the fan runs off the frame — which is what a per-segment fit did,
// giving a 199bp interior segment its own 199bp panel between two 10kb ones.
test('every panel is the same span, whatever the segments measure', () => {
  const { locStrings } = buildSplitViewFromPath({
    candidate: candidate([
      { refName: 'chr3', start: 25326821, end: 25359568 },
      { refName: 'chr10', start: 58717464, end: 58717662 },
      { refName: 'chr12', start: 72273112, end: 72290000 },
    ]),
    tracks: [],
    windowSize: 10000,
  })
  const spans = locStrings.map(l => {
    const [, range] = l.split(':')
    const [start, end] = range!.split('-').map(Number)
    return end! - start! + 1
  })
  expect(spans).toEqual([10000, 10000, 10000])
})

test('each panel centres on the junction it carries', () => {
  const { locStrings } = buildSplitViewFromPath({
    candidate: candidate([
      { refName: 'chr3', start: 25326821, end: 25359568 },
      { refName: 'chr10', start: 58717464, end: 58717662 },
      { refName: 'chr12', start: 72273112, end: 72290000 },
    ]),
    tracks: [],
    windowSize: 10000,
  })
  expect(locStrings).toEqual([
    // leads into the path, so its junction is its end
    'chr3:25354569-25364568',
    // pinned at both ends, so its centre is the junction
    'chr10:58712564-58722563',
    // led into, so its junction is its start
    'chr12:72268113-72278112',
  ])
})

// A junction near the start of a contig can't be centred; the panel keeps its
// span and butts against base 1 rather than asking for a negative coordinate.
test('a locstring never runs off the start of a contig', () => {
  const { locStrings } = buildSplitViewFromPath({
    candidate: candidate([
      { refName: 'chr3', start: 0, end: 4000 },
      { refName: 'chr10', start: 5, end: 50 },
    ]),
    tracks: [],
    windowSize: 60000,
  })
  expect(locStrings[0]).toBe('chr3:1-60000')
})

// The midpoint's justification is the SHORT interior segment (the test above
// centres a 199 bp one), and it inverts once the segment outgrows the window
// every panel shares: the centre of a 30 kb interior segment is 15 kb from
// either junction, so a 10 kb panel there carries no junction, no reads, and
// nothing for the curves on either side to attach to. Nothing bounds an
// interior segment's length — only its edges are pinned by junctions.
test('a long interior segment falls back to the junction it is reached by', () => {
  const { locStrings } = buildSplitViewFromPath({
    candidate: candidate([
      { refName: 'chr3', start: 25326821, end: 25359568 },
      { refName: 'chr10', start: 58700000, end: 58730000 },
      { refName: 'chr12', start: 72273112, end: 72290000 },
    ]),
    tracks: [],
    windowSize: 10000,
  })
  // reached at its start, so the panel holds the junction the previous one hands
  // off to; the midpoint (58,715,000) holds neither
  expect(locStrings[1]).toBe('chr10:58695001-58705000')
})

test('a long INVERTED interior segment is reached at its end', () => {
  const { locStrings } = buildSplitViewFromPath({
    candidate: candidate([
      { refName: 'chr3', start: 25326821, end: 25359568 },
      { refName: 'chr10', start: 58700000, end: 58730000, strand: -1 },
      { refName: 'chr12', start: 72273112, end: 72290000 },
    ]),
    tracks: [],
    windowSize: 10000,
  })
  expect(locStrings[1]).toBe('chr10:58725001-58735000')
})

// A segment exactly the window's length still has both junctions in frame, so
// the centre holds right up to there and the fallback starts one base past it.
test('an interior segment the window fits keeps its centre', () => {
  const at = (length: number) =>
    buildSplitViewFromPath({
      candidate: candidate([
        { refName: 'chr3', start: 0, end: 40000 },
        { refName: 'chr10', start: 1_000_000, end: 1_000_000 + length },
        { refName: 'chr12', start: 2_000_000, end: 2_040_000 },
      ]),
      tracks: [],
      windowSize: 10000,
    }).locStrings[1]
  // centred on 1,005,000
  expect(at(10000)).toBe('chr10:1000001-1010000')
  // one base longer, so it cannot show both and takes the entry junction
  expect(at(10001)).toBe('chr10:995001-1005000')
})

// No junction to be about, so neither end is the answer. `computeDerivativePaths`
// filters chains of one, but this builder is `#api`.
test('a lone segment centres on itself', () => {
  const { locStrings } = buildSplitViewFromPath({
    candidate: candidate([{ refName: 'chr3', start: 1000, end: 3000 }]),
    tracks: [],
    windowSize: 1000,
  })
  expect(locStrings).toEqual(['chr3:1501-2500'])
})
