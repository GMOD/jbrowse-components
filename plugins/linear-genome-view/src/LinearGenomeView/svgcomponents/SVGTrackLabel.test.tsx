import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import SVGTrackLabel from './SVGTrackLabel.tsx'
import {
  TRACK_LABEL_GAP,
  defaultTextHeight,
  labelInkHeight,
  offsetLabelBaselineY,
} from './util.ts'

import type { TrackLabelMode } from '../types.ts'

// The export dialog offers four label placements and only 'offset' — the
// default — was ever exercised, by the integration snapshots. These cover the
// other three at the level the placement actually lives.

const FONT_SIZE = 13
const TRACK_LABEL_OFFSET = 200
// leftmost visible content, which the non-gutter modes hang off
const CONTENT_X = 7

function renderLabel(trackLabels: TrackLabelMode, fontSize = FONT_SIZE) {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <SVGTrackLabel
          trackName="volvox alignments"
          trackLabels={trackLabels}
          fontSize={fontSize}
          textHeight={defaultTextHeight(fontSize)}
          trackLabelOffset={TRACK_LABEL_OFFSET}
          x={CONTENT_X}
        />
      </svg>
    </ThemeProvider>,
  )
  return container.querySelector('text')
}

// Chrome reports a 13px string's ink as 15px tall with ~3px below the baseline;
// util.ts models that with LABEL_INK_EM / LABEL_DESCENT_EM, and these read the
// drawn baseline back through the same model.
const descent = (fontSize: number) => Math.ceil(fontSize * 0.22)
const inkTop = (baseline: number, fontSize: number) =>
  baseline - (labelInkHeight(fontSize) - descent(fontSize))

test('none draws nothing at all', () => {
  expect(renderLabel('none')).toBeNull()
})

test('left right-aligns into the gutter trackLabelLeftOffset reserved', () => {
  const text = renderLabel('left')
  // trackLabelLeftOffset reserves `widest name + TRACK_LABEL_GAP`, so the text
  // has to end exactly TRACK_LABEL_GAP short of the track body or the widest
  // name overflows the gutter that was measured for it
  expect(text?.getAttribute('x')).toBe(String(TRACK_LABEL_OFFSET - TRACK_LABEL_GAP))
  expect(text?.getAttribute('text-anchor')).toBe('end')
})

// The regression: 'left' used to sit at a hardcoded y=20 on a hanging baseline,
// which ignored fontSize and spent 20px of the track's height getting there —
// so at the default font the name sat at [20, 36] of a track whose whole body
// might be 20px tall. It now hugs the top, taking only the room its own glyphs
// need, whatever the font.
test.each([10, 13, 26])(
  'left occupies just its own ink height at fontSize %i',
  fontSize => {
    const y = Number(renderLabel('left', fontSize)?.getAttribute('y'))
    expect(inkTop(y, fontSize)).toBeGreaterThanOrEqual(0)
    expect(y + descent(fontSize)).toBeLessThanOrEqual(labelInkHeight(fontSize) + 1)
  },
)

test('a left label fits inside a short track at the default font', () => {
  // 20px is as short as a display's body gets; the old fixed y=20 put the name
  // entirely below it, overlapping whatever came next
  const y = Number(renderLabel('left')?.getAttribute('y'))
  expect(y + descent(FONT_SIZE)).toBeLessThanOrEqual(20)
})

test('offset hangs off the leftmost visible content, above the track body', () => {
  const text = renderLabel('offset')
  expect(text?.getAttribute('x')).toBe(String(CONTENT_X))
  expect(text?.getAttribute('y')).toBe(
    String(offsetLabelBaselineY(defaultTextHeight(FONT_SIZE), FONT_SIZE)),
  )
  // left-aligned is the SVG default; spending bytes to restate it on every
  // track label is what the mode-specific branches avoid
  expect(text?.getAttribute('text-anchor')).toBeNull()
})

test('overlay insets over the track body it draws on', () => {
  const text = renderLabel('overlay')
  expect(text?.getAttribute('x')).toBe(String(CONTENT_X + 5))
  // ascenders stay inside the box below the label's own top edge; at y=0 they
  // used to rise into the track above
  expect(inkTop(Number(text?.getAttribute('y')), FONT_SIZE)).toBeGreaterThanOrEqual(0)
})

test.each(['left', 'offset', 'overlay'] as const)(
  '%s places its own baseline rather than declaring one',
  trackLabels => {
    // every mode resolves the baseline from util.ts's ink-box model, which is
    // the same model getHeaderLayout/defaultTextHeight reserve space with —
    // leaving it to the renderer would make the two disagree
    expect(renderLabel(trackLabels)?.getAttribute('dominant-baseline')).toBeNull()
  },
)
