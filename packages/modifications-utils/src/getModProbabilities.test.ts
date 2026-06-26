import { getModProbabilities } from './getModProbabilities.ts'

import type { Feature } from '@jbrowse/core/util'

function featureWith(tags: Record<string, unknown>): Feature {
  return { get: (k: string) => (k === 'tags' ? tags : undefined) } as Feature
}

describe('getModProbabilities', () => {
  // BAM returns ML:B:C as a Uint8Array. Mapping it with TypedArray.prototype.map
  // would coerce each float result back to a uint8 (every value → 0), so the fix
  // routes through Array.from. This guards that regression.
  test('Uint8Array ML (BAM) scales to fractional 0..1 values', () => {
    const probs = getModProbabilities(featureWith({ ML: new Uint8Array([251, 0, 128]) }))
    expect(probs).toEqual([251.5 / 256, 0.5 / 256, 128.5 / 256])
  })

  test('plain number[] ML scales identically', () => {
    const probs = getModProbabilities(featureWith({ ML: [251, 0, 128] }))
    expect(probs).toEqual([251.5 / 256, 0.5 / 256, 128.5 / 256])
  })

  test('string ML (SAM text) is split then scaled', () => {
    const probs = getModProbabilities(featureWith({ ML: '251,0,128' }))
    expect(probs).toEqual([251.5 / 256, 0.5 / 256, 128.5 / 256])
  })

  test('lowercase Ml alias is honored', () => {
    const probs = getModProbabilities(featureWith({ Ml: new Uint8Array([200]) }))
    expect(probs).toEqual([200.5 / 256])
  })

  test('missing ML tag returns undefined', () => {
    expect(getModProbabilities(featureWith({}))).toBeUndefined()
  })
})
