import { createJBrowseTheme } from '@jbrowse/core/ui'
import { PaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { getPaletteHost } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import {
  createTestAlignmentsDisplay,
  makeEmptyPileupData,
  oneReadWithMate,
} from './testUtils.ts'

import type React from 'react'

// The export waits on the fetch reaching a terminal state, and this harness
// never fetches.
jest.mock('@jbrowse/core/svg/svgReady', () => ({
  ...jest.requireActual('@jbrowse/core/svg/svgReady'),
  awaitSvgReady: () => Promise.resolve(),
}))

type TestDisplay = ReturnType<typeof createTestAlignmentsDisplay>['display']

function booted(seed: (display: TestDisplay) => void) {
  const { view, display } = createTestAlignmentsDisplay()
  // wide enough that both feet of the arc are on screen
  view.setNewView(10, 0)
  seed(display)
  return display
}

function withReadPair(display: TestDisplay) {
  display.setDrawnReadConnections('link')
  display.setRpcData(
    0,
    { groups: [{ key: '', label: '', data: oneReadWithMate(5000) }] },
    display.view.displayedRegions[0]!,
  )
}

function withJunction(display: TestDisplay) {
  display.setShowSashimi(true)
  display.setRpcData(
    0,
    {
      groups: [
        {
          key: '',
          label: '',
          data: {
            ...makeEmptyPileupData(),
            sashimiX1: new Uint32Array([1000]),
            sashimiX2: new Uint32Array([5000]),
            sashimiFwd: new Uint32Array([0]),
            sashimiRev: new Uint32Array([0]),
            sashimiDonors: new Uint8Array([0]),
            sashimiAcceptors: new Uint8Array([0]),
            sashimiClass: new Uint8Array([0]),
            sashimiCounts: new Uint32Array([20]),
          },
        },
      ],
    },
    display.view.displayedRegions[0]!,
  )
}

// The one arc the export draws: the rect its band clips it to, the y its feet
// stand at, and whether it bows toward the top of the page.
async function exportedArc(display: TestDisplay) {
  const body = await display.renderSvg({})
  const svg = renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PaletteProvider palette={getPaletteHost(display).palette}>
        <svg>{body as React.ReactElement}</svg>
      </PaletteProvider>
    </ThemeProvider>,
  )
  const clip = /<clipPath[^>]*><path d="M0,([\d.]+)h[\d.]+v([\d.]+)h/.exec(svg)
  const arc =
    /<path d="M([\d.]+),([\d.]+)L[^A]*A[\d.]+,[\d.]+ 0 0 ([01]) ([\d.]+),/.exec(
      svg,
    )
  return clip && arc
    ? {
        clipTop: Number(clip[1]),
        clipHeight: Number(clip[2]),
        footY: Math.round(Number(arc[2])),
        rises: (arc[3] === '1') === Number(arc[1]) < Number(arc[4]),
      }
    : undefined
}

describe('the read connections export where their placement puts them', () => {
  test('above: in the strip over coverage, standing on its floor', async () => {
    const display = booted(d => {
      withReadPair(d)
      d.setReadConnectionsPlacement('above')
    })
    const strip = display.readConnectionsHeight
    expect(await exportedArc(display)).toEqual({
      clipTop: 0,
      clipHeight: strip,
      footY: strip,
      rises: true,
    })
    expect(display.renderState.sections[0]!.coverageTopOffset).toBe(strip)
  })

  test('below: in the strip under coverage, hanging from its top', async () => {
    const display = booted(d => {
      withReadPair(d)
      d.setReadConnectionsPlacement('below')
    })
    expect(await exportedArc(display)).toEqual({
      clipTop: display.coverageHeight,
      clipHeight: display.readConnectionsHeight,
      footY: display.coverageHeight,
      rises: false,
    })
    expect(display.renderState.sections[0]!.coverageTopOffset).toBe(0)
  })

  test('overlay, coverage hidden: the arcs rise in a strip of their own', async () => {
    const display = booted(d => {
      d.setShowCoverage(false)
      d.setReadConnectionsPlacement('overlay')
      withReadPair(d)
    })
    const strip = display.readConnectionsHeight
    expect(await exportedArc(display)).toEqual({
      clipTop: 0,
      clipHeight: strip,
      footY: strip,
      rises: true,
    })
  })
})

describe('the sashimi arcs export where their placement puts them', () => {
  test('above: in the strip over coverage, standing on its floor', async () => {
    const display = booted(d => {
      withJunction(d)
      d.setSashimiPlacement('above')
    })
    const strip = display.sashimiHeight
    expect(await exportedArc(display)).toEqual({
      clipTop: 0,
      clipHeight: strip,
      footY: strip,
      rises: true,
    })
    expect(display.renderState.sections[0]!.coverageTopOffset).toBe(strip)
  })

  test('below: in the strip under coverage, hanging from its top', async () => {
    const display = booted(d => {
      withJunction(d)
      d.setSashimiPlacement('below')
    })
    expect(await exportedArc(display)).toEqual({
      clipTop: display.coverageHeight,
      clipHeight: display.sashimiHeight,
      footY: display.coverageHeight,
      rises: false,
    })
    expect(display.renderState.sections[0]!.coverageTopOffset).toBe(0)
  })

  // The strip above is the arcs' own, so they keep it, rising, with the
  // coverage band hidden. Hiding the band changes what the display fetches,
  // so the junction is seeded after it.
  test('above, coverage hidden: the strip keeps its place', async () => {
    const display = booted(d => {
      d.setShowCoverage(false)
      d.setSashimiPlacement('above')
      withJunction(d)
    })
    const strip = display.sashimiHeight
    expect(await exportedArc(display)).toEqual({
      clipTop: 0,
      clipHeight: strip,
      footY: strip,
      rises: true,
    })
  })

  test('overlay, coverage hidden: the arcs hang in a strip of their own', async () => {
    const display = booted(d => {
      d.setShowCoverage(false)
      d.setSashimiPlacement('overlay')
      withJunction(d)
    })
    expect(await exportedArc(display)).toEqual({
      clipTop: 0,
      clipHeight: display.sashimiHeight,
      footY: 0,
      rises: false,
    })
  })
})
