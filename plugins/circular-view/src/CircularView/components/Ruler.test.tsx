import { radToDeg } from '@jbrowse/core/util'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'

import Ruler from './Ruler.tsx'
import { Slice } from '../slices.ts'

import type { CircularViewModel } from '../model.ts'

// the elided branch of Ruler reads only these two off the view; the non-elided
// branch additionally needs getSession, so it can't run outside an MST tree
function makeModel(offsetRadians: number) {
  return { radiusPx: 150, offsetRadians } as unknown as CircularViewModel
}

function makeRegion(refName: string) {
  return { assemblyName: 'volvox', refName, start: 0, end: 100 }
}

function makeSlice(centerRadians: number, widthRadians: number) {
  const bpPerRadian = 1000
  return new Slice(
    { bpPerRadian },
    {
      elided: true,
      widthBp: widthRadians * bpPerRadian,
      regions: [makeRegion('ctgA'), makeRegion('ctgB')],
    },
    centerRadians - widthRadians / 2,
  )
}

// rotation of the label once the view's own rotation of the whole figure is
// applied, normalized to [0, 360)
function screenRotationDeg(text: Element, offsetRadians: number) {
  const transform = text.getAttribute('transform')!
  const [, rotation] = /rotate\((-?[\d.]+)\)/.exec(transform)!
  const deg = Number(rotation) + radToDeg(offsetRadians)
  return ((deg % 360) + 360) % 360
}

// a slice narrow enough that the label can't fit along the arc renders radially,
// a wide one renders tangentially; both have to stay right-side-up
const widths = { perpendicular: 0.06, parallel: 0.45 }

// includes offsets wound past a full turn: offsetRadians accumulates without
// bound as the user rotates, so orientation must not depend on its winding
const offsets = [-Math.PI / 2, 0, Math.PI / 3, -Math.PI / 2 + 2 * Math.PI, -7]

describe.each(Object.entries(widths))('%s labels', (_name, widthRadians) => {
  test.each(offsets)('are never upside-down at offset %d', offsetRadians => {
    const model = makeModel(offsetRadians)
    // 24 positions around the circle, half-step offset so none lands exactly
    // vertical on screen (where neither orientation is upside-down)
    const angles = Array.from(
      { length: 24 },
      (_, i) => (((i + 0.5) / 24) * 2 * Math.PI),
    )

    for (const radians of angles) {
      const { container, unmount } = render(
        <ThemeProvider theme={createJBrowseTheme()}>
          <svg>
            <Ruler model={model} slice={makeSlice(radians, widthRadians)} />
          </svg>
        </ThemeProvider>,
      )
      const rotation = screenRotationDeg(
        container.querySelector('text')!,
        offsetRadians,
      )
      expect(rotation < 90 || rotation > 270).toBe(true)
      unmount()
    }
  })
})
