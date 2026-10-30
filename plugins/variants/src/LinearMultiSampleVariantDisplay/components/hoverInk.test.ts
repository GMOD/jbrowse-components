import { backingScale } from '@jbrowse/render-core/canvas2dUtils'

import {
  cellDataOf,
  cellPayloadOf,
  featureInfoOf,
} from '../../shared/cellDataFixtures.ts'
import { createTestEnvironment } from '../testEnv.ts'

const SAMPLES = ['S0', 'S1', 'S2']

function withDpr<T>(dpr: number, run: () => T) {
  const before = window.devicePixelRatio
  window.devicePixelRatio = dpr
  try {
    return run()
  } finally {
    window.devicePixelRatio = before
  }
}

// One SNV at a bp that lands mid-pixel at bpPerPx 3.7, called on every sample.
function loadedDisplay() {
  const { display, view } = createTestEnvironment().createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 8000, refName: 'ctgA' },
  ])
  view.zoomTo(3.7)
  view.scrollTo(0)
  display.setSources(SAMPLES.map(name => ({ name })))
  display.setRowHeight(7.3)
  display.setCellData(
    cellDataOf({
      rowNames: SAMPLES,
      sampleNames: SAMPLES,
      genotypeDict: ['0/1'],
      simplifiedFeatures: [
        {
          id: 'v0',
          data: { start: 1001, end: 1002, refName: 'ctgA', name: 'v0' },
        },
      ],
      perRegionCellData: {
        0: cellPayloadOf([featureInfoOf('v0')], {
          cellFeatureIndices: new Uint32Array(3),
          cellRowIndices: Uint32Array.of(0, 1, 2),
          cellColors: new Uint32Array(3).fill(0xff0000ff),
          cellAltDosage: new Uint8Array(3).fill(128),
          numCells: 3,
          featurePositions: Uint32Array.of(1001, 1002),
        }),
      },
    }),
  )
  return display
}

test.each([1, 1.25, 1.5, 2])(
  'the hover box sits on the device pixels its cell paints at dpr %d',
  dpr => {
    withDpr(dpr, () => {
      const display = loadedDisplay()
      const region = display.renderBlocks[0]!
      display.setHoveredCell({
        cellIndex: 2,
        genomicStart: 1001,
        genomicEnd: 1002,
        displayedRegionIndex: region.displayedRegionIndex,
      })
      expect(display.hoverInk).toHaveLength(1)
      const { left, top, width, height } = display.hoverInk[0]!
      const { canvasWidth, canvasHeight } = display.renderState
      const sx = backingScale(canvasWidth)
      const sy = backingScale(canvasHeight)
      const y0 = top - display.rowsTopOffset
      for (const [px, scale] of [
        [left, sx],
        [left + width, sx],
        [y0, sy],
        [y0 + height, sy],
      ] as const) {
        expect(px * scale).toBeCloseTo(Math.round(px * scale), 6)
      }
      expect(Math.abs(y0 - 2 * 7.3)).toBeLessThanOrEqual(0.5 / sy)
    })
  },
)
