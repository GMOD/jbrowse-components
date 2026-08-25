import {
  NO_CALL_COLOR,
  REFERENCE_COLOR,
  getInsertionColorForDosage,
} from './constants.ts'
import { PHASE_SET_COLOR } from './getPhasedColor.ts'
import { CONSEQUENCE_IMPACT_JEXL } from './variantConsequence.ts'
import {
  getGenotypeLegendItems,
  getSampleGroupLegendItems,
  getVariantLegendSections,
} from './variantLegend.ts'
import { SV_TYPE_COLOR } from './variantSvType.ts'

import type { Source } from './types.ts'

describe('getGenotypeLegendItems', () => {
  it('alleleCount mode: dosage shades + no call', () => {
    const items = getGenotypeLegendItems({
      renderingMode: 'alleleCount',
      hasSecondaryAlt: false,
      hasUnphased: false,
      hasNoCall: false,
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
      hasNoCall: false,
    })
    expect(items.map(i => i.label)).toContain('Other alt allele')
  })

  it('phased mode: ref + alt, plus unphased when present', () => {
    const items = getGenotypeLegendItems({
      renderingMode: 'phased',
      hasSecondaryAlt: false,
      hasUnphased: true,
      hasNoCall: false,
    })
    expect(items.map(i => i.label)).toEqual([
      'Reference',
      'Alt allele',
      'Unphased',
    ])
  })

  it('phased mode: adds no-call when present, distinct from unphased', () => {
    const items = getGenotypeLegendItems({
      renderingMode: 'phased',
      hasSecondaryAlt: false,
      hasUnphased: false,
      hasNoCall: true,
    })
    expect(items.map(i => i.label)).toEqual([
      'Reference',
      'Alt allele',
      'No call',
    ])
  })
})

describe('getSampleGroupLegendItems', () => {
  const sources: Source[] = [
    { name: 'HG1', population: 'EUR', labelColor: '#a' },
    { name: 'HG2', population: 'AFR', labelColor: '#b' },
    { name: 'HG3', population: 'EUR', labelColor: '#a' },
    { name: 'HG4', population: 'EUR', labelColor: '#a' },
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
      { name: 'a', population: 'EUR', labelColor: '#a' },
      { name: 'b', labelColor: '#b' }, // no population
    ]
    const items = getSampleGroupLegendItems('population', mixed)
    expect(items).toContainEqual({ color: '#a', label: 'EUR' })
    expect(items).toContainEqual({ color: '#b', label: '(unlabeled)' })
  })

  it('returns [] when colorBy attribute is absent from every source', () => {
    const noPop: Source[] = [
      { name: 'a', labelColor: '#a' },
      { name: 'b', labelColor: '#b' },
    ]
    expect(getSampleGroupLegendItems('population', noPop)).toEqual([])
  })
})

describe('getVariantLegendSections', () => {
  const sources: Source[] = [
    { name: 'HG1', population: 'EUR', labelColor: '#a' },
    { name: 'HG2', population: 'AFR', labelColor: '#b' },
  ]

  it('only the genotype section when colorBy is unset', () => {
    const sections = getVariantLegendSections({
      renderingMode: 'alleleCount',
      hasSecondaryAlt: false,
      hasUnphased: false,
      hasNoCall: false,
      featureColor: '',
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
      hasNoCall: false,
      featureColor: '',
      colorBy: 'population',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['genotypes', 'group'])
    expect(sections[1]!.title).toBe('Population')
    expect(sections[1]!.items.map(i => i.label)).toEqual(['EUR', 'AFR'])
  })

  it('replaces the genotype section with an impact key for the consequence preset', () => {
    const sections = getVariantLegendSections({
      renderingMode: 'alleleCount',
      hasSecondaryAlt: false,
      hasUnphased: false,
      hasNoCall: false,
      featureColor: 'jexl:impactColor(feature)',
      colorBy: '',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['consequenceImpact'])
    expect(sections[0]!.items.map(i => i.label)).toEqual([
      'HIGH',
      'MODERATE',
      'LOW',
      'MODIFIER',
      // the override only reaches alt-carrying cells, so the ref fill is still
      // on screen and still has to be named
      'Homozygous reference',
    ])
  })

  it('builds an SV-type section from the shipped color map', () => {
    const sections = getVariantLegendSections({
      renderingMode: 'alleleCount',
      hasSecondaryAlt: false,
      hasUnphased: false,
      hasNoCall: false,
      featureColor: 'svType',
      svTypeColors: { DEL: '#e41a1c', DUP: '#377eb8', INVDUP: '#1f77b4' },
      colorBy: '',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['svType'])
    expect(sections[0]!.items).toEqual([
      { color: '#e41a1c', label: 'Deletion' },
      { color: '#377eb8', label: 'Duplication' },
      { color: '#1f77b4', label: 'INVDUP' }, // unrecognized token: raw label
      { color: REFERENCE_COLOR, label: 'Homozygous reference' },
    ])
  })

  it('names the no-call fill in an SV-type key when one is drawn', () => {
    const [section] = getVariantLegendSections({
      renderingMode: 'alleleCount',
      hasSecondaryAlt: false,
      hasUnphased: false,
      hasNoCall: true,
      featureColor: 'svType',
      svTypeColors: { DEL: '#e41a1c' },
      colorBy: '',
      sources,
    })
    // an SV-type override paints alt cells only; a no-call keeps the no-call
    // yellow, and a key that omits it leaves a whole column unexplained
    expect(section!.items).toEqual([
      { color: '#e41a1c', label: 'Deletion' },
      { color: REFERENCE_COLOR, label: 'Homozygous reference' },
      { color: NO_CALL_COLOR, label: 'No call' },
    ])
  })

  it('keeps a genotype key for a plain CSS feature color, recolored', () => {
    const sections = getVariantLegendSections({
      renderingMode: 'phased',
      hasSecondaryAlt: true,
      hasUnphased: false,
      hasNoCall: true,
      featureColor: '#E69F00',
      colorBy: '',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['genotypes'])
    // one alt entry in the override color: the secondary-alt color is
    // overridden too, so listing it would describe a swatch nothing paints
    expect(sections[0]!.items).toEqual([
      { color: REFERENCE_COLOR, label: 'Reference' },
      { color: '#E69F00', label: 'Alt allele' },
      { color: NO_CALL_COLOR, label: 'No call' },
    ])
  })

  it('drops the cell legend for an arbitrary custom feature color', () => {
    const sections = getVariantLegendSections({
      renderingMode: 'alleleCount',
      hasSecondaryAlt: false,
      hasUnphased: false,
      hasNoCall: false,
      featureColor: 'jexl:get(feature,"foo")',
      colorBy: 'population',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['group'])
  })
})

describe('phase-set legend section', () => {
  const base = {
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    svTypeColors: {},
    colorBy: '',
    sources: undefined,
  }

  test('replaces the alt-allele swatches with the hue rule', () => {
    const [section] = getVariantLegendSections({
      ...base,
      renderingMode: 'phased',
      featureColor: PHASE_SET_COLOR,
    })
    expect(section!.id).toBe('phaseSet')
    const labels = section!.items.map(i => i.label)
    // The two swatches that would now match nothing on screen are gone; the
    // rule replaces them, and Reference (still literal) stays.
    expect(labels).not.toContain('Alt allele')
    expect(labels).not.toContain('Other alt allele')
    expect(labels).toContain('Reference')
    expect(labels).toContain('Alt allele (hue identifies the phase set)')
    // A rule line carries no swatch — there is no single color to show.
    expect(
      section!.items.find(i => i.label.startsWith('Alt allele ('))!.color,
    ).toBeUndefined()
  })

  test('falls back to the genotype legend outside phased mode', () => {
    // Only the phased cell loop reads PS, so in allele-count mode the cells are
    // genotype-colored and the legend must describe that, not phase sets.
    const [section] = getVariantLegendSections({
      ...base,
      renderingMode: 'alleleCount',
      featureColor: PHASE_SET_COLOR,
    })
    expect(section!.id).toBe('genotypes')
    expect(section!.items.map(i => i.label)).toContain('Homozygous reference')
  })
})

describe('getVariantLegendSections insertion marker', () => {
  const base = {
    renderingMode: 'alleleCount',
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    featureColor: '',
    svTypeColors: {},
    colorBy: '',
    sources: undefined,
  }

  // The display resolves the color (palette.insertion) and answers undefined
  // where no marker is drawn — the matrix display, the slot off, or nothing
  // visible inserting bases. Absent means absent, not a colorless entry.
  test('no section when the display draws no markers', () => {
    expect(getVariantLegendSections(base).map(s => s.id)).toEqual(['genotypes'])
  })

  // Allele-count mode: one row is a whole sample, and the marker covers the
  // dosage-shaded cell it widens, so the bar's shade is the only thing left
  // saying how many copies the sample carries. Both swatches come from
  // getInsertionColorForDosage, so the key cannot drift from the glyph.
  test('allele-count mode keys both the hom and the het shade', () => {
    const sections = getVariantLegendSections({
      ...base,
      insertionColor: '#800080',
    })
    expect(sections.map(s => s.id)).toEqual(['genotypes', 'insertions'])
    expect(sections.find(s => s.id === 'insertions')!.items).toEqual([
      { color: '#800080', label: 'Homozygous' },
      {
        color: getInsertionColorForDosage('#800080', 128),
        label: 'Heterozygous',
      },
    ])
  })

  // Phased mode needs one swatch: a row is a single haplotype, which either
  // carries the allele or does not, so zygosity reads as the pattern down a
  // sample's rows and every marker is full strength.
  test('phased mode keys one shade, since rows carry the zygosity', () => {
    const sections = getVariantLegendSections({
      ...base,
      renderingMode: 'phased',
      insertionColor: '#800080',
    })
    expect(sections.find(s => s.id === 'insertions')!.items).toEqual([
      { color: '#800080', label: 'Insertion' },
    ])
  })

  // The reason it is a section rather than a genotype swatch: coloring by SV
  // type REPLACES the genotype items, and an entry appended to them would go
  // with them — in the mode an insertion is most likely to be the thing being
  // looked at. Same for consequence impact, and for a raw jexl expression,
  // which drops the cell section entirely.
  test.each([
    ['svType', SV_TYPE_COLOR],
    ['consequenceImpact', CONSEQUENCE_IMPACT_JEXL],
  ])('survives the %s coloring replacing the genotype items', (id, color) => {
    const sections = getVariantLegendSections({
      ...base,
      featureColor: color,
      svTypeColors: { DEL: '#123456' },
      insertionColor: '#800080',
    })
    expect(sections.map(s => s.id)).toEqual([id, 'insertions'])
  })

  test('survives a jexl coloring that drops the cell section outright', () => {
    const sections = getVariantLegendSections({
      ...base,
      featureColor: 'jexl:someUserExpression(feature)',
      insertionColor: '#800080',
    })
    expect(sections.map(s => s.id)).toEqual(['insertions'])
  })
})
