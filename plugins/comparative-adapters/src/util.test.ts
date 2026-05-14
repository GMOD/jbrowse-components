import { flipCigar, parsePanSN } from './util.ts'

test('flip cigar', () => {
  expect(flipCigar('3M5D5M5I6M')).toEqual('6M5D5M5I3M')
})

describe('parsePanSN', () => {
  test('3-part PanSN: sample#hap#contig', () => {
    const r = parsePanSN('HG002#1#chr20')
    expect(r.genome).toBe('HG002#1')
    expect(r.refName).toBe('chr20')
    expect(r.subwalkStart).toBe(0)
    expect(r.subwalkEnd).toBe(0)
  })

  test('2-part PanSN: sample#contig', () => {
    const r = parsePanSN('volvox#ctgA')
    expect(r.genome).toBe('volvox')
    expect(r.refName).toBe('ctgA')
  })

  test('bare name maps genome=refName', () => {
    const r = parsePanSN('chr20')
    expect(r.genome).toBe('chr20')
    expect(r.refName).toBe('chr20')
  })

  test('4-part name: drops fragment, aggregates to sample#hap', () => {
    const r = parsePanSN('HG002#1#chr20#frag1')
    expect(r.genome).toBe('HG002#1')
    expect(r.refName).toBe('chr20')
  })

  test('odgi colon subwalk suffix: sample#0#chr20:100-200', () => {
    const r = parsePanSN('GRCh38#0#chr20:100864-26386516')
    expect(r.genome).toBe('GRCh38#0')
    expect(r.refName).toBe('chr20')
    expect(r.subwalkStart).toBe(100864)
    expect(r.subwalkEnd).toBe(26386516)
  })

  test('volvox odgi colon subwalk: volvox#0#ctgB:0-6079', () => {
    const r = parsePanSN('volvox#0#ctgB:0-6079')
    expect(r.genome).toBe('volvox#0')
    expect(r.refName).toBe('ctgB')
    expect(r.subwalkStart).toBe(0)
    expect(r.subwalkEnd).toBe(6079)
  })

  test('vg bracket subwalk suffix: sample#chr20[100-200]', () => {
    const r = parsePanSN('HG002#chr20[100864-26386516]')
    expect(r.genome).toBe('HG002')
    expect(r.refName).toBe('chr20')
    expect(r.subwalkStart).toBe(100864)
    expect(r.subwalkEnd).toBe(26386516)
  })
})
