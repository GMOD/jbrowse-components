import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { COVERAGE_AXIS_LABEL } from '@jbrowse/wiggle-core'

import {
  emptyMafCoverage,
  emptyMafWireRegionData,
} from './components/coverageTestFixture.ts'
import { createMafTestEnvironment, stageDetailRegion } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The coverage band reads the alignments display's scale and band settings:
// `scales.y`, `coverageSnpMinFrequency` and `showInterbaseIndicators`.
function displayWith(displayConfig: Record<string, unknown> = {}) {
  const { display } = createMafTestEnvironment({
    displayConfig,
  }).createDisplay()
  const depths = Array.from({ length: 200 }, (_, i) => 10 + (i % 7))
  stageDetailRegion(display, 0, {
    ...emptyMafWireRegionData(),
    coverage: {
      ...emptyMafCoverage(0),
      coverageDepths: Float32Array.from(depths),
      coverageMaxDepth: Math.max(...depths),
    },
  })
  return display
}

function labels(items: MenuItem[]) {
  return items.flatMap(i => ('label' in i ? [i.label] : []))
}

test('a default band is linear from zero, every mismatch and insertion drawn', () => {
  const display = displayWith()
  const domain = display.coverageDepthDomain!
  expect(domain[0]).toBe(0)
  expect(domain[1]).toBeGreaterThanOrEqual(16)
  expect(display.coverageBandState).toMatchObject({
    domainMin: 0,
    domainMax: domain[1],
    scaleType: scaleTypeCode('linear'),
    snpMinFrequency: 0,
    showInterbase: true,
  })
  expect(display.axes[0]!.domain).toEqual(domain)
})

test('scales.y reaches the band, its axis and its marks alike', () => {
  const display = displayWith({ scales: { y: { type: 'log' } } })
  const domain = display.coverageDepthDomain!
  expect(domain[0]).toBeGreaterThanOrEqual(1)
  expect(display.coverageBandState.scaleType).toBe(scaleTypeCode('log'))
  expect(display.axes[0]!.scaleType).toBe('log')
})

test('a pinned maximum pins the band', () => {
  const display = displayWith()
  display.setMaxScore(100)
  expect(display.coverageDepthDomain).toEqual([0, 100])
  expect(display.coverageBandState.domainMax).toBe(100)
})

test('the SNP floor and the interbase toggle reach the band', () => {
  const display = displayWith({ coverageSnpMinFrequency: 0.2 })
  expect(display.coverageBandState.snpMinFrequency).toBe(0.2)
  display.setShowInterbaseIndicators(false)
  expect(display.coverageBandState.showInterbase).toBe(false)
})

test('the track menu offers the shared coverage rows', () => {
  const display = displayWith()
  expect(labels(display.trackMenuItems())).toEqual(
    expect.arrayContaining([
      `${COVERAGE_AXIS_LABEL}...`,
      'Color SNPs above...',
    ]),
  )
})
