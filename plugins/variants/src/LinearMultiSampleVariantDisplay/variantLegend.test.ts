import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { ALT_HUE, HET_DOSAGE, shadeByDosage } from '../shared/cellFill.ts'
import { NO_CALL_COLOR, REFERENCE_COLOR } from '../shared/constants.ts'
import { PHASE_SET_FIELD } from '../shared/getPhasedColor.ts'
import {
  IMPACT_FIELD,
  UNANNOTATED_IMPACT,
} from '../shared/variantConsequence.ts'
import {
  DOSAGE_NOTE,
  getGenotypeEntries,
  getVariantColorScales,
} from './variantLegend.ts'

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
    unit: 'sample',
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    paintedDomain: [],
    shadeByDosage: true,
    ...over,
  }) satisfies VariantLegendInputs

describe('getGenotypeEntries', () => {
  it('sample rows: the ramp, and no-call only when one was painted', () => {
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

  it('sample rows have no secondary-alt swatch: which alt is not on hue', () => {
    expect(
      getGenotypeEntries(inputs({ hasSecondaryAlt: true })).map(i => i.label),
    ).not.toContain('Other alt allele')
  })

  it('the ramp swatches are the ones the cells take', () => {
    const items = getGenotypeEntries(inputs())
    expect(items[1]!.color).toBe(shadeByDosage(ALT_HUE, HET_DOSAGE))
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
      getGenotypeEntries(inputs({ unit: 'haplotype', hasUnphased: true })).map(
        i => i.label,
      ),
    ).toEqual(['Reference', 'Alt allele', 'Unphased'])
  })

  it('phased mode: adds no-call when present, distinct from unphased', () => {
    expect(
      getGenotypeEntries(inputs({ unit: 'haplotype', hasNoCall: true })).map(
        i => i.label,
      ),
    ).toEqual(['Reference', 'Alt allele', 'No call'])
  })

  it('phased mode names the other alt only when one was painted', () => {
    expect(
      getGenotypeEntries(
        inputs({ unit: 'haplotype', hasSecondaryAlt: true }),
      ).map(i => i.label),
    ).toContain('Other alt allele')
  })
})

describe('getVariantColorScales', () => {
  it('only the genotype section under the default colour', () => {
    const sections = getVariantColorScales({
      ...inputs(),
      color: undefined,
    })
    expect(sections.map(s => s.id)).toEqual(['genotypes'])
  })

  it('lists only the impact tiers a cell was painted for', () => {
    const sections = getVariantColorScales({
      ...inputs({ paintedDomain: ['MODIFIER', 'HIGH'], shadeByDosage: false }),
      color: IMPACT,
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

  it('titles and names the impact key where color says so', () => {
    const sections = getVariantColorScales({
      ...inputs({
        paintedDomain: ['MODIFIER', 'HIGH'],
        shadeByDosage: false,
        colorTitle: 'Effect',
      }),
      color: { ...IMPACT, domain: ['HIGH'], labels: ['Loss of function'] },
    })
    expect(sections[0]!.title).toBe('Effect')
    expect(entriesOf(sections[0])!.map(i => i.label)).toEqual([
      'Loss of function',
      'MODIFIER',
      'Homozygous reference',
    ])
  })

  it('titles the genotype key, and an empty title draws none', () => {
    const titleOf = (colorTitle: string | undefined) =>
      getVariantColorScales({
        ...inputs({ colorTitle }),
        color: undefined,
      })[0]!.title
    expect(titleOf(undefined)).toBe('Genotypes')
    expect(titleOf('Calls')).toBe('Calls')
    expect(titleOf('')).toBe('')
  })

  it('keys a record field by the values painted, the no-value row on the alt hue', () => {
    const [section] = getVariantColorScales({
      ...inputs({
        paintedDomain: ['Pathogenic', '', 'Benign'],
        shadeByDosage: false,
      }),
      color: { field: 'INFO.CLNSIG', scale: 'categorical' },
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

  it('keeps a lone field row beside the reference grey', () => {
    expect(
      labelsOf(
        { paintedDomain: ['Pathogenic'] },
        { field: 'INFO.CLNSIG', scale: 'categorical' },
      ),
    ).toEqual(['Pathogenic', DOSAGE_NOTE, 'Homozygous reference'])
  })

  it('lists no lone field row painted in the reference grey itself', () => {
    expect(
      labelsOf(
        { paintedDomain: ['Pathogenic'], shadeByDosage: false },
        {
          field: 'INFO.CLNSIG',
          scale: 'categorical',
          domain: ['Pathogenic'],
          range: [REFERENCE_COLOR],
        },
      ),
    ).toEqual(['Homozygous reference'])
  })

  it('caps the field rows alone, the absent-data rows aside', () => {
    const values = Array.from({ length: 20 }, (_, i) => `v${i}`)
    const labels = labelsOf(
      {
        paintedDomain: values,
        shadeByDosage: false,
        hasUnphased: true,
        hasNoCall: true,
      },
      {
        field: 'INFO.T',
        scale: 'categorical',
        domain: values,
        range: values.map((_, i) => `rgb(${i * 10},0,0)`),
      },
    )
    expect(labels).toHaveLength(23)
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
    })
    expect(entriesOf(section)!.map(i => [i.label, i.swatches])).toEqual([
      [
        'a, b',
        [{ color: shadeByDosage('#a00', HET_DOSAGE) }, { color: '#a00' }],
      ],
      ['c', [{ color: shadeByDosage('#00a', HET_DOSAGE) }, { color: '#00a' }]],
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
    })
    const entries = entriesOf(section)!
    const modifier = entries.find(i => i.label === 'MODIFIER')!
    const unannotated = entries.find(i => i.label === UNANNOTATED_IMPACT)!
    expect(unannotated).toBeDefined()
    expect(unannotated.color).not.toBe(modifier.color)
  })

  const svKey = (over: Partial<VariantLegendInputs>) =>
    entriesOf(
      getVariantColorScales({
        ...inputs(over),
        color: SV_TYPE,
      })[0],
    )!.map(i => [i.label, i.color && cssColorToABGR(i.color)])

  it('keys the painted SV classes in class order, in their class colours', () => {
    expect(
      svKey({ paintedDomain: ['OTHER', 'DEL'], shadeByDosage: false }),
    ).toEqual([
      ['Deletion', cssColorToABGR('#e41a1c')],
      ['Other / mixed', cssColorToABGR('#000000')],
      ['Homozygous reference', cssColorToABGR(REFERENCE_COLOR)],
    ])
  })

  it('keys a record with no class on the alt hue, and a painted no-call', () => {
    expect(
      svKey({
        paintedDomain: ['DEL', ''],
        hasNoCall: true,
        shadeByDosage: false,
      }),
    ).toEqual([
      ['Deletion', cssColorToABGR('#e41a1c')],
      ['(no value)', cssColorToABGR(ALT_HUE)],
      ['Homozygous reference', cssColorToABGR(REFERENCE_COLOR)],
      ['No call', cssColorToABGR(NO_CALL_COLOR)],
    ])
  })

  it('draws each SV class at het and hom dosage when shading is on', () => {
    const [section] = getVariantColorScales({
      ...inputs({ paintedDomain: ['DEL'] }),
      color: SV_TYPE,
    })
    const [del, note] = entriesOf(section)!
    expect(del!.swatches).toEqual([
      { color: shadeByDosage('#e41a1c', HET_DOSAGE) },
      { color: '#e41a1c' },
    ])
    expect(note!.label).toBe(DOSAGE_NOTE)
  })

  it('keeps one swatch per SV class in phased mode', () => {
    expect(
      svKey({ unit: 'haplotype', paintedDomain: ['DEL'] }).map(
        ([label]) => label,
      ),
    ).toEqual(['Deletion', 'Reference'])
  })

  it('keeps a genotype key for a plain CSS feature color, recolored', () => {
    const sections = getVariantColorScales({
      ...inputs({
        unit: 'haplotype',
        hasSecondaryAlt: true,
        hasNoCall: true,
      }),
      color: '#E69F00',
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
    })
    expect(entriesOf(section)!.map(i => [i.label, i.color])).toEqual([
      ['Homozygous reference', REFERENCE_COLOR],
      ['Alt, half dosage (het)', shadeByDosage('#E69F00', HET_DOSAGE)],
      ['Alt, full dosage (hom)', '#E69F00'],
    ])
  })

  it('drops the cell legend for an arbitrary custom feature color', () => {
    const sections = getVariantColorScales({
      ...inputs(),
      color: 'jexl:get(feature,"foo")',
    })
    expect(sections.map(s => s.id)).toEqual([])
  })
})

describe('phase-set legend section', () => {
  const base = {
    ...inputs(),
  }

  test('replaces the alt-allele swatches with the hue rule', () => {
    const [section] = getVariantColorScales({
      ...base,
      unit: 'haplotype',
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

  test('keys a secondary alt painted with no phase set', () => {
    const [section] = getVariantColorScales({
      ...base,
      unit: 'haplotype',
      color: PHASE_SET,
      hasSecondaryAlt: true,
    })
    expect(entriesOf(section)!.map(i => i.label)).toContain(
      'Other alt allele, no phase set',
    )
  })

  test('keys an alt painted its plain hue with no phase set', () => {
    const [section] = getVariantColorScales({
      ...base,
      unit: 'haplotype',
      color: PHASE_SET,
      hasAltWithoutPhaseSet: true,
    })
    expect(entriesOf(section)!.map(i => i.label)).toContain(
      'Alt allele, no phase set',
    )
  })

  test('falls back to the genotype legend outside phased mode', () => {
    // Only the phased cell loop reads PS, so in allele-count mode the cells are
    // genotype-colored and the legend must describe that, not phase sets.
    const [section] = getVariantColorScales({
      ...base,
      unit: 'sample',
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
  }

  // The display answers whether a marker is drawn — columns never, genomic
  // only where one outgrows its cell. Absent means absent.
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
    ['recordField', SV_TYPE],
    ['consequenceImpact', IMPACT],
  ])('survives the %s coloring replacing the genotype items', (id, color) => {
    const sections = getVariantColorScales({
      ...base,
      color,
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
