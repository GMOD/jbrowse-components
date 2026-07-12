import { fireEvent, render } from '@testing-library/react'

import { makeResolutionSubMenu } from './wiggleMenuItems.tsx'

// minimal stand-in for the display: resolution + the clamping setter, the only
// bits the stepper reads/writes
function makeSelf(resolution: number) {
  const calls: number[] = []
  return {
    calls,
    hasResolution: true,
    resolution,
    summaryScoreMode: 'avg',
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
  const custom = 'subMenu' in item ? item.subMenu[0]! : undefined
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
