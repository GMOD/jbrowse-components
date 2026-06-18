import { buildFeatureAdmission } from './featureAdmission.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { Feature } from '@jbrowse/core/util'

function feat(type: string, attrs: Record<string, unknown> = {}): Feature {
  const map: Record<string, unknown> = { type, ...attrs }
  return {
    get: (k: string) => map[k],
    id: () => String(map.id ?? type),
  } as Feature
}

describe('buildFeatureAdmission', () => {
  it('admits everything when no filters and showOnlyGenes is off', () => {
    const admit = buildFeatureAdmission({ config: mockDisplayConfig() })
    expect(admit(feat('gene'))).toBe(true)
    expect(admit(feat('region'))).toBe(true)
  })

  it('applies config jexlFilters (slot strings carry no jexl: prefix)', () => {
    const admit = buildFeatureAdmission({
      config: mockDisplayConfig({
        jexlFilters: [`get(feature,'type')=='gene'`],
      }),
    })
    expect(admit(feat('gene'))).toBe(true)
    expect(admit(feat('mRNA'))).toBe(false)
  })

  it('accepts already-prefixed filters (the runtime "Filter by..." form)', () => {
    // activeFilters() in the model emits `jexl:`-prefixed expressions; admission
    // must normalize them identically to the unprefixed config-slot form.
    const admit = buildFeatureAdmission({
      config: mockDisplayConfig({
        jexlFilters: [`jexl:get(feature,'type')=='gene'`],
      }),
    })
    expect(admit(feat('gene'))).toBe(true)
    expect(admit(feat('mRNA'))).toBe(false)
  })

  it('ANDs multiple filters together', () => {
    const admit = buildFeatureAdmission({
      config: mockDisplayConfig({
        jexlFilters: [`get(feature,'type')=='gene'`, `get(feature,'score')>5`],
      }),
    })
    expect(admit(feat('gene', { score: 10 }))).toBe(true)
    expect(admit(feat('gene', { score: 1 }))).toBe(false)
  })

  it('showOnlyGenes keeps gene-like top-level types and drops the rest', () => {
    const admit = buildFeatureAdmission({
      config: mockDisplayConfig({ transcriptTypes: ['mRNA'] }),
      showOnlyGenes: true,
    })
    expect(admit(feat('gene'))).toBe(true)
    expect(admit(feat('mRNA'))).toBe(true)
    expect(admit(feat('exon'))).toBe(false)
    expect(admit(feat('region'))).toBe(false)
  })

  it('showOnlyGenes and jexlFilters both apply (admission is their AND)', () => {
    const admit = buildFeatureAdmission({
      config: mockDisplayConfig({ jexlFilters: [`get(feature,'score')>5`] }),
      showOnlyGenes: true,
    })
    expect(admit(feat('gene', { score: 10 }))).toBe(true)
    expect(admit(feat('gene', { score: 1 }))).toBe(false)
    expect(admit(feat('exon', { score: 10 }))).toBe(false)
  })
})
