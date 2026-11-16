import { namesToBlock } from '@jbrowse/alignments-core'

import {
  bootAlignmentsDisplay,
  makeEmptyAlignmentsResult,
  makeEmptyPileupData,
  oneReadWithMate,
} from './testUtils.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'

// Boots a real LinearAlignmentsDisplay: whether the stack scrolls is a
// property of the whole chain (`groupOrder` → `sections` → the scroll
// clamp), not of the band arithmetic alone.
function createEnv() {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay()
  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
    getCanonicalRefName2: (refName: string) => refName,
  }
  const Session = baseSession.volatile(() => ({
    rpcManager: {
      call: jest.fn(() => Promise.resolve(makeEmptyAlignmentsResult())),
    },
    assemblyManager: {
      get: (name: string) => (name === 'volvox' ? asm : undefined),
      isValidRefName: () => true,
    },
  }))
  const { view, display } = mount(Session)
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  return display
}

// n reads all covering one span, stacked n rows deep.
function stackedReads(n: number): WorkerPileupData {
  const readPositions = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    readPositions[i * 2] = 1000
    readPositions[i * 2 + 1] = 1100
  }
  return {
    ...makeEmptyPileupData(),
    readKeys: Array.from({ length: n }, (_, i) => `r${i}`),
    ...namesToBlock(Array.from({ length: n }, (_, i) => `read${i}`)),
    readPositions,
    readFlags: new Uint16Array(n),
    readMapqs: new Uint8Array(n),
    readStrands: new Int8Array(n).fill(1),
    readInsertSizes: new Float32Array(n),
    readPairOrientations: new Uint8Array(n),
    segmentPositions: readPositions,
    segmentReadIndices: Uint32Array.from({ length: n }, (_, i) => i),
    segmentEdgeFlags: new Uint8Array(n).fill(3),
    numSegments: n,
  }
}

// `facet` is set before the data: it is a fetch-tier setting, and setting it
// afterwards re-partitions the fetch and clears what was seeded.
function seed(laneCount: number, depth = 5) {
  const display = createEnv()
  if (laneCount > 1) {
    display.facetByField('strand')
  }
  display.setRpcData(
    0,
    {
      groups: Array.from({ length: laneCount }, (_, i) => ({
        key: `${i}`,
        label: `HP: ${i}`,
        data: stackedReads(depth),
      })),
    },
    { refName: 'ctgA', start: 0, end: 10_000, assemblyName: 'volvox' },
  )
  return display
}

describe('a display with the pileup hidden', () => {
  test('fits 40 lanes in its height and never scrolls', () => {
    const display = seed(40)
    display.setShowPileup(false)
    expect(display.groupOrder).toHaveLength(40)
    expect(display.laneSlot).toBe(Math.floor(250 / 40))
    expect(display.sections.contentHeight).toBeLessThanOrEqual(display.height)
    expect(display.scrollableHeight).toBe(0)
    display.setScrollTop(500)
    expect(display.scrollTop).toBe(0)
  })

  test('fills its height with one lane, coverage stretched to it', () => {
    const display = seed(1)
    display.setShowPileup(false)
    expect(display.height).toBe(250)
    expect(display.coverageBandHeight).toBe(250)
    expect(display.sections.contentHeight).toBe(250)
  })

  test('fits the track height in grow mode too, never its lanes', () => {
    const display = seed(40)
    display.setHeightMode('grow')
    display.setShowPileup(false)
    expect(display.height).toBe(250)
    expect(display.scrollableHeight).toBe(0)
  })

  // The pileup's row floor is no part of a hidden pileup's stack: at 60 px
  // the arcs still draw beside 45 px of coverage instead of binding to 0.
  test('fills a short track from every band that fits', () => {
    const display = createEnv()
    display.setDrawnReadConnections('link')
    display.setReadConnectionsPlacement('down')
    display.setHeight(60)
    display.setRpcData(
      0,
      { groups: [{ key: '', label: '', data: oneReadWithMate(2000) }] },
      { refName: 'ctgA', start: 0, end: 10_000, assemblyName: 'volvox' },
    )
    display.setShowPileup(false)
    expect(display.sections.sections[0]!.bands.reserved).toEqual({
      coverage: 45,
      readConnections: 15,
      sashimi: 0,
    })
  })

  // Hiding the pileup writes nothing: the stated band heights and the track's
  // height are the config's, the row budget reads the stated stack, so the
  // reads keep their layout and showing them again moves nothing.
  test.each(['fixed', 'fit'] as const)(
    'in %s mode, writes no height and keeps the layout across a toggle',
    mode => {
      const display = seed(3, 40)
      display.setHeightMode(mode)
      const coverageHeight = display.coverageHeight
      const height = display.height
      const layout = display.laidOutByGroup
      display.setShowPileup(false)
      expect(display.coverageBandHeight).not.toBe(coverageHeight)
      expect(display.coverageHeight).toBe(coverageHeight)
      expect(display.height).toBe(height)
      expect(display.laidOutByGroup).toBe(layout)
      display.setShowPileup(true)
      expect(display.coverageBandHeight).toBe(coverageHeight)
      expect(display.height).toBe(height)
      expect(display.laidOutByGroup).toBe(layout)
    },
  )
})
