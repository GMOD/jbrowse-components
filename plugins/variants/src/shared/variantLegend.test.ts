import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { ALT_HUE, shadeByDosage } from './cellFill.ts'
import { NO_CALL_COLOR, REFERENCE_COLOR } from './constants.ts'
import { PHASE_SET_FIELD } from './getPhasedColor.ts'
import { IMPACT_FIELD, UNANNOTATED_IMPACT } from './variantConsequence.ts'
import {
  DOSAGE_NOTE,
  getGenotypeEntries,
  getSampleGroupEntries,
  getVariantColorScales,
} from './variantLegend.ts'
import {
  NON_SV_TYPE,
  SV_TYPE_FIELD,
  assignSvTypeColors,
} from './variantSvType.ts'

import type { Source } from './types.ts'
import type { VariantLegendInputs } from './variantLegend.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ColorEncoding } from '@jbrowse/core/util/markEncoding'

const IMPACT = { field: IMPACT_FIELD, scale: 'categorical' as const }
const SV_TYPE = { field: SV_TYPE_FIELD, scale: 'categorical' as const }
const PHASE_SET = { field: PHASE_SET_FIELD, scale: 'categorical' as const }

// Every scale these build is categorical; the narrowing is what the type asks.
function entriesOf(scale: ColorScale | undefined) {
  return scale?.kind === 'categorical' ? scale.entries : undefined
}

const inputs = (over: Partial<VariantLegendInputs> = {}): VariantLegendInputs =>
  ({
    renderingMode: 'alleleCount',
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    paintedDomain: [],
    shadeByDosage: true,
    ...over,
  }) satisfies VariantLegendInputs

describe('getGenotypeEntries', () => {
  it('alleleCount mode: the ramp, and no-call only when one was painted', () => {
    expect(getGenotypeEntries(inputs()).map(i => i.label)).toEqual([
      'Homozygous reference',
      'Alt, half dosage (het)',
      'Alt, full dosage (hom)',
    ])
    expect(
      getGenotypeEntries(inputs({ hasNoCall: true })).map(i => i.label),
    ).toEqual([
      'Homozygous reference',
      'Alt, half dosage (het)',
      'Alt, full dosage (hom)',
      'No call',
    ])
  })

  it('alleleCount mode has no secondary-alt swatch: which alt is not on hue', () => {
    expect(
      getGenotypeEntries(inputs({ hasSecondaryAlt: true })).map(i => i.label),
    ).not.toContain('Other alt allele')
  })

  it('the ramp swatches are the ones the cells take', () => {
    const items = getGenotypeEntries(inputs())
    expect(items[1]!.color).toBe(shadeByDosage(ALT_HUE, 0.5))
    expect(items[2]!.color).toBe(ALT_HUE)
  })

  it('shading off collapses the ramp to one flat alt swatch', () => {
    const items = getGenotypeEntries(inputs({ shadeByDosage: false }))
    expect(items.map(i => i.label)).toEqual([
      'Homozygous reference',
      'Alt allele',
    ])
    expect(items[1]!.color).toBe(ALT_HUE)
  })

  it('phased mode: ref + alt, plus unphased when present', () => {
    expect(
      getGenotypeEntries(
        inputs({ renderingMode: 'phased', hasUnphased: true }),
      ).map(i => i.label),
    ).toEqual(['Reference', 'Alt allele', 'Unphased'])
  })

  it('phased mode: adds no-call when present, distinct from unphased', () => {
    expect(
      getGenotypeEntries(
        inputs({ renderingMode: 'phased', hasNoCall: true }),
      ).map(i => i.label),
    ).toEqual(['Reference', 'Alt allele', 'No call'])
  })

  it('phased mode names the other alt only when one was painted', () => {
    expect(
      getGenotypeEntries(
        inputs({ renderingMode: 'phased', hasSecondaryAlt: true }),
      ).map(i => i.label),
    ).toContain('Other alt allele')
  })
})

describe('getSampleGroupEntries', () => {
  const sources: Source[] = [
    { name: 'HG1', population: 'EUR', labelColor: '#a' },
    { name: 'HG2', population: 'AFR', labelColor: '#b' },
    { name: 'HG3', population: 'EUR', labelColor: '#a' },
    { name: 'HG4', population: 'EUR', labelColor: '#a' },
  ]

  it('returns [] when colorBy is unset', () => {
    expect(getSampleGroupEntries('', sources)).toEqual([])
  })

  it('returns [] when sources are undefined/empty', () => {
    expect(getSampleGroupEntries('population', undefined)).toEqual([])
    expect(getSampleGroupEntries('population', [])).toEqual([])
  })

  it('one entry per distinct value, most-common first, with its color', () => {
    const items = getSampleGroupEntries('population', sources)
    expect(items).toEqual([
      { value: 'EUR', label: 'EUR', color: '#a' }, // 3 occurrences -> first
      { value: 'AFR', label: 'AFR', color: '#b' }, // 1 occurrence -> second
    ])
  })

  it('labels missing values as (unlabeled) and tolerates missing color', () => {
    const mixed: Source[] = [
      { name: 'a', population: 'EUR', labelColor: '#a' },
      { name: 'b', labelColor: '#b' }, // no population
    ]
    const items = getSampleGroupEntries('population', mixed)
    expect(items).toContainEqual({ value: 'EUR', label: 'EUR', color: '#a' })
    expect(items).toContainEqual({
      value: '',
      label: '(unlabeled)',
      color: '#b',
    })
  })

  it('returns [] when colorBy attribute is absent from every source', () => {
    const noPop: Source[] = [
      { name: 'a', labelColor: '#a' },
      { name: 'b', labelColor: '#b' },
    ]
    expect(getSampleGroupEntries('population', noPop)).toEqual([])
  })
})

describe('getVariantColorScales', () => {
  const sources: Source[] = [
    { name: 'HG1', population: 'EUR', labelColor: '#a' },
    { name: 'HG2', population: 'AFR', labelColor: '#b' },
  ]

  it('only the genotype section when colorBy is unset', () => {
    const sections = getVariantColorScales({
      ...inputs(),
      color: undefined,
      colorBy: '',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['genotypes'])
  })

  it('adds a title-cased group section when colorBy is set', () => {
    const sections = getVariantColorScales({
      ...inputs(),
      color: undefined,
      colorBy: 'population',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['genotypes', 'group'])
    expect(sections[1]!.title).toBe('Population')
    expect(entriesOf(sections[1])!.map(i => i.label)).toEqual(['EUR', 'AFR'])
  })

  it('lists only the impact tiers a cell was painted for', () => {
    const sections = getVariantColorScales({
      ...inputs({ paintedDomain: ['MODIFIER', 'HIGH'], shadeByDosage: false }),
      color: IMPACT,
      colorBy: '',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['consequenceImpact'])
    expect(entriesOf(sections[0])!.map(i => i.label)).toEqual([
      // severity order, not the order they were met
      'HIGH',
      'MODIFIER',
      // the hue only reaches alt-carrying cells, so the ref fill is still on
      // screen and still has to be named
      'Homozygous reference',
    ])
  })

  it('keys a record field by the values painted, the no-value row on the alt hue', () => {
    const [section] = getVariantColorScales({
      ...inputs({
        paintedDomain: ['Pathogenic', '', 'Benign'],
        shadeByDosage: false,
      }),
      color: { field: 'INFO.CLNSIG', scale: 'categorical' },
      colorBy: '',
      sources,
    })
    expect(section!.title).toBe('INFO.CLNSIG')
    const entries = entriesOf(section)!
    expect(entries.map(i => i.label)).toEqual([
      'Benign',
      'Pathogenic',
      '(no value)',
      'Homozygous reference',
    ])
    expect(
      cssColorToABGR(entries.find(i => i.label === '(no value)')!.color!),
    ).toBe(cssColorToABGR(ALT_HUE))
  })

  const AF = {
    field: 'INFO.AF',
    scale: 'threshold' as const,
    domain: ['0.01', '0.05'],
    range: ['#a00', '#0a0', '#00a'],
  }

  it('lists every bin of a threshold once one painted', () => {
    const [section] = getVariantColorScales({
      ...inputs({ paintedDomain: ['< 0.01'], shadeByDosage: false }),
      color: AF,
      colorBy: '',
      sources,
    })
    expect(
      entriesOf(section)!.map(i => [i.label, cssColorToABGR(i.color!)]),
    ).toEqual(
      [
        ['< 0.01', '#a00'],
        ['0.01 – 0.05', '#0a0'],
        ['≥ 0.05', '#00a'],
        ['Homozygous reference', REFERENCE_COLOR],
      ].map(([label, color]) => [label, cssColorToABGR(color!)]),
    )
  })

  const labelsOf = (over: Partial<VariantLegendInputs>, color: ColorEncoding) =>
    entriesOf(
      getVariantColorScales({
        ...inputs(over),
        color,
        colorBy: '',
        sources,
      })[0],
    )!.map(i => i.label)

  it('lists no bin of a threshold while no cell painted one', () => {
    expect(labelsOf({ hasNoCall: true }, AF)).toEqual([
      'Homozygous reference',
      'No call',
    ])
  })

  // Color by → Field… over a numeric INFO field with no cut points files each
  // value as its own category, and the key listed all sixty of them.
  it('lists no field rows where the values painted are not a vocabulary', () => {
    expect(
      labelsOf(
        { paintedDomain: Array.from({ length: 60 }, (_, i) => `${i}`) },
        { field: 'INFO.DP', scale: 'categorical' },
      ),
    ).toEqual(['Homozygous reference'])
  })

  it('lists no field row where every value painted one colour', () => {
    expect(
      labelsOf(
        { paintedDomain: ['Pathogenic'] },
        { field: 'INFO.CLNSIG', scale: 'categorical' },
      ),
    ).toEqual(['Homozygous reference'])
  })

  it('names two values sharing a colour on one row, drawn at het and hom dosage', () => {
    const [section] = getVariantColorScales({
      ...inputs({ paintedDomain: ['b', 'a', 'c'], hasNoCall: true }),
      color: {
        field: 'INFO.T',
        scale: 'categorical',
        domain: ['a', 'b', 'c'],
        range: ['#a00', '#a00', '#00a'],
      },
      colorBy: '',
      sources,
    })
    expect(entriesOf(section)!.map(i => [i.label, i.swatches])).toEqual([
      ['a, b', [{ color: shadeByDosage('#a00', 0.5) }, { color: '#a00' }]],
      ['c', [{ color: shadeByDosage('#00a', 0.5) }, { color: '#00a' }]],
      [DOSAGE_NOTE, undefined],
      ['Homozygous reference', undefined],
      ['No call', undefined],
    ])
  })

  it('names unannotated records as their own tier, in its own color', () => {
    const [section] = getVariantColorScales({
      ...inputs({
        paintedDomain: ['MODIFIER', UNANNOTATED_IMPACT],
        shadeByDosage: false,
      }),
      color: IMPACT,
      colorBy: '',
      sources,
    })
    const entries = entriesOf(section)!
    const modifier = entries.find(i => i.label === 'MODIFIER')!
    const unannotated = entries.find(i => i.label === UNANNOTATED_IMPACT)!
    expect(unannotated).toBeDefined()
    expect(unannotated.color).not.toBe(modifier.color)
  })

  it('builds an SV-type section from the painted classes', () => {
    const sections = getVariantColorScales({
      ...inputs({ paintedDomain: ['INVDUP', 'DEL'], shadeByDosage: false }),
      color: SV_TYPE,
      svTypeColors: { DEL: '#e41a1c', DUP: '#377eb8', INVDUP: '#1f77b4' },
      colorBy: '',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['svType'])
    expect(entriesOf(sections[0])!).toEqual([
      { value: 'DEL', label: 'Deletion', color: '#e41a1c' },
      { value: 'INVDUP', label: 'INVDUP', color: '#1f77b4' }, // raw token label
      {
        value: 'Homozygous reference',
        label: 'Homozygous reference',
        color: REFERENCE_COLOR,
      },
    ])
  })

  it('lists the non-structural class as a member of the SV scale', () => {
    const [section] = getVariantColorScales({
      ...inputs({ paintedDomain: ['DEL', NON_SV_TYPE], shadeByDosage: false }),
      color: SV_TYPE,
      svTypeColors: assignSvTypeColors(['DEL', NON_SV_TYPE]),
      colorBy: '',
      sources,
    })
    expect(entriesOf(section)!.map(i => i.value)).toEqual([
      'DEL',
      NON_SV_TYPE,
      'Homozygous reference',
    ])
  })

  it('names the no-call fill in an SV-type key when one was painted', () => {
    const [section] = getVariantColorScales({
      ...inputs({
        hasNoCall: true,
        paintedDomain: ['DEL'],
        shadeByDosage: false,
      }),
      color: SV_TYPE,
      svTypeColors: { DEL: '#e41a1c' },
      colorBy: '',
      sources,
    })
    // an SV-type hue paints alt cells only; a no-call keeps the no-call yellow,
    // and a key that omits it leaves a whole column unexplained
    expect(entriesOf(section)!).toEqual([
      { value: 'DEL', label: 'Deletion', color: '#e41a1c' },
      {
        value: 'Homozygous reference',
        label: 'Homozygous reference',
        color: REFERENCE_COLOR,
      },
      { value: 'No call', label: 'No call', color: NO_CALL_COLOR },
    ])
  })

  it('draws each SV class at het and hom dosage when shading is on', () => {
    const [section] = getVariantColorScales({
      ...inputs({ paintedDomain: ['DEL'] }),
      color: SV_TYPE,
      svTypeColors: { DEL: '#e41a1c' },
      colorBy: '',
      sources,
    })
    expect(entriesOf(section)!.slice(0, 2)).toEqual([
      {
        value: 'DEL',
        label: 'Deletion',
        swatches: [
          { color: shadeByDosage('#e41a1c', 0.5) },
          { color: '#e41a1c' },
        ],
      },
      { value: DOSAGE_NOTE, label: DOSAGE_NOTE, color: undefined },
    ])
  })

  it('keeps one swatch per SV class in phased mode', () => {
    const [section] = getVariantColorScales({
      ...inputs({ renderingMode: 'phased', paintedDomain: ['DEL'] }),
      color: SV_TYPE,
      svTypeColors: { DEL: '#e41a1c' },
      colorBy: '',
      sources,
    })
    expect(entriesOf(section)!.map(i => i.label)).toEqual([
      'Deletion',
      'Reference',
    ])
  })

  it('keeps a genotype key for a plain CSS feature color, recolored', () => {
    const sections = getVariantColorScales({
      ...inputs({
        renderingMode: 'phased',
        hasSecondaryAlt: true,
        hasNoCall: true,
      }),
      color: '#E69F00',
      colorBy: '',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['genotypes'])
    // one alt entry in the chosen hue: the secondary-alt color is replaced too,
    // so listing it would describe a swatch nothing paints
    expect(entriesOf(sections[0])!).toEqual([
      { value: 'Reference', label: 'Reference', color: REFERENCE_COLOR },
      { value: 'Alt allele', label: 'Alt allele', color: '#E69F00' },
      { value: 'No call', label: 'No call', color: NO_CALL_COLOR },
    ])
  })

  it('shades a plain CSS feature color in allele-count mode', () => {
    const [section] = getVariantColorScales({
      ...inputs(),
      color: '#E69F00',
      colorBy: '',
      sources,
    })
    expect(entriesOf(section)!.map(i => [i.label, i.color])).toEqual([
      ['Homozygous reference', REFERENCE_COLOR],
      ['Alt, half dosage (het)', shadeByDosage('#E69F00', 0.5)],
      ['Alt, full dosage (hom)', '#E69F00'],
    ])
  })

  it('drops the cell legend for an arbitrary custom feature color', () => {
    const sections = getVariantColorScales({
      ...inputs(),
      color: 'jexl:get(feature,"foo")',
      colorBy: 'population',
      sources,
    })
    expect(sections.map(s => s.id)).toEqual(['group'])
  })
})

describe('phase-set legend section', () => {
  const base = {
    ...inputs(),
    svTypeColors: {},
    colorBy: '',
    sources: undefined,
  }

  test('replaces the alt-allele swatches with the hue rule', () => {
    const [section] = getVariantColorScales({
      ...base,
      renderingMode: 'phased',
      color: PHASE_SET,
    })
    expect(section!.id).toBe('phaseSet')
    const labels = entriesOf(section)!.map(i => i.label)
    // The two swatches that would now match nothing on screen are gone; the
    // rule replaces them, and Reference (still literal) stays.
    expect(labels).not.toContain('Alt allele')
    expect(labels).not.toContain('Other alt allele')
    expect(labels).toContain('Reference')
    expect(labels).toContain('Alt allele (hue identifies the phase set)')
    // A rule line carries no swatch — there is no single color to show.
    expect(
      entriesOf(section)!.find(i => i.label.startsWith('Alt allele ('))!.color,
    ).toBeUndefined()
  })

  test('falls back to the genotype legend outside phased mode', () => {
    // Only the phased cell loop reads PS, so in allele-count mode the cells are
    // genotype-colored and the legend must describe that, not phase sets.
    const [section] = getVariantColorScales({
      ...base,
      renderingMode: 'alleleCount',
      color: PHASE_SET,
    })
    expect(section!.id).toBe('genotypes')
    expect(entriesOf(section)!.map(i => i.label)).toContain(
      'Homozygous reference',
    )
  })
})

describe('getVariantColorScales insertion marker', () => {
  const base = {
    ...inputs(),
    color: undefined,
    svTypeColors: {},
    colorBy: '',
    sources: undefined,
  }

  // The display answers whether a marker is drawn — the matrix never, the
  // regular display only where one outgrows its cell. Absent means absent.
  test('no section when the display draws no markers', () => {
    expect(getVariantColorScales(base).map(s => s.id)).toEqual(['genotypes'])
  })

  // The marker is the cell's own color widened, so the section carries no
  // swatch: what it explains is the number.
  test('one colorless entry naming what the number means', () => {
    const sections = getVariantColorScales({
      ...base,
      insertionMarkers: true,
    })
    expect(sections.map(s => s.id)).toEqual(['genotypes', 'insertions'])
    expect(entriesOf(sections.find(s => s.id === 'insertions'))!).toEqual([
      {
        value: 'Widened to inserted bp',
        label: 'Widened to inserted bp',
        color: undefined,
      },
    ])
  })

  // The reason it is a section rather than a genotype entry: coloring by SV
  // type REPLACES the genotype items, and an entry appended to them would go
  // with them — in the mode an insertion is most likely to be the thing being
  // looked at. Same for consequence impact, and for a raw jexl expression,
  // which drops the cell section entirely.
  test.each([
    ['svType', SV_TYPE],
    ['consequenceImpact', IMPACT],
  ])('survives the %s coloring replacing the genotype items', (id, color) => {
    const sections = getVariantColorScales({
      ...base,
      color,
      svTypeColors: { DEL: '#123456' },
      insertionMarkers: true,
    })
    expect(sections.map(s => s.id)).toEqual([id, 'insertions'])
  })

  test('survives a jexl coloring that drops the cell section outright', () => {
    const sections = getVariantColorScales({
      ...base,
      color: 'jexl:someUserExpression(feature)',
      insertionMarkers: true,
    })
    expect(sections.map(s => s.id)).toEqual(['insertions'])
  })
})
