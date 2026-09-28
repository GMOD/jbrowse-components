import { createElement } from 'react'

import { axisPlotBox } from '@jbrowse/display-ui'
import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { MockHal } from '@jbrowse/render-core/hal'
import * as spanShader from '@jbrowse/render-core/shaders/spanMarkIface'
import { act, render, screen } from '@testing-library/react'

import MarkRows from './components/MarkRows.tsx'
import { findMarkHit } from './findMarkHit.ts'
import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'
import { placeTextMarks } from './textMarks.ts'

import type { LinearMarkDisplayModel } from './model.ts'

const SPAN = [{ mark: 'span' }]

// Four rows over the whole region, so every column of a row reaches it.
const FOUR = features(
  ['a', 'b', 'c', 'd'].map((source, i) => ({
    source,
    start: 0,
    end: 10_000,
    score: i + 1,
  })),
)

// 40 px rows in an 80 px plot: two of the four show, and 80 px scroll.
const PINNED = { rows: 'source', rowHeight: 40, height: 90 }

function loaded(display: Record<string, unknown>, marks: unknown[] = SPAN) {
  const { display: model } = createTestEnvironment({
    marks,
    ...display,
  }).createDisplay()
  model.setRpcData(0, workerResult(model, FOUR), REGION)
  return model
}

// The row a sweep of the columns at `y` hits first, by name.
function rowAt(display: LinearMarkDisplayModel, y: number) {
  for (let x = 0; x < display.renderState.canvasWidth; x += 8) {
    const hit = findMarkHit(
      x,
      y,
      display.renderBlocks,
      display.rpcDataMap,
      display.markList,
      display.renderState,
      display.host.displayedRegions,
    )
    if (hit) {
      return { name: display.rowKeys.names[hit.row!], hit }
    }
  }
  return undefined
}

test('a pinned rowHeight is the row height under rows, and fit mode splits the plot', () => {
  const display = loaded(PINNED)
  expect(axisPlotBox(display.height).plotHeight).toBe(80)
  expect(display.rowCount).toBe(4)
  expect(display.effectiveRowHeight).toBe(40)
  expect(display.renderState.rowHeight).toBe(40)
  display.setFitToHeight()
  expect(display.rowHeight).toBe(0)
  expect(display.effectiveRowHeight).toBe(20)
})

test('a facet fits its rows to the plot whatever rowHeight holds', () => {
  const display = loaded({ facet: 'source', rowHeight: 40, height: 90 })
  expect(display.effectiveRowHeight).toBe(20)
  expect(display.scrollableHeight).toBe(0)
})

test('the rows scroll as far as a pinned height overflows the plot, and not at all where they fit', () => {
  const display = loaded(PINNED)
  expect(display.scrollViewportHeight).toBe(80)
  expect(display.scrollContentHeight).toBe(160)
  expect(display.scrollableHeight).toBe(80)
  display.setRowHeight(15)
  expect(display.scrollableHeight).toBe(0)
  display.setFitToHeight()
  expect(display.scrollableHeight).toBe(0)
})

test('setScrollTop clamps to the overflow, and fit mode returns the rows to the top', () => {
  const display = loaded(PINNED)
  display.setScrollTop(1_000)
  expect(display.scrollTop).toBe(80)
  display.setScrollTop(-5)
  expect(display.scrollTop).toBe(0)
  display.setScrollTop(30)
  expect(display.renderState.scrollTop).toBe(30)
  display.setFitToHeight()
  expect(display.scrollTop).toBe(0)
})

test("the span's uniforms carry the scroll and the row proportion", () => {
  const display = loaded(PINNED)
  display.setScrollTop(25)
  display.setRowProportion(0.5)
  const [mark] = display.markList
  const hal = new MockHal([mark!.pass])
  const { canvasWidth, canvasHeight } = display.renderState
  const block = display.renderBlocks[0]!
  mark!.drawRegion(
    hal,
    new ArrayBuffer(mark!.pass.uniformByteSize),
    block,
    clipBlock(block, canvasWidth, canvasHeight, { x: 1, y: 1 })!,
    display.rpcDataMap.get(0)!,
    display.renderState,
    0,
  )
  const uniforms = hal.getLastUniformsF32()!
  expect(uniforms[spanShader.UNIFORM_OFFSET_F32.rowHeight]).toBe(40)
  expect(uniforms[spanShader.UNIFORM_OFFSET_F32.scrollTop]).toBe(25)
  expect(uniforms[spanShader.UNIFORM_OFFSET_F32.rowProportion]).toBe(0.5)
})

test('a hit and its hover ink under a scroll name the row drawn there', () => {
  const display = loaded(PINNED)
  expect(rowAt(display, 20)?.name).toBe('a')
  display.setScrollTop(40)
  const { name, hit } = rowAt(display, 20)!
  expect(name).toBe('b')
  display.setHoveredFeature(hit)
  expect(display.hoverInk[0]!.top).toBe(display.rowsTopOffset)
  display.setScrollTop(80)
  expect(rowAt(display, 20)?.name).toBe('c')
  expect(rowAt(display, 60)?.name).toBe('d')
})

// Row b's bar stands on the lower half of its band, 2 on [0, 4].
test('a bar under a scroll is found through the band the scroll put it in', () => {
  const display = loaded(PINNED, [{ mark: 'bar', encoding: { y: 'score' } }])
  expect(display.domain).toEqual([0, 4])
  expect(rowAt(display, 70)?.name).toBe('b')
  display.setScrollTop(20)
  expect(rowAt(display, 50)?.name).toBe('b')
})

test('a text label follows its row up the plot, and one scrolled past the top is left out', () => {
  const display = loaded(PINNED, [
    { mark: 'text', encoding: { text: 'source' } },
  ])
  const placed = () =>
    placeTextMarks(
      display.textMarkEntries,
      display.rpcDataMap,
      display.renderBlocks,
      display.renderState,
      { size: 11, family: 'sans-serif' },
      'black',
    ).map(label => [label.text, Math.floor(label.baseline / 40)])
  expect(placed()).toEqual([
    ['a', 0],
    ['b', 1],
  ])
  display.setScrollTop(40)
  expect(placed()).toEqual([
    ['b', 0],
    ['c', 1],
  ])
})

test('the rows panel mounts a scrollbar over itself while the rows overflow, and none once they fit', () => {
  const display = loaded(PINNED)
  const { yTop, plotHeight } = axisPlotBox(display.height)
  render(createElement(MarkRows, { model: display, yTop, plotHeight }))
  expect(screen.getByRole('scrollbar').getAttribute('aria-controls')).toBe(
    screen.getByTestId('mark-rows').id,
  )
  act(() => {
    display.setFitToHeight()
  })
  expect(screen.queryByRole('scrollbar')).toBeNull()
})

test('the track menu offers the row height beside the other row items', () => {
  const labels = (display: LinearMarkDisplayModel) =>
    display.trackMenuItems().map(item => ('label' in item ? item.label : ''))
  expect(labels(loaded(PINNED))).toContain('Row height')
  expect(labels(loaded({ height: 90 }))).not.toContain('Row height')
})

// A span is found through the rows near the cursor, read back through the row
// table, so a reorder that moves every key to another slot is what the hover
// follows.
test('a hover over spans follows a reorder of the rows', () => {
  const display = loaded(PINNED)
  display.setRowOrder([
    { name: 'd' },
    { name: 'c' },
    { name: 'b' },
    { name: 'a' },
  ])
  expect(rowAt(display, 20)?.name).toBe('d')
  expect(rowAt(display, 60)?.name).toBe('c')
  display.setScrollTop(80)
  expect(rowAt(display, 60)?.name).toBe('a')
})

test('a span layer asks the worker for no hit index', () => {
  const display = loaded(PINNED)
  expect(display.rpcProps().layers[0]!.lanes).not.toContain('index')
  expect(display.rpcDataMap.get(0)!.layers[0]!.flatbush).toBeUndefined()
})
