import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import WiggleSvgScale from '../LinearWiggleDisplay/WiggleSvgScale.tsx'
import MultiWiggleSvgScales from '../MultiLinearWiggleDisplay/MultiWiggleSvgScales.tsx'
import { makeDensityRgbStringFn } from './getDensityColor.ts'
import { makeWiggleRenderState } from './wiggleComponentUtils.ts'

import type React from 'react'

// The legend bar and the plot are two drawings of one color function, so a
// score has to land on the same ink in both. `symlogConstant` is the input
// that can separate them: the config slot holds a raw value whose `0` means
// "derive from the domain", and only the renderer's resolution of it is the
// number actually painted with.

const DOMAIN: [number, number] = [0, 1000]
const RAMP = {
  posColor: '#b2182b',
  negColor: '#2166ac',
  pivot: 0,
  gradientId: 'g1',
}

// A configured constant well away from the auto value this domain derives
// (max/1000 = 1), so a legend resolving "auto" paints a visibly different bar.
function makeModel(symlogConstant: number) {
  return {
    domain: DOMAIN,
    scaleType: 'symlog',
    symlogConstant,
    renderingType: 'density',
    scatterPointSize: 2,
    lineWidth: 1,
    bicolorPivot: RAMP.pivot,
    isDensityMode: true,
    scoreRamp: RAMP,
    rowHeightTooSmallForScalebar: false,
    sources: [{ name: 'a' }],
    isOverlay: false,
    effectiveRowHeight: 100,
    ticks: undefined,
    numSources: 1,
    numRows: 1,
    showRowLabels: true,
  }
}

function renderState(model: ReturnType<typeof makeModel>) {
  return makeWiggleRenderState(model, { width: 800, height: 100, numRows: 1 })
}

function draw(node: React.ReactNode) {
  return renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>{node}</svg>
    </ThemeProvider>,
  )
}

function stops(svg: string) {
  return [...svg.matchAll(/<stop offset="([\d.]+)" stop-color="([^"]+)"/g)].map(
    m => ({ offset: Number(m[1]), color: m[2]! }),
  )
}

function plotColorAt(model: ReturnType<typeof makeModel>, offset: number) {
  const state = renderState(model)
  const [min, max] = DOMAIN
  return makeDensityRgbStringFn(
    min,
    max,
    state.scaleType,
    178,
    24,
    43,
    state.origin,
    state.symlogConstant,
  )(min + (max - min) * offset)
}

const CALL_SITES = [
  [
    'WiggleSvgScale',
    (model: ReturnType<typeof makeModel>) => (
      <WiggleSvgScale
        model={model}
        scalebarLeft={0}
        legendRight={800}
        ticks={undefined}
      />
    ),
  ],
  [
    'MultiWiggleSvgScales',
    (model: ReturnType<typeof makeModel>) => (
      <MultiWiggleSvgScales
        model={model}
        legendRight={800}
        scalebarLeft={0}
        labelOffset={0}
      />
    ),
  ],
] as const

test.each(CALL_SITES)(
  '%s draws the ramp with the constant the plot is painted with',
  (_name, element) => {
    const model = makeModel(10)
    const bar = stops(draw(element(model)))
    expect(bar.length).toBeGreaterThan(2)
    for (const stop of bar) {
      expect([stop.offset, stop.color]).toEqual([
        stop.offset,
        plotColorAt(model, stop.offset),
      ])
    }
  },
)

test.each(CALL_SITES)(
  '%s still agrees when the constant is left at the auto default',
  (_name, element) => {
    const model = makeModel(0)
    for (const stop of stops(draw(element(model)))) {
      expect(stop.color).toBe(plotColorAt(model, stop.offset))
    }
  },
)
