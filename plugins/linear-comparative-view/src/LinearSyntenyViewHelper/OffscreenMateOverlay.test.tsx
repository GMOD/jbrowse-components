import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import OffscreenMateOverlay from './OffscreenMateOverlay.tsx'

import type { LinearSyntenyViewHelperModel } from './stateModelFactory.ts'

function level({ width = 800, height = 100, show = true } = {}) {
  return {
    level: 0,
    height,
    linearSyntenyDisplays: [
      {
        featureData: {
          offscreenMates: {
            mateRefNameDict: ['ctgB'],
            counts: Uint32Array.from([1]),
            starts: Float64Array.from([0]),
            ends: Float64Array.from([1000]),
            mateRefNameIds: Uint32Array.from([0]),
            lengths: Float32Array.from([1000]),
          },
        },
      },
    ],
    parentView: {
      width,
      showOffscreenMates: show,
      minAlignmentLength: 0,
      views: [{ bpPerPx: 1, offsetPx: 0 }],
    },
  } as unknown as LinearSyntenyViewHelperModel
}

// The bug this exists for: a canvas is a REPLACED element, so it takes its
// intrinsic size wherever CSS leaves width/height auto — and that intrinsic size
// is the DPR-scaled backing store. Positioned with `inset: 0` and nothing else,
// the overlay laid out at twice the band on a retina display, so every mark and
// label drew at twice its x with the right half off the edge. Meanwhile the hit
// test reads the LEVEL's canvas, which was the right size, so the mark a reader
// saw and the mark their click resolved were in different places — the one thing
// the shared layout function was written to make impossible, arriving through
// the element instead of through the geometry.
test('the overlay lays out at the band, not at its backing store', () => {
  const { getByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <OffscreenMateOverlay model={level({ width: 800, height: 100 })} />
    </ThemeProvider>,
  )
  const canvas = getByTestId('offscreen_mate_overlay')
  expect(canvas.style.width).toBe('800px')
  expect(canvas.style.height).toBe('100px')
})

// The setting is off by default, so an unconditional overlay meant a band-sized
// DPR-scaled backing store per level for a strip nobody had asked for.
test('nothing to mark is no canvas at all', () => {
  const { queryByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <OffscreenMateOverlay model={level({ show: false })} />
    </ThemeProvider>,
  )
  expect(queryByTestId('offscreen_mate_overlay')).toBeNull()
})
