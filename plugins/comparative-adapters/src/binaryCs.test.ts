import {
  encodeBinaryCs,
  decodeBinaryCs,
  binaryCsIdentity,
  binaryCsToCigar,
  binaryCsFlip,
} from './binaryCs.ts'
import { csToCigar } from './csUtils.ts'

describe('encodeBinaryCs / decodeBinaryCs round-trip', () => {
  const cases = [
    ':100',
    ':50:30',
    '*ac',
    '*ac*gt',
    '+acgt',
    '-acgt',
    '+a',
    '-tt',
    ':100*ac:50+ggg:200',
    ':12*gt*gt*ca*ca*ac*ac*tg*tg*gt*gt*ca*ca:12:12',
    ':100-acgt+tttt:50',
    '',
    ':1',
    ':63',
    ':64',
    ':127',
    ':128',
    ':1000',
    ':16383',
    ':16384',
    '+acgtacgtacgtacgtacgt',
  ]

  for (const cs of cases) {
    it(`round-trips: ${cs || '(empty)'}`, () => {
      const binary = encodeBinaryCs(cs)
      const decoded = decodeBinaryCs(binary)
      expect(decoded).toBe(cs)
    })
  }

  it('maps N bases to A (2-bit limitation)', () => {
    const binary = encodeBinaryCs('-nnn')
    const decoded = decodeBinaryCs(binary)
    // N is not representable in 2-bit encoding, maps to A (0)
    expect(decoded).toBe('-aaa')
  })

  it('skips zero-length match', () => {
    const binary = encodeBinaryCs(':0:100')
    const decoded = decodeBinaryCs(binary)
    expect(decoded).toBe(':100')
  })
})

describe('binaryCsIdentity', () => {
  it('computes identity for pure match', () => {
    const bin = encodeBinaryCs(':100')
    expect(binaryCsIdentity(bin)).toBeCloseTo(1.0)
  })

  it('computes identity with substitutions', () => {
    const bin = encodeBinaryCs(':95*ac*gt*ca*tg*at')
    // 95 match, 5 mismatch → 95/100 = 0.95
    expect(binaryCsIdentity(bin)).toBeCloseTo(0.95)
  })

  it('ignores indels in identity', () => {
    const bin = encodeBinaryCs(':90+acgt:10')
    // 100 match, 0 mismatch → 1.0 (indels don't count)
    expect(binaryCsIdentity(bin)).toBeCloseTo(1.0)
  })

  it('handles empty', () => {
    const bin = encodeBinaryCs('')
    expect(binaryCsIdentity(bin)).toBe(1)
  })

  it('matches text-based identity computation', () => {
    const cs = ':100*ac:50+ggg-tt:200*gt'
    const bin = encodeBinaryCs(cs)

    // Text-based: matchBp = 100 + 50 + 200 = 350, mismatchBp = 2
    // identity = 350 / 352
    let matchBp = 0
    let mismatchBp = 0
    let i = 0
    while (i < cs.length) {
      const ch = cs[i]!
      if (ch === ':') {
        i++
        let num = ''
        while (i < cs.length && cs[i]! >= '0' && cs[i]! <= '9') {
          num += cs[i]
          i++
        }
        matchBp += +num
      } else if (ch === '*') {
        mismatchBp++
        i += 3
      } else if (ch === '+' || ch === '-') {
        i++
        while (
          i < cs.length &&
          cs[i] !== ':' &&
          cs[i] !== '*' &&
          cs[i] !== '+' &&
          cs[i] !== '-'
        ) {
          i++
        }
      } else {
        i++
      }
    }
    const textIdentity = matchBp / (matchBp + mismatchBp)
    expect(binaryCsIdentity(bin)).toBeCloseTo(textIdentity)
  })
})

describe('binaryCsToCigar', () => {
  const cases = [
    ':100',
    '*ac',
    '*ac*gt',
    '+acgt',
    '-acgt',
    '+a',
    '-tt',
    ':100*ac:50+ggg:200',
    ':12*gt*gt*ca*ca*ac*ac*tg*tg*gt*gt*ca*ca:12:12',
    ':100-acgt+tttt:50',
    '+acgtacgtacgtacgtacgt',
    '-acgtacgtacgt',
  ]

  for (const cs of cases) {
    it(`matches csToCigar for: ${cs}`, () => {
      const textCigar = csToCigar(cs)
      const bin = encodeBinaryCs(cs)
      const binaryCigar = binaryCsToCigar(bin)

      // Convert text CIGAR to packed format for comparison
      // parseCigar2 format: (len << 4) | op
      const expectedOps: number[] = []
      let j = 0
      while (j < textCigar.length) {
        let num = 0
        while (j < textCigar.length && textCigar[j]! >= '0' && textCigar[j]! <= '9') {
          num = num * 10 + textCigar.charCodeAt(j) - 48
          j++
        }
        const opChar = textCigar[j]!
        j++
        const opMap: Record<string, number> = { '=': 7, X: 8, I: 1, D: 2 }
        expectedOps.push((num << 4) | opMap[opChar]!)
      }

      expect(binaryCigar).toEqual(expectedOps)
    })
  }

  it('handles empty', () => {
    const bin = encodeBinaryCs('')
    expect(binaryCsToCigar(bin)).toEqual([])
  })
})

describe('binaryCsFlip', () => {
  it('preserves match runs', () => {
    const bin = encodeBinaryCs(':100')
    const flipped = binaryCsFlip(bin)
    expect(decodeBinaryCs(flipped)).toBe(':100')
  })

  it('swaps substitution bases', () => {
    const bin = encodeBinaryCs('*ac')
    const flipped = binaryCsFlip(bin)
    expect(decodeBinaryCs(flipped)).toBe('*ca')
  })

  it('swaps insertions and deletions', () => {
    const binIns = encodeBinaryCs('+acgt')
    expect(decodeBinaryCs(binaryCsFlip(binIns))).toBe('-acgt')

    const binDel = encodeBinaryCs('-acgt')
    expect(decodeBinaryCs(binaryCsFlip(binDel))).toBe('+acgt')
  })

  it('handles mixed operations', () => {
    const bin = encodeBinaryCs(':100*ac+ggg-tt:50')
    const flipped = binaryCsFlip(bin)
    expect(decodeBinaryCs(flipped)).toBe(':100*ca-ggg+tt:50')
  })

  it('is its own inverse', () => {
    const cs = ':100*ac+ggg-tt:50*gt'
    const bin = encodeBinaryCs(cs)
    const doubleFlipped = binaryCsFlip(binaryCsFlip(bin))
    expect(decodeBinaryCs(doubleFlipped)).toBe(cs)
  })

  it('handles long match (varint)', () => {
    const bin = encodeBinaryCs(':1000')
    const flipped = binaryCsFlip(bin)
    expect(decodeBinaryCs(flipped)).toBe(':1000')
  })
})

describe('binary encoding size', () => {
  it('single-byte match for 1-63', () => {
    expect(encodeBinaryCs(':1').length).toBe(1)
    expect(encodeBinaryCs(':63').length).toBe(1)
  })

  it('multi-byte match for >= 64', () => {
    expect(encodeBinaryCs(':64').length).toBe(2) // 0x00 + varint(64)
    expect(encodeBinaryCs(':128').length).toBe(3) // 0x00 + varint(128)
  })

  it('single-byte substitution', () => {
    expect(encodeBinaryCs('*ac').length).toBe(1)
    expect(encodeBinaryCs('*gt').length).toBe(1)
  })

  it('insertion/deletion includes packed bases', () => {
    // +acgt: 1 byte opcode + 1 byte (4 bases packed)
    expect(encodeBinaryCs('+acgt').length).toBe(2)
    // +acgta: 1 byte opcode + 2 bytes (5 bases, ceil(5/4) = 2)
    expect(encodeBinaryCs('+acgta').length).toBe(3)
  })
})
