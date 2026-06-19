import { readConfigValue } from './renderConfig.ts'

import type { DisplayConfig } from './renderConfig.ts'

function mockFeature(data: Record<string, unknown> = {}) {
  return {
    get: (key: string) => data[key],
    id: () => 'test-id',
    parent: () => undefined,
  } as any
}

// These tests probe the reader's value resolution (presence, jexl eval, nested
// keys), not the shape of DisplayConfig, so they pass deliberately-partial
// fixtures.
const cfg = (o: Record<string, unknown>) => o as unknown as DisplayConfig

const anyFeature = mockFeature()

describe('readConfigValue', () => {
  it('returns value when present', () => {
    expect(readConfigValue(cfg({ color: 'red' }), 'color', anyFeature)).toBe(
      'red',
    )
  })

  it('returns undefined when key is missing', () => {
    expect(readConfigValue(cfg({}), 'color', anyFeature)).toBeUndefined()
  })

  it('evaluates JEXL expression per-feature', () => {
    const config = cfg({
      color: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
    })
    expect(readConfigValue(config, 'color', mockFeature({ type: 'SNV' }))).toBe(
      'green',
    )
    expect(
      readConfigValue(config, 'color', mockFeature({ type: 'insertion' })),
    ).toBe('purple')
  })

  it('resolves nested keys', () => {
    expect(
      readConfigValue(
        cfg({ labels: { name: 'myGene' } }),
        ['labels', 'name'],
        anyFeature,
      ),
    ).toBe('myGene')
  })
})
