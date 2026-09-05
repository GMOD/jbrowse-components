import createJexlInstance from '@jbrowse/core/util/jexl'

import { isDisplayMode, readConfigValueSafe } from './renderConfig.ts'

import type { DisplayConfig } from './renderConfig.ts'

const jexl = createJexlInstance()

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

// A fallback nothing could resolve to, so every case below pins whether the
// read produced a value or gave up.
const NONE = Symbol('none')

function read(
  config: DisplayConfig,
  key: string | string[],
  feature = anyFeature,
) {
  return readConfigValueSafe<unknown>(config, key, feature, jexl, NONE)
}

describe('readConfigValueSafe', () => {
  it('returns value when present', () => {
    expect(read(cfg({ color: 'red' }), 'color')).toBe('red')
  })

  it('takes the fallback when the key is missing', () => {
    expect(read(cfg({}), 'color')).toBe(NONE)
  })

  it('evaluates JEXL expression per-feature', () => {
    const config = cfg({
      color: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
    })
    expect(read(config, 'color', mockFeature({ type: 'SNV' }))).toBe('green')
    expect(read(config, 'color', mockFeature({ type: 'insertion' }))).toBe(
      'purple',
    )
  })

  it('resolves nested keys', () => {
    expect(read(cfg({ labels: { name: 'myGene' } }), ['labels', 'name'])).toBe(
      'myGene',
    )
  })
})

describe('isDisplayMode', () => {
  it('accepts the three modes and rejects anything else', () => {
    expect(isDisplayMode('normal')).toBe(true)
    expect(isDisplayMode('compact')).toBe(true)
    expect(isDisplayMode('superCompact')).toBe(true)
    expect(isDisplayMode('super-compact')).toBe(false)
    expect(isDisplayMode(undefined)).toBe(false)
    expect(isDisplayMode('')).toBe(false)
  })
})
