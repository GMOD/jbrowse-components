import { trackFields } from './fields.ts'

test('a row height is the shared Row height menu, with each display its presets', () => {
  const path = (value: number, displayType: string) => {
    const step = trackFields.rowHeight!(value, { noun: 'row', displayType })
    return Array.isArray(step) ? undefined : step?.path
  }
  expect(path(8, 'LinearMafDisplay')).toBe('Track menu → Row height → Compact')
  expect(path(2, 'LinearMultiSampleVariantDisplay')).toBe(
    'Track menu → Row height → Custom... → 2px',
  )
  expect(path(0, 'LinearMultiSampleVariantDisplay')).toBe(
    'Track menu → Row height → Squeeze to fit view',
  )
})

test('an autoscale group is the axis widget of the display it is on', () => {
  expect(
    stepPaths(
      'coverage.encoding.y',
      { scale: { group: 'depth' } },
      'LinearAlignmentsDisplay',
    ),
  ).toEqual(['Track menu → Coverage axis... → Share axis with'])
  expect(
    stepPaths(
      'encoding.y',
      { scale: { group: 'depth' } },
      'LinearWiggleDisplay',
    ),
  ).toEqual(['Track menu → Y axis... → Share axis with'])
})

test("wiggle's encoding.y is the bin summary and the axis rows, the mark display's the axis rows", () => {
  expect(stepPaths('encoding.y', 'maxScore', 'LinearWiggleDisplay')).toEqual([
    'Track menu → Resolution → Bin summary → Maximum',
  ])
  expect(
    stepPaths(
      'encoding.y',
      { field: 'minScore', axis: { grid: true } },
      'LinearWiggleDisplay',
    ),
  ).toEqual([
    'Track menu → Resolution → Bin summary → Minimum',
    'Track menu → Y axis... → Grid lines (checked)',
  ])
  expect(
    stepPaths(
      'encoding.y',
      { scale: { type: 'log' } },
      'LinearMarkDisplay',
    ),
  ).toEqual(['Track menu → Y axis... → Scale → Log'])
})

test("a y channel's scale and axis members are axis widget rows", () => {
  expect(
    stepPaths(
      'coverage.encoding.y',
      { scale: { type: 'log', fenceQuantile: 0.99 }, axis: { grid: true } },
      'LinearAlignmentsDisplay',
    ),
  ).toEqual([
    'Track menu → Coverage axis... → Scale → Log',
    'Track menu → Coverage axis... → Clip extreme outliers (checked)',
    'Track menu → Coverage axis... → Grid lines (checked)',
  ])
  expect(stepPaths('encoding.y', 'identity', 'LinearMafDisplay')).toEqual([
    'Track menu → Plot type → Identity X-Y plot',
  ])
})

test('clustering over a narrower window names that window in its step', () => {
  const settings = {
    runClustering: true,
    clusterRegion: '17:39,000,000-40,500,000',
  }
  const step = trackFields.runClustering!(true, { noun: 'row', settings })
  expect(Array.isArray(step) ? undefined : step?.note).toContain(
    'clusters over 17:39,000,000-40,500,000',
  )
  expect(
    trackFields.clusterRegion!(settings.clusterRegion, { noun: 'row' }),
  ).toEqual([])
})

function stepPaths(
  field: string,
  value: unknown,
  displayType: string | undefined,
) {
  const step = trackFields[field]!(value, { noun: 'row', displayType })
  return step === undefined ? [] : [step].flat().map(s => s.path)
}

test('a legend toggle is the same Show... row on every display that has a legend', () => {
  for (const displayType of [
    'LinearBasicDisplay',
    'LinearMultiSampleVariantDisplay',
    'LinearMarkDisplay',
  ]) {
    expect(stepPaths('legend.show', false, displayType)).toEqual([
      'Track menu → Show... → Legend (unchecked)',
    ])
  }
  expect(stepPaths('legend.show', true, undefined)).toEqual([])
  expect(stepPaths('legend.show', true, 'LinearArcDisplay')).toEqual([])
})

test('the variant lane toggle is a multi-sample Show... row', () => {
  expect(
    stepPaths('variants.show', true, 'LinearMultiSampleVariantDisplay'),
  ).toEqual(['Track menu → Show... → Variant lane (checked)'])
  expect(stepPaths('variants.show', true, 'LinearBasicDisplay')).toEqual([])
})

test('branch lengths are the toggle beside Tree', () => {
  expect(stepPaths('showBranchLength', false, 'LinearMafDisplay')).toEqual([
    'Track menu → Show... → Tree branch lengths (unchecked)',
  ])
  expect(stepPaths('showBranchLength', false, 'LinearBasicDisplay')).toEqual([])
})

test('a row color table is the arrangement dialog, and a column name stays a Samples row', () => {
  const table = { scale: { domain: ['a', 'b'], range: ['#111', '#222'] } }
  expect(stepPaths('rowColor', table, 'LinearMultiRowFeatureDisplay')).toEqual([
    'Track menu → Edit colors/arrangement...',
  ])
  expect(
    stepPaths('rowColor', 'group', 'LinearMultiSampleVariantDisplay'),
  ).toEqual(['Track menu → Color by... → Samples → Group'])
  expect(stepPaths('rowColor', table, 'LinearBasicDisplay')).toEqual([])
})

test('a multi-row facet is a Group by... row named for its field', () => {
  expect(
    stepPaths(
      'facet',
      { field: 'group', domain: ['x', 'y'] },
      'LinearMultiRowFeatureDisplay',
    ),
  ).toEqual(['Track menu → Group by... → group'])
})

test('rows are lanes on a multi-way track and a layout on a wiggle track', () => {
  expect(
    stepPaths(
      'rows',
      { domain: ['a', 'b'], kept: ['a'] },
      'MultiWaySyntenyDisplay',
    ),
  ).toEqual([
    'Track menu → Lanes → Lane menus',
    'Track menu → Lanes → Choose lanes...',
  ])
  expect(
    stepPaths('rows', { domain: ['a'] }, 'MultiWaySyntenyDisplay'),
  ).toEqual(['Track menu → Lanes → Lane menus'])
  expect(stepPaths('rows', '', 'LinearWiggleDisplay')).toEqual([
    'Track menu → Plot type → Overlapping',
  ])
  expect(stepPaths('rows', 'source', 'LinearWiggleDisplay')).toEqual([
    'Track menu → Plot type → Multi-row',
  ])
})

test('marks are added in the plot editor of the mark and Manhattan displays', () => {
  const marks = [{ mark: 'link' }, { mark: 'rule' }]
  expect(stepPaths('marks', marks, 'LinearMarkDisplay')).toEqual([
    'Track menu → Edit marks... → Add mark',
  ])
  expect(stepPaths('marks', marks, 'LinearManhattanDisplay')).toHaveLength(1)
  expect(stepPaths('marks', marks, 'LinearBasicDisplay')).toEqual([])
  expect(stepPaths('marks', [], 'LinearMarkDisplay')).toEqual([])
})

test('a gene color with its own scale is typed into the multi-way plot editor', () => {
  expect(
    stepPaths(
      'encoding.color',
      { field: 'jexl:feature.name', scale: { domain: ['a'], range: ['red'] } },
      'MultiWaySyntenyDisplay',
    ),
  ).toEqual(['Track menu → Advanced → Edit plot...'])
  expect(
    stepPaths('encoding.color', 'strand', 'MultiWaySyntenyDisplay'),
  ).toEqual([])
})

test('a size preset needs no display type, since only the canvas base declares it', () => {
  expect(stepPaths('displayMode', 'collapsed', undefined)).toEqual([
    'Track menu → Feature height → Collapsed',
  ])
  expect(
    stepPaths('displayMode', 'collapsed', 'LinearAlignmentsDisplay'),
  ).toEqual([])
})

test('read connections are the band checkboxes', () => {
  expect(
    stepPaths('readConnections', 'cloud', 'LinearAlignmentsDisplay'),
  ).toEqual(['Track menu → Read connections → Read cloud (checked)'])
  expect(
    stepPaths('readConnections', 'off', 'LinearAlignmentsDisplay'),
  ).toEqual(['Track menu → Read connections → Read arcs (unchecked)'])
})

test('alignments fit is a Read height radio and autogrow an Advanced checkbox', () => {
  expect(stepPaths('heightMode', 'fit', 'LinearAlignmentsDisplay')).toEqual([
    'Track menu → Row height → Fit to track height',
  ])
  expect(stepPaths('heightMode', 'grow', 'LinearAlignmentsDisplay')).toEqual([
    'Track menu → Advanced → Autogrow track height (checked)',
  ])
  expect(stepPaths('heightMode', 'fit', 'LinearBasicDisplay')).toEqual([
    'Track menu → Feature height → Track sizing → Fit row height to track height',
  ])
})

test("a filter list's entries are the rows that write them", () => {
  expect(
    stepPaths('filter', ['jexl:feature.score > 5'], 'LinearBasicDisplay'),
  ).toEqual(['Track menu → Filter by... → add the expression'])
  expect(stepPaths('filter', ['geneLike'], 'LinearBasicDisplay')).toEqual([
    'Track menu → Filter by... → Genes → Only genes',
  ])
  expect(
    stepPaths(
      'filter',
      [{ field: 'geneLike', equal: false }],
      'LinearBasicDisplay',
    ),
  ).toEqual(['Track menu → Filter by... → Genes → Hide genes'])
  expect(
    stepPaths(
      'filter',
      [{ field: 'missingness', lte: 0.1 }],
      'LinearMultiSampleVariantDisplay',
    ),
  ).toEqual(['Track menu → Filter by... → Missingness → 0.10'])
  expect(
    stepPaths(
      'filter',
      [
        { field: 'split', equal: true },
        { field: 'junction.reads', gte: 3 },
        { field: 'junction.canonical', equal: true },
      ],
      'LinearAlignmentsDisplay',
    ),
  ).toEqual([
    'Track menu → Filter by... → Split alignments → Only split alignments',
    'Track menu → Filter by... → Min reads at a junction → 3',
    'Track menu → Filter by... → Non-canonical junctions → Hide non-canonical junctions',
  ])
  expect(
    stepPaths('filter', [{ field: 'mapq', gte: 20 }], 'LinearAlignmentsDisplay'),
  ).toEqual(['Track menu → Filter by... → Edit filters...'])
})
