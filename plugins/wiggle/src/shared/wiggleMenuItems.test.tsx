import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { fireEvent, render } from '@testing-library/react'

import {
  makeRenderingTypeSubMenu,
  makeResolutionSubMenu,
} from './wiggleMenuItems.tsx'

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

// minimal stand-in for the display: the plot radios plus the facet toggle and
// the raw adapter rows the gate counts
function makePlotSelf(sourceCount: number, isFaceted: boolean) {
  const calls: boolean[] = []
  return {
    calls,
    renderingType: 'xyplot',
    setRenderingType: () => {},
    isFaceted,
    setFaceted: (on: boolean) => {
      calls.push(on)
    },
    sourcesWithoutLayout: Array.from({ length: sourceCount }, (_, i) => i),
  }
}

function plotLabels(sourceCount: number, isFaceted = false) {
  const item = makeRenderingTypeSubMenu(makePlotSelf(sourceCount, isFaceted), [
    ['xyplot', 'XY plot'],
  ])
  const rows = 'subMenu' in item ? resolveSubMenu(item) : []
  return rows.map(i => ('label' in i ? i.label : undefined))
}

test('two sources offer the row split', () => {
  expect(plotLabels(2)).toContain('One row per source')
})

test('one source does not, so no tree can be raised over a single row', () => {
  expect(plotLabels(1)).not.toContain('One row per source')
})

test('a faceted display keeps the toggle when its sources drop to one', () => {
  expect(plotLabels(1, true)).toContain('One row per source')
})
