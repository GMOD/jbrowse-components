import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { PRESET_ATTRIBUTES, buildBpRegionIndex } from '@jbrowse/synteny-core'

import {
  admittedOffscreenMates,
  createOffscreenMateCollector,
  renameOffscreenMates,
} from './collectOffscreenMates.ts'

let nextId = 0

// One alignment anchored at refName:start-end whose mate is
// mateRefName:mateStart-mateEnd, with any other fields it carries
function add(
  c: ReturnType<typeof createOffscreenMateCollector>,
  refName: string,
  start: number,
  end: number,
  mateRefName: string,
  mateStart: number,
  mateEnd: number,
  fields: Record<string, unknown> = {},
) {
  c.add(
    new SimpleFeature({
      uniqueId: `f${nextId++}`,
      refName,
      start: Math.min(start, end),
      end: Math.max(start, end),
      strand: 1,
      ...fields,
    }),
    { refName, start, end },
    { refName: mateRefName, start: mateStart, end: mateEnd },
  )
}

const collector = () => createOffscreenMateCollector(index, PRESET_ATTRIBUTES)

const index = buildBpRegionIndex({
  bpPerPx: 1,
  displayedRegions: [
    { refName: 'chr1', start: 0, end: 1000, assemblyName: 'a' },
    { refName: 'chr2', start: 0, end: 500, assemblyName: 'a' },
  ],
})

test('counts per off-screen contig and places each on the query axis', () => {
  const c = collector()
  add(c, 'chr1', 100, 200, 'grapeA', 0, 100)
  add(c, 'chr1', 300, 400, 'grapeA', 0, 100)
  add(c, 'chr1', 500, 600, 'grapeB', 0, 100)
  const out = c.finish()
  expect(out.mateRefNameDict).toEqual(['grapeA', 'grapeB'])
  expect([...out.counts]).toEqual([2, 1])
  // and what those alignments cover, which is what the hover leads with and
  // what a stretch is ranked by
  expect([...out.alignedBp]).toEqual([200, 100])
  expect([...out.starts]).toEqual([100, 300, 500])
  expect([...out.ends]).toEqual([200, 400, 600])
  expect([...out.mateRefNameIds]).toEqual([0, 0, 1])
})

// What a click on a mark navigates to. The mate's own contig has no ruler on
// this side — the facing row is not displaying it, which is what an off-screen
// mate IS — so these are the contig's own bp rather than a cumBp, and they are
// the only coordinates in the payload that are.
test('keeps the mate coordinates, in the mate contig own bp', () => {
  const c = collector()
  add(c, 'chr1', 100, 200, 'grapeA', 4000, 4100)
  const out = c.finish()
  expect(Array.from(out.mateStarts)).toEqual([4000])
  expect(Array.from(out.mateEnds)).toEqual([4100])
})

// Same reason `starts`/`ends` are ordered: a PAF row for a reverse-strand
// alignment spells its mate end-first, and a locstring built from that is
// backwards.
test('...ordered, whichever way the alignment is spelled', () => {
  const c = collector()
  add(c, 'chr1', 100, 200, 'grapeA', 4100, 4000)
  const out = c.finish()
  expect(Array.from(out.mateStarts)).toEqual([4000])
  expect(Array.from(out.mateEnds)).toEqual([4100])
})

// cumBp is whole-view cumulative, so the second region's coordinates sit past
// the first region's length — the same axis the ribbons are drawn on.
test('a later region is placed past the regions before it', () => {
  const c = collector()
  add(c, 'chr2', 100, 200, 'elsewhere', 0, 100)
  expect([...c.finish().starts]).toEqual([1100])
})

test('a block straddling a region edge is clamped, not dropped', () => {
  const c = collector()
  add(c, 'chr1', 900, 1200, 'elsewhere', 0, 100)
  const out = c.finish()
  expect([...out.starts]).toEqual([900])
  expect([...out.ends]).toEqual([1000])
})

// ...and it keeps its OWN length through that clamp, because the length is what
// a `length` filter tests and the ribbons test the unclamped extent
// (off `starts`/`ends` before `clipLargeBlockToWindow`).
// Measured off the clamped span instead, raising Min length hid the mark for an
// alignment whose ribbon the same setting kept.
test('...and reports the block length, not the clamped one', () => {
  const c = collector()
  add(c, 'chr1', 900, 1200, 'elsewhere', 0, 100)
  expect([...c.finish().lengths]).toEqual([300])
})

// The count is what answers "how much is this view not showing you", so it has
// to include the ones that could not be placed — otherwise the number shrinks
// to whatever happened to be drawable, which is the omission all over again.
test('an unplaceable block is still counted', () => {
  const c = collector()
  add(c, 'chr3', 100, 200, 'elsewhere', 0, 100)
  const out = c.finish()
  expect([...out.counts]).toEqual([1])
  expect([...out.alignedBp]).toEqual([100])
  expect(out.starts).toHaveLength(0)
})

test('a reversed span comes out ascending', () => {
  const c = collector()
  add(c, 'chr1', 400, 100, 'elsewhere', 0, 100)
  const out = c.finish()
  expect([...out.starts]).toEqual([100])
  expect([...out.ends]).toEqual([400])
})

test('nothing dropped leaves no contig behind', () => {
  const out = collector().finish()
  expect(out.mateRefNameDict).toEqual([])
  expect([...out.counts]).toEqual([])
})

// The names here are the file's, and every reader they meet — the strip's
// labels, a mark's tooltip count, `navToLocString` on a click — is canonical.
const aliases = (map: Record<string, string>) => (name: string) =>
  map[name] ?? name

test('the mate contigs are renamed into the assembly namespace', () => {
  const c = collector()
  add(c, 'chr1', 100, 200, '1', 0, 100)
  const out = renameOffscreenMates(c.finish(), {
    mate: aliases({ '1': 'grape1' }),
    anchor: name => name,
  })
  expect(out.mateRefNameDict).toEqual(['grape1'])
  expect([...out.mateRefNameIds]).toEqual([0])
})

// A file spelling one contig two ways leaves as one contig, so the strip labels
// one stretch rather than two and a mark's tooltip reports one pair of numbers
// — the same re-interning `renameDictLane` does for the per-feature lanes, plus
// the thing only this lane has: per-contig tallies that have to be SUMMED, not
// reindexed.
test('two spellings of one contig collapse, and their tallies add', () => {
  const c = collector()
  add(c, 'chr1', 100, 200, 'grape1', 0, 100)
  add(c, 'chr1', 300, 450, '1', 0, 100)
  add(c, 'chr1', 500, 600, 'grape2', 0, 100)
  const out = renameOffscreenMates(c.finish(), {
    mate: aliases({ '1': 'grape1' }),
    anchor: name => name,
  })
  expect(out.mateRefNameDict).toEqual(['grape1', 'grape2'])
  expect([...out.counts]).toEqual([2, 1])
  expect([...out.alignedBp]).toEqual([250, 100])
  expect([...out.mateRefNameIds]).toEqual([0, 0, 1])
})

// The placed marks are untouched by any of this: a rename moves names, and the
// geometry is what the strip draws.
test('the placements survive the rename', () => {
  const c = collector()
  add(c, 'chr1', 100, 200, 'grape1', 0, 100)
  add(c, 'chr1', 300, 400, '1', 0, 100)
  const out = renameOffscreenMates(c.finish(), {
    mate: aliases({ '1': 'grape1' }),
    anchor: name => name,
  })
  expect([...out.starts]).toEqual([100, 300])
  expect([...out.lengths]).toEqual([100, 100])
})

test('a name the assembly does not know is left alone', () => {
  const c = collector()
  add(c, 'chr1', 100, 200, 'grapeX', 0, 100)
  expect(
    renameOffscreenMates(c.finish(), {
      mate: aliases({ '1': 'grape1' }),
      anchor: name => name,
    }).mateRefNameDict,
  ).toEqual(['grapeX'])
})

test('the anchored contig is renamed with the anchor axis resolver', () => {
  const c = collector()
  add(c, 'chr1', 100, 200, 'grape1', 0, 100)
  const out = renameOffscreenMates(c.finish(), {
    mate: name => name,
    anchor: aliases({ chr1: 'peach1' }),
  })
  expect(out.refNameDict).toEqual(['peach1'])
  expect(out.mateRefNameDict).toEqual(['grape1'])
})

// The off-screen marks are the alignments the band could not draw, so a filter
// that hides an alignment's ribbon hides its mark the same way: by any field
// the ribbons are filtered on, not by length alone.
test('a filter on a channel drops the marks it refuses and their tallies', () => {
  const c = collector()
  add(c, 'chr1', 100, 200, 'grapeA', 0, 100, { identity: 0.99 })
  add(c, 'chr1', 300, 450, 'grapeA', 0, 100, { identity: 0.5 })
  add(c, 'chr1', 500, 600, 'grapeB', 0, 100, { identity: 0.95 })
  const out = admittedOffscreenMates(
    c.finish(),
    [{ field: 'identity', gte: 0.9 }],
    { axis: 'query' },
  )
  expect([...out.starts]).toEqual([100, 500])
  expect([...out.mateRefNameIds]).toEqual([0, 1])
  expect([...out.counts]).toEqual([1, 1])
  expect([...out.alignedBp]).toEqual([100, 100])
  expect([...out.attributes.identity!]).toEqual([
    Math.fround(0.99),
    Math.fround(0.95),
  ])
})

test('a filter on strand reads each alignment orientation', () => {
  const c = collector()
  add(c, 'chr1', 100, 200, 'grapeA', 0, 100, { strand: -1 })
  add(c, 'chr1', 300, 400, 'grapeA', 0, 100, { strand: 1 })
  const out = admittedOffscreenMates(
    c.finish(),
    [{ field: 'strand', equal: -1 }],
    { axis: 'query' },
  )
  expect([...out.starts]).toEqual([100])
})

test('length is one of the fields, read off the unclamped block', () => {
  const c = collector()
  add(c, 'chr1', 900, 1200, 'grapeA', 0, 100)
  add(c, 'chr1', 100, 150, 'grapeA', 0, 100)
  const out = admittedOffscreenMates(
    c.finish(),
    [{ field: 'length', gte: 200 }],
    { axis: 'query' },
  )
  expect([...out.lengths]).toEqual([300])
})

// On the target axis an entry is anchored on its target contig and its mate
// is the query end, so `query` names the mate's contig there.
test('query and target name the alignment ends on either axis', () => {
  const c = collector()
  add(c, 'chr1', 100, 200, 'grapeA', 0, 100)
  add(c, 'chr1', 300, 400, 'grapeB', 0, 100)
  const fetched = c.finish()
  const onQuery = admittedOffscreenMates(
    fetched,
    [{ field: 'target', oneOf: ['grapeB'] }],
    { axis: 'query' },
  )
  const onTarget = admittedOffscreenMates(
    fetched,
    [{ field: 'query', oneOf: ['grapeB'] }],
    { axis: 'target' },
  )
  expect([...onQuery.starts]).toEqual([300])
  expect([...onTarget.starts]).toEqual([300])
})

test('an unplaceable block keeps counting under a filter', () => {
  const c = collector()
  add(c, 'chr3', 100, 200, 'grapeA', 0, 100, { identity: 0.5 })
  const out = admittedOffscreenMates(
    c.finish(),
    [{ field: 'identity', gte: 0.9 }],
    { axis: 'query' },
  )
  expect([...out.counts]).toEqual([1])
})

test('no filter hands the payload back as it is', () => {
  const fetched = collector().finish()
  expect(admittedOffscreenMates(fetched, [], { axis: 'query' })).toBe(fetched)
})
