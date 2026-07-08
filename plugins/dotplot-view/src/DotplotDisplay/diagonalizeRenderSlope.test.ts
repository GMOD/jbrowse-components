import { diagonalizeRegions } from '@jbrowse/core/util/diagonalizeRegions'
import { bpToCumBp, buildBpRegionIndex } from '@jbrowse/synteny-core'

import type { Region } from '@jbrowse/core/util'
import type { AlignmentData } from '@jbrowse/core/util/diagonalizeRegions'

// End-to-end invariant guard: the reversal decision that `diagonalizeRegions`
// makes for a query (vertical-axis) contig, once fed through the dotplot render
// coordinate transform, must turn that contig's dominant alignment into a clean
// POSITIVE (parallel) diagonal — never an anti-diagonal. `diagonalizeRegions`
// (reorder + reverse decision) and the render's strand-swap are each covered in
// isolation (diagonalize.test.ts, executeDotplotFeaturesAndPositions.test.ts);
// only their composition catches a sign flip in either one silently
// reintroducing inverted-looking main diagonals. Verified against real cgiab
// (HG008T.hap1 vs GRCh38) data: 0 contigs had a dominant alignment render
// negative.

// Mirror executeDotplotFeaturesAndPositions exactly: reverse-strand features
// swap start/end on the H (reference) axis; both axes then go through bpToCumBp,
// which applies each region's `reversed` flag. A segment reads as a clean
// forward diagonal when both axes advance in the same direction in cumBp space
// — i.e. sign(p12 - p11) === sign(p22 - p21). Opposite signs = anti-diagonal
// (the inverted-looking artifact).
function renderedIsParallel(
  aln: AlignmentData,
  refRegions: Region[],
  queryRegions: Region[],
) {
  const hIndex = buildBpRegionIndex({
    bpPerPx: 1,
    minimumBlockWidth: 0,
    displayedRegions: refRegions,
  })
  const vIndex = buildBpRegionIndex({
    bpPerPx: 1,
    minimumBlockWidth: 0,
    displayedRegions: queryRegions,
  })
  const f1s = aln.strand === -1 ? aln.refEnd : aln.refStart
  const f1e = aln.strand === -1 ? aln.refStart : aln.refEnd
  const p11 = bpToCumBp(hIndex, aln.refRefName, f1s)!
  const p12 = bpToCumBp(hIndex, aln.refRefName, f1e)!
  const p21 = bpToCumBp(vIndex, aln.queryRefName, aln.queryStart)!
  const p22 = bpToCumBp(vIndex, aln.queryRefName, aln.queryEnd)!
  return Math.sign(p12 - p11) === Math.sign(p22 - p21)
}

describe('diagonalize + render slope composition', () => {
  const refRegions: Region[] = [
    { refName: 'ref1', start: 0, end: 100000, assemblyName: 'ref' },
  ]
  // one forward-aligning contig, one reverse-aligning contig
  const queryRegions: Region[] = [
    { refName: 'fwd', start: 0, end: 100000, assemblyName: 'query' },
    { refName: 'rev', start: 0, end: 100000, assemblyName: 'query' },
  ]
  const fwdAln: AlignmentData = {
    refRefName: 'ref1',
    queryRefName: 'fwd',
    refStart: 0,
    refEnd: 80000,
    queryStart: 0,
    queryEnd: 80000,
    strand: 1,
  }
  const revAln: AlignmentData = {
    refRefName: 'ref1',
    queryRefName: 'rev',
    refStart: 0,
    refEnd: 80000,
    // reverse-strand: query runs antiparallel to the reference
    queryStart: 0,
    queryEnd: 80000,
    strand: -1,
  }

  test('reverse-strand contig renders as an anti-diagonal WITHOUT diagonalize', () => {
    // Baseline: with no reversal applied, the reverse alignment is inverted —
    // this is the appearance diagonalize is meant to correct.
    expect(renderedIsParallel(revAln, refRegions, queryRegions)).toBe(false)
  })

  test('after diagonalize, every contig dominant alignment renders parallel', async () => {
    const { newRegions } = await diagonalizeRegions(
      [fwdAln, revAln],
      refRegions,
      queryRegions,
    )
    // sanity: diagonalize flipped exactly the reverse contig
    expect(newRegions.find(r => r.refName === 'fwd')?.reversed).toBe(false)
    expect(newRegions.find(r => r.refName === 'rev')?.reversed).toBe(true)

    // the reference axis is held fixed; the query axis carries the reversal
    for (const aln of [fwdAln, revAln]) {
      expect(renderedIsParallel(aln, refRegions, newRegions)).toBe(true)
    }
  })

  test('forward alignment on a reversed contig becomes an anti-diagonal (minority-strand residual is expected, not a bug)', async () => {
    // A contig whose MAJORITY is reverse gets flipped; a minority forward
    // alignment within it then reads anti-diagonal. This documents that such
    // residual anti-diagonals are the correct, expected output — not a
    // regression to hunt down.
    const mostlyRev: AlignmentData[] = [
      { ...revAln, refStart: 0, refEnd: 80000, queryStart: 0, queryEnd: 80000 },
      {
        refRefName: 'ref1',
        queryRefName: 'rev',
        refStart: 90000,
        refEnd: 95000,
        queryStart: 90000,
        queryEnd: 95000,
        strand: 1, // minority forward alignment
      },
    ]
    const { newRegions } = await diagonalizeRegions(
      mostlyRev,
      refRegions,
      queryRegions.filter(r => r.refName === 'rev'),
    )
    expect(newRegions.find(r => r.refName === 'rev')?.reversed).toBe(true)
    // dominant (reverse) alignment is parallel; minority (forward) is not
    expect(renderedIsParallel(mostlyRev[0]!, refRegions, newRegions)).toBe(true)
    expect(renderedIsParallel(mostlyRev[1]!, refRegions, newRegions)).toBe(false)
  })
})
