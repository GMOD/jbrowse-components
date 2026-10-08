import { trackFields } from './fields.ts'

function scalePaths(value: unknown, displayType: string) {
  const steps = trackFields.scales!(value, { noun: 'read', displayType })
  return (Array.isArray(steps) ? steps : [steps]).map(step => step?.path)
}

test('a row height is the shared Row height menu, with each display its presets', () => {
  const path = (value: number, displayType: string) => {
    const step = trackFields.rowHeight!(value, { noun: 'row', displayType })
    return Array.isArray(step) ? undefined : step?.path
  }
  expect(path(8, 'LinearMafDisplay')).toBe('Track menu → Row height → Compact')
  expect(path(14, 'LinearMultiRowFeatureDisplay')).toBe(
    'Track menu → Row height → Normal',
  )
  expect(path(2, 'LinearMultiSampleVariantDisplay')).toBe(
    'Track menu → Row height → Custom... → 2px',
  )
  expect(path(0, 'LinearMultiSampleVariantDisplay')).toBe(
    'Track menu → Row height → Squeeze to fit view',
  )
})

test('an autoscale group is the axis widget of the display it is on', () => {
  expect(
    scalePaths({ y: { autoscaleGroup: 'depth' } }, 'LinearAlignmentsDisplay'),
  ).toEqual(['Track menu → Coverage axis... → Share axis with'])
  expect(
    scalePaths({ y: { autoscaleGroup: 'depth' } }, 'LinearWiggleDisplay'),
  ).toEqual(['Track menu → Y axis... → Share axis with'])
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
    expect(stepPaths('showLegend', false, displayType)).toEqual([
      'Track menu → Show... → Show legend (unchecked)',
    ])
  }
  expect(stepPaths('showLegend', true, undefined)).toEqual([])
  expect(stepPaths('showLegend', true, 'LinearArcDisplay')).toEqual([])
})

test('the variant lane toggle is a multi-sample Show... row', () => {
  expect(
    stepPaths('showVariantLane', true, 'LinearMultiSampleVariantDisplay'),
  ).toEqual(['Track menu → Show... → Show variant lane (checked)'])
  expect(stepPaths('showVariantLane', true, 'LinearBasicDisplay')).toEqual([])
})

test('branch lengths are the tree toggle beside Show tree', () => {
  expect(stepPaths('showBranchLength', false, 'LinearMafDisplay')).toEqual([
    'Track menu → Show... → Tree branch lengths (unchecked)',
  ])
  expect(stepPaths('showBranchLength', false, 'LinearBasicDisplay')).toEqual([])
})

test('a row color table is the arrangement dialog, and a column name stays a Samples row', () => {
  const table = { domain: ['a', 'b'], range: ['#111', '#222'] }
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
    'Track menu → Edit plot... → Add mark',
  ])
  expect(stepPaths('marks', marks, 'LinearManhattanDisplay')).toHaveLength(1)
  expect(stepPaths('marks', marks, 'LinearBasicDisplay')).toEqual([])
  expect(stepPaths('marks', [], 'LinearMarkDisplay')).toEqual([])
})

test('a gene color with its own scale is typed into the multi-way plot editor', () => {
  expect(
    stepPaths(
      'color',
      { field: 'jexl:feature.name', domain: ['a'], range: ['red'] },
      'MultiWaySyntenyDisplay',
    ),
  ).toEqual(['Track menu → Advanced → Edit plot...'])
  expect(
    stepPaths('color', { field: 'strand' }, 'MultiWaySyntenyDisplay'),
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

test('turning read connections off is the None overlay radio', () => {
  expect(
    stepPaths('readConnections', 'off', 'LinearAlignmentsDisplay'),
  ).toEqual(['Track menu → Read connections → None'])
})
