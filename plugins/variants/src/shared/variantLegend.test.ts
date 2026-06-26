import {
  getGenotypeLegendItems,
  getMaxLabelWidth,
  getSampleGroupLegendItems,
  getVariantLegendSections,
} from './variantLegend.ts'

import type { Source } from './types.ts'

describe('getGenotypeLegendItems', () => {
  it('alleleCount mode: dosage shades + no call', () => {
    const items = getGenotypeLegendItems({
      renderingMode: 'alleleCount',
      hasSecondaryAlt: false,
      hasUnphased: false,
    })
    expect(items.map(i => i.label)).toEqual([
      'Homozygous reference',
      'Heterozygous alt',
      'Homozygous alt',
      'No call',
    ])
  })

  it('alleleCount mode: adds other-alt when multiallelic', () => {
    const items = getGenotypeLegendItems({
      renderingMode: 'alleleCount',
      hasSecondaryAlt: true,
      hasUnphased: false,
    })
    expect(items.map(i => i.label)).toContain('Other alt allele')
  })

  it('phased mode: ref + alt, plus unphased when present', () => {
    const items = getGenotypeLegendItems({
      renderingMode: 'phased',
      hasSecondaryAlt: false,
      hasUnphased: true,
    })
    expect(items.map(i => i.label)).toEqual([
      'Reference',
      'Alt allele',
      'Unphased',
    ])
  })
})

describe('getSampleGroupLegendItems', () => {
  const sources: Source[] = [
    { name: 'HG1', population: 'EUR', color: '#a' },
    { name: 'HG2', population: 'AFR', color: '#b' },
    { name: 'HG3', population: 'EUR', color: '#a' },
    { name: 'HG4', population: 'EUR', color: '#a' },
  ]

  it('returns [] when colorBy is unset', () => {
    expect(getSampleGroupLegendItems('', sources)).toEqual([])
  })

  it('returns [] when sources are undefined/empty', () => {
    expect(getSampleGroupLegendItems('population', undefined)).toEqual([])
    expect(getSampleGroupLegendItems('population', [])).toEqual([])
  })

  it('one entry per distinct value, most-common first, with its color', () => {
    const items = getSampleGroupLegendItems('population', sources)
    expect(items).toEqual([
      { color: '#a', label: 'EUR' }, // 3 occurrences -> first
      { color: '#b', label: 'AFR' }, // 1 occurrence -> second
    ])
  })

  it('labels missing values as (unlabeled) and tolerates missing color', () => {
    const mixed: Source[] = [
      { name: 'a', population: 'EUR', color: '#a' },
      { name: 'b', color: '#b' }, // no population
    ]
    const items = getSampleGroupLegendItems('population', mixed)
    expect(items).toContainEqual({ color: '#a', label: 'EUR' })
    expect(items).toContainEqual({ color: '#b', label: '(unlabeled)' })
  })

  it('returns [] when colorBy attribute is absent from every source', () => {
    const noPop: Source[] = [
      { name: 'a', color: '#a' },
      { name: 'b', color: '#b' },
    ]
    expect(getSampleGroupLegendItems('population', noPop)).toEqual([])
  })
})

describe('getVariantLegendSections', () => {
  const sources: Source[] = [
    { name: 'HG1', population: 'EUR', color: '#a' },
    { name: 'HG2', population: 'AFR', color: '#b' },
  ]

  it('only the genotype section when colorBy is unset', () => {
    const sections = getVariantLegendSections({
      renderingMode: 'alleleCount',
      hasSecondaryAlt: false,
      hasUnphased: false,
      colorBy: '',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['genotypes'])
  })

  it('adds a title-cased group section when colorBy is set', () => {
    const sections = getVariantLegendSections({
      renderingMode: 'alleleCount',
      hasSecondaryAlt: false,
      hasUnphased: false,
      colorBy: 'population',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['genotypes', 'group'])
    expect(sections[1]!.title).toBe('Population')
    expect(sections[1]!.items.map(i => i.label)).toEqual(['EUR', 'AFR'])
  })
})

describe('getMaxLabelWidth', () => {
  const sources: Source[] = [
    { name: 'a', color: '#a' },
    { name: 'bb', color: '#b' },
  ]

  it('is 0 when there are no sources', () => {
    expect(
      getMaxLabelWidth({
        sources: undefined,
        fontSize: 12,
        canDisplayLabels: true,
      }),
    ).toBe(0)
    expect(
      getMaxLabelWidth({ sources: [], fontSize: 12, canDisplayLabels: true }),
    ).toBe(0)
  })

  it('uses the fixed swatch width when labels are hidden', () => {
    expect(
      getMaxLabelWidth({ sources, fontSize: 12, canDisplayLabels: false }),
    ).toBe(20)
  })

  it('measures labels (plus padding) when labels are shown', () => {
    expect(
      getMaxLabelWidth({ sources, fontSize: 12, canDisplayLabels: true }),
    ).toBeGreaterThanOrEqual(10)
  })
})
