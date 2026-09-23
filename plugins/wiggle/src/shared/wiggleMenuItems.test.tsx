import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { fireEvent, render } from '@testing-library/react'

import {
  makeRenderingTypeSubMenu,
  makeResolutionSubMenu,
} from './wiggleMenuItems.tsx'

import type { MenuItem } from '@jbrowse/core/ui'

// minimal stand-in for the display: resolution + the clamping setter, the only
// bits the stepper reads/writes
function makeSelf(resolution: number) {
  const calls: number[] = []
  return {
    calls,
    hasResolution: true,
    resolution,
    effectiveSummaryScoreMode: 'avg',
    isDensityMode: false,
    setResolution: (n: number) => {
      calls.push(n)
    },
    setSummaryScoreMode: () => {},
  }
}

function renderStepper(resolution: number) {
  const self = makeSelf(resolution)
  const item = makeResolutionSubMenu(self)[0]!
  const custom = 'subMenu' in item ? resolveSubMenu(item)[0]! : undefined
  const node = custom && 'render' in custom ? custom.render(() => {}) : null
  const utils = render(<div>{node}</div>)
  const [coarser, finer, reset] = utils.getAllByRole('button')
  return { self, coarser: coarser!, finer: finer!, reset: reset!, ...utils }
}

test('at default: reset disabled, both steps enabled', () => {
  const { coarser, finer, reset } = renderStepper(1)
  expect(coarser.hasAttribute('disabled')).toBe(false)
  expect(finer.hasAttribute('disabled')).toBe(false)
  expect(reset.hasAttribute('disabled')).toBe(true)
})

test('at the fine ceiling the finer button disables', () => {
  const { coarser, finer } = renderStepper(1024)
  expect(finer.hasAttribute('disabled')).toBe(true)
  expect(coarser.hasAttribute('disabled')).toBe(false)
})

test('at the coarse floor the coarser button disables', () => {
  const { coarser, finer } = renderStepper(1 / 16)
  expect(coarser.hasAttribute('disabled')).toBe(true)
  expect(finer.hasAttribute('disabled')).toBe(false)
})

test('stepping finer doubles the resolution', () => {
  const { self, finer } = renderStepper(2)
  fireEvent.click(finer)
  expect(self.calls).toEqual([4])
})

const PLOTS = [
  ['xyplot', 'XY plot'],
  ['density', 'Density'],
] as const

// minimal stand-in for the display: the two axes a leaf writes, and the raw
// adapter rows that decide whether there is a layout axis at all
function makePlotSelf(sourceCount: number, isRowLayout: boolean) {
  const writes: (string | boolean)[] = []
  return {
    writes,
    renderingType: 'xyplot',
    setRenderingType: (t: string) => {
      writes.push(t)
    },
    isRowLayout,
    setRowLayout: (on: boolean) => {
      writes.push(on)
    },
    sourcesWithoutLayout: Array.from({ length: sourceCount }, (_, i) => i),
  }
}

const rowsOf = (item: MenuItem | undefined): MenuItem[] =>
  item && 'subMenu' in item ? resolveSubMenu(item) : []
const labelsOf = (item: MenuItem | undefined) =>
  rowsOf(item).map(i => ('label' in i ? i.label : undefined))
const checkedIn = (item: MenuItem | undefined) =>
  rowsOf(item)
    .filter(i => 'checked' in i && i.checked)
    .map(i => ('label' in i ? i.label : undefined))

function plotMenu(sourceCount: number, isRowLayout = false) {
  const self = makePlotSelf(sourceCount, isRowLayout)
  return { self, item: makeRenderingTypeSubMenu(self, PLOTS) }
}

test('several sources drill through the layout to the plot', () => {
  expect(labelsOf(plotMenu(2).item)).toEqual(['Multi-row', 'Overlapping'])
})

test('every layout offers every plot, overlapping density included', () => {
  const [multirow, overlapping] = rowsOf(plotMenu(2).item)
  expect(labelsOf(multirow)).toEqual(['XY plot', 'Density'])
  expect(labelsOf(overlapping)).toEqual(['XY plot', 'Density'])
})

test('one source meets the plots flat, with no layout to drill through', () => {
  expect(labelsOf(plotMenu(1).item)).toEqual(['XY plot', 'Density'])
})

test('a faceted display keeps the groups when its sources drop to one', () => {
  expect(labelsOf(plotMenu(1, true).item)).toEqual(['Multi-row', 'Overlapping'])
})

test('the checked leaf is the pair, not the plot alone', () => {
  // renderingType 'xyplot' with the facet off: checked under Overlapping only,
  // where a plot-alone value would tick XY plot in both groups
  const [multirow, overlapping] = rowsOf(plotMenu(2).item)
  expect(checkedIn(multirow)).toEqual([])
  expect(checkedIn(overlapping)).toEqual(['XY plot'])
})

test('one leaf writes both axes', () => {
  const { self, item } = plotMenu(2)
  const [multirow] = rowsOf(item)
  const density = rowsOf(multirow).find(
    i => 'label' in i && i.label === 'Density',
  )
  if (!density || !('onClick' in density)) {
    throw new Error('no Density row under Multi-row')
  }
  density.onClick()
  expect(self.writes).toEqual(['density', true])
})
