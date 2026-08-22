import { act } from 'react'

import { fireEvent, render } from '@testing-library/react'

import { createTestEnvironment } from '../LinearMultiSampleVariantMatrixDisplay/testEnv.ts'
import { ConnectorLineOverlay } from './ConnectorLines.tsx'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'

// Only the positional fields matter for the connector zone; nothing is painted.
function matrixCellData(starts: number[]): CellDataResult {
  return {
    mode: 'matrix',
    sampleInfo: {},
    rowNames: [],
    hasPhased: false,
    hasPhasedOrHaploid: false,
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    hasConsequence: false,
    hasSvType: false,
    hasPhaseSet: false,
    svTypeColors: {},
    simplifiedFeatures: starts.map((start, i) => ({
      id: `v${i}`,
      data: { start, end: start + 1, refName: 'ctgA', name: `v${i}` },
    })),
    genotypeDict: [],
    sampleNames: [],
    cellFeatureIndices: new Float32Array(0),
    cellRowIndices: new Uint32Array(0),
    cellColors: new Uint32Array(0),
    numCells: 0,
    numFeatures: starts.length,
    featureData: [],
  }
}

// Four variants over an 8kb window at bpPerPx 10: four 200px columns in the
// 800px viewport, so the first column runs from its center (100, lineZoneHeight)
// up to bp 0 at (0, 0) and its midpoint is (50, lineZoneHeight/2).
function loadedDisplay() {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 8000, refName: 'ctgA' },
  ])
  view.zoomTo(10)
  view.scrollTo(0)
  display.setCellData(matrixCellData([0, 1000, 3000, 7000]))
  return { display, view }
}

// The hovered line, drawn on top of the faint field in red.
function emphasizedLine(container: HTMLElement) {
  return container.querySelector('line[stroke="#f00c"]')
}

test('hovering a connector emphasizes it', () => {
  const { display } = loadedDisplay()
  const { container } = render(
    <ConnectorLineOverlay model={display} strokeWidth={0.5} />,
  )

  fireEvent.mouseMove(container.querySelector('rect')!, {
    clientX: 50,
    clientY: display.lineZoneHeight / 2,
  })

  expect(emphasizedLine(container)?.getAttribute('x1')).toBe('100')
})

// The regression: the hovered coord is React state, but the coord list is
// rebuilt from the view on every zoom/pan. A zoom fires no mousemove, so a hover
// held by identity alone kept drawing the red line (and its tooltip) at the
// position that column had before the zoom.
test('a zoom drops a hover it cannot fire a mousemove for', () => {
  const { display, view } = loadedDisplay()
  const { container } = render(
    <ConnectorLineOverlay model={display} strokeWidth={0.5} />,
  )
  fireEvent.mouseMove(container.querySelector('rect')!, {
    clientX: 50,
    clientY: display.lineZoneHeight / 2,
  })
  expect(emphasizedLine(container)).not.toBeNull()

  act(() => {
    view.zoomTo(view.bpPerPx / 2)
  })

  expect(emphasizedLine(container)).toBeNull()
})

// The zone keeps its height with nothing in view, and that is exactly when a
// user wants the space back, so the drag handle can't be gated on having lines.
test('the resize handle survives an empty viewport', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  const { container } = render(
    <ConnectorLineOverlay model={display} strokeWidth={0.5} />,
  )

  expect(display.connectorLineCoords).toEqual([])
  expect(container.querySelector('[data-gesture-owner]')).not.toBeNull()
})
