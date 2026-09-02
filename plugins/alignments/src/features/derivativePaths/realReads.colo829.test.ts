import { chainsFromSamRecords } from '../../LinearAlignmentsDisplay/samRecordFixture.ts'
import { computeDerivativePaths } from './computePaths.ts'
import { letterSegments } from './letterSegments.ts'
import {
  COLO829_REGION as REGION,
  COLO829_TUMOUR as TUMOUR,
} from './realReads.colo829.fixture.ts'

import type { SamRecordFixture } from '../../LinearAlignmentsDisplay/samRecordFixture.ts'

// COLO829 at the chr3 breakpoints of its der(3), tumour and matched normal, so
// the headline number this feature reports — "N reads describe this allele" — is
// pinned against records rather than against a hand-built chain. The synthetic
// der(3) in computePaths.test.ts gives every read the same outer edges, which is
// the one property real reads never share, and that is what the grouping bug
// this file was added with fed on: it passed every synthetic case while
// reporting the real allele as two candidates, at 16 reads and 10 reads.
//
// Both fixtures are every record overlapping the window that takes part in a
// multi-segment chain, verbatim, one selection rule for both so the tumour and
// its control are comparable. The tumour's command is with its records in
// realReads.colo829.fixture.ts; the normal's is
//
//   samtools view -F 1540 \
//     https://ont-open-data.s3.amazonaws.com/colo829_2024.03/basecalls/colo829bl/sup/PAU59807.d052sup4305mCG_5hmCGvHg38.bam \
//     chr3:25357600-25361000

// The same window in the matched normal. One read of the seventy-eight there
// carries an SA tag at all, and it points at an unplaced contig with MAPQ 9.
const NORMAL: SamRecordFixture[] = [
  {
    name: '519ae516-29b3-4d7c-976a-ef582c84c39d',
    flag: 0,
    strand: 1,
    pos: 25338258,
    CIGAR:
      '140M2I40M1I447M1I13M1D15M1D916M3D388M1D336M1I343M1I1356M1D318M1D447M14D418M1I1310M1I231M1I374M1D292M1I3049M1I522M1I429M1D1288M4D459M1D1119M2I528M1I520M2D546M1D669M1D79M2D12M1D5M1D1215M1D3M1I396M1D2421M5D169M1D1663M1D936M4D1226M1I1658M10357S',
    SA: 'chr1_KI270709v1_random,3284,+,26312S7467M1564D2891S,9,1748;',
  },
]

function candidatesFor(records: SamRecordFixture[]) {
  const chains = chainsFromSamRecords(records, REGION)
  return { chains, candidates: computeDerivativePaths({ chains }) }
}

describe('COLO829 der(3), tumour', () => {
  it('reports the allele once, with every read that crosses it', () => {
    const { chains, candidates } = candidatesFor(TUMOUR)
    // 37 of the reads in this window carry a junction at all; the rest clip at
    // the breakpoint without a placed supplementary.
    expect(chains).toHaveLength(37)

    // The der(3) allele, on ONE row rather than two. The reads describing it
    // split roughly 18/10 between the two directions it can be read in: a read
    // covering a long stretch of the first chr3 arm reads it one way, a read
    // that clips early there but runs far down the last arm reads it the other.
    // Any grouping rule that consults an outer read edge therefore reports one
    // event as two.
    expect(candidates[0]!.segments.map(seg => seg.refName)).toEqual([
      'chr3',
      'chr10',
      'chr12',
      'chr3',
    ])
    expect(candidates[0]!.readCount).toBe(28)

    // The second row is not noise and not a duplicate of the first: it is the
    // three-segment path chr3 -> chr10 -> chr3 that SKIPS the 183 bp chr12
    // templated insert the top row claims. Two reads take it. That disagreement
    // is the one thing a picture built only from the supporting reads cannot
    // show, so it must survive to the picker rather than be absorbed.
    expect(candidates).toHaveLength(2)
    expect(candidates[1]!.readCount).toBe(2)
    expect(candidates[1]!.refNames).not.toContain('chr12')
  })

  it('lays the allele out in the orientation sv_multihop.py derive reports', () => {
    const [candidate] = candidatesFor(TUMOUR).candidates
    expect(candidate!.segments.map(seg => [seg.refName, seg.strand])).toEqual([
      ['chr3', 1],
      ['chr10', 1],
      ['chr12', -1],
      ['chr3', -1],
    ])
    // The junction coordinates the tutorial publishes, from the reads alone:
    // chr3 runs out at 25,359,568, 199 bp of chr10 follows, then 183 bp of
    // chr12 inverted, then chr3 resumes inverted from 25,359,111 downward. Only
    // the junctions are asserted; the outer edges are the widest read's.
    const segs = candidate!.segments
    expect(segs[0]!.end).toBe(25_359_568)
    expect([segs[1]!.start, segs[1]!.end]).toEqual([58_717_463, 58_717_662])
    expect([segs[2]!.start, segs[2]!.end]).toEqual([72_273_111, 72_273_294])
    expect(segs[3]!.end).toBe(25_359_111)
  })

  it('letters it as the inverted duplication the papers describe', () => {
    // The returning arm lies inside the outgoing one, so its edges cut that arm
    // into A B | C and B is carried twice, once each way: a DUP-INV with 382 bp
    // of chr10 and chr12 templated in at the fold.
    const [candidate] = candidatesFor(TUMOUR).candidates
    const { derivative, pieces } = letterSegments(candidate!.observedSegments)
    expect(derivative).toBe('A B C D E′ B′')
    expect(pieces.map(p => [p.letter, p.refName, p.copies])).toEqual([
      ['A', 'chr3', 1],
      ['B', 'chr3', 2],
      ['C', 'chr3', 1],
      ['D', 'chr10', 1],
      ['E', 'chr12', 1],
    ])
  })

  it('is not sensitive to the order the reads arrive in', () => {
    // The grouping key has to be a property of the allele, so reversing the
    // fetch cannot move a read between candidates or change which end the
    // allele is presented from.
    const forward = candidatesFor(TUMOUR).candidates
    const reversed = candidatesFor([...TUMOUR].reverse()).candidates
    expect(reversed).toHaveLength(2)
    expect(reversed[0]!.readCount).toBe(28)
    expect(reversed.map(c => c.locString)).toEqual(
      forward.map(c => c.locString),
    )
  })

  it('reports the same allele wherever the locus sits', () => {
    // The same records at a different absolute coordinate are the same answer.
    // They were not: junction endpoints were rounded into fixed `tolerance`-wide
    // cells, so whether two reads agreed depended on which side of a cell edge
    // their junction fell. Swept over one cell width these records reported
    // anything from 24 to 28 reads, and grew a spurious second candidate at 14
    // of the 20 offsets -- the published figure's read count was a property of
    // where chr3's breakpoint sits relative to a multiple of 20.
    const shift = (records: SamRecordFixture[], by: number) =>
      records.map(record => ({
        ...record,
        pos: record.pos + by,
        SA: record.SA
          ? `${record.SA.split(';')
              .filter(Boolean)
              .map(entry => {
                const parts = entry.split(',')
                parts[1] = String(Number(parts[1]) + by)
                return parts.join(',')
              })
              .join(';')};`
          : record.SA,
      }))
    for (let by = 0; by < 20; by++) {
      const chains = chainsFromSamRecords(shift(TUMOUR, by), {
        ...REGION,
        start: REGION.start + by,
        end: REGION.end + by,
      })
      const candidates = computeDerivativePaths({ chains })
      expect(candidates).toHaveLength(2)
      expect(candidates[0]!.readCount).toBe(28)
    }
  })
})

describe('COLO829BL matched normal, same window', () => {
  it('proposes nothing where the tumour proposes an allele', () => {
    // The specificity check the tutorial's side-by-side figure makes visually.
    // The normal has one split read here, and it is a mismapping: MAPQ 9 onto
    // an unplaced contig. That is exactly what the minReads floor is for, so
    // the run that finds a 26-read allele in the tumour finds nothing here.
    const { chains, candidates } = candidatesFor(NORMAL)
    expect(chains).toHaveLength(1)
    expect(chains[0]![1]!.refName).toBe('chr1_KI270709v1_random')
    expect(candidates).toEqual([])
  })

  it('would still not propose it with the floor removed', () => {
    // Lowering minReads surfaces the mismapping as a one-read path rather than
    // conjuring the tumour's allele, i.e. the normal genuinely carries no
    // evidence for it and is not merely being filtered.
    const chains = chainsFromSamRecords(NORMAL, REGION)
    const loose = computeDerivativePaths({ chains, minReads: 1 })
    expect(loose).toHaveLength(1)
    expect(loose[0]!.refNames).not.toContain('chr10')
    expect(loose[0]!.refNames).not.toContain('chr12')
  })
})
