import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { WiggleSourceData } from '@jbrowse/wiggle-core'

// One binned feature covering the visible window, whose whisker bounds sit far
// outside its average: the whole point is that the two summary modes disagree
// about the domain.
function makeBinnedSource(name: string): WiggleSourceData {
  const featurePositions = new Uint32Array([0, 1000])
  const featureScores = new Float32Array([1])
  return {
    ...makeSource(name),
    featurePositions,
    featureScores,
    featureMinScores: new Float32Array([-10]),
    featureMaxScores: new Float32Array([50]),
    numFeatures: 1,
    hasSummaryScores: true,
  }
}

function makeDisplay() {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  display.configuration.mark.setSlot('extent', 'min-max')
  display.setRpcData(
    0,
    { sources: [makeBinnedSource('a')] },
    view.displayedRegions[0],
  )
  return display
}

it('scales a density domain to the averages it actually paints', () => {
  const display = makeDisplay()
  // a min-max extent draws the min..max bands, so the domain covers them
  expect(display.domain).toEqual([-10, 50])

  // density has no min-max presentation, so a domain over the min and max
  // would leave the color ramp — and the score legend printing it —
  // describing a range nothing on screen reaches
  display.setMark('rect')
  expect(display.effectiveExtent).toBe('none')
  expect(display.domain).toEqual([1, 2])

  // and the render path is handed the same resolved extent, so it cannot draw
  // a presentation the domain and the score legend were not scaled for
  expect(display.gpuProps().effectiveExtent).toBe('none')
})

it("lists a bin's min and max in the tooltip only where the plot shows them", () => {
  const display = makeDisplay()
  expect(display.tooltipShowsMinMax).toBe(true)
  display.setMark('rect')
  expect(display.tooltipShowsMinMax).toBe(false)
  display.setY('maxScore')
  expect(display.tooltipShowsMinMax).toBe(true)
})

it('stops drawing cross hatches in density mode', () => {
  const display = makeDisplay()
  const hatchedBands = () =>
    display.axes.flatMap(axis => (axis.grid ? (axis.bandTops ?? [0]) : []))
  display.setGrid(true)
  expect(hatchedBands().length).toBeGreaterThan(0)

  // the hatches rule a score axis density doesn't have, and the track menu
  // drops the toggle there — so leaving them drawn strands them on with no way
  // back off
  display.setMark('rect')
  expect(display.grid).toBe(true)
  expect(hatchedBands()).toEqual([])
})

it("writes the plot type as the mark and the line's interpolation it draws", () => {
  const display = makeDisplay()
  display.setMark('line', 'linear')
  expect(readConfObject(display.configuration, ['mark', 'type'])).toBe('line')
  expect(readConfObject(display.configuration, ['mark', 'interpolate'])).toBe(
    'linear',
  )
  expect(display.renderingType).toBe('linecenter')
  display.setMark('rect')
  expect(readConfObject(display.configuration, ['mark', 'type'])).toBe('rect')
  expect(display.renderingType).toBe('density')
  display.setMark('line')
  expect(readConfObject(display.configuration, ['mark', 'interpolate'])).toBe(
    'step',
  )
  expect(display.renderingType).toBe('line')
})

it('a mark other than a line leaves no interpolate written, which only a line reads', () => {
  const display = makeDisplay()
  display.setMark('line', 'linear')
  display.setMark('bar')
  expect(getSnapshot(display.configuration).mark?.interpolate).toBeUndefined()
})

it('titles the density key with the scale title, the axis it replaces', () => {
  const display = makeDisplay()
  display.setMark('rect')
  expect(display.scoreColorScale?.title).toBe('Score')
  setConf(display, ['encoding', 'y', 'axis', 'title'], 'phyloP')
  expect(display.scoreColorScale?.title).toBe('phyloP')
})
