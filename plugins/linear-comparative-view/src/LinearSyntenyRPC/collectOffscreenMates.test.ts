import { buildBpRegionIndex } from '@jbrowse/synteny-core'

import {
  createOffscreenMateCollector,
  offscreenMateTally,
  renameOffscreenMates,
} from './collectOffscreenMates.ts'

const index = buildBpRegionIndex({
  bpPerPx: 1,
  displayedRegions: [
    { refName: 'chr1', start: 0, end: 1000, assemblyName: 'a' },
    { refName: 'chr2', start: 0, end: 500, assemblyName: 'a' },
  ],
})

test('counts per off-screen contig and places each on the query axis', () => {
  const c = createOffscreenMateCollector(index)
  c.add('chr1', 100, 200, 'grapeA')
  c.add('chr1', 300, 400, 'grapeA')
  c.add('chr1', 500, 600, 'grapeB')
  const out = c.finish()
  expect(out.mateRefNameDict).toEqual(['grapeA', 'grapeB'])
  expect([...out.counts]).toEqual([2, 1])
  expect([...out.starts]).toEqual([100, 300, 500])
  expect([...out.ends]).toEqual([200, 400, 600])
  expect([...out.mateRefNameIds]).toEqual([0, 0, 1])
})

// cumBp is whole-view cumulative, so the second region's coordinates sit past
// the first region's length — the same axis the ribbons are drawn on.
test('a later region is placed past the regions before it', () => {
  const c = createOffscreenMateCollector(index)
  c.add('chr2', 100, 200, 'elsewhere')
  expect([...c.finish().starts]).toEqual([1100])
})

test('a block straddling a region edge is clamped, not dropped', () => {
  const c = createOffscreenMateCollector(index)
  c.add('chr1', 900, 1200, 'elsewhere')
  const out = c.finish()
  expect([...out.starts]).toEqual([900])
  expect([...out.ends]).toEqual([1000])
})

// ...and it keeps its OWN length through that clamp, because the length is what
// `minAlignmentLength` culls on and the ribbons cull on the unclamped extent
// (`alignmentLengths`, off `starts`/`ends` before `clipLargeBlockToWindow`).
// Measured off the clamped span instead, raising Min length hid the mark for an
// alignment whose ribbon the same setting kept.
test('...and reports the block length, not the clamped one', () => {
  const c = createOffscreenMateCollector(index)
  c.add('chr1', 900, 1200, 'elsewhere')
  expect([...c.finish().lengths]).toEqual([300])
})

// The count is what answers "how much is this view not showing you", so it has
// to include the ones that could not be placed — otherwise the number shrinks
// to whatever happened to be drawable, which is the omission all over again.
test('an unplaceable block is still counted', () => {
  const c = createOffscreenMateCollector(index)
  c.add('chr3', 100, 200, 'elsewhere')
  const out = c.finish()
  expect([...out.counts]).toEqual([1])
  expect(out.starts).toHaveLength(0)
})

test('a reversed span comes out ascending', () => {
  const c = createOffscreenMateCollector(index)
  c.add('chr1', 400, 100, 'elsewhere')
  const out = c.finish()
  expect([...out.starts]).toEqual([100])
  expect([...out.ends]).toEqual([400])
})

test('nothing dropped is an empty tally, not a zero row', () => {
  expect(
    offscreenMateTally(createOffscreenMateCollector(index).finish()),
  ).toEqual([])
})

// The names here are the file's, and every reader they meet — the strip's
// labels, the hamburger tally, `navToLocString` on a click — is canonical.
const aliases = (map: Record<string, string>) => (name: string) =>
  map[name] ?? name

test('the mate contigs are renamed into the assembly namespace', () => {
  const c = createOffscreenMateCollector(index)
  c.add('chr1', 100, 200, '1')
  const out = renameOffscreenMates(c.finish(), aliases({ '1': 'grape1' }))
  expect(out.mateRefNameDict).toEqual(['grape1'])
  expect([...out.mateRefNameIds]).toEqual([0])
})

// A file spelling one contig two ways leaves as one contig, so the strip labels
// one stretch rather than two and the tally reports one row — the same
// re-interning `renameDictLane` does for the per-feature lanes, plus the thing
// only this lane has: a per-contig `counts` that has to be SUMMED, not
// reindexed.
test('two spellings of one contig collapse, and their counts add', () => {
  const c = createOffscreenMateCollector(index)
  c.add('chr1', 100, 200, 'grape1')
  c.add('chr1', 300, 400, '1')
  c.add('chr1', 500, 600, 'grape2')
  const out = renameOffscreenMates(c.finish(), aliases({ '1': 'grape1' }))
  expect(out.mateRefNameDict).toEqual(['grape1', 'grape2'])
  expect([...out.counts]).toEqual([2, 1])
  expect([...out.mateRefNameIds]).toEqual([0, 0, 1])
  expect(offscreenMateTally(out)).toEqual([
    { refName: 'grape1', count: 2 },
    { refName: 'grape2', count: 1 },
  ])
})

// The placed marks are untouched by any of this: a rename moves names, and the
// geometry is what the strip draws.
test('the placements survive the rename', () => {
  const c = createOffscreenMateCollector(index)
  c.add('chr1', 100, 200, 'grape1')
  c.add('chr1', 300, 400, '1')
  const out = renameOffscreenMates(c.finish(), aliases({ '1': 'grape1' }))
  expect([...out.starts]).toEqual([100, 300])
  expect([...out.lengths]).toEqual([100, 100])
})

test('a name the assembly does not know is left alone', () => {
  const c = createOffscreenMateCollector(index)
  c.add('chr1', 100, 200, 'grapeX')
  expect(
    renameOffscreenMates(c.finish(), aliases({ '1': 'grape1' }))
      .mateRefNameDict,
  ).toEqual(['grapeX'])
})

test('the tally is largest first, ties by name', () => {
  const c = createOffscreenMateCollector(index)
  c.add('chr1', 0, 1, 'small')
  c.add('chr1', 0, 1, 'zeta')
  c.add('chr1', 0, 1, 'alpha')
  c.add('chr1', 0, 1, 'alpha')
  c.add('chr1', 0, 1, 'alpha')
  expect(offscreenMateTally(c.finish())).toEqual([
    { refName: 'alpha', count: 3 },
    { refName: 'small', count: 1 },
    { refName: 'zeta', count: 1 },
  ])
})
