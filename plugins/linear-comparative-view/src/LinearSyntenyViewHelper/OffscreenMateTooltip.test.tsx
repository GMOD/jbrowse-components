import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import OffscreenMateTooltip from './OffscreenMateTooltip.tsx'

import type { OffscreenMateSource } from './offscreenMateStrip.ts'

function source(
  counts: Record<string, number>,
  bp: Record<string, number> = {},
) {
  const dict = Object.keys(counts)
  return {
    level: 0,
    height: 100,
    linearSyntenyDisplays: [
      {
        featureData: {
          offscreenMates: {
            mateRefNameDict: dict,
            counts: Uint32Array.from(dict, name => counts[name]!),
            alignedBp: Float64Array.from(dict, name => bp[name] ?? 0),
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
    },
  } as OffscreenMateSource
}

function draw(
  model: OffscreenMateSource,
  refName: string,
  side: 'top' | 'bottom' = 'top',
  scrolledOff = false,
) {
  const { getByRole } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <OffscreenMateTooltip
        model={model}
        hover={{
          refName,
          side,
          locus: { start: 0, end: 1 },
          mateCumBp: scrolledOff ? { start: 0, end: 1 } : undefined,
          navRow: 1,
          clientX: 40,
          clientY: 12,
        }}
      />
    </ThemeProvider>,
  )
  // hidden: floating-ui has not positioned it in jsdom, and `BaseTooltip`
  // hides an unpositioned tooltip so it cannot flash at the top left
  return getByRole('tooltip', { hidden: true }).textContent
}

// The marks a reader most wants explained are the unlabelled ones: a stretch
// under half its own name's width carries no name.
test('the hover names the contig the mark points at', () => {
  expect(draw(source({ ctgB: 2767 }), 'ctgB')).toContain('ctgB')
})

// How much SEQUENCE goes there, which is what says whether the mark is worth a
// click and what the strip ranks its own names by
test('and how much of the genome goes to it', () => {
  expect(draw(source({ ctgB: 2767 }, { ctgB: 3_845_773 }), 'ctgB')).toContain(
    '3.85Mbp',
  )
})

// ...and in how many alignments, since one block and a thousand fragments of
// one are different things to click into. The tally's own numbers, the same
// ones the strip ranks by, so two readouts of one fact cannot drift.
test('and how many alignments carry it', () => {
  expect(draw(source({ ctgB: 2767 }, { ctgB: 3_845_773 }), 'ctgB')).toContain(
    '2,767 alignments',
  )
})

// The mark is often unlabelled and the click is the only other way to find out
// where it goes, so the hover says what clicking does, and which of the two
// things it does: a contig the facing panel lacks is added to its regions,
// one it has merely scrolled off is scrolled to.
test('and says what clicking it does', () => {
  expect(draw(source({ ctgB: 1 }), 'ctgB')).toContain(
    'Not on the panel below. Click to add it',
  )
})

test('a mark for a contig the panel has scrolled off says so', () => {
  expect(draw(source({ ctgB: 1 }), 'ctgB', 'top', true)).toContain(
    'The panel below has scrolled off it. Click to scroll there',
  )
})

// ...and WHICH panel, because the band has a strip on each edge once the view
// fetches both rows. A mark on the lower edge names a contig the panel ABOVE is
// not showing.
test('a mark on the target axis names the panel above instead', () => {
  expect(draw(source({ ctgB: 1 }), 'ctgB', 'bottom')).toContain(
    'Not on the panel above. Click to add it',
  )
})

// The two lanes hold contigs of DIFFERENT assemblies, so a refName does not say
// which tally it came from — and two haplotypes of one genome, which is what
// this view is most used for, both spell a contig `chr1`. Counting both lanes
// reported a lower-strip mark's own number plus the upper strip's.
function bothLanes() {
  return {
    level: 0,
    height: 100,
    linearSyntenyDisplays: [
      {
        featureData: {
          offscreenMates: {
            mateRefNameDict: ['chr1'],
            counts: Uint32Array.from([7]),
            alignedBp: Float64Array.from([7000]),
            starts: Float64Array.from([0]),
            ends: Float64Array.from([10]),
            mateRefNameIds: new Uint32Array(1),
          },
          targetOffscreenMates: {
            mateRefNameDict: ['chr1'],
            counts: Uint32Array.from([3]),
            alignedBp: Float64Array.from([3000]),
            starts: Float64Array.from([0]),
            ends: Float64Array.from([10]),
            mateRefNameIds: new Uint32Array(1),
          },
          targetQueried: true,
        },
      },
    ],
    parentView: {
      showOffscreenMates: true,
      minAlignmentLength: 0,
    },
  } as unknown as OffscreenMateSource
}

test('a contig named on both axes counts only the lane hovered', () => {
  expect(draw(bothLanes(), 'chr1', 'top')).toContain('7 alignments')
})

test('...and the other lane on the other edge', () => {
  expect(draw(bothLanes(), 'chr1', 'bottom')).toContain('3 alignments')
})

test('a contig no display counted is named without a number', () => {
  const text = draw(source({ ctgB: 5 }), 'ctgQ')
  expect(text).toContain('ctgQ')
  expect(text).not.toContain('alignments')
})
