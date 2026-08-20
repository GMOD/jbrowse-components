import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import OffscreenMateTooltip from './OffscreenMateTooltip.tsx'

import type { OffscreenMateSource } from './offscreenMateStrip.ts'

function source(counts: Record<string, number>) {
  const dict = Object.keys(counts)
  return {
    level: 0,
    linearSyntenyDisplays: [
      {
        featureData: {
          offscreenMates: {
            mateRefNameDict: dict,
            counts: Uint32Array.from(dict, name => counts[name]!),
            starts: Float64Array.from([0]),
            ends: Float64Array.from([1000]),
            mateRefNameIds: Uint32Array.from([0]),
          },
        },
      },
    ],
    parentView: {
      showOffscreenMates: true,
      minAlignmentLength: 0,
      views: [{ bpPerPx: 1, offsetPx: 0 }],
    },
  } as OffscreenMateSource
}

function draw(model: OffscreenMateSource, refName: string, navRow = 1) {
  const { getByRole } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <OffscreenMateTooltip
        model={model}
        hover={{ refName, navRow, level: 0, clientX: 40, clientY: 12 }}
      />
    </ThemeProvider>,
  )
  // hidden: floating-ui has not positioned it in jsdom, and `BaseTooltip`
  // hides an unpositioned tooltip so it cannot flash at the top left
  return getByRole('tooltip', { hidden: true }).textContent
}

// The marks a reader most wants explained are the unlabelled ones: a label goes
// on a stretch only when the stretch is wide enough to hold it.
test('the hover names the contig the mark points at', () => {
  expect(draw(source({ ctgB: 2767 }), 'ctgB')).toContain('ctgB')
})

// Grouped, and the tally's own number — the same one the hamburger item reports
// for this contig, so two readouts of one fact cannot drift.
test('and how many alignments go to it', () => {
  expect(draw(source({ ctgB: 2767 }), 'ctgB')).toContain('2,767')
})

// Clicking REPLACES the facing panel's regions, so the hover has to say what
// the click will do before it is the only way to find out.
test('and says what clicking it does', () => {
  expect(draw(source({ ctgB: 1 }), 'ctgB')).toContain(
    'Click to show it on the panel below',
  )
})

// ...and WHICH panel, because the band has a strip on each edge once the view
// fetches both rows. A mark on the lower edge names a contig the panel ABOVE is
// not showing, and a tooltip promising the one below describes a click that
// then rewrites the other panel's regions.
test('a mark on the target axis names the panel above instead', () => {
  expect(draw(source({ ctgB: 1 }), 'ctgB', 0)).toContain(
    'Click to show it on the panel above',
  )
})

test('a contig no display counted is named without a number', () => {
  const text = draw(source({ ctgB: 5 }), 'ctgQ')
  expect(text).toContain('ctgQ')
  expect(text).not.toContain('alignments')
})
