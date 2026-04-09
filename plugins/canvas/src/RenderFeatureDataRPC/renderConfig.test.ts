import {
  createRenderConfigContext,
  readConfigValue,
} from './renderConfig.ts'

function mockFeature(data: Record<string, unknown> = {}) {
  return {
    get: (key: string) => data[key],
    id: () => 'test-id',
    parent: () => undefined,
  } as any
}

const anyFeature = mockFeature()

describe('readConfigValue', () => {
  it('returns value when present', () => {
    expect(readConfigValue({ color1: 'red' }, 'color1', anyFeature)).toBe('red')
  })

  it('returns undefined when key is missing', () => {
    expect(readConfigValue({}, 'color1', anyFeature)).toBeUndefined()
  })

  it('evaluates JEXL expression per-feature', () => {
    const config = {
      color1: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
    }
    expect(
      readConfigValue(config, 'color1', mockFeature({ type: 'SNV' })),
    ).toBe('green')
    expect(
      readConfigValue(config, 'color1', mockFeature({ type: 'insertion' })),
    ).toBe('purple')
  })

  it('resolves nested keys', () => {
    expect(
      readConfigValue({ labels: { fontSize: 14 } }, ['labels', 'fontSize'], anyFeature),
    ).toBe(14)
  })
})

describe('createRenderConfigContext', () => {
  it('reads values from config', () => {
    const ctx = createRenderConfigContext({
      displayMode: 'normal',
      subfeatureLabels: 'none',
      geneGlyphMode: 'all',
      transcriptTypes: ['mRNA'],
      containerTypes: ['proteoform_orf'],
    })
    expect(ctx.displayMode).toBe('normal')
    expect(ctx.labelAllowed).toBe(true)
    expect(ctx.heightMultiplier).toBe(1)
    expect(ctx.geneGlyphMode).toBe('all')
    expect(ctx.transcriptTypes).toEqual(['mRNA'])
  })

  it('compact mode adjusts height multiplier', () => {
    const ctx = createRenderConfigContext({
      displayMode: 'compact',
      subfeatureLabels: 'none',
      geneGlyphMode: 'all',
      transcriptTypes: ['mRNA'],
      containerTypes: [],
    })
    expect(ctx.heightMultiplier).toBe(0.6)
  })

  it('collapse mode disables labels', () => {
    const ctx = createRenderConfigContext({
      displayMode: 'collapse',
      subfeatureLabels: 'none',
      geneGlyphMode: 'all',
      transcriptTypes: ['mRNA'],
      containerTypes: [],
    })
    expect(ctx.labelAllowed).toBe(false)
  })

  it('end-to-end: JEXL color evaluated per-feature', () => {
    const ctx = createRenderConfigContext({
      color1: "jexl:get(feature,'type')=='SNV'?'green':'purple'",
      displayMode: 'normal',
      subfeatureLabels: 'none',
      geneGlyphMode: 'all',
      transcriptTypes: ['mRNA'],
      containerTypes: [],
    })
    expect(
      readConfigValue(ctx.config, 'color1', mockFeature({ type: 'SNV' })),
    ).toBe('green')
    expect(
      readConfigValue(ctx.config, 'color1', mockFeature({ type: 'insertion' })),
    ).toBe('purple')
  })
})
