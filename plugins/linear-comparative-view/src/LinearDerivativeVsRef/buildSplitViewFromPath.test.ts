import { buildSplitViewFromPath } from './buildSplitViewFromPath.ts'

import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

function candidate(
  segments: { refName: string; start: number; end: number; strand?: number }[],
): DerivativeCandidate {
  return {
    segments: segments.map(s => ({ strand: 1, ...s })),
    readCount: 4,
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
  })
  expect(viewSnapshot.views).toHaveLength(3)
  expect(locStrings).toEqual([
    'chr3:25352001-25359568',
    'chr10:58717465-58717662',
    'chr12:72273113-72273294',
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
  })
  expect(viewSnapshot.views).toHaveLength(2)
  expect(locStrings).toEqual([
    'chr9:28030001-28031837',
    'chr9:28059143-28061000',
  ])
  expect(viewSnapshot.displayName).toBe('chr9 → chr9 (inverted)')
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

test('a long outer segment opens on its junction end, not on all of it', () => {
  // What the reads happened to reach is not the event: an outer segment is as
  // long as the longest read that described it, and a panel over all of it is a
  // fetch the alignments track refuses.
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
    'chr3:25349569-25359568',
    // short enough to show whole
    'chr10:58717465-58717662',
    // led into, so its junction is its start
    'chr12:72273113-72283112',
  ])
})

test('a locstring never runs off the start of a contig', () => {
  const { locStrings } = buildSplitViewFromPath({
    candidate: candidate([
      { refName: 'chr3', start: 0, end: 40000 },
      { refName: 'chr10', start: 5, end: 50 },
    ]),
    tracks: [],
    windowSize: 60000,
  })
  expect(locStrings[0]).toBe('chr3:1-40000')
})
