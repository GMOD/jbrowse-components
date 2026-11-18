import { createElement } from 'react'

import { namesToBlock } from '@jbrowse/alignments-core'
import { MIN_BAND_HEIGHT } from '@jbrowse/core/util/bandHeight'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { LaneBandResizeHandles } from './components/PileupComponent.tsx'
import {
  bootAlignmentsDisplay,
  makeEmptyAlignmentsResult,
  makeEmptyPileupData,
  oneReadWithMate,
} from './testUtils.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'

afterEach(cleanup)

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

// One lane whose pair draws in a below-mode arcs strip, `height` px tall.
function arcsDown(height: number) {
  const display = createEnv()
  display.setDrawnReadConnections('link')
  display.setReadConnectionsPlacement('below')
  display.setHeight(height)
  display.setRpcData(
    0,
    { groups: [{ key: '', label: '', data: oneReadWithMate(2000) }] },
    { refName: 'ctgA', start: 0, end: 10_000, assemblyName: 'volvox' },
  )
  return display
}

// A press on `handle`, a move `dy` px down (up when negative), and a release.
function drag(handle: HTMLElement, dy: number) {
  fireEvent.pointerDown(handle, { clientY: 500, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientY: 500 + dy, pointerId: 1 })
  fireEvent.pointerUp(handle, { clientY: 500 + dy, pointerId: 1 })
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

  test('fits the grow ceiling in grow mode when the stored height is above it', () => {
    const display = seed(40)
    display.setHeight(1000)
    display.setHeightMode('grow')
    display.setShowPileup(false)
    expect(display.height).toBe(800)
    expect(display.sections.contentHeight).toBeLessThanOrEqual(800)
    expect(display.scrollableHeight).toBe(0)
  })

  // Only the middle lane holds a pair: every lane takes the same slot and
  // the same coverage height, and only the middle one reserves its arcs.
  test('gives lanes with and without arcs the same slot', () => {
    const display = createEnv()
    display.setDrawnReadConnections('link')
    display.setReadConnectionsPlacement('below')
    display.setRpcData(
      0,
      {
        groups: [
          { key: 'a', label: 'A', data: oneReadWithMate() },
          {
            key: 'b',
            label: 'B',
            data: oneReadWithMate(2000, { key: 'r1', name: 'readB' }),
          },
          {
            key: 'c',
            label: 'C',
            data: oneReadWithMate(undefined, { key: 'r2', name: 'readC' }),
          },
        ],
      },
      { refName: 'ctgA', start: 0, end: 10_000, assemblyName: 'volvox' },
    )
    display.setShowPileup(false)
    const { sections, contentHeight } = display.sections
    expect(sections.map(s => [s.groupKey, s.height])).toEqual([
      ['a', 83],
      ['b', 83],
      ['c', 83],
    ])
    expect(sections.map(s => s.bands.reserved)).toEqual([
      { coverage: 48, readConnections: 0, sashimi: 0 },
      { coverage: 48, readConnections: 35, sashimi: 0 },
      { coverage: 48, readConnections: 0, sashimi: 0 },
    ])
    expect(display.coverageBandHeight).toBe(83 - display.readConnectionsHeight)
    expect(contentHeight).toBeLessThanOrEqual(display.height)
    expect(display.scrollableHeight).toBe(0)
  })

  // The pileup's row floor is no part of a hidden pileup's stack: at 60 px
  // the arcs keep their stated 35 px, and the coverage takes the rest.
  test('keeps a short track its arcs strip at its stated height', () => {
    const display = arcsDown(60)
    display.setShowPileup(false)
    expect(display.sections.sections[0]!.bands.reserved).toEqual({
      coverage: 25,
      readConnections: 35,
      sashimi: 0,
    })
  })

  test('draws a handle on the arcs strip only, which grows dragged up', () => {
    const display = arcsDown(250)
    display.setShowPileup(false)
    const { coverageHeight, height } = display
    render(createElement(LaneBandResizeHandles, { model: display }))
    expect(screen.queryByTitle('Drag to resize the coverage band')).toBeNull()
    const seam = screen.getByTitle('Drag to resize the read connections band')
    expect(seam.style.top).toBe(`${display.coverageBandHeight - 4}px`)

    drag(seam, -30)
    expect(display.readConnectionsHeight).toBe(65)
    expect(display.sections.sections[0]!.bands.reserved).toEqual({
      coverage: 185,
      readConnections: 65,
      sashimi: 0,
    })
    expect(display.coverageHeight).toBe(coverageHeight)
    expect(display.height).toBe(height)
    expect(display.sections.contentHeight).toBe(height)
    expect(display.scrollableHeight).toBe(0)

    drag(seam, -1000)
    expect(display.readConnectionsHeight).toBe(250 - MIN_BAND_HEIGHT)
    expect(display.coverageBandHeight).toBe(MIN_BAND_HEIGHT)

    drag(seam, 1000)
    expect(display.readConnectionsHeight).toBe(MIN_BAND_HEIGHT)
    expect(display.coverageBandHeight).toBe(250 - MIN_BAND_HEIGHT)
    expect(display.coverageHeight).toBe(coverageHeight)
    expect(display.height).toBe(height)
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
      const overheads = display.laneBandOverheads
      const fittedFeatureHeight = display.fittedFeatureHeight
      const featureHeight = display.featureHeight
      const unchanged = () => {
        expect(display.coverageHeight).toBe(coverageHeight)
        expect(display.height).toBe(height)
        expect(display.laidOutByGroup).toBe(layout)
        expect(display.laneBandOverheads).toEqual(overheads)
        expect(display.fittedFeatureHeight).toBe(fittedFeatureHeight)
        expect(display.featureHeight).toBe(featureHeight)
      }
      display.setShowPileup(false)
      expect(display.coverageBandHeight).not.toBe(coverageHeight)
      unchanged()
      display.setShowPileup(true)
      expect(display.coverageBandHeight).toBe(coverageHeight)
      unchanged()
    },
  )
})
