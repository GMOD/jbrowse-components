import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { colorAt } from '@jbrowse/core/util/markEncoding'
import { colorSettingOf } from '@jbrowse/display-kit/colorConfigSchema'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { paintedColorNode } from '../LinearMarkDisplay/inheritedColor.ts'
import { keySettingOf } from '../LinearMarkDisplay/legend.ts'
import { SPLICED_MARKS } from '../LinearMarkDisplay/markPlot.ts'
import { NORMAL_ROW_PROPORTION } from '../LinearMarkDisplay/markVocabulary.ts'
import { scanPlotFields } from '../LinearMarkDisplay/scanPlotFields.ts'
import { REGION, features, workerResult } from '../LinearMarkDisplay/testEnv.ts'
import { multiRowMenuItems } from './multiRowMenus.ts'
import {
  RECT_MARKS,
  TRANSCRIPT_PROTEIN_MARKS,
  multiRowPlot,
} from './multiRowPlot.ts'
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

function scan(records: Parameters<typeof features>[0]) {
  return scanPlotFields(features(records), { listedSources: 0 })
}

// A painting as one scan window meets it: every sample's segment covers the
// window, so `sample` takes a value per feature while the genotype each
// segment is painted by takes two, shared across samples.
const PAINTING_WINDOW = Array.from({ length: 30 }, (_, i) => ({
  start: 0,
  end: 5000 + i,
  name: i % 2 ? 'B' : 'D',
  genotype: i % 2 ? 'B' : 'D',
  sample: `BXD${i}`,
}))

test('a painting rows on the field whose values each hold features that never overlap', () => {
  const fields = scan(PAINTING_WINDOW)
  expect(fields.categorical).toContain('genotype')
  expect(fields.lane).toBe('sample')
  expect(multiRowPlot(fields)).toEqual({ marks: RECT_MARKS, rows: 'sample' })
})

test("a painting whose segments are each named rows on its samples, not the segments' names", () => {
  const fields = scan([
    { start: 0, end: 900, name: 'seg1', sample: 'mom' },
    { start: 0, end: 700, name: 'seg2', sample: 'dad' },
    { start: 0, end: 800, name: 'seg3', sample: 'kid' },
  ])
  expect(multiRowPlot(fields).rows).toBe('sample')
})

test('of two lane fields the one of fewer values gives the rows', () => {
  const fields = scan([
    { start: 0, end: 100, cellType: 'K562', segment: 'a' },
    { start: 100, end: 200, cellType: 'K562', segment: 'b' },
    { start: 0, end: 100, cellType: 'HepG2', segment: 'c' },
    { start: 100, end: 200, cellType: 'HepG2', segment: 'd' },
  ])
  expect(multiRowPlot(fields).rows).toBe('cellType')
})

test('features that overlap within every field, or share one value, draw one lane', () => {
  const overlapping = scan([
    { start: 0, end: 500, name: 'peak', kind: 'a', strand: 1 },
    { start: 100, end: 600, name: 'peak', kind: 'a', strand: -1 },
    { start: 200, end: 700, name: 'peak', kind: 'b', strand: 1 },
    { start: 300, end: 800, name: 'peak', kind: 'b', strand: -1 },
  ])
  expect(overlapping.lane).toBeUndefined()
  const constant = scan([
    { start: 0, end: 100, kind: 'peak', score: 3 },
    { start: 200, end: 300, kind: 'peak', score: 9 },
  ])
  expect(constant.lane).toBeUndefined()
  const bed3 = multiRowPlot(constant)
  expect(bed3.rows).toBeUndefined()
  const model = display({})
  model.applyDefaultPlot(bed3)
  expect(model.drawsRows).toBe(false)
})

test('a field some features lack, a number and a color column give no rows', () => {
  const fields = scan([
    { start: 0, end: 100, depth: 3, itemRgb: '255,0,0', note: 'x' },
    { start: 0, end: 100, depth: 9, itemRgb: '0,0,255', note: 'y' },
    { start: 0, end: 100, depth: 4, itemRgb: '0,255,0' },
  ])
  expect(fields.lane).toBeUndefined()
})

test('a feature two scan windows both answer does not overlap itself', () => {
  const [mom, dad] = features([
    { start: 0, end: 900, sample: 'mom' },
    { start: 0, end: 900, sample: 'dad' },
  ])
  expect(
    scanPlotFields([mom!, dad!, mom!, dad!], { listedSources: 0 }).lane,
  ).toBe('sample')
})

test('RepeatMasker rows take a row per repClass though a class overlaps itself, and an adapter listing sources rows on them first', () => {
  const fields = scan([
    { start: 0, end: 300, name: 'AluY', repClass: 'SINE' },
    { start: 200, end: 500, name: 'AluSx', repClass: 'SINE' },
    { start: 400, end: 900, name: 'L1PA2', repClass: 'LINE' },
  ])
  expect(multiRowPlot(fields).rows).toBe('repClass')
  expect(multiRowPlot({ ...fields, rows: 'source' }).rows).toBe('source')
})

test('spliced features draw their blocks joined by a line, and a file stating colors paints them', () => {
  expect(
    multiRowPlot({
      numeric: [],
      categorical: [],
      attributes: ['name', 'transcript'],
      lane: 'name',
      spliced: true,
      bedColored: true,
    }),
  ).toEqual({
    marks: SPLICED_MARKS,
    rows: 'name',
    color: { scale: { type: 'identity' } },
  })
})

test('protein features alone take a row per transcript they sit on, colored by family', () => {
  expect(
    multiRowPlot({
      numeric: [],
      categorical: [],
      attributes: ['accession', 'name', 'proteinStart', 'transcript'],
      spliced: true,
    }),
  ).toEqual({
    marks: SPLICED_MARKS,
    rows: 'transcript',
    color: { field: 'name' },
  })
})

// Isoforms as domains2genome --gff3 writes them: overlapping transcripts, two
// sharing a product, so `product` is few-valued and holds no lanes.
function transcript(name: string, product: string, start: number) {
  return {
    start,
    end: start + 900,
    type: 'mRNA',
    name,
    product,
    protein_id: `${name}.p`,
    subfeatures: [
      { uniqueId: `${name}-exon`, start, end: start + 900, type: 'exon' },
      { uniqueId: `${name}-cds`, start, end: start + 600, type: 'CDS' },
      {
        uniqueId: `${name}-pfam`,
        start,
        end: start + 300,
        type: 'protein_match',
        name: 'SET',
      },
    ],
  }
}

test('a transcript carrying protein matches draws as the transcript with its matches over it, a row each', () => {
  const fields = scan([
    transcript('XM_1', 'TBC1 domain family member 10A', 0),
    transcript('XM_2', 'TBC1 domain family member 10A', 100),
    transcript('XM_3', 'GATA zinc finger protein 8', 200),
  ])
  expect(fields.categorical).toContain('product')
  expect(multiRowPlot(fields)).toEqual({
    marks: TRANSCRIPT_PROTEIN_MARKS,
    rows: 'name',
    color: { field: 'name' },
  })
  expect(
    multiRowPlot({
      numeric: [],
      categorical: [],
      attributes: ['name', 'product', 'protein_id', 'type'],
      spliced: true,
      childTypes: ['CDS', 'exon', 'protein_match'],
    }),
  ).toEqual({
    marks: TRANSCRIPT_PROTEIN_MARKS,
    rows: 'name',
    color: { field: 'name' },
  })
  // nameless transcripts row on what the scan found
  expect(
    multiRowPlot({
      numeric: [],
      categorical: [],
      attributes: ['protein_id', 'type'],
      lane: 'protein_id',
      spliced: true,
      childTypes: ['CDS', 'exon', 'protein_match'],
    }).rows,
  ).toBe('protein_id')
  expect(
    multiRowPlot({
      numeric: [],
      categorical: [],
      spliced: true,
      childTypes: ['CDS', 'exon'],
    }).marks,
  ).toBe(SPLICED_MARKS)
})

test("a match's family colors only the matches, the transcript's greys key as UTR and coding, and Color by still reaches the matches", () => {
  const model = display({ marks: TRANSCRIPT_PROTEIN_MARKS })
  model.applyDefaultPlot(
    multiRowPlot({
      numeric: [],
      categorical: [],
      attributes: ['name'],
      spliced: true,
      childTypes: ['CDS', 'exon', 'protein_match'],
    }),
  )
  const painted = () =>
    model.conf.marks.map(m =>
      colorSettingOf(paintedColorNode(m, model.conf.encoding.color)),
    )
  expect(painted().map(c => c.field)).toEqual(['', 'type', 'type', 'name'])
  const [, exon, cds] = model.conf.marks
  expect([keySettingOf(exon, 'color'), keySettingOf(cds, 'color')]).toEqual([
    expect.objectContaining({ title: 'Transcript', names: ['UTR', 'coding'] }),
    expect.objectContaining({ title: 'Transcript', names: ['UTR', 'coding'] }),
  ])
  model.colorByField('accession')
  expect(painted().map(c => c.field)).toEqual(['', 'type', 'type', 'accession'])
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

test('One row per and Color by offer the scanned attributes and write the display', () => {
  const model = display({ rows: 'sample', marks: RECT_MARKS })
  const scanned = {
    numeric: ['score'],
    categorical: [],
    attributes: ['itemRgb', 'name', 'sample', 'score', 'strand'],
  }
  model.setPlotFields({ ...scanned, bedColored: true })
  const items = multiRowMenuItems(model)
  expect(labels(subMenu(items, 'One row per'))).toEqual(['name', 'sample'])
  const colorBy = labels(subMenu(items, 'Color by'))
  expect(colorBy).toEqual(
    expect.arrayContaining(['Strand', 'itemRgb', 'name', 'sample', 'score']),
  )
  expect(colorBy).not.toContain('strand')
  // a color column no feature states a color in offers no itemRgb row
  model.setPlotFields(scanned)
  expect(labels(subMenu(multiRowMenuItems(model), 'Color by'))).not.toContain(
    'itemRgb',
  )

  model.setRowsField('name')
  expect(model.rowsField).toBe('name')
  model.colorByIdentity()
  expect(model.colorByMode).toBe('itemRgb')
  model.colorByField('strand')
  expect(model.colorByMode).toBe('strand')
})

function ticked(items: MenuItem[]) {
  return labels(items.filter(i => 'checked' in i && i.checked))
}

test('Group by ticks the row attribute banding the rows, and None once it is cleared', () => {
  const model = loaded(
    display({
      rows: {
        field: 'sample',
        groups: [
          { match: '^(mom|dad)$', group: 'parents' },
          { match: 'kid', group: 'children' },
        ],
      },
      marks: RECT_MARKS,
    }),
  )
  const groupBy = () => subMenu(model.trackMenuItems(), 'Group by')
  expect(labels(groupBy())).toEqual(['None', 'Group'])
  expect(ticked(groupBy())).toEqual(['None'])
  model.facetByField('group')
  expect(model.bandsRows).toBe(true)
  expect(ticked(groupBy())).toEqual(['Group'])
  model.facetByField('')
  expect(ticked(groupBy())).toEqual(['None'])
})

test('rows with no attributes offer no Group by', () => {
  const model = loaded(display({ rows: 'sample', marks: RECT_MARKS }))
  expect(labels(model.trackMenuItems())).not.toContain('Group by')
})

test("One row per goes while a facet's sections draw in the rows' place", () => {
  const model = display({ rows: 'sample', marks: RECT_MARKS })
  model.setPlotFields({
    numeric: [],
    categorical: [],
    attributes: ['name', 'sample'],
  })
  expect(labels(multiRowMenuItems(model))).toContain('One row per')
  model.facetByField('name')
  expect(model.drawsRows).toBe(false)
  expect(labels(multiRowMenuItems(model))).not.toContain('One row per')
})

test('Color by a `jexl:` field ticks nothing and names it a custom expression', () => {
  const expr = 'jexl:get(feature,"tint")'
  const model = display({
    rows: 'sample',
    marks: RECT_MARKS,
    encoding: { color: { field: expr } },
  })
  model.setPlotFields({
    numeric: [],
    categorical: [],
    attributes: ['sample', 'tint'],
  })
  const colorBy = subMenu(multiRowMenuItems(model), 'Color by')
  expect(labels(colorBy)).toContain('Custom expression')
  expect(labels(colorBy)).not.toContain(expr)
  expect(labels(colorBy.filter(i => 'checked' in i && i.checked))).toEqual([])
})

test('One row per another field drops the arrangement, and the field in force keeps it', () => {
  const rows = {
    field: 'sample',
    sort: ['b', 'a'],
    labels: { a: 'A' },
    tree: { newick: '(a,b);' },
    kept: ['a'],
  }
  const model = display({ rows, marks: RECT_MARKS })
  model.setRowsField('sample')
  expect(getSnapshot(model.conf.rows)).toEqual(rows)
  model.setRowsField('name')
  expect(getSnapshot(model.conf.rows)).toEqual({ field: 'name' })
})

// The keyed rule (ADR-257): the pins name the old field's rows, and the
// color channel names an attribute, valid on the new rows.
test('One row per another field drops the pinned row colors and keeps rows.color', () => {
  const model = display({
    rows: {
      field: 'sample',
      colors: { a: '#f00' },
      color: { field: 'group', scale: { unknown: '' } },
    },
    marks: RECT_MARKS,
  })
  model.setRowsField('sample')
  expect(getSnapshot(model.conf.rows).colors).toEqual({ a: '#f00' })
  model.setRowsField('name')
  expect(getSnapshot(model.conf.rows)).toEqual({
    field: 'name',
    color: { field: 'group', scale: { unknown: '' } },
  })
})

test("Reset row order on another field than the config's returns none of the config's arrangement to the new rows", () => {
  const rows = {
    field: 'sample',
    sort: ['kid'],
    labels: { mom: 'Mother' },
    colors: { mom: '#f00' },
    kept: ['mom'],
  }
  const model = loaded(display({ rows, marks: RECT_MARKS }))
  model.setRowsField('name')
  expect(model.rowArrangementIsCustom).toBe(false)
  model.setRowLabels({ x: 'X' })
  expect(model.rowArrangementIsCustom).toBe(true)
  model.resetRowArrangement()
  expect(getSnapshot(model.conf.rows)).toEqual({ field: 'name' })
  model.setRowsField('sample')
  model.resetRowArrangement()
  expect(getSnapshot(model.conf.rows)).toEqual(rows)
})

// A config's arrangement stating no field names no field, so it returns on
// whatever field the rows are on: the plain rule a write from an empty field
// follows too, not a guess at the field the default plot picked.
test('Reset row order returns a config arrangement stating no field on any field', () => {
  const rows = { sort: ['kid'], kept: ['mom'] }
  const model = display({ rows })
  const fields = {
    numeric: [],
    categorical: [],
    attributes: ['name', 'sample'],
    lane: 'sample',
  }
  model.setPlotFields(fields)
  model.applyDefaultPlot(model.defaultPlotOf(fields)!)
  expect(getSnapshot(model.conf.rows)).toEqual({ ...rows, field: 'sample' })
  model.setRowsField('name')
  expect(getSnapshot(model.conf.rows)).toEqual({ field: 'name' })
  expect(model.rowArrangementIsCustom).toBe(true)
  model.resetRowArrangement()
  expect(getSnapshot(model.conf.rows)).toEqual({ ...rows, field: 'name' })
})

test("a spliced painting's rows sort and cluster on its blocks, not the line under them", () => {
  const model = display({ rows: 'sample', marks: SPLICED_MARKS })
  expect(model.rowCompare?.mark).toBe(1)
})

test("Row height sizes a spliced painting's blocks and leaves the line under them a line", () => {
  const model = display({ rows: 'sample', marks: SPLICED_MARKS })
  expect(model.rowProportion).toBe(NORMAL_ROW_PROPORTION)
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

test("Default over the documented parent key raises no notice, and itemRgb brings the key's names back", () => {
  const model = loaded(
    display({
      rows: 'sample',
      marks: RECT_MARKS,
      encoding: {
        color: {
          scale: {
            type: 'identity',
            domain: ['rgb(227,26,28)', 'rgb(31,120,180)'],
            names: ['Maternal', 'Paternal'],
          },
        },
      },
    }),
  )
  const keyLabels = () =>
    model.colorScales.flatMap(scale =>
      scale.kind === 'categorical' ? scale.entries.map(e => e.label) : [],
    )
  model.pickDefaultColor()
  expect(model.colorByMode).toBe('default')
  expect(model.cornerNotices).toEqual([])
  model.colorByIdentity()
  expect(model.colorByMode).toBe('itemRgb')
  expect(keyLabels()).toEqual(['Maternal', 'Paternal'])
})

test("a row's color paints its blocks while no mark or display color does", () => {
  const model = loaded(
    display({
      rows: { field: 'sample', colors: { mom: '#222222' } },
      marks: RECT_MARKS,
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

const WIDE = { ...REGION, end: 8_000_000 }

function scanned(
  answers: (() => Promise<unknown>)[],
  config: Record<string, unknown> = {},
) {
  const asked: unknown[] = []
  const env = createTestEnvironment(config, {
    region: WIDE,
    rpcCall: (_sessionId, method, args) => {
      if (method === 'MarkScanPlotFields') {
        asked.push((args as { regions: unknown }).regions)
        return answers[Math.min(asked.length, answers.length) - 1]!()
      }
      return new Promise(() => {})
    },
  }).createDisplay()
  return { ...env, asked }
}

const NO_FEATURES = () =>
  Promise.resolve({ numeric: [], categorical: [], empty: true })
const REPEATS = () =>
  Promise.resolve({
    numeric: [],
    categorical: [],
    attributes: ['name', 'repClass'],
  })

test('a window with no features decides no plot, and the next window scans again', async () => {
  const { display, view, asked } = scanned([NO_FEATURES, REPEATS])
  await waitFor(() => {
    expect(asked).toHaveLength(1)
  })
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(display.conf.marks).toHaveLength(0)
  expect(display.plotDefaultChecked).toBe(false)
  view.setNewView(1, 1_000_000)
  await waitFor(() => {
    expect(display.markTypes).toEqual(['rect'])
  })
  expect(display.rowsField).toBe('repClass')
  expect(asked).toHaveLength(2)
})

test("a failed scan is the display's error, and a retry scans again", async () => {
  const { display, asked } = scanned([
    () => Promise.reject(new Error('network down')),
    REPEATS,
  ])
  await waitFor(() => {
    expect(String(display.error)).toMatch('network down')
  })
  expect(display.conf.marks).toHaveLength(0)
  display.reload()
  await waitFor(() => {
    expect(display.markTypes).toEqual(['rect'])
  })
  expect(display.error).toBeUndefined()
  expect(asked).toHaveLength(2)
})

const DECLARED = { marks: RECT_MARKS, rows: 'name' }

test("a declared plot whose first window holds no features offers the next window's fields", async () => {
  const { display, view, asked } = scanned([NO_FEATURES, REPEATS], DECLARED)
  await waitFor(() => {
    expect(asked).toHaveLength(1)
  })
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(display.plotFields?.attributes).toBeUndefined()
  view.setNewView(1, 1_000_000)
  await waitFor(() => {
    expect(display.plotFields?.attributes).toEqual(['name', 'repClass'])
  })
  expect(labels(subMenu(display.trackMenuItems(), 'One row per'))).toContain(
    'repClass',
  )
  expect(display.rowsField).toBe('name')
})

test('a declared plot draws on through a failed scan, and the next window scans again', async () => {
  const { display, view, asked } = scanned(
    [() => Promise.reject(new Error('network down')), REPEATS],
    DECLARED,
  )
  await waitFor(() => {
    expect(asked).toHaveLength(1)
  })
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(display.error).toBeUndefined()
  view.setNewView(1, 1_000_000)
  await waitFor(() => {
    expect(display.plotFields?.attributes).toEqual(['name', 'repClass'])
  })
})
