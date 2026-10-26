import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { colorAt } from '@jbrowse/core/util/markEncoding'

import { REGION, features, workerResult } from '../LinearMarkDisplay/testEnv.ts'
import { multiRowMenuItems } from './multiRowMenus.ts'
import { RECT_MARKS, SPLICED_MARKS, multiRowPlot } from './multiRowPlot.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { LinearMultiRowFeatureDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const PAINTING = features([
  { sample: 'mom', start: 0, end: 400 },
  { sample: 'dad', start: 100, end: 900 },
  { sample: 'kid', start: 200, end: 300 },
])

function display(config: Record<string, unknown>) {
  return createTestEnvironment(config).createDisplay().display
}

function loaded(model: LinearMultiRowFeatureDisplayModel) {
  model.setRpcData(0, workerResult(model, PAINTING), REGION)
  return model
}

function subMenu(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  const sub = item && 'subMenu' in item ? item.subMenu : []
  return typeof sub === 'function' ? sub() : sub
}

function labels(items: MenuItem[]) {
  return items.flatMap(i => ('label' in i ? [i.label] : []))
}

test('a painting rows on repClass where the features carry it, else name, unless the adapter lists sources', () => {
  expect(
    multiRowPlot({ numeric: [], categorical: [], attributes: ['repClass'] }),
  ).toEqual({ marks: RECT_MARKS, rows: 'repClass' })
  expect(
    multiRowPlot({ numeric: [], categorical: [], attributes: ['sample'] }),
  ).toEqual({ marks: RECT_MARKS, rows: 'name' })
  expect(
    multiRowPlot({ numeric: [], categorical: [], rows: 'source' }).rows,
  ).toBe('source')
})

test('spliced features draw their blocks joined by a line, and a file stating colors paints them', () => {
  expect(
    multiRowPlot({
      numeric: [],
      categorical: [],
      attributes: ['name', 'transcript'],
      spliced: true,
      bedColored: true,
    }),
  ).toEqual({
    marks: SPLICED_MARKS,
    rows: 'name',
    color: { scale: { type: 'identity' } },
  })
})

test('the default plot writes its rows and color, and leaves a declared color alone', () => {
  const bare = display({})
  bare.applyDefaultPlot(
    multiRowPlot({
      numeric: [],
      categorical: [],
      attributes: ['repClass'],
      bedColored: true,
    }),
  )
  expect(bare.rowsField).toBe('repClass')
  expect(bare.colorByMode).toBe('itemRgb')
  expect(bare.markTypes).toEqual(['rect'])

  const declared = display({
    rows: 'sample',
    encoding: { color: { field: 'name' } },
  })
  declared.applyDefaultPlot(
    multiRowPlot({ numeric: [], categorical: [], bedColored: true }),
  )
  expect(declared.rowsField).toBe('sample')
  expect(declared.colorField).toBe('name')
})

test('One row per... and Color by offer the scanned attributes and write the display', () => {
  const model = display({ rows: 'sample', marks: RECT_MARKS })
  model.setPlotFields({
    numeric: ['score'],
    categorical: [],
    attributes: ['itemRgb', 'name', 'sample', 'score', 'strand'],
  })
  const items = multiRowMenuItems(model)
  expect(labels(subMenu(items, 'One row per...'))).toEqual(['name', 'sample'])
  const colorBy = labels(subMenu(items, 'Color by...'))
  expect(colorBy).toEqual(
    expect.arrayContaining(['Strand', 'itemRgb', 'name', 'sample', 'score']),
  )
  expect(colorBy).not.toContain('strand')

  model.setRowsField('name')
  expect(model.rowsField).toBe('name')
  model.colorByItemRgb()
  expect(model.colorByMode).toBe('itemRgb')
  model.colorByField('strand')
  expect(model.colorByMode).toBe('strand')
})

test("a spliced painting's rows sort and cluster on its blocks, not the line under them", () => {
  const model = display({ rows: 'sample', marks: SPLICED_MARKS })
  expect(model.rowCompare?.mark).toBe(1)
})

test("Row height sizes a spliced painting's blocks and leaves the line under them a line", () => {
  const model = display({ rows: 'sample', marks: SPLICED_MARKS })
  expect(model.rowProportion).toBe(1)
  model.setRowProportion(0.5)
  expect(model.markRowProportions).toEqual([0, 0.5])
})

test('an identity color over a field paints the colors the field holds, with no notice', () => {
  const model = display({
    rows: 'sample',
    marks: RECT_MARKS,
    encoding: {
      color: {
        field: 'tint',
        scale: { type: 'identity', domain: ['#0072b2'], names: ['A'] },
      },
    },
  })
  model.setRpcData(
    0,
    workerResult(
      model,
      features([{ sample: 'mom', start: 0, end: 400, tint: '#0072b2' }]),
    ),
    REGION,
  )
  const [layer] = [...model.rpcDataMap.values()][0]!.layers
  expect(colorAt(layer!, 0)).toBe(cssColorToABGR('#0072b2'))
  expect(model.cornerNotices).toEqual([])
})

test("a file's own colors with no domain take their features' names in the key", () => {
  const model = display({
    rows: 'sample',
    marks: RECT_MARKS,
    encoding: { color: { scale: { type: 'identity' } } },
  })
  model.setRpcData(
    0,
    workerResult(
      model,
      features([
        {
          sample: 'mom',
          start: 0,
          end: 400,
          name: 'Quiescent',
          itemRgb: '245,245,245',
        },
        {
          sample: 'dad',
          start: 0,
          end: 400,
          name: 'Promoter',
          itemRgb: '255,0,0',
        },
      ]),
    ),
    REGION,
  )
  const labels = model.colorScales.flatMap(scale =>
    scale.kind === 'categorical' ? scale.entries.map(e => e.label) : [],
  )
  expect(labels).toEqual(expect.arrayContaining(['Quiescent', 'Promoter']))
})

test("a row's color paints its blocks while no mark or display color does", () => {
  const model = loaded(
    display({
      rows: 'sample',
      marks: RECT_MARKS,
      rowColor: { scale: { domain: ['mom'], range: ['#222222'] } },
    }),
  )
  const [layer] = [...model.rpcDataMap.values()][0]!.layers
  const names = model.rowKeySpace.rowKeys.names
  const colorOf = (sample: string) => {
    const i = Array.from(layer!.row!).findIndex(key => names[key] === sample)
    return colorAt(layer!, i)
  }
  expect(colorOf('mom')).toBe(cssColorToABGR('#222222'))
  expect(colorOf('dad')).toBe(cssColorToABGR('#0068d1'))

  model.colorByField('sample')
  const [recolored] = [...model.rpcDataMap.values()][0]!.layers
  expect(recolored!.colorKey ?? recolored!.color).not.toBe(layer!.color)
})
