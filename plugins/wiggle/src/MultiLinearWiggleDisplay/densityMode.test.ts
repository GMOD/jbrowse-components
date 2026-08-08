import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { WiggleSourceData } from '../util.ts'

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
    posFeaturePositions: featurePositions,
    posFeatureScores: featureScores,
    posNumFeatures: 1,
  }
}

function makeDisplay() {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  display.configuration.setSlot('summaryScoreMode', 'whiskers')
  display.setRpcData(0, { sources: [makeBinnedSource('a')] })
  return display
}

it('scales a density domain to the averages it actually paints', () => {
  const display = makeDisplay()
  // whiskers draws the min..max bands, so the domain covers them
  expect(display.domain).toEqual([-10, 50])

  // density has no whiskers presentation (sourceLayers falls back to the
  // average scores), so a domain over the whisker extremes would leave the
  // color ramp — and the score legend printing it — describing a range nothing
  // on screen reaches
  display.setRenderingType('multirowdensity')
  expect(display.effectiveSummaryScoreMode).toBe('avg')
  expect(display.domain).toEqual([0, 1])

  // and the render path is handed the same resolved mode, so it cannot draw a
  // presentation the domain and the score legend were not scaled for
  expect(display.gpuProps().effectiveSummaryScoreMode).toBe('avg')
})

it('stops drawing cross hatches in density mode', () => {
  const display = makeDisplay()
  display.toggleCrossHatches()
  expect(display.showCrossHatches).toBe(true)

  // the hatches rule a score axis density doesn't have, and the track menu
  // drops the toggle there — so leaving them drawn strands them on with no way
  // back off
  display.setRenderingType('multirowdensity')
  expect(display.displayCrossHatches).toBe(true)
  expect(display.showCrossHatches).toBe(false)
})
