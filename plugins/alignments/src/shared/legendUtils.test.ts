import { colorShortInsertArc } from '@jbrowse/core/ui/theme'

import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import {
  getAlignmentsLegendSections,
  getArcLegendItems,
  getReadDisplayLegendItems,
} from './legendUtils.ts'

import type { ReadColorCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { ReadConnectionsMode } from '../LinearAlignmentsDisplay/constants.ts'
import type { ColorBy, ColorSchemeType } from './types.ts'
import type { LegendItem } from '@jbrowse/core/ui'

function legendFor(
  colorBy: ColorBy,
  categories: ReadColorCategory[],
  rest?: {
    detectedModifications?: Map<string, string>
    colorTagMap?: Record<string, string>
  },
) {
  return getReadDisplayLegendItems({
    colorBy,
    presentCategories: new Set(categories),
    palette: makeTestPalette(),
    ...rest,
  })
}

function labels(
  type: ColorSchemeType,
  categories: ReadColorCategory[],
  detectedModifications?: Map<string, string>,
) {
  return legendFor({ type }, categories, { detectedModifications }).map(
    i => i.label,
  )
}

function tagLabels(
  colorBy: { type: 'tag'; tag: string },
  colorTagMap?: Record<string, string>,
) {
  return legendFor(colorBy, ['tag'], { colorTagMap }).map(i => i.label)
}

describe('getReadDisplayLegendItems', () => {
  test('lists only the buckets present in the reads', () => {
    expect(labels('insertSize', ['normalInsert'])).toEqual(['Normal'])
    expect(labels('insertSize', ['normalInsert', 'longInsert'])).toEqual([
      'Normal',
      'Long insert',
    ])
  })

  test('omits "Supplementary/split" when no supplementary reads are present', () => {
    expect(labels('insertSize', ['normalInsert'])).not.toContain(
      'Supplementary/split',
    )
    expect(labels('strand', ['fwdStrand'])).toEqual(['Forward strand'])
  })

  test('strand scheme lists forward/reverse', () => {
    expect(labels('strand', ['fwdStrand', 'revStrand'])).toEqual([
      'Forward strand',
      'Reverse strand',
    ])
  })

  // `noStrand` is the defensive branch of `strandCategory` (strand 0). NEITHER
  // feature source this pipeline serves emits one — `SamRecordFeature.strand` is
  // `flags & SAM_FLAG_REVERSE ? -1 : 1`, PAF parses `'-' ? -1 : 1` — so this
  // asserts a row nothing currently reaches. It is here because the legend table
  // is now exhaustive over `SwatchCategory` by type, and the pair of tests below
  // is what says which wording that completeness bought: a bucket the renderer
  // has a palette slot and a shader index for is no longer one the key can drop
  // silently if a future adapter does emit it.
  //
  // (A previous test asserted the opposite — that `noStrand` "is never a real
  // read bucket" — which was true, but reasoned from the BAM flag alone about a
  // pipeline that also serves flagless PAF. Right answer, wrong argument.)
  test('the unstranded bucket has a row if it is ever produced', () => {
    expect(labels('strand', ['fwdStrand', 'revStrand', 'noStrand'])).toEqual([
      'Forward strand',
      'Reverse strand',
      'Unstranded',
    ])
  })

  test('a non-strand scheme reframes the unstranded bucket as a split read too', () => {
    expect(labels('insertSize', ['noStrand', 'normalInsert'])).toEqual([
      'Split read (unstranded)',
      'Normal',
    ])
  })

  test('pair-orientation scheme: split-read strand framing + non-split bucket', () => {
    // fwd/rev come only from split segments here, and po=0 non-split reads are
    // their own grey bucket.
    expect(
      labels('pairOrientation', [
        'fwdStrand',
        'revStrand',
        'nonSplit',
        'pairLR',
      ]),
    ).toEqual([
      'Split read (forward)',
      'Split read (reverse)',
      'Unsplit read',
      'LR - Normal pair orientation',
    ])
  })

  test('includes "Supplementary/split" only when that bucket occurs', () => {
    expect(labels('insertSize', ['normalInsert', 'supplementary'])).toContain(
      'Supplementary/split',
    )
    expect(labels('strand', ['fwdStrand', 'supplementary'])).toEqual([
      'Forward strand',
      'Supplementary/split',
    ])
  })

  test('pair orientation lists only the orientations seen', () => {
    expect(labels('pairOrientation', ['pairLR', 'pairRL'])).toEqual([
      'LR - Normal pair orientation',
      'RL - Mates point outward',
    ])
  })

  test('normal scheme shows a base-reads swatch plus any cross-cutting buckets', () => {
    // a single "Reads" entry so "Show legend" is never a silent no-op
    expect(labels('normal', ['plain'])).toEqual(['Reads'])
    // chain mode still surfaces unmapped/supplementary after the base swatch
    expect(labels('normal', ['plain', 'unmappedMate'])).toEqual([
      'Reads',
      'Unmapped mate',
    ])
  })

  test('chain-mode split reads read as "Split read" under any non-strand scheme', () => {
    // In linked-reads mode only the split segments pick up a fwd/rev color while
    // ordinary reads stay grey; a fwd/rev bucket here can only be a split, so it
    // must not read as a plain "Forward strand".
    expect(labels('normal', ['plain', 'fwdStrand', 'revStrand'])).toEqual([
      'Reads',
      'Split read (forward)',
      'Split read (reverse)',
    ])
    // swatches follow CATEGORY_LEGEND order (strand buckets precede insert ones)
    expect(labels('insertSize', ['normalInsert', 'fwdStrand'])).toEqual([
      'Split read (forward)',
      'Normal',
    ])
    expect(labels('mappingQuality', ['fwdStrand'])).toEqual([
      'MAPQ 0',
      'MAPQ 30',
      'MAPQ ≥60',
      'Split read (forward)',
    ])
  })

  test('the plain strand scheme keeps the plain wording (fwd/rev is its primary key)', () => {
    // Under strand, every read is colored by its own strand, so a fwd/rev bucket
    // is the key itself, not a split-read exception.
    expect(labels('strand', ['fwdStrand', 'revStrand'])).toEqual([
      'Forward strand',
      'Reverse strand',
    ])
  })

  test('first-of-pair-strand names the fragment strand, not the read’s own strand', () => {
    // The color is the strand inferred from the first mate, so a reverse-mapped
    // read1 lands in the "forward" bucket — spell that out.
    expect(labels('firstOfPairStrand', ['fwdStrand', 'revStrand'])).toEqual([
      'Forward (first-in-pair)',
      'Reverse (first-in-pair)',
    ])
  })

  test('modifications view surfaces chain-mode split reads after the mod-type key', () => {
    const mods = new Map([['m', 'red']])
    expect(labels('modifications', ['fwdStrand', 'revStrand'], mods)).toEqual([
      '5mC',
      'Split read (forward)',
      'Split read (reverse)',
    ])
  })

  test('value tag scheme lists discovered tag values sorted, colored from the map', () => {
    expect(
      tagLabels({ type: 'tag', tag: 'HP' }, { '2': 'blue', '1': 'red' }),
    ).toEqual(['1', '2'])
    // empty until reads with the tag load
    expect(tagLabels({ type: 'tag', tag: 'HP' }, {})).toEqual([])
    expect(tagLabels({ type: 'tag', tag: 'HP' })).toEqual([])
  })

  test('value tag swatch colors come straight from colorTagMap', () => {
    const items = legendFor({ type: 'tag', tag: 'HP' }, ['tag'], {
      colorTagMap: { '1': 'red', '2': 'blue' },
    })
    expect(items).toEqual([
      { color: 'red', label: '1' },
      { color: 'blue', label: '2' },
    ])
  })

  test('strand-encoding tags (XS/TS/ts) show the strand key, not a value list', () => {
    // just the two strand keys; untagged reads fall back to the neutral color
    // with no legend swatch of its own
    expect(tagLabels({ type: 'tag', tag: 'ts' }, { foo: 'red' })).toEqual([
      'Forward strand',
      'Reverse strand',
    ])
    expect(tagLabels({ type: 'tag', tag: 'XS' })).toEqual([
      'Forward strand',
      'Reverse strand',
    ])
  })

  test('a strand tag still keys the cross-cutting buckets it paints', () => {
    // The strand pair is the tag's own key, so it must not be repeated as a
    // split-read swatch — but supplementary reads still get theirs.
    expect(
      legendFor({ type: 'tag', tag: 'XS' }, [
        'fwdStrand',
        'revStrand',
        'supplementary',
      ]).map(i => i.label),
    ).toEqual(['Forward strand', 'Reverse strand', 'Supplementary/split'])
  })

  // Reads the tag is absent from paint the neutral fallback, which used to be
  // the one painted color with no legend entry. Named per scheme, since "no
  // value" means a missing tag under one and a mateless block under the other.
  test('the unvalued bucket is named for the scheme that produced it', () => {
    expect(
      legendFor({ type: 'tag', tag: 'HP' }, ['tag', 'noTagValue'], {
        colorTagMap: { '1': 'red' },
      }).map(i => i.label),
    ).toEqual(['1', 'No HP value'])
    expect(
      legendFor({ type: 'mateRefName' }, ['tag', 'noTagValue'], {
        colorTagMap: { ctgA: 'red' },
      }).map(i => i.label),
    ).toEqual(['ctgA', 'No mate'])
  })

  test('the unvalued bucket is omitted when every read resolved a color', () => {
    expect(tagLabels({ type: 'tag', tag: 'HP' }, { '1': 'red' })).not.toContain(
      'No HP value',
    )
  })

  // Chromosome painting rides the same CPU-baked color path as tag coloring, so
  // it keys the discovered mate refNames. It listed nothing at all before.
  test('chromosome painting keys each discovered mate refName', () => {
    expect(
      legendFor({ type: 'mateRefName' }, ['tag'], {
        colorTagMap: { ctgB: 'blue', ctgA: 'red' },
      }),
    ).toEqual([
      { color: 'red', label: 'ctgA' },
      { color: 'blue', label: 'ctgB' },
    ])
  })

  test('mapping quality is a fixed ramp regardless of present buckets', () => {
    expect(labels('mappingQuality', [])).toEqual([
      'MAPQ 0',
      'MAPQ 30',
      'MAPQ ≥60',
    ])
  })

  test('modifications list visible mod types by friendly name, gating supplementary on presence', () => {
    const mods = new Map([
      ['m', 'red'],
      ['h', 'blue'],
    ])
    expect(labels('modifications', [], mods)).toEqual(['5mC', '5hmC'])
    expect(labels('modifications', ['supplementary'], mods)).toEqual([
      '5mC',
      '5hmC',
      'Supplementary/split',
    ])
  })

  test('hiddenModifications drops the swatch even though the type was detected', () => {
    const mods = new Map([
      ['m', 'red'],
      ['h', 'blue'],
      ['a', 'purple'],
    ])
    expect(
      legendFor(
        {
          type: 'modifications',
          modifications: { hiddenModifications: ['m', 'h'] },
        },
        [],
        { detectedModifications: mods },
      ).map(i => i.label),
    ).toEqual(['6mA'])
  })

  test('shownModifications allow-list keeps only the listed swatch', () => {
    const mods = new Map([
      ['m', 'red'],
      ['h', 'blue'],
      ['a', 'purple'],
    ])
    expect(
      legendFor(
        { type: 'modifications', modifications: { shownModifications: ['a'] } },
        [],
        { detectedModifications: mods },
      ).map(i => i.label),
    ).toEqual(['6mA'])
  })

  test('fill-unmarked (methylation) view keys the states it paints, incl. the blue unmethylated swatch', () => {
    const mods = new Map([
      ['m', 'red'],
      ['h', 'magenta'],
    ])
    const items = legendFor(
      { type: 'modifications', modifications: { fillUnmarked: true } },
      [],
      { detectedModifications: mods },
    )
    expect(items).toEqual([
      { color: '#ff0000', label: '5mC methylated' },
      { color: '#ffc0cb', label: '5hmC methylated' },
      { color: '#0000ff', label: 'Unmethylated' },
    ])
  })

  // Bisulfite is reference-based and parses no MM/ML tags, so the detected-types
  // map is ALWAYS empty for it — the real shape of a bisulfite track. Gating its
  // swatches on that map dropped the red 5mC key entirely.
  test('bisulfite keys the methylated state it paints, with no MM types detected', () => {
    // twoColor is off by default in every mode, so a default bisulfite track
    // paints methylated (red) only, and must not key a blue swatch it never
    // draws.
    expect(labels('bisulfite', [], new Map())).toEqual(['5mC methylated'])
  })

  test('bisulfite keys the unmethylated swatch once twoColor paints it', () => {
    expect(
      legendFor({ type: 'bisulfite', modifications: { twoColor: true } }, [], {
        detectedModifications: new Map(),
      }).map(i => i.label),
    ).toEqual(['5mC methylated', 'Unmethylated'])
  })

  // Regression: two-color over a non-cytosine mod paints blue low-probability
  // calls (extract.ts), but usesMethylationLegend is false for it, so the
  // by-type branch keyed only '6mA' and left the blue marks unexplained.
  test('two-color over a non-cytosine mod keys its blue unmodified swatch', () => {
    const mods = new Map([['a', 'purple']])
    expect(
      legendFor(
        { type: 'modifications', modifications: { twoColor: true } },
        [],
        { detectedModifications: mods },
      ).map(i => i.label),
    ).toEqual(['6mA', 'Unmodified'])
  })

  test('fill-unmarked view omits the 5hmC swatch when only 5mC was detected', () => {
    const mods = new Map([['m', 'red']])
    expect(
      legendFor(
        { type: 'modifications', modifications: { fillUnmarked: true } },
        [],
        { detectedModifications: mods },
      ).map(i => i.label),
    ).toEqual(['5mC methylated', 'Unmethylated'])
  })

  test('swatch colors come from the live palette when provided', () => {
    const palette = makeTestPalette({
      colorFwdStrand: [0, 0, 1],
      colorSupplementary: [0, 1, 0],
    })
    const items = getReadDisplayLegendItems({
      colorBy: { type: 'strand' },
      presentCategories: new Set<ReadColorCategory>([
        'fwdStrand',
        'supplementary',
      ]),
      palette,
    })
    expect(items).toEqual([
      { color: 'rgb(0,0,255)', label: 'Forward strand' },
      { color: 'rgb(0,255,0)', label: 'Supplementary/split' },
    ])
  })
})

// The arc colors are their own vocabulary — a track colored by strand still
// draws insert-size-colored arcs — so they key a separate section rather than
// merging into the read swatches, where the arcs' neutral slot would land
// beside an identically-colored read swatch.
describe('getArcLegendItems', () => {
  test('keys only the arc color slots plotted, in table order', () => {
    expect(
      getArcLegendItems(
        new Set<ReadColorCategory>(['splitInversion', 'longInsert']),
        makeTestPalette(),
        'arc',
      ).map(i => i.label),
    ).toEqual(['Long insert', 'Split-read inversion'])
    expect(getArcLegendItems(new Set(), makeTestPalette(), 'arc')).toEqual([])
  })

  // The curves stroke colorShortInsertArc, not the pale pileup fill; keying the
  // fill left the one arc in a frame looking like the long-insert red beside it.
  test('keys short insert in the color the curves stroke', () => {
    const swatch = (mode: ReadConnectionsMode) =>
      getArcLegendItems(
        new Set<ReadColorCategory>(['shortInsert']),
        makeTestPalette(),
        mode,
      )[0]!.color
    expect(swatch('arc')).toBe(colorShortInsertArc)
    // read cloud fills endpoint squares from the pale marker palette instead
    expect(swatch('cloud')).not.toBe(colorShortInsertArc)
  })

  test('takes no per-scheme rewording — an arc never produces a strand bucket', () => {
    // under a read scheme these two would read as "Split read (forward/reverse)"
    expect(
      getArcLegendItems(
        new Set<ReadColorCategory>(['fwdStrand', 'revStrand']),
        makeTestPalette(),
        'arc',
      ).map(i => i.label),
    ).toEqual(['Forward strand', 'Reverse strand'])
  })
})

// Reads and arcs are one vocabulary or two, and the box has to say which. The
// overlapping case is the default one: reads by orientation under
// insert-size-and-orientation arcs share every orientation bucket.
describe('getAlignmentsLegendSections', () => {
  const model = (reads: LegendItem[], arcs: LegendItem[]) => ({
    legendItems: () => reads,
    arcLegendTitle: 'Arc colors',
    arcLegendItems: () => arcs,
    bezierLegendItems: () => [],
  })
  const shown = (sections: ReturnType<typeof getAlignmentsLegendSections>) =>
    sections
      .filter(s => s.items.length > 0)
      .map(s => [s.title, s.items.map(i => i.label)])

  test('merges reads and arcs into one list when they share a color', () => {
    expect(
      shown(
        getAlignmentsLegendSections(
          model(
            [
              { color: '#aaa', label: 'LR - Normal pair orientation' },
              { color: '#0a0', label: 'LL - Both mates forward strand' },
            ],
            [
              { color: '#aaa', label: 'Normal' },
              { color: '#0a0', label: 'LL - Both mates forward strand' },
              { color: '#f00', label: 'Long insert' },
            ],
          ),
        ),
      ),
    ).toEqual([
      [
        'Read and arc colors',
        [
          'LR - Normal pair orientation',
          'LL - Both mates forward strand',
          'Long insert',
        ],
      ],
    ])
  })

  // The neutral arc slot and the reads' LR slot are the same colorPairLR, so
  // "Normal" would be that grey a second time under a different word.
  test('keys a color once, under the label it got first', () => {
    const [[, labels]] = shown(
      getAlignmentsLegendSections(
        model(
          [{ color: '#aaa', label: 'LR - Normal pair orientation' }],
          [{ color: '#aaa', label: 'Normal' }],
        ),
      ),
    ) as [[string, string[]]]
    expect(labels).toEqual(['LR - Normal pair orientation'])
  })

  // Short insert is the one bucket the two vocabularies paint differently (pale
  // read fill vs. saturated arc stroke), so a color-only rule lists it twice.
  test('keys a label once, in the reads own color', () => {
    const [[, items]] = shown(
      getAlignmentsLegendSections(
        model(
          [
            { color: '#aaa', label: 'LR - Normal pair orientation' },
            { color: '#ffc0cb', label: 'Short insert' },
          ],
          [
            { color: '#aaa', label: 'Normal' },
            { color: '#ff3a8c', label: 'Short insert' },
          ],
        ),
      ),
    ) as [[string, string[]]]
    expect(items).toEqual(['LR - Normal pair orientation', 'Short insert'])
  })

  test('keeps them apart when the two vocabularies share nothing', () => {
    expect(
      shown(
        getAlignmentsLegendSections(
          model(
            [{ color: '#e00', label: '5mC methylated' }],
            [{ color: '#f00', label: 'Long insert' }],
          ),
        ),
      ),
    ).toEqual([
      ['Read colors', ['5mC methylated']],
      ['Arc colors', ['Long insert']],
    ])
  })
})
