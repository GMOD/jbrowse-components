import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'
import { groupKeySpaceOf } from '@jbrowse/core/util/groupKeys'

import {
  GROUP_BY_DIMENSIONS,
  MAX_GROUPS,
  OVERFLOW_GROUP_KEY,
  groupByForMode,
  isChainGroupable,
  partitionChains,
  partitionFeatures,
  workerGroupBy,
} from './groupFeatures.ts'

import type { GroupBy } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

function feat(uniqueId: string, fields: Record<string, unknown>): Feature {
  return new SimpleFeature({
    id: uniqueId,
    data: { uniqueId, refName: 'ctgA', start: 0, end: 100, ...fields },
  })
}

function keys(groups: { key: string }[]) {
  return groups.map(g => g.key)
}

test('ungrouped is a single section holding every read', () => {
  const features = [feat('a', { flags: 0 }), feat('b', { flags: 16 })]
  const groups = partitionFeatures(features, undefined)
  expect(groups).toHaveLength(1)
  expect(groups[0]!.key).toBe('')
  expect(groups[0]!.features).toHaveLength(2)
})

// BAM/CRAM features expose `strand` derived from SAM_FLAG_REVERSE, so the two
// always agree on reads; the fixtures carry both, as real adapters do.
test('strand grouping splits forward/reverse reads', () => {
  const features = [
    feat('a', { flags: 0, strand: 1 }),
    feat('b', { flags: 16, strand: -1 }),
    feat('c', { flags: 0, strand: 1 }),
  ]
  const groups = partitionFeatures(features, { field: 'strand' })
  expect(keys(groups)).toEqual(['+', '-'])
  expect(groups[0]!.features.map(f => f.id())).toEqual(['a', 'c'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['b'])
})

// Synteny (PAF) features carry a real strand and no SAM flags at all. Keying off
// the reverse flag put every block in '+', silently collapsing the grouping.
test('strand grouping splits synteny features, which have no SAM flags', () => {
  const features = [feat('a', { strand: 1 }), feat('b', { strand: -1 })]
  const groups = partitionFeatures(features, { field: 'strand' })
  expect(keys(groups)).toEqual(['+', '-'])
  expect(groups[0]!.features.map(f => f.id())).toEqual(['a'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['b'])
})

// These fixtures carry `strand` alongside `flags`, as every adapter feature does
// (`SamRecordFeature.strand` IS the reverse flag) — a flags-only stub is a shape
// no source produces.
test('first-of-pair strand groups both mates of a pair together', () => {
  // read1 forward (flags 0x40) and read2 reverse (flags 0x10|0x80) are the two
  // mates of one forward-strand fragment, so they share the '+' group.
  const features = [
    feat('r1', { flags: 0x40, strand: 1 }),
    feat('r2', { flags: 0x10 | 0x80, strand: -1 }),
  ]
  const groups = partitionFeatures(features, { field: 'firstOfPairStrand' })
  expect(keys(groups)).toEqual(['+'])
  expect(groups[0]!.features).toHaveLength(2)
})

test('first-of-pair strand groups single-end reads by their own strand', () => {
  // Unpaired reads (no SECOND_IN_PAIR flag) represent the fragment strand
  // directly: a forward single-end read (flags 0) is forward, not flipped.
  const features = [
    feat('fwd', { flags: 0, strand: 1 }),
    feat('rev', { flags: 0x10, strand: -1 }),
  ]
  const groups = partitionFeatures(features, { field: 'firstOfPairStrand' })
  expect(keys(groups)).toEqual(['+', '-'])
  expect(groups[0]!.features.map(f => f.id())).toEqual(['fwd'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['rev'])
})

// Synteny (PAF) blocks have no SAM flags, so "first of pair" is meaningless for
// them — but the dimension must still degrade to the block's own strand rather
// than filing every block as forward, exactly as plain `strand` grouping does.
test('first-of-pair strand falls back to own strand with no SAM flags', () => {
  const features = [feat('a', { strand: 1 }), feat('b', { strand: -1 })]
  const groups = partitionFeatures(features, { field: 'firstOfPairStrand' })
  expect(keys(groups)).toEqual(['+', '-'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['b'])
})

test('tag grouping sorts values and pins untagged reads last', () => {
  const features = [
    feat('a', { tags: { HP: 2 } }),
    feat('b', {}),
    feat('c', { tags: { HP: 1 } }),
    feat('d', { tags: { HP: 1 } }),
  ]
  const groups = partitionFeatures(features, { field: 'tags.HP' })
  expect(keys(groups)).toEqual(['1', '2', ''])
  expect(groups[2]!.label).toBe('HP: none')
  expect(groups[0]!.features.map(f => f.id())).toEqual(['c', 'd'])
})

test('numeric tag values order by magnitude, not code point', () => {
  // A numeric tag with values past 9 must stack 2 before 10 (not code-point
  // '10' < '2'); untagged still pins last.
  const features = [
    feat('a', { tags: { RG: 10 } }),
    feat('b', { tags: { RG: 2 } }),
    feat('c', {}),
    feat('d', { tags: { RG: 1 } }),
  ]
  const groups = partitionFeatures(features, { field: 'tags.RG' })
  expect(keys(groups)).toEqual(['1', '2', '10', ''])
})

// Confidence bins, not decades: a bwa run puts nearly every read at 60 and the
// rest at 0, so decade bins produced mostly-empty sections. Highest confidence
// heads the stack, "unavailable" pins last.
test('mapq buckets by confidence, best first, unavailable last', () => {
  const features = [
    feat('a', { score: 0 }),
    feat('b', { score: 5 }),
    feat('c', { score: 255 }),
    feat('d', { score: 60 }),
    feat('e', { score: 20 }),
  ]
  const groups = partitionFeatures(features, { field: 'mapq' })
  expect(groups.map(g => g.label)).toEqual([
    'MAPQ 30+ (high confidence)',
    'MAPQ 10-29',
    'MAPQ 1-9 (low)',
    'MAPQ 0 (multi-mapping)',
    'MAPQ unavailable',
  ])
})

// The bin count is fixed, so this dimension can never approach MAX_GROUPS
// however wide the MAPQ distribution is.
test('mapq never produces more than its five buckets', () => {
  const features = Array.from({ length: 256 }, (_, score) =>
    feat(`f${score}`, { score }),
  )
  expect(partitionFeatures(features, { field: 'mapq' })).toHaveLength(5)
})

// PAF/MashMap features spell mapping quality `mappingQual` and leave `score`
// unset, so reading only `score` bucketed every synteny block into the single
// "MAPQ unavailable" section — LGVSyntenyDisplay offers this dimension.
test('mapq grouping reads the synteny mappingQual field too', () => {
  const features = [
    feat('a', { mappingQual: 60 }),
    feat('b', { mappingQual: 0 }),
    feat('c', {}),
  ]
  const groups = partitionFeatures(features, { field: 'mapq' })
  expect(groups.map(g => g.label)).toEqual([
    'MAPQ 30+ (high confidence)',
    'MAPQ 0 (multi-mapping)',
    'MAPQ unavailable',
  ])
})

// SA is written on every segment of a split read, the primary included, so both
// pieces of read 'a' land in one section — the distinction the retired
// SUPPLEMENTARY-flag grouping could not draw, since it filed 'a' (flags 0) with
// the unsplit read 'c'.
test('split-read grouping keeps both pieces of a split read together', () => {
  const features = [
    feat('a', { flags: 0, tags: { SA: 'ctgA,200,+,50M50S,60,0;' } }),
    feat('a-supp', { flags: 0x800, tags: { SA: 'ctgA,1,+,50S50M,60,0;' } }),
    feat('c', { flags: 0, tags: {} }),
  ]
  const groups = partitionFeatures(features, { field: 'splitRead' })
  // 'split' sorts before 'unsplit', which is also the order that helps: at an SV
  // locus the reads crossing the breakpoint sit at the top of the pileup.
  expect(groups.map(g => g.label)).toEqual(['Split (SA)', 'Not split'])
  expect(groups[0]!.features.map(f => f.id())).toEqual(['a', 'a-supp'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['c'])
})

// The supplementary flag is a conformance backstop on top of SA, and it is the
// half "Show only split alignments" already counted: a supplementary record IS a
// piece of a split, so one whose SA the source dropped used to survive that filter
// and then group as "Not split". Both surfaces read one predicate now.
test('split-read grouping counts a supplementary record with no SA tag', () => {
  const features = [
    feat('supp', { flags: 0x800, tags: {} }),
    feat('plain', { flags: 0, tags: {} }),
  ]
  const groups = partitionFeatures(features, { field: 'splitRead' })
  expect(groups.map(g => g.label)).toEqual(['Split (SA)', 'Not split'])
  expect(groups[0]!.features.map(f => f.id())).toEqual(['supp'])
})

// F1R2 and F2R1 are the SAME pair orientation — the normal LR — differing only
// in which mate the record is. Keying the raw `pair_orientation` string opened a
// section per permutation, so a plain FR library drew two "normal" sections, both
// painted the identical LR grey by the color scheme, plus a cryptic label neither
// the legend nor the tooltip uses.
test('pair-orientation grouping keys the IGV category, not the raw string', () => {
  const features = [
    feat('a', { pair_orientation: 'F1R2' }),
    feat('b', { pair_orientation: 'F2R1' }),
    feat('c', { pair_orientation: 'R1F2' }),
  ]
  const groups = partitionFeatures(features, { field: 'pairOrientation' })
  expect(groups.map(g => g.label)).toEqual([
    'LR - Normal pair orientation',
    'RL - Mates point outward',
  ])
  expect(groups[0]!.features.map(f => f.id())).toEqual(['a', 'b'])
})

// The sections stack in the order the legend lists its pair-orientation swatches
// (PAIR_DIRECTION_NUM), which is why the keys are ordinals: the category letters
// sort LL, LR, RL, RR, stranding the normal lane between the aberrant ones.
test('pair-orientation stacks sections in the legend swatch order', () => {
  const features = [
    feat('ll', { pair_orientation: 'F1F2' }),
    feat('lr', { pair_orientation: 'F1R2' }),
    feat('rr', { pair_orientation: 'R1R2' }),
    feat('rl', { pair_orientation: 'R1F2' }),
    feat('none', {}),
  ]
  const groups = partitionFeatures(features, { field: 'pairOrientation' })
  expect(groups.map(g => g.features[0]!.id())).toEqual([
    'lr',
    'rl',
    'rr',
    'll',
    'none',
  ])
  expect(groups.at(-1)!.label).toBe('No orientation')
})

// An orientation string the classifier doesn't recognize is not a category, so it
// files with the reads that have no orientation at all rather than opening a
// section named after a value nothing else in the app will show.
test('pair-orientation files an unrecognized orientation as no-orientation', () => {
  const features = [
    feat('a', { pair_orientation: 'bogus' }),
    feat('b', {}),
    feat('c', { pair_orientation: 'F1R2' }),
  ]
  const groups = partitionFeatures(features, { field: 'pairOrientation' })
  expect(groups.map(g => g.label)).toEqual([
    'LR - Normal pair orientation',
    'No orientation',
  ])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['a', 'b'])
})

test('mate-assembly grouping splits synteny features by mate assembly', () => {
  const features = [
    feat('a', { mate: { assemblyName: 'peach' } }),
    feat('b', { mate: { assemblyName: 'cacao' } }),
    feat('c', { mate: { assemblyName: 'cacao' } }),
  ]
  const groups = partitionFeatures(features, { field: 'mateAssembly' })
  expect(keys(groups)).toEqual(['cacao', 'peach'])
  expect(groups[0]!.label).toBe('cacao')
  expect(groups[0]!.features.map(f => f.id())).toEqual(['b', 'c'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['a'])
})

test('mate-assembly grouping pins features with no mate assembly last', () => {
  const features = [
    feat('a', { mate: { assemblyName: 'peach' } }),
    feat('b', {}),
    feat('c', { mate: {} }),
  ]
  const groups = partitionFeatures(features, { field: 'mateAssembly' })
  expect(keys(groups)).toEqual(['peach', ''])
  expect(groups[1]!.label).toBe('No mate assembly')
  expect(groups[1]!.features.map(f => f.id())).toEqual(['b', 'c'])
})

// Two ways a dimension resolves one chain to one key: the representative read
// answers for the fragment, or the dimension states the chain's key itself.
// `splitRead` is the second — its per-read key differs between a split mate and
// its unsplit partner — so a reading of `fragmentLevel` alone would drop it from
// chain mode, where it matters most.
test('isChainGroupable allows a fragment-level key, a chainKey, a tag or a field', () => {
  expect(isChainGroupable('tags.HP')).toBe(true)
  expect(isChainGroupable('name')).toBe(true)
  expect(isChainGroupable('firstOfPairStrand')).toBe(true)
  expect(isChainGroupable('pairOrientation')).toBe(true)
  expect(isChainGroupable('mateAssembly')).toBe(true)
  expect(isChainGroupable('strand')).toBe(false)
  expect(isChainGroupable('splitRead')).toBe(true)
  expect(GROUP_BY_DIMENSIONS.splitRead.fragmentLevel).toBe(false)
  expect(isChainGroupable('mapq')).toBe(false)
  expect(isChainGroupable(undefined)).toBe(false)
})

// Each entry names its own registry key, which is the field the alignments menu
// maps to radio options — a copy-paste naming a sibling would offer a radio that
// selects something else. Pinned at runtime as well as in the type because the
// type is the part a future edit can widen.
test('every dimension states its own registry key as its field', () => {
  for (const [key, dimension] of Object.entries(GROUP_BY_DIMENSIONS)) {
    expect(dimension.field).toBe(key)
  }
})

// A fragment has split evidence if either mate does, which the chain's
// representative read (the primary read1) cannot answer on its own — hence the
// dimension's own chainKey.
test('split-read grouping keys a chain off any read carrying SA', () => {
  // `name` is what chains the two, and it has to be spelled: a fixture that
  // leaves it off is two NAMELESS features, which `chainGroupingKey` now keys
  // apart (a PAF block has no QNAME either) rather than collapsing into one
  // accidental chain.
  const features = [
    feat('r1', { name: 'frag', flags: 0x40, tags: {} }),
    feat('r2', {
      name: 'frag',
      flags: 0x80,
      tags: { SA: 'ctgA,200,+,50M50S,60,0;' },
    }),
  ]
  const groups = partitionChains(features, { field: 'splitRead' })
  expect(groups.map(g => g.label)).toEqual(['Split (SA)'])
  expect(groups[0]!.features).toHaveLength(2)
})

test('partitionChains ungrouped is a single section holding every read', () => {
  const features = [
    feat('a', { name: 'r1', flags: 0 }),
    feat('b', { name: 'r2', flags: 0 }),
  ]
  const groups = partitionChains(features, undefined)
  expect(groups).toHaveLength(1)
  expect(groups[0]!.key).toBe('')
  expect(groups[0]!.features).toHaveLength(2)
})

test('partitionChains keeps every read of a chain in one group', () => {
  // read1 (HP 1) and its mate read2 carry the same HP tag, but even if a mate
  // lacked the tag the representative read's key decides the whole chain.
  const features = [
    feat('r1a', { name: 'r1', flags: 0x40, tags: { HP: 1 } }),
    feat('r1b', { name: 'r1', flags: 0x80, tags: { HP: 1 } }),
    feat('r2a', { name: 'r2', flags: 0x40, tags: { HP: 2 } }),
    feat('r2b', { name: 'r2', flags: 0x80, tags: { HP: 2 } }),
  ]
  const groups = partitionChains(features, { field: 'tags.HP' })
  expect(keys(groups)).toEqual(['1', '2'])
  expect(groups[0]!.features.map(f => f.id())).toEqual(['r1a', 'r1b'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['r2a', 'r2b'])
})

test('partitionChains keys a chain from its read1 representative', () => {
  // The mate (read2, no HP) would key as untagged, but the representative is the
  // primary read1, which carries HP 1 — so the whole chain lands in group '1'.
  const features = [
    feat('mate', { name: 'r1', flags: 0x80 }),
    feat('primary', { name: 'r1', flags: 0x40, tags: { HP: 1 } }),
  ]
  const groups = partitionChains(features, { field: 'tags.HP' })
  expect(keys(groups)).toEqual(['1'])
  expect(groups[0]!.features).toHaveLength(2)
})

test('partitionChains ignores supplementary/secondary for the key', () => {
  // The only primary read is read2 (HP 9); the supplementary record (HP absent)
  // must not be picked as representative.
  const features = [
    feat('supp', { name: 'r1', flags: 0x800 }),
    feat('prim', { name: 'r1', flags: 0x80, tags: { HP: 9 } }),
  ]
  const groups = partitionChains(features, { field: 'tags.HP' })
  expect(keys(groups)).toEqual(['9'])
})

// A high-cardinality grouping (a UMI-style tag) must not spawn a section per
// value: every section runs its own coverage pipeline over region-width arrays.
function umiFeatures(count: number) {
  return Array.from({ length: count }, (_, i) =>
    // zero-padded so the sorted order is the numeric order, making which values
    // survive the cap easy to state
    feat(`r${i}`, { tags: { RX: `v${String(i).padStart(3, '0')}` } }),
  )
}

test('group count is capped, with the tail merged into one overflow section', () => {
  const groups = partitionFeatures(umiFeatures(MAX_GROUPS + 10), {
    field: 'tags.RX',
  })
  expect(groups).toHaveLength(MAX_GROUPS)
  const overflow = groups.at(-1)!
  expect(overflow.key).toBe(OVERFLOW_GROUP_KEY)
  expect(overflow.label).toBe('11 merged values')
  // the keys it swallowed ride along, because only the main thread can say how
  // many the drawn lane ends up holding — see `orderedGroups`
  expect(overflow.mergedKeys).toHaveLength(11)
  expect(overflow.mergedKeys).toContain(
    `v${String(MAX_GROUPS + 9).padStart(3, '0')}`,
  )
  // no read is dropped: the merged tail carries every one of its groups' reads
  expect(groups.flatMap(g => g.features)).toHaveLength(MAX_GROUPS + 10)
  expect(overflow.features).toHaveLength(11)
  // the surviving named groups are the first MAX_GROUPS - 1 in key order
  expect(groups[0]!.key).toBe('v000')
  expect(groups[MAX_GROUPS - 2]!.key).toBe(
    `v${String(MAX_GROUPS - 2).padStart(3, '0')}`,
  )
})

test('exactly MAX_GROUPS values needs no overflow section', () => {
  const groups = partitionFeatures(umiFeatures(MAX_GROUPS), {
    field: 'tags.RX',
  })
  expect(groups).toHaveLength(MAX_GROUPS)
  expect(groups.map(g => g.key)).not.toContain(OVERFLOW_GROUP_KEY)
})

// Reads *lacking* the grouping tag are a distinct answer, not one arbitrary value
// among the merged tail — so the cap holds the untagged group out of the merge and
// re-pins it just ahead of the overflow bucket. It sorts into the tail
// (groupKeyRank), so a plain splice would have buried it in the merged bucket.
test('the untagged group survives the cap, pinned just ahead of the overflow', () => {
  // one untagged read plus enough tagged values to trip the cap
  const features = [feat('none', {}), ...umiFeatures(MAX_GROUPS + 5)]
  const groups = partitionFeatures(features, { field: 'tags.RX' })
  expect(groups).toHaveLength(MAX_GROUPS)
  expect(groups.map(g => g.key).slice(-2)).toEqual(['', OVERFLOW_GROUP_KEY])
  const untagged = groups.at(-2)!
  expect(untagged.label).toBe('RX: none')
  expect(untagged.features.map(f => f.id())).toEqual(['none'])
  // holding it out costs one named slot, and the merged tail grows by one to
  // match; still no reads dropped
  expect(groups.at(-1)!.label).toBe('7 merged values')
  expect(groups.at(-1)!.features).toHaveLength(7)
  expect(groups.flatMap(g => g.features)).toHaveLength(MAX_GROUPS + 6)
})

test('partitionChains caps groups too, keeping each chain whole', () => {
  // one two-read chain per tag value, so a naive per-read cap could split a chain
  const features = Array.from({ length: MAX_GROUPS + 5 }, (_, i) => {
    const tags = { RX: `v${String(i).padStart(3, '0')}` }
    return [
      feat(`r${i}a`, { name: `q${i}`, flags: 0x40, tags }),
      feat(`r${i}b`, { name: `q${i}`, flags: 0x80, tags }),
    ]
  }).flat()
  const groups = partitionChains(features, { field: 'tags.RX' })
  expect(groups).toHaveLength(MAX_GROUPS)
  expect(groups.flatMap(g => g.features)).toHaveLength((MAX_GROUPS + 5) * 2)
  // every group holds whole chains, i.e. an even number of reads (both mates)
  for (const g of groups) {
    expect(g.features.length % 2).toBe(0)
  }
})

test('the worker partitions in natural order and caps off the key set alone', () => {
  const features = [
    feat('a', { tags: { HP: 2 } }),
    feat('b', {}),
    feat('c', { tags: { HP: 1 } }),
  ]
  expect(keys(partitionFeatures(features, { field: 'tags.HP' }))).toEqual([
    '1',
    '2',
    '',
  ])
  expect(keys(partitionChains(features, { field: 'tags.HP' }))).toEqual([
    '1',
    '2',
    '',
  ])
  const last = `v${String(MAX_GROUPS + 9).padStart(3, '0')}`
  const groups = partitionFeatures(umiFeatures(MAX_GROUPS + 10), {
    field: 'tags.RX',
  })
  expect(groups.at(-1)!.mergedKeys).toContain(last)
})

test('the worker is sent the field, never the domain', () => {
  expect(workerGroupBy({ field: 'tags.HP', domain: ['2'] })).toEqual({
    field: 'tags.HP',
  })
  expect(workerGroupBy({ field: 'strand', domain: ['-1'] })).toEqual({
    field: 'strand',
  })
  expect(workerGroupBy(undefined)).toBeUndefined()
})

test('groupByForMode degrades a per-read dimension in chain mode only', () => {
  const perRead = { field: 'strand' as const }
  const chainSafe = { field: 'tags.HP' }
  expect(groupByForMode(perRead, false)).toBe(perRead)
  expect(groupByForMode(perRead, true)).toBeUndefined()
  expect(groupByForMode(chainSafe, true)).toBe(chainSafe)
  expect(groupByForMode(undefined, true)).toBeUndefined()
})

// The collision the display's per-group volatiles are keyed against: '' is the
// ungrouped lane's key and the catch-all bucket of three dimensions, so a key
// carried across a grouping change lands on a lane that never earned it. One
// test because the point is that the SAME string comes back from groupings
// that share nothing else.
test("'' is the ungrouped lane's key and several dimensions' catch-all", () => {
  const untagged = feat('a', { flags: 0, strand: 1 })
  const keyUnder = (groupBy?: GroupBy) =>
    partitionFeatures([untagged], groupBy)[0]!.key
  expect(keyUnder()).toBe('')
  expect(keyUnder({ field: 'tags.HP' })).toBe('')
  expect(keyUnder({ field: 'pairOrientation' })).toBe('')
  expect(keyUnder({ field: 'mateAssembly' })).toBe('')
})

test('groupKeySpaceOf separates the groupings that share a key', () => {
  const groupings: (GroupBy | undefined)[] = [
    undefined,
    { field: 'tags.HP' },
    { field: 'tags.RG' },
    { field: 'pairOrientation' },
    { field: 'mateAssembly' },
  ]
  const spaces = groupings.map(g => groupKeySpaceOf(g))
  expect(new Set(spaces).size).toBe(spaces.length)
})

test('a field no read dimension names keys by its value, labelled by the field', () => {
  const features = [
    feat('a', { sample: 'tumor' }),
    feat('b', {}),
    feat('c', { sample: 'normal' }),
  ]
  const groups = partitionFeatures(features, { field: 'sample' })
  expect(keys(groups)).toEqual(['normal', 'tumor', ''])
  expect(groups.map(g => g.label)).toEqual([
    'sample: normal',
    'sample: tumor',
    'sample: none',
  ])
})

test('a jexl field keys by what the expression answers', () => {
  const jexl = new PluginManager().jexl
  const features = [
    feat('a', { template_length: 900 }),
    feat('b', { template_length: 200 }),
  ]
  const groups = partitionFeatures(
    features,
    { field: "jexl:get(feature,'template_length') > 500" },
    jexl,
  )
  expect(keys(groups)).toEqual(['false', 'true'])
  expect(groups[1]!.features.map(f => f.id())).toEqual(['a'])
})
