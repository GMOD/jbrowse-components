import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { basePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import {
  readGroupConnections,
  resolveReadGroup,
} from './readGroupConnections.ts'
import { namesToBlock } from './readNameBlock.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'

interface ReadSpec {
  id: string
  flags: number
  start: number
  end: number
  strand: 1 | -1
  clipAtStart?: number
  // This segment's own SA tag records — what the read says about the segments
  // that are not this one, whether or not any region fetched them.
  sa?: string[]
}

interface Entry {
  data: PileupDataResult
  readIdx: number
  // Test-only label, so an assertion names the read rather than an index.
  id: string
}

// One entry per spec, all sharing a QNAME — the shape `groupReadsByName` hands
// the resolver. `region` lets a read appear in two regions with the SAME readId,
// which is the cross-region duplicate the readId dedup exists for.
function entries(specs: ReadSpec[], region = 0): Entry[] {
  const n = specs.length
  const data: PileupDataResult = {
    ...basePileupDataResult(n),
    readPositions: new Uint32Array(specs.flatMap(s => [s.start, s.end])),
    readFlags: new Uint16Array(specs.map(s => s.flags)),
    readStrands: new Int8Array(specs.map(s => s.strand)),
    // optional, so the base leaves it out — this suite is about read-order
    // sorting, which is the one thing it decides
    readClipAtStart: new Uint32Array(specs.map(s => s.clipAtStart ?? 0)),
    readSuppAlignments: specs.map(s => s.sa?.join(';') ?? ''),
    readKeys: specs.map(s => s.id),
    ...namesToBlock(specs.map(() => 'readA')),
  }
  return specs.map((s, readIdx) => ({
    data,
    readIdx,
    id: `${s.id}${region === 0 ? '' : `@r${region}`}`,
  }))
}

// Connections as `${id1}-${id2}` plus whether each is a split junction, which is
// everything the callers actually consume.
function links(es: Entry[]) {
  return readGroupConnections(es).map(
    c => `${c.e1.id}-${c.e2.id}${c.isSplit ? ' split' : ' mate'}`,
  )
}

const PRIMARY_1 = SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR
const PRIMARY_2 = SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR
const SUPP_1 = PRIMARY_1 | SAM_FLAG_SUPPLEMENTARY

describe('readGroupConnections', () => {
  test('two mates on screen produce one mate link', () => {
    expect(
      links(
        entries([
          { id: 'a', flags: PRIMARY_1, start: 100, end: 200, strand: 1 },
          { id: 'b', flags: PRIMARY_2, start: 900, end: 1000, strand: -1 },
        ]),
      ),
    ).toEqual(['a-b mate'])
  })

  test('a lone mate produces nothing — no dangling link', () => {
    expect(
      links(
        entries([
          { id: 'a', flags: PRIMARY_1, start: 100, end: 200, strand: 1 },
        ]),
      ),
    ).toEqual([])
  })

  test("each mate's own split segments chain, plus the one mate link", () => {
    // Mate 1 is split into two segments; mate 2 is whole. The mate link joins
    // the two PRIMARIES (a1, b) — not a1's supplementary — because the primary
    // is what carries the pair's orientation and template length.
    expect(
      links(
        entries([
          {
            id: 'a1',
            flags: PRIMARY_1,
            start: 100,
            end: 200,
            strand: 1,
            clipAtStart: 0,
          },
          {
            id: 'a2',
            flags: SUPP_1,
            start: 500,
            end: 600,
            strand: 1,
            clipAtStart: 100,
          },
          { id: 'b', flags: PRIMARY_2, start: 900, end: 1000, strand: -1 },
        ]),
      ),
    ).toEqual(['a1-a2 split', 'a1-b mate'])
  })

  test('split segments chain in READ order, not genomic order', () => {
    // An inversion: the second segment in read order (clip 100) maps to a LOWER
    // genomic coordinate than the first. Sorting genomically would chain them
    // backwards; the clip-at-start-of-read key is what gets this right.
    expect(
      links(
        entries([
          {
            id: 'far',
            flags: SAM_FLAG_SUPPLEMENTARY,
            start: 100,
            end: 200,
            strand: -1,
            clipAtStart: 100,
          },
          {
            id: 'near',
            flags: 0,
            start: 500,
            end: 600,
            strand: 1,
            clipAtStart: 0,
          },
        ]),
      ),
    ).toEqual(['near-far split'])
  })

  test('a secondary alignment never joins its primary', () => {
    // A competing mapping of the same bases elsewhere (an RNA-seq multimapper).
    // Chaining it would draw a connector spanning to the wrong locus.
    expect(
      links(
        entries([
          { id: 'a', flags: PRIMARY_1, start: 100, end: 200, strand: 1 },
          {
            id: 'sec',
            flags: PRIMARY_1 | SAM_FLAG_SECONDARY,
            start: 9000,
            end: 9100,
            strand: 1,
          },
        ]),
      ),
    ).toEqual([])
  })

  test('a mate-unmapped read keeps its own split junction', () => {
    // Mate-unmapped reads are deliberately NOT filtered: the only same-name
    // members are this read's own segments, so dropping them would delete a
    // legitimate junction. The lone-mate guard is what stops the dangling link.
    const flags = PRIMARY_1 | SAM_FLAG_MATE_UNMAPPED
    expect(
      links(
        entries([
          { id: 'a1', flags, start: 100, end: 200, strand: 1, clipAtStart: 0 },
          {
            id: 'a2',
            flags: flags | SAM_FLAG_SUPPLEMENTARY,
            start: 500,
            end: 600,
            strand: 1,
            clipAtStart: 100,
          },
        ]),
      ),
    ).toEqual(['a1-a2 split'])
  })

  test('the same read fetched from two regions is one segment, not a split', () => {
    // A read spanning a region boundary is returned by BOTH regions' fetches
    // under one readId. Without the dedup the copies look like a 2-segment split
    // read and a self-junction is fabricated.
    const spec: ReadSpec = {
      id: 'a',
      flags: 0,
      start: 100,
      end: 200,
      strand: 1,
    }
    expect(links([...entries([spec], 0), ...entries([spec], 1)])).toEqual([])
  })

  test('an unpaired long read chains every segment in one sub-read', () => {
    expect(
      links(
        entries([
          {
            id: 's1',
            flags: 0,
            start: 100,
            end: 200,
            strand: 1,
            clipAtStart: 0,
          },
          {
            id: 's2',
            flags: SAM_FLAG_SUPPLEMENTARY,
            start: 500,
            end: 600,
            strand: 1,
            clipAtStart: 100,
          },
          {
            id: 's3',
            flags: SAM_FLAG_SUPPLEMENTARY,
            start: 900,
            end: 1000,
            strand: 1,
            clipAtStart: 200,
          },
        ]),
      ),
    ).toEqual(['s1-s2 split', 's2-s3 split'])
  })
})

// Consecutive ON SCREEN is not consecutive on the molecule: the read's SA tags
// name every segment it has, and a junction between two fetched ones may step
// over any number the view never loaded. That is the difference between a real
// rearrangement and a drawn one, so the junction reports it.
describe('a junction over segments no region fetched', () => {
  const canonical = (refName: string) => refName
  // Both fetched segments sit at read bases 0-100 and 300-400; the read declares
  // a third at 100-300 that only its tag knows about.
  const twoOfThree = () =>
    entries(
      [
        {
          id: 'a',
          flags: 0,
          start: 100,
          end: 200,
          strand: 1,
          clipAtStart: 0,
          sa: ['ctgA,501,+,100S200M100S,60,0', 'ctgA,1001,+,300S100M,60,0'],
        },
        {
          id: 'b',
          flags: SAM_FLAG_SUPPLEMENTARY,
          start: 1000,
          end: 1100,
          strand: 1,
          clipAtStart: 300,
          sa: ['ctgA,101,+,100M300S,60,0', 'ctgA,501,+,100S200M100S,60,0'],
        },
      ],
      0,
    )

  test('names the segment between them, and only it', () => {
    expect(
      readGroupConnections(twoOfThree(), canonical).map(
        c => c.hiddenSegmentsBetween,
      ),
    ).toEqual([['ctgA:501-700']])
  })

  test('says nothing without the normalizer that turns the walk on', () => {
    expect(
      readGroupConnections(twoOfThree()).map(c => c.hiddenSegmentsBetween),
    ).toEqual([undefined])
  })

  test('a mate link is never marked — it joins two molecules, not two segments', () => {
    expect(
      readGroupConnections(
        entries([
          {
            id: 'm1',
            flags: PRIMARY_1,
            start: 100,
            end: 200,
            strand: 1,
            sa: ['ctgA,501,+,100S200M100S,60,0'],
          },
          {
            id: 'm2',
            flags: PRIMARY_2,
            start: 900,
            end: 1000,
            strand: -1,
          },
        ]),
        canonical,
      ).map(c => c.hiddenSegmentsBetween),
    ).toEqual([undefined])
  })
})

describe('resolveReadGroup loneMateLink', () => {
  const hooks = {
    chainMate: (segs: Entry[]) => segs.map(s => `chain:${s.id}`),
    mateLink: (p1: Entry, p2: Entry) => `mate:${p1.id}-${p2.id}`,
    loneMateLink: (p: Entry) => [`lone:${p.id}`],
  }

  test('fires when only one mate is on screen', () => {
    expect(
      resolveReadGroup(
        entries([
          { id: 'a', flags: PRIMARY_1, start: 100, end: 200, strand: 1 },
        ]),
        hooks,
      ),
    ).toEqual(['chain:a', 'lone:a'])
  })

  test('fires for a SPLIT read whose mate is off screen', () => {
    // The regression this hook exists for: two on-screen entries that are both
    // the SAME mate. An entry count reads that as "both mates present" and
    // suppresses the link; the mate partition sees the empty second side.
    expect(
      resolveReadGroup(
        entries([
          { id: 'a1', flags: PRIMARY_1, start: 100, end: 200, strand: 1 },
          { id: 'a2', flags: SUPP_1, start: 500, end: 600, strand: 1 },
        ]),
        hooks,
      ),
    ).toEqual(['chain:a1', 'chain:a2', 'lone:a1'])
  })

  test('does NOT fire when both mates are present', () => {
    expect(
      resolveReadGroup(
        entries([
          { id: 'a', flags: PRIMARY_1, start: 100, end: 200, strand: 1 },
          { id: 'b', flags: PRIMARY_2, start: 900, end: 1000, strand: -1 },
        ]),
        hooks,
      ),
    ).toEqual(['chain:a', 'chain:b', 'mate:a-b'])
  })

  test('does NOT fire for an unpaired read', () => {
    // No mate exists to link to, off screen or otherwise.
    expect(
      resolveReadGroup(
        entries([{ id: 'a', flags: 0, start: 100, end: 200, strand: 1 }]),
        hooks,
      ),
    ).toEqual(['chain:a'])
  })

  test('does NOT fire when the only entry is secondary', () => {
    // Filtered before the partition, so the group has no paired survivor and a
    // spurious mate link is never anchored at the secondary's locus.
    expect(
      resolveReadGroup(
        entries([
          {
            id: 'sec',
            flags: PRIMARY_1 | SAM_FLAG_SECONDARY,
            start: 100,
            end: 200,
            strand: 1,
          },
        ]),
        hooks,
      ),
    ).toEqual([])
  })

  test('defaults to emitting nothing when the caller omits it', () => {
    // What a renderer drawing between two on-screen reads needs: it has no
    // second endpoint, so a lone mate must produce no connection at all.
    expect(
      resolveReadGroup(
        entries([
          { id: 'a', flags: PRIMARY_1, start: 100, end: 200, strand: 1 },
        ]),
        { chainMate: hooks.chainMate, mateLink: hooks.mateLink },
      ),
    ).toEqual(['chain:a'])
  })
})
