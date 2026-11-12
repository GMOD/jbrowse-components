import { Suspense, createElement } from 'react'

import { getSession } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import { DEFAULT_MARK_COLOR, colorAt } from '@jbrowse/core/util/markEncoding'
import { colorSettingOf } from '@jbrowse/display-kit/colorConfigSchema'
import { getSnapshot, onPatch } from '@jbrowse/mobx-state-tree'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { paintedColorNode } from '../LinearMarkDisplay/inheritedColor.ts'
import { keySettingOf } from '../LinearMarkDisplay/legend.ts'
import { SPLICED_MARKS } from '../LinearMarkDisplay/markPlot.ts'
import { NORMAL_ROW_PROPORTION } from '../LinearMarkDisplay/markVocabulary.ts'
import { REGION, features, workerResult } from '../LinearMarkDisplay/testEnv.ts'
import { multiRowMenuItems } from './multiRowMenus.ts'
import { TRANSCRIPT_PROTEIN_PLOT } from './plotExamples.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { LinearMultiRowFeatureDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

const PAINTING = features([
  { sample: 'mom', start: 0, end: 400 },
  { sample: 'dad', start: 100, end: 900 },
  { sample: 'kid', start: 200, end: 300 },
])

function display(config: Record<string, unknown>) {
  return createTestEnvironment(config).createDisplay().display
}

function loaded(
  model: LinearMultiRowFeatureDisplayModel,
  feats: readonly Feature[] = PAINTING,
) {
  model.setRpcData(0, workerResult(model, feats), REGION)
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

// Each instance's packed color, by the value of `field` on its feature.
function colorsBy(model: LinearMultiRowFeatureDisplayModel, field: string) {
  const [layer] = [...model.rpcDataMap.values()][0]!.layers
  const names = model.rowKeySpace.rowKeys.names
  return (value: string) => {
    const i = model.drawsRows
      ? Array.from(layer!.row!).findIndex(key => names[key] === value)
      : PAINTING_COLORS.findIndex(f => f.get(field) === value)
    return colorAt(layer!, i)
  }
}

const PAINTING_COLORS = features([
  { sample: 'mom', start: 0, end: 400, itemRgb: '0,0,0' },
  { sample: 'dad', start: 100, end: 900, itemRgb: '0' },
  { sample: 'kid', start: 200, end: 300, itemRgb: '0,210,0' },
  { sample: 'aunt', start: 300, end: 500 },
])

const DEFAULT_ABGR = cssColorToABGR(DEFAULT_MARK_COLOR)

test('the plot is stated: a rect per feature in a row per type, with nothing scanned or written to decide it', async () => {
  const methods: string[] = []
  const { display: model } = createTestEnvironment(
    {},
    {
      rpcCall: (_sessionId, method) => {
        methods.push(method)
        return new Promise(() => {})
      },
    },
  ).createDisplay()
  expect(getSnapshot(model.conf.marks)).toEqual([{ mark: { type: 'rect' } }])
  expect(model.markTypes).toEqual(['rect'])
  expect(model.rowsField).toBe('type')
  expect(model.drawsRows).toBe(true)
  expect(model.rpcProps().facet).toEqual({ field: 'type' })
  expect(getSnapshot(model.conf.rows)).toEqual({})
  expect(model.colorByMode).toBe('default')
  expect(model.conf.encoding.color.scale.type).toBeUndefined()
  await waitFor(() => {
    expect(methods.length).toBeGreaterThan(0)
  })
  expect(methods).not.toContain('MarkScanPlotFields')
})

const VARIANTS = features([
  { start: 0, end: 1, type: 'single nucleotide variant', name: 'VCV1' },
  { start: 10, end: 11, type: 'single nucleotide variant', name: 'VCV2' },
  { start: 20, end: 30, type: 'Deletion', name: 'VCV3' },
])

test('rows default to the features type, one labelled row per type in view', () => {
  const model = loaded(display({}), VARIANTS)
  expect(model.sources.map(s => s.name)).toEqual([
    'Deletion',
    'single nucleotide variant',
  ])
  expect(model.featuresCarryRowsField).toBe(true)
  expect(model.rowsHint).toBeUndefined()
})

test('features carrying none of the rows field in force draw in one row, and the display asks once, writing nothing', () => {
  const model = display({})
  const queueDialog = jest.spyOn(getSession(model), 'queueDialog')
  loaded(model)
  expect(model.rowsField).toBe('type')
  expect(model.featuresCarryRowsField).toBe(false)
  expect(model.sources.map(s => s.name)).toEqual([''])
  expect(model.rowsHint?.text).toBe('One row per...')
  expect(getSnapshot(model.conf.rows)).toEqual({})
  expect(queueDialog).toHaveBeenCalledTimes(1)
  model.setRpcData(0, workerResult(model, PAINTING), REGION)
  expect(queueDialog).toHaveBeenCalledTimes(1)
  model.setRowsField('sample')
  model.setRpcData(0, workerResult(model, PAINTING), REGION)
  expect(model.rowsField).toBe('sample')
  expect(model.rowsHint).toBeUndefined()
  const written = display({ rows: 'cellType' })
  const asked = jest.spyOn(getSession(written), 'queueDialog')
  loaded(written)
  expect(written.rowsHint?.text).toBe('One row per...')
  expect(asked).toHaveBeenCalledTimes(1)
})

test('one row is a written choice the default never overrides, and Type returns to the declared default', () => {
  const one = loaded(display({ rows: '' }), VARIANTS)
  expect(getSnapshot(one.conf.rows)).toEqual({ field: '' })
  expect(one.rowsField).toBe('')
  expect(one.drawsRows).toBe(false)
  expect(one.rowsHint).toBeUndefined()
  const typed = display({})
  typed.setRowsField('')
  expect(getSnapshot(typed.conf.rows)).toEqual({ field: '' })
  expect(typed.rowsField).toBe('')
  typed.setRowsField('type')
  expect(getSnapshot(typed.conf.rows)).toEqual({})
  expect(typed.rowsField).toBe('type')
  const sampled = loaded(display({ rows: { field: 'sample' } }))
  expect(sampled.rowsField).toBe('sample')
  expect(sampled.featuresCarryRowsField).toBe(true)
})

test("a pick off the default type drops the arrangement naming the types' rows", () => {
  const model = display({
    rows: { sort: ['Deletion'], labels: { Deletion: 'Del' } },
  })
  model.setRowsField('type')
  expect(getSnapshot(model.conf.rows)).toEqual({
    sort: ['Deletion'],
    labels: { Deletion: 'Del' },
  })
  model.setRowsField('clinSign')
  expect(getSnapshot(model.conf.rows)).toEqual({ field: 'clinSign' })
})

test("unset, each feature paints its file's own color, and a placeholder black paints the default", () => {
  const model = loaded(display({ rows: 'sample' }), PAINTING_COLORS)
  const colorOf = colorsBy(model, 'sample')
  expect(colorOf('mom')).toBe(DEFAULT_ABGR)
  expect(colorOf('dad')).toBe(DEFAULT_ABGR)
  expect(colorOf('kid')).toBe(cssColorToABGR('rgb(0,210,0)'))
  expect(colorOf('aunt')).toBe(DEFAULT_ABGR)
  expect(model.rpcProps().layers[0]!.encoding.color).toEqual({
    scale: 'identity',
    strict: true,
  })
})

test('an identity scale written explicitly reads black as black, as UCSC itemRgb on does', () => {
  const model = loaded(
    display({
      rows: 'sample',
      encoding: { color: { scale: { type: 'identity' } } },
    }),
    PAINTING_COLORS,
  )
  const colorOf = colorsBy(model, 'sample')
  expect(colorOf('mom')).toBe(cssColorToABGR('black'))
  expect(colorOf('dad')).toBe(cssColorToABGR('black'))
  expect(colorOf('kid')).toBe(cssColorToABGR('rgb(0,210,0)'))
  expect(model.rpcProps().layers[0]!.encoding.color).toEqual({
    scale: 'identity',
  })
})

test("a stated row color wins over the file's own color, which wins over the default", () => {
  const model = loaded(
    display({
      rows: { field: 'sample', colors: { kid: '#222222', mom: '#f28e2b' } },
    }),
    PAINTING_COLORS,
  )
  const colorOf = colorsBy(model, 'sample')
  expect(colorOf('kid')).toBe(cssColorToABGR('#222222'))
  expect(colorOf('mom')).toBe(cssColorToABGR('#f28e2b'))
  expect(colorOf('dad')).toBe(DEFAULT_ABGR)
  expect(model.conf.encoding.color.scale.type).toBeUndefined()
})

test('a stated display color paints over the file colors, and Default returns them', () => {
  const model = loaded(display({ rows: 'sample' }), PAINTING_COLORS)
  model.setColorValue('#123456')
  expect(colorsBy(model, 'sample')('kid')).toBe(cssColorToABGR('#123456'))
  expect(model.colorByMode).toBe('solid')
  model.pickDefaultColor()
  model.setRpcData(0, workerResult(model, PAINTING_COLORS), REGION)
  expect(colorsBy(model, 'sample')('kid')).toBe(cssColorToABGR('rgb(0,210,0)'))
})

test('One row per offers None, Type and Attribute..., Type ticked by default, and Color by Default, Strand, Attribute... and Solid color...', () => {
  const model = display({})
  const ticked = () =>
    labels(
      subMenu(multiRowMenuItems(model), 'One row per').filter(
        i => 'checked' in i && i.checked,
      ),
    )
  expect(labels(subMenu(multiRowMenuItems(model), 'One row per'))).toEqual([
    'None (one row)',
    'Type',
    'Attribute...',
  ])
  expect(ticked()).toEqual(['Type'])
  expect(labels(subMenu(multiRowMenuItems(model), 'Color by'))).toEqual([
    'Default',
    'Strand',
    'Attribute...',
    'Solid color...',
  ])
  model.setRowsField('sample')
  expect(ticked()).toEqual(['Attribute...'])
  model.setRowsField('')
  expect(model.drawsRows).toBe(false)
  expect(ticked()).toEqual(['None (one row)'])
  model.colorByField('strand')
  expect(model.colorByMode).toBe('strand')
  model.colorByField('clinSign')
  expect(model.colorByMode).toBe('attribute')
  expect(model.colorByAttribute).toBe('clinSign')
})

test('Color by Strand paints forward and reverse in the strand preset colors', () => {
  const model = display({})
  model.setRowsField('')
  const strand = subMenu(multiRowMenuItems(model), 'Color by').find(
    i => 'label' in i && i.label === 'Strand',
  )
  if (strand && 'onClick' in strand) {
    strand.onClick()
  }
  expect(model.colorByMode).toBe('strand')
  loaded(
    model,
    features([
      { start: 0, end: 100, strand: 1 },
      { start: 200, end: 300, strand: -1 },
    ]),
  )
  const [layer] = [...model.rpcDataMap.values()][0]!.layers
  const { domain, range } = UNIVERSAL_FIELD_PRESETS.strand.scale
  const presetColor = (key: '1' | '-1') =>
    cssColorToABGR(range[domain.indexOf(key)]!)
  expect(colorAt(layer!, 0)).toBe(presetColor('1'))
  expect(colorAt(layer!, 1)).toBe(presetColor('-1'))
})

test('the pickers scan the features in view under the display byte budget', async () => {
  const asked: { method: string; args: Record<string, unknown> }[] = []
  const answer = [
    { field: 'clinSign', values: ['Benign'], missing: false, overflow: false },
  ]
  const { display: model } = createTestEnvironment(
    { rows: 'sample' },
    {
      rpcCall: (_sessionId, method, args) => {
        asked.push({ method, args: args as Record<string, unknown> })
        return method === 'MarkGetFieldCandidates'
          ? Promise.resolve(answer)
          : new Promise(() => {})
      },
    },
  ).createDisplay()
  const controller = new AbortController()
  expect(
    await model.scanGroupByCandidates({
      signal: controller.signal,
      statusCallback: () => {},
    }),
  ).toEqual(answer)
  const call = asked.find(a => a.method === 'MarkGetFieldCandidates')!
  expect(call.args.byteLimit).toBe(model.resolvedByteLimit())
  expect(call.args.regions).toEqual([
    expect.objectContaining({ refName: 'ctgA', assemblyName: 'volvox' }),
  ])
})

test("a match's family colors only the matches, the transcript's greys key as UTR and coding, and Color by still reaches the matches", () => {
  const model = display(TRANSCRIPT_PROTEIN_PLOT)
  expect(model.rowsField).toBe('name')
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
  const model = loaded(display({ rows: 'sample' }))
  expect(labels(model.trackMenuItems())).not.toContain('Group by')
})

test("One row per goes while a facet's sections draw in the rows' place", () => {
  const model = display({ rows: 'sample' })
  expect(labels(multiRowMenuItems(model))).toContain('One row per')
  model.facetByField('name')
  expect(model.drawsRows).toBe(false)
  expect(labels(multiRowMenuItems(model))).not.toContain('One row per')
})

test('Color by a `jexl:` field ticks nothing and names it a custom expression', () => {
  const expr = 'jexl:get(feature,"tint")'
  const model = display({
    rows: 'sample',
    encoding: { color: { field: expr } },
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
  const model = display({ rows })
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
  const model = loaded(display({ rows }))
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

// A config's arrangement stating no field names the declared default's rows,
// `type`'s, so it leaves with a pick of another field and returns with type.
test("Reset row order returns a config arrangement stating no field to the default type's rows", () => {
  const rows = { sort: ['kid'], kept: ['mom'] }
  const model = display({ rows })
  model.setRowsField('sample')
  expect(getSnapshot(model.conf.rows)).toEqual({ field: 'sample' })
  model.resetRowArrangement()
  expect(getSnapshot(model.conf.rows)).toEqual({ field: 'sample' })
  model.setRowsField('type')
  model.resetRowArrangement()
  expect(getSnapshot(model.conf.rows)).toEqual(rows)
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

function clickRowHeight(
  model: LinearMultiRowFeatureDisplayModel,
  label: string,
) {
  const item = subMenu(model.trackMenuItems(), 'Row height').find(
    i => 'label' in i && i.label === label,
  )
  if (item && 'onClick' in item) {
    item.onClick()
  }
}

test("Row height keeps the transcript plot's UTR thinner than its coding exons, in the ratio the plot states", () => {
  const model = display(TRANSCRIPT_PROTEIN_PLOT)
  const stated = model.markRowProportions
  const [line, utr, cds] = stated
  clickRowHeight(model, 'Normal')
  expect(model.markRowProportions).toEqual(stated)
  clickRowHeight(model, 'Compact')
  const [compactLine, compactUtr, compactCds, compactMatch] =
    model.markRowProportions
  expect(compactLine).toBe(line)
  expect(compactCds).not.toBe(cds)
  expect(compactMatch).toBe(compactCds)
  expect(compactUtr! / compactCds!).toBeCloseTo(utr! / cds!)
  expect(model.rowProportion).toBe(compactCds)
  expect(ticked(subMenu(model.trackMenuItems(), 'Row height'))).toEqual([
    'Compact',
  ])
  clickRowHeight(model, 'Normal')
  expect(model.markRowProportions).toEqual(stated)
})

test("the Custom row height dialog offers the transcript plot's tallest span, and submitting it unchanged writes no band", async () => {
  const model = display(TRANSCRIPT_PROTEIN_PLOT)
  const stated = model.markRowProportions
  expect(model.rowProportion).toBe(Math.max(...stated))
  const queueDialog = jest.spyOn(getSession(model), 'queueDialog')
  clickRowHeight(model, 'Custom...')
  const [Dialog, props] = queueDialog.mock.calls[0]![0](() => {})
  render(createElement(Suspense, null, createElement(Dialog, props)))
  const submit = await screen.findByText('Submit')
  const inputs = document.querySelectorAll('input')
  expect(inputs[1]!.value).toBe(String(model.rowProportion))
  const patches: unknown[] = []
  onPatch(model.configuration, patch => patches.push(patch))
  fireEvent.click(submit)
  expect(model.markRowProportions).toEqual(stated)
  expect(patches).toEqual([])
})

test('an identity color over a field paints the colors the field holds, with no notice', () => {
  const model = display({
    rows: 'sample',
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

test('a written identity color with no domain, like the unset file color, keys nothing', () => {
  const colored = features([
    { sample: 'mom', start: 0, end: 400, itemRgb: '245,245,245' },
    { sample: 'dad', start: 0, end: 400, itemRgb: '255,0,0' },
  ])
  for (const encoding of [{}, { color: { scale: { type: 'identity' } } }]) {
    const model = display({ rows: 'sample', encoding })
    model.setRpcData(0, workerResult(model, colored), REGION)
    expect(model.legendSections).toEqual([])
    expect(model.colorScales).toEqual([])
  }
})

test('Default keeps the documented parent key, and brings it back after a pick away from it', () => {
  const model = loaded(
    display({
      rows: 'sample',
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
  expect(model.colorByMode).toBe('default')
  model.pickDefaultColor()
  expect(model.colorByMode).toBe('default')
  expect(model.cornerNotices).toEqual([])
  expect(keyLabels()).toEqual(['Maternal', 'Paternal'])
  model.colorByField('sample')
  expect(model.colorByMode).toBe('attribute')
  model.pickDefaultColor()
  model.setRpcData(0, workerResult(model, PAINTING), REGION)
  expect(model.colorByMode).toBe('default')
  expect(keyLabels()).toEqual(['Maternal', 'Paternal'])
})

test("a row's color paints its blocks while no mark or display color does", () => {
  const model = loaded(
    display({
      rows: { field: 'sample', colors: { mom: '#222222' } },
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

test("a rect floors at 2px, and 3px in a row whose rects leave room at this zoom; a bar's floor stays 1px", () => {
  const sparse = Array.from({ length: 4 }, (_, i) => ({
    sample: 'sparse',
    start: i * 2000,
    end: i * 2000 + 1,
  }))
  const dense = Array.from({ length: 40 }, (_, i) => ({
    sample: 'dense',
    start: i * 2,
    end: i * 2 + 1,
  }))
  const model = loaded(
    display({ rows: 'sample' }),
    features([...sparse, ...dense]),
  )
  const table = model.rowTable!
  const { rowKeys } = model.rowKeySpace
  expect(table.sparse[rowKeys.lookup('sparse')!]).toBe(1)
  expect(table.sparse[rowKeys.lookup('dense')!]).toBe(0)
  expect(model.renderState.rectMinWidthPx).toBe(2)
  expect(model.renderState.minWidthPx).toBe(1)

  const one = loaded(display({ rows: '' }), features(sparse))
  expect(one.rowTable).toBeUndefined()
  expect(one.renderState.rectMinWidthPx).toBe(3)
  const crowded = loaded(display({ rows: '' }), features(dense))
  expect(crowded.renderState.rectMinWidthPx).toBe(2)
})
