import {
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
  const codes = new Uint32Array(sampleNames.length)
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

// The dict used to be capped at 65535 entries to fit a Uint16 code, and past
// the cap a genotype interned to 0. That was survivable when the cells were
// painted from the genotype strings and only the tooltip lost the call; it is
// not now, because the cell loops color from the codes and would decline to
// paint the overflow entirely. Codes are Uint32, so what these pin is that
// there is no cap left to fall off.
describe('genotype dict past 65535 entries', () => {
  function fillDict(n: number) {
    const dict: string[] = []
    const dictIndex = new Map<string, number>()
    const codes: number[] = []
    for (let i = 0; i < n; i++) {
      codes.push(internGenotype(`${i}|${i}`, dict, dictIndex))
    }
    return { dict, dictIndex, codes }
  }

  test('a genotype past the old cap gets a real code, not 0', () => {
    const { dict, dictIndex } = fillDict(65535)
    const code = internGenotype('novel|genotype', dict, dictIndex)
    expect(code).toBe(65536)
    expect(dict).toHaveLength(65536)
  })

  test('codes past the old cap round-trip through the packed array', () => {
    const { dict, dictIndex } = fillDict(65535)
    const sampleIndex = buildSampleIndex(['A'])
    // Two of them: the first overflow is 65536, which a Uint16Array truncated
    // to 0 (the harmless absent-sample answer), but the second was 65537,
    // truncating onto code 1 — a real, wrong genotype. Both decode themselves.
    for (const gt of ['novel|genotype', 'another|novel|genotype']) {
      const codes = Uint32Array.from([internGenotype(gt, dict, dictIndex)])
      expect(decodeGenotype(dict, sampleIndex, codes, 'A')).toBe(gt)
    }
  })

  test('genotypes interned before the old cap still decode', () => {
    const { dict, dictIndex } = fillDict(65535)
    internGenotype('novel|genotype', dict, dictIndex)
    const sampleIndex = buildSampleIndex(['A'])
    const codes = Uint32Array.from([internGenotype('7|7', dict, dictIndex)])
    expect(decodeGenotype(dict, sampleIndex, codes, 'A')).toBe('7|7')
  })
})
