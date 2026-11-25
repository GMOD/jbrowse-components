import { namesToBlock } from '@jbrowse/alignments-core'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { PaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import {
  createTestAlignmentsDisplay,
  makeEmptyPileupData,
} from './testUtils.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'
import type React from 'react'

jest.mock('@jbrowse/core/svg/svgReady', () => ({
  ...jest.requireActual('@jbrowse/core/svg/svgReady'),
  awaitSvgReady: () => Promise.resolve(),
}))

// n reads over one span, so the layout stacks them n rows deep.
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
  }
}

async function exported(reads: number) {
  const { view, display } = createTestAlignmentsDisplay()
  view.setNewView(0.1, 9900)
  display.setRpcData(
    0,
    { groups: [{ key: '', label: '', data: stackedReads(reads) }] },
    display.view.displayedRegions[0]!,
  )
  const body = await display.renderSvg({})
  const svg = renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PaletteProvider palette={resolvePalette()}>
        <svg>{body as React.ReactElement}</svg>
      </PaletteProvider>
    </ThemeProvider>,
  )
  return { display, svg }
}

const caption = (svg: string) =>
  /data-testid="pileup-cut-caption"[^>]*>([^<]*)</.exec(svg)?.[1]

// A 250px box with rows from 45 at a 9px pitch: 21 whole rows end above the
// caption line at 237.
test('a pileup deeper than its box ends on a whole row over a caption counting the rest', async () => {
  const { svg } = await exported(200)
  expect(caption(svg)).toBe('179 more rows below')
  expect(svg).toMatch(/<clipPath id="pileup-cut-[^"]*"><rect [^>]*height="234"/)
})

test('a pileup that fits draws no caption and no cut', async () => {
  const { svg } = await exported(2)
  expect(caption(svg)).toBeUndefined()
  expect(svg).not.toContain('pileup-cut-')
})
