import { createJBrowseTheme } from '@jbrowse/core/ui'
import { PaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { ThemeProvider } from '@mui/material'
import { createCanvas } from '@napi-rs/canvas'
import { renderToString } from 'react-dom/server'

import { createTestAlignmentsDisplay, oneReadWithMate } from './testUtils.ts'

import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type React from 'react'

jest.mock('@jbrowse/core/svg/svgReady', () => ({
  ...jest.requireActual('@jbrowse/core/svg/svgReady'),
  awaitSvgReady: () => Promise.resolve(),
}))

const nodeCanvas = createCanvas as unknown as (
  width: number,
  height: number,
) => HTMLCanvasElement

function readWithMismatch() {
  const { view, display } = createTestAlignmentsDisplay()
  view.setNewView(0.1, 9900)
  display.setRpcData(
    0,
    {
      groups: [
        {
          key: '',
          label: '',
          data: {
            ...oneReadWithMate(),
            mismatchPositions: new Uint32Array([1010]),
            mismatchReadIndices: new Uint32Array([0]),
            mismatchStrands: new Int8Array([1]),
            mismatchFrequencies: new Uint8Array([255]),
            mismatchBases: new Uint8Array([65]),
            mismatchQuals: new Uint8Array([60]),
          },
        },
      ],
    },
    display.view.displayedRegions[0]!,
  )
  return display
}

async function exported(opts: ExportSvgDisplayOptions) {
  const display = readWithMismatch()
  expect(display.visibleLabels.map(l => l.text)).toEqual(['A'])
  const body = await display.renderSvg(opts)
  return renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PaletteProvider palette={resolvePalette()}>
        <svg>{body as React.ReactElement}</svg>
      </PaletteProvider>
    </ThemeProvider>,
  )
}

const letters = (svg: string) =>
  [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1])

test('a rasterized export keeps the mismatch letters text over the reads', async () => {
  const svg = await exported({
    rasterizeLayers: true,
    createCanvas: nodeCanvas,
  })
  expect(svg).toContain('<image')
  expect(letters(svg)).toEqual(['A'])
  expect(svg.indexOf('<image')).toBeLessThan(svg.indexOf('<text'))
})

test('an exported letter names no family, so it draws in the export font', async () => {
  const svg = await exported({})
  const [tag] = /<text[^>]*>A<\/text>/.exec(svg) ?? ['']
  expect(tag).toContain('font-weight="bold"')
  expect(tag).not.toContain('font-family')
})
