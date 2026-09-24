import createJexlInstance from '@jbrowse/core/util/jexl'

import {
  GENE_GLYPH_DEFAULTS,
  isDisplayMode,
  pickDisplayConfig,
  readConfigValueSafe,
} from './renderConfig.ts'

import type { DisplayConfig } from './renderConfig.ts'

const jexl = createJexlInstance()

function mockFeature(data: Record<string, unknown> = {}) {
  return {
    get: (key: string) => data[key],
    id: () => 'test-id',
    parent: () => undefined,
  } as any
}

// These probe the reader's value resolution, not the shape of DisplayConfig, so
// the fixtures are deliberately partial.
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

// The variant display declares no gene-glyph slots, and the worker reads them
// all, so its fetch sends the defaults the feature display's slots start at.
describe('pickDisplayConfig', () => {
  it('sends the gene defaults for a display declaring no gene slots', () => {
    const picked = pickDisplayConfig({ featureHeight: 10, height: 100 })
    expect(picked).toMatchObject(GENE_GLYPH_DEFAULTS)
    expect(picked).not.toHaveProperty('height')
  })

  it('lets a declared gene slot win over its default', () => {
    const picked = pickDisplayConfig({
      transcriptTypes: ['mRNA'],
      subParts: 'CDS',
    })
    expect(picked.transcriptTypes).toEqual(['mRNA'])
    expect(picked.subParts).toBe('CDS')
    expect(picked.impliedUTRs).toBe(GENE_GLYPH_DEFAULTS.impliedUTRs)
  })
})
