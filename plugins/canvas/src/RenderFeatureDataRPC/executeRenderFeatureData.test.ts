import createJexlInstance from '@jbrowse/core/util/jexl'

import { buildFeatureAdmission } from './featureAdmission.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { Feature } from '@jbrowse/core/util'

const jexl = createJexlInstance()

function feat(type: string, attrs: Record<string, unknown> = {}): Feature {
  const map: Record<string, unknown> = { type, ...attrs }
  return {
    get: (k: string) => map[k],
    id: () => String(map.id ?? type),
  } as Feature
}

describe('buildFeatureAdmission', () => {
  it('admits everything when the filter is empty', () => {
    const admit = buildFeatureAdmission({ jexl, config: mockDisplayConfig() })
    expect(admit(feat('gene'))).toBe(true)
    expect(admit(feat('region'))).toBe(true)
  })

  it('applies the expressions', () => {
    const admit = buildFeatureAdmission({
      jexl,
      config: mockDisplayConfig({
        filter: { expressions: [`jexl:get(feature,'type')=='gene'`] },
      }),
    })
    expect(admit(feat('gene'))).toBe(true)
    expect(admit(feat('mRNA'))).toBe(false)
  })

  it('ANDs multiple expressions together', () => {
    const admit = buildFeatureAdmission({
      jexl,
      config: mockDisplayConfig({
        filter: {
          expressions: [
            `jexl:get(feature,'type')=='gene'`,
            `jexl:get(feature,'score')>5`,
          ],
        },
      }),
    })
    expect(admit(feat('gene', { score: 10 }))).toBe(true)
    expect(admit(feat('gene', { score: 1 }))).toBe(false)
  })

  it("drops NCBI's gbkey=='Src' record and nothing else", () => {
    const admit = buildFeatureAdmission({ jexl, config: mockDisplayConfig() })
    expect(admit(feat('region', { gbkey: 'Src' }))).toBe(false)
    expect(admit(feat('region', { gbkey: 'CpG_island' }))).toBe(true)
    expect(admit(feat('region'))).toBe(true)
    expect(admit(feat('gene'))).toBe(true)
  })

  it('genes only keeps gene-like top-level types and drops the rest', () => {
    const admit = buildFeatureAdmission({
      jexl,
      config: mockDisplayConfig({
        transcriptTypes: ['mRNA'],
        filter: { expressions: [], genes: 'only' },
      }),
    })
    expect(admit(feat('gene'))).toBe(true)
    expect(admit(feat('mRNA'))).toBe(true)
    expect(admit(feat('exon'))).toBe(false)
    expect(admit(feat('region'))).toBe(false)
  })

  it('genes exclude drops gene-like top-level types and keeps the rest', () => {
    const admit = buildFeatureAdmission({
      jexl,
      config: mockDisplayConfig({
        transcriptTypes: ['mRNA'],
        filter: { expressions: [], genes: 'exclude' },
      }),
    })
    expect(admit(feat('gene'))).toBe(false)
    expect(admit(feat('mRNA'))).toBe(false)
    expect(admit(feat('exon'))).toBe(true)
    expect(admit(feat('region'))).toBe(true)
  })

  it('genes only keeps the gene and RNA types no slot lists', () => {
    const admit = buildFeatureAdmission({
      jexl,
      config: mockDisplayConfig({
        transcriptTypes: [],
        containerTypes: [],
        filter: { expressions: [], genes: 'only' },
      }),
    })
    for (const type of ['ncRNA_gene', 'pseudogene', 'lnc_RNA', 'tRNA', 'CDS']) {
      expect(admit(feat(type))).toBe(true)
    }
    expect(admit(feat('repeat_region'))).toBe(false)
  })

  it('genes and expressions both apply (admission is their AND)', () => {
    const admit = buildFeatureAdmission({
      jexl,
      config: mockDisplayConfig({
        filter: { expressions: [`jexl:get(feature,'score')>5`], genes: 'only' },
      }),
    })
    expect(admit(feat('gene', { score: 10 }))).toBe(true)
    expect(admit(feat('gene', { score: 1 }))).toBe(false)
    expect(admit(feat('exon', { score: 10 }))).toBe(false)
  })

  it('soloFeatureIds admits only features whose id() is in the set', () => {
    const admit = buildFeatureAdmission({
      jexl,
      config: mockDisplayConfig(),
      soloFeatureIds: ['f1', 'f3'],
    })
    expect(admit(feat('gene', { id: 'f1' }))).toBe(true)
    expect(admit(feat('gene', { id: 'f2' }))).toBe(false)
    expect(admit(feat('gene', { id: 'f3' }))).toBe(true)
  })

  it('an empty soloFeatureIds set admits everything', () => {
    const admit = buildFeatureAdmission({
      jexl,
      config: mockDisplayConfig(),
      soloFeatureIds: [],
    })
    expect(admit(feat('gene', { id: 'f1' }))).toBe(true)
    expect(admit(feat('region', { id: 'f2' }))).toBe(true)
  })

  it('hiddenFeatureIds drops features whose id() is in the set', () => {
    const admit = buildFeatureAdmission({
      jexl,
      config: mockDisplayConfig(),
      hiddenFeatureIds: ['f2'],
    })
    expect(admit(feat('gene', { id: 'f1' }))).toBe(true)
    expect(admit(feat('gene', { id: 'f2' }))).toBe(false)
  })

  it('hidden wins over solo when a feature is in both', () => {
    const admit = buildFeatureAdmission({
      jexl,
      config: mockDisplayConfig(),
      soloFeatureIds: ['f1'],
      hiddenFeatureIds: ['f1'],
    })
    expect(admit(feat('gene', { id: 'f1' }))).toBe(false)
  })
})
