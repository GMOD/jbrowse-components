import { matchesCytosineContext } from './cytosineContext.ts'

describe('matchesCytosineContext forward strand', () => {
  // seq index:  0123456
  //             A C G C A C T  -> 'ACGCACT'
  const seq = 'ACGCACT'

  test('CpG matches C followed by G', () => {
    expect(matchesCytosineContext(seq, 1, false, 'CG')).toBe(true) // C@1,G@2
    expect(matchesCytosineContext(seq, 3, false, 'CG')).toBe(false) // C@3,A@4
  })

  test('CHG matches C, H (A/C/T), then G', () => {
    // C@3, A@4 (H), C@5 ... not G -> false; build a CHG explicitly
    expect(matchesCytosineContext('CAG', 0, false, 'CHG')).toBe(true)
    expect(matchesCytosineContext('CGG', 0, false, 'CHG')).toBe(false) // 2nd is G, not H
    expect(matchesCytosineContext('CAA', 0, false, 'CHG')).toBe(false) // 3rd not G
  })

  test('CHH matches C then two H', () => {
    expect(matchesCytosineContext('CAT', 0, false, 'CHH')).toBe(true)
    expect(matchesCytosineContext('CAG', 0, false, 'CHH')).toBe(false) // 3rd is G
    expect(matchesCytosineContext('CGT', 0, false, 'CHH')).toBe(false) // 2nd is G
  })

  test('all matches any cytosine regardless of neighbours', () => {
    expect(matchesCytosineContext('CAA', 0, false, 'all')).toBe(true)
    expect(matchesCytosineContext('GAA', 0, false, 'all')).toBe(false)
  })

  test('runs off the end of the sequence -> no match', () => {
    expect(matchesCytosineContext('AC', 1, false, 'CG')).toBe(false) // no base after C
  })
})

describe('matchesCytosineContext reverse strand', () => {
  // Reverse reads are matched in stored-sequence space: read backwards from pos
  // and complement. A template CpG (C-G) appears as G@pos preceded by C@pos-1.
  test('CpG: G preceded by C', () => {
    expect(matchesCytosineContext('CG', 1, true, 'CG')).toBe(true) // compl(G)=C, compl(C)=G
    expect(matchesCytosineContext('AG', 1, true, 'CG')).toBe(false)
  })

  test('CHG: stored C, H-complement, G reading backwards', () => {
    // template C-H-G  -> stored (revcomp space) reads pos,pos-1,pos-2 complemented
    // pick stored 'CAG' read at pos=2: compl(G)=C(✓C), compl(A)=T(H ✓), compl(C)=G(✓G)
    expect(matchesCytosineContext('CAG', 2, true, 'CHG')).toBe(true)
    // stored 'CCG' at pos2: compl(G)=C, compl(C)=G -> not H -> false
    expect(matchesCytosineContext('CCG', 2, true, 'CHG')).toBe(false)
  })

  test('CHH: stored, two H complements reading backwards', () => {
    // stored 'AAG' at pos2: compl(G)=C(✓), compl(A)=T(H✓), compl(A)=T(H✓)
    expect(matchesCytosineContext('AAG', 2, true, 'CHH')).toBe(true)
    // stored 'CAG' at pos2: 3rd compl(C)=G -> not H -> false
    expect(matchesCytosineContext('CAG', 2, true, 'CHH')).toBe(false)
  })

  test('runs off the start of the sequence -> no match', () => {
    expect(matchesCytosineContext('CG', 0, true, 'CG')).toBe(false) // no base before pos 0
  })
})
