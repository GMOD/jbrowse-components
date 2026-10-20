import { viewFields } from './fields.ts'

function stepPaths(
  field: string,
  value: unknown,
  viewType: string,
  settings?: Record<string, unknown>,
) {
  const step = viewFields[field]!(value, {
    noun: 'feature',
    viewType,
    settings,
  })
  return step === undefined ? [] : [step].flat().map(s => s.path)
}

test('the circular view holds the filter rows in its view menu', () => {
  expect(
    stepPaths(
      'filter',
      [
        { field: 'length', gte: 100000 },
        { field: 'identity', gte: 0.9 },
      ],
      'CircularView',
    ),
  ).toEqual([
    'View menu → Min length → drag to 100,000bp',
    'View menu → Min identity → drag to 90%',
  ])
  expect(
    stepPaths('filter', [{ field: 'length', gte: 100000 }], 'LinearSyntenyView'),
  ).toEqual([
    'Synteny display settings (the sliders button in the view header) → Min length → drag to 100,000bp',
  ])
})

test('the color radios sit in the circular view menu and the comparative headers', () => {
  const color = { field: 'strand' }
  expect(stepPaths('color', color, 'CircularView')).toEqual([
    'View menu → Color by... → Strand',
  ])
  expect(stepPaths('color', color, 'DotplotView')).toEqual([
    'Dotplot header → palette button → Strand',
  ])
})

test('hiding unlabelled rows is a valid predicate the color menu writes', () => {
  const filter = [{ field: 'gene_group', valid: true }]
  expect(stepPaths('filter', filter, 'LinearSyntenyView')).toEqual([
    'Synteny view header → palette button → Hide unlabelled rows (checked)',
  ])
  expect(stepPaths('filter', filter, 'CircularView')).toEqual([
    'View menu → Color by... → Hide unlabelled rows (checked)',
  ])
  expect(stepPaths('filter', filter, 'LinearGenomeView')).toEqual([])
})

test('the legend toggle of the circular view is in its view menu', () => {
  expect(stepPaths('showLegend', true, 'CircularView')).toEqual([
    'View menu → Show legend (checked)',
  ])
  expect(stepPaths('showLegend', true, 'LinearSyntenyView')).toEqual([])
})

test('an axis grid names the menu each view keeps it in', () => {
  expect(stepPaths('axis', { grid: false }, 'LinearGenomeView')).toEqual([
    'View menu → Show... → Guidelines (unchecked)',
  ])
  expect(
    stepPaths('axis', { grid: false, labels: false }, 'DotplotView'),
  ).toEqual([
    'Dotplot display settings (the sliders button in the view header) → Gridlines (unchecked)',
    'Dotplot display settings (the sliders button in the view header) → Tick labels (unchecked)',
  ])
  expect(stepPaths('axis', { grid: true }, 'LinearSyntenyView')).toEqual([
    'Synteny display settings (the sliders button in the view header) → Location markers (checked)',
  ])
})

test('line width is a dotplot settings row only', () => {
  expect(stepPaths('lineWidth', 4, 'DotplotView')).toEqual([
    'Dotplot display settings (the sliders button in the view header) → Line width → drag to 4px',
  ])
  expect(stepPaths('lineWidth', 4, 'LinearSyntenyView')).toEqual([])
})

test('the dotplot height is its resize grip, and the breakpoint view has none', () => {
  expect(stepPaths('height', 760, 'DotplotView')).toEqual([
    'Drag the bar at the bottom edge of the view to resize it (760px here).',
  ])
  expect(stepPaths('height', 800, 'BreakpointSplitView')).toEqual([])
})

test('the anchor row is named as the reorder dialog lists it', () => {
  const settings = {
    views: [{ assembly: 'a' }, { assembly: 'b' }, { assembly: 'a' }],
  }
  const path = (row: number) =>
    stepPaths('diagonalizeAnchorRow', row, 'LinearSyntenyView', settings)
  expect(path(1)).toEqual([
    'Synteny view header → View options → Rows → Re-order chromosomes... → Row to keep as it is → b',
  ])
  expect(path(2)).toEqual([
    'Synteny view header → View options → Rows → Re-order chromosomes... → Row to keep as it is → a (row 3)',
  ])
  expect(path(3)).toEqual([])
})
