import { parseCigar2 } from '@jbrowse/cigar-utils'

import { findPosInCigar } from './findPosInCigar.ts'

describe('findPosInCigar', () => {
  it('pure match advances both axes equally up to startX', () => {
    expect(findPosInCigar(parseCigar2('100='), 50)).toEqual([50, 50])
    expect(findPosInCigar(parseCigar2('100='), 100)).toEqual([100, 100])
  })

  it('startX past the CIGAR end returns the totals (capped)', () => {
    // 50 matches in CIGAR, user asks for 100bp → got 50 on each axis
    expect(findPosInCigar(parseCigar2('50='), 100)).toEqual([50, 50])
  })

  it('insertions advance only the mate axis', () => {
    // 100M then 10I then 100M; startX=150 consumes the I fully
    // 100 match → featX=100, mateX=100; 10I → mateX=110; 50 match → 150,160
    expect(findPosInCigar(parseCigar2('100=10I100='), 150)).toEqual([150, 160])
  })

  it('insertions at the exact breakpoint are NOT consumed', () => {
    // featX hits startX=100 after the first 100=, the loop breaks before the
    // 10I is seen. Half-open `[start, end)` tie-break: a boundary insertion
    // belongs to the region whose START it is, not the one whose END it is.
    expect(findPosInCigar(parseCigar2('100=10I100='), 100)).toEqual([100, 100])
  })

  it('deletions advance only the feature axis', () => {
    // 100M, 10D, then more match; startX=150 spans the deletion
    // 100 match → 100,100; 10D → featX=110; 40 match → 150,140
    expect(findPosInCigar(parseCigar2('100=10D100='), 150)).toEqual([150, 140])
  })

  it('treats M / = / X identically (all consume both axes)', () => {
    expect(findPosInCigar(parseCigar2('50M'), 30)).toEqual([30, 30])
    expect(findPosInCigar(parseCigar2('50='), 30)).toEqual([30, 30])
    expect(findPosInCigar(parseCigar2('50X'), 30)).toEqual([30, 30])
  })

  it('startX=0 returns [0,0] without consuming anything', () => {
    expect(findPosInCigar(parseCigar2('100=10I100='), 0)).toEqual([0, 0])
  })

  it('mixed CIGAR string walks correctly', () => {
    // 30M 5I 20D 40M; ask startX=60
    //  - 30M → 30,30
    //  - 5I  → 30,35  (mate-only)
    //  - 20D → 50,35  (feat-only, cap min(20, 60-30)=20 → wait, 60-50=10)
    //    actually: min(20, 60-30) = min(20, 30) = 20 → featX 30→50, mateX 35
    //  - 40M → cap min(40, 60-50)=10 → featX 50→60, mateX 35→45
    expect(findPosInCigar(parseCigar2('30M5I20D40M'), 60)).toEqual([60, 45])
  })

  it('startX inside a deletion run caps the deletion partially', () => {
    // 30M 50D 30M; startX=50
    //  - 30M → 30,30
    //  - 50D capped at min(50, 50-30)=20 → featX 30→50, mateX stays 30
    expect(findPosInCigar(parseCigar2('30M50D30M'), 50)).toEqual([50, 30])
  })

  it('unknown ops (S/H/N) are silently skipped', () => {
    // 10S 100M — soft-clip should be ignored; 50bp ask hits matches directly
    expect(findPosInCigar(parseCigar2('10S100M'), 50)).toEqual([50, 50])
  })
})
