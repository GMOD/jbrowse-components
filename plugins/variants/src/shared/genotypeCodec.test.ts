import {
  buildSampleIndex,
  decodeGenotype,
  decodeGenotypes,
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

  test('decodeGenotypes reconstructs the sparse map', () => {
    const sampleNames = ['A', 'B', 'C']
    const dict: string[] = []
    const dictIndex = new Map<string, number>()
    const codes = pack({ A: '0|0', C: '1|1' }, sampleNames, dict, dictIndex)
    expect(decodeGenotypes(dict, sampleNames, codes)).toEqual({
      A: '0|0',
      C: '1|1',
    })
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
