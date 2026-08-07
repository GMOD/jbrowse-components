import {
  MAX_GENOTYPE_DICT_ENTRIES,
  buildSampleIndex,
  decodeGenotype,
  internGenotype,
} from './genotypeCodec.ts'

// Mirror the worker pack step: intern a per-feature sampleName->genotype map
// into a code array aligned to a shared sampleNames order.
function pack(
  genotypes: Record<string, string>,
  sampleNames: string[],
  dict: string[],
  dictIndex: Map<string, number>,
) {
  const sampleIndex = buildSampleIndex(sampleNames)
  const codes = new Uint16Array(sampleNames.length)
  for (const sampleName in genotypes) {
    codes[sampleIndex.get(sampleName)!] = internGenotype(
      genotypes[sampleName]!,
      dict,
      dictIndex,
    )
  }
  return codes
}

describe('genotypeCodec', () => {
  test('round-trips a single genotype by sampleName', () => {
    const sampleNames = ['A', 'B', 'C']
    const dict: string[] = []
    const dictIndex = new Map<string, number>()
    const codes = pack(
      { A: '0|0', B: '0|1', C: '1|1' },
      sampleNames,
      dict,
      dictIndex,
    )
    const sampleIndex = buildSampleIndex(sampleNames)
    expect(decodeGenotype(dict, sampleIndex, codes, 'B')).toBe('0|1')
    expect(decodeGenotype(dict, sampleIndex, codes, 'C')).toBe('1|1')
  })

  test('absent sample decodes to undefined (code 0)', () => {
    const sampleNames = ['A', 'B', 'C']
    const dict: string[] = []
    const dictIndex = new Map<string, number>()
    // C has no genotype for this feature
    const codes = pack({ A: '0|0', B: '0|1' }, sampleNames, dict, dictIndex)
    const sampleIndex = buildSampleIndex(sampleNames)
    expect(decodeGenotype(dict, sampleIndex, codes, 'C')).toBeUndefined()
    expect(decodeGenotype(dict, sampleIndex, codes, 'missing')).toBeUndefined()
  })

  test('dict is shared/deduped across features', () => {
    const sampleNames = ['A', 'B']
    const dict: string[] = []
    const dictIndex = new Map<string, number>()
    pack({ A: '0|0', B: '0|1' }, sampleNames, dict, dictIndex)
    pack({ A: '0|1', B: '0|0' }, sampleNames, dict, dictIndex)
    // only the two distinct strings are stored once
    expect(dict).toEqual(['0|0', '0|1'])
  })
})

// Codes are Uint16 with 0 reserved, so the dict tops out at 65535 entries.
// Uncapped, `code + 1` truncated on the way into the Uint16Array and the
// overflow genotypes decoded as OTHER genotypes' strings — a tooltip
// confidently naming a call the VCF never made.
describe('genotype dict overflow', () => {
  function fillDict(n: number) {
    const dict: string[] = []
    const dictIndex = new Map<string, number>()
    const codes: number[] = []
    for (let i = 0; i < n; i++) {
      codes.push(internGenotype(`${i}|${i}`, dict, dictIndex))
    }
    return { dict, dictIndex, codes }
  }

  test('every code fits a Uint16 up to the cap', () => {
    const { dict, codes } = fillDict(MAX_GENOTYPE_DICT_ENTRIES)
    expect(dict).toHaveLength(MAX_GENOTYPE_DICT_ENTRIES)
    expect(Math.max(...codes)).toBe(MAX_GENOTYPE_DICT_ENTRIES)
    // the round trip a Uint16Array does, which is where truncation would bite
    const packed = Uint16Array.from(codes)
    expect(packed[packed.length - 1]).toBe(MAX_GENOTYPE_DICT_ENTRIES)
  })

  test('past the cap a new genotype interns to 0, not onto another code', () => {
    const { dict, dictIndex } = fillDict(MAX_GENOTYPE_DICT_ENTRIES)
    expect(internGenotype('novel|genotype', dict, dictIndex)).toBe(0)
    // and it did not displace the dict or claim an existing entry
    expect(dict).toHaveLength(MAX_GENOTYPE_DICT_ENTRIES)
    expect(dict).not.toContain('novel|genotype')
  })

  test('genotypes already in the dict keep decoding after it saturates', () => {
    const { dict, dictIndex } = fillDict(MAX_GENOTYPE_DICT_ENTRIES)
    internGenotype('novel|genotype', dict, dictIndex)
    const sampleIndex = buildSampleIndex(['A'])
    const codes = Uint16Array.from([internGenotype('7|7', dict, dictIndex)])
    expect(decodeGenotype(dict, sampleIndex, codes, 'A')).toBe('7|7')
  })

  // The failure the cap exists for. Uncapped, the FIRST overflow returned 65536,
  // which a Uint16Array truncates to 0 — harmless, the absent-sample answer. The
  // second returned 65537, truncating to 1, and code 1 is the first genotype in
  // the dict: the tooltip then named a real, wrong call rather than declining to
  // answer. So this has to walk past the first one.
  test('overflowed codes decode to undefined, never onto another genotype', () => {
    const { dict, dictIndex } = fillDict(MAX_GENOTYPE_DICT_ENTRIES)
    const sampleIndex = buildSampleIndex(['A'])
    for (const gt of ['novel|genotype', 'another|novel|genotype']) {
      const codes = Uint16Array.from([internGenotype(gt, dict, dictIndex)])
      expect(decodeGenotype(dict, sampleIndex, codes, 'A')).toBeUndefined()
    }
  })
})
