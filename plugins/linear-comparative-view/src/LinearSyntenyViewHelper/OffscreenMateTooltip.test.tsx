import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import OffscreenMateTooltip from './OffscreenMateTooltip.tsx'

import type { MateNavDestination } from './offscreenMateNav.ts'
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

const SHOW: MateNavDestination = {
  kind: 'show',
  loc: 'ctgB:190,001..210,000',
  regions: [],
  location: { refName: 'ctgB', start: 190_000, end: 210_000 },
}

function draw(
  model: OffscreenMateSource,
  refName: string,
  side: 'top' | 'bottom' = 'top',
  destination: MateNavDestination | undefined = SHOW,
) {
  const { getByRole } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <OffscreenMateTooltip
        model={model}
        hover={{
          refName,
          side,
          locus: { start: 0, end: 1 },
          navRow: 1,
          clientX: 40,
          clientY: 12,
        }}
        destination={destination}
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
// where it goes, so the hover says what clicking does and names the locus the
// snackbar will.
test('and says what clicking it does', () => {
  expect(draw(source({ ctgB: 1 }), 'ctgB')).toContain(
    'Click to show ctgB:190,001..210,000 on the panel below',
  )
})

// warned on hover, where it used to be found out only by clicking
test('a mark that resolves nowhere says why', () => {
  expect(
    draw(source({ ctgB: 1 }), 'ctgB', 'top', {
      kind: 'none',
      reason: 'Could not find ctgB in volvox2',
    }),
  ).toContain('Could not find ctgB in volvox2')
})

// ...and WHICH panel, because the band has a strip on each edge once the view
// fetches both rows
test('a mark on the target axis names the panel above instead', () => {
  expect(draw(source({ ctgB: 1 }), 'ctgB', 'bottom')).toContain(
    'on the panel above',
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
