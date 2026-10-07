import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR, withAbgrAlpha } from '@jbrowse/core/util/colorBits'
import { colorSchemes } from '@jbrowse/synteny-core'

import { createDisplayWithSession } from './testEnv.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'

// Three mates sharing no record: B runs with the anchor, C and D against it.
// The header names the anchor and no lane pairs, so each lane reads against it.
const A = 'volvox'
const B = 'volvox_random'
const C = 'volvox_ins'
const D = 'volvox_del'
const STARTS = [100, 300, 500, 700]

function record(id: string, start: number, mate: string, mateStart: number) {
  const strand = mate === B ? 1 : -1
  return new SimpleFeature({
    uniqueId: id,
    refName: 'ctgA',
    start,
    end: start + 100,
    strand,
    assemblyName: A,
    mate: {
      assemblyName: mate,
      refName: 'ctgB',
      start: mateStart,
      end: mateStart + 100,
    },
  })
}

async function starDisplay() {
  const { display } = createDisplayWithSession({
    trackAssemblyNames: [A, B, C],
    geneTracks: [],
    rpc: () => new Promise(() => {}),
  })
  display.setAdapterHeader({
    adapterConfig: display.adapterConfig,
    value: { anchorAssemblyName: A },
  })
  display.setDomain([B, C, D])
  display.setFeatures(
    STARTS.flatMap(s => [
      record(`b${s}`, s, B, s),
      record(`c${s}`, s, C, 2000 - s),
      record(`d${s}`, s, D, 3000 - s),
    ]),
  )
  for (let i = 0; i < 200 && display.laneDecisions.size < 3; i++) {
    await new Promise(r => setTimeout(r, 5))
  }
  return display
}

function gutter(display: MultiWaySyntenyDisplayModel, row: number) {
  const cell = display.ribbonGeometry.cells.get(`ribbons:${row}`)
  if (cell?.kind !== 'ribbons') {
    throw new Error(`ribbons:${row} is not a ribbon cell`)
  }
  const { data } = cell
  return Array.from({ length: data.instanceCount }, (_, i) => ({
    color: data.colors[i]!,
    crossed:
      Math.sign(data.bp2[i]! - data.bp1[i]!) !==
      Math.sign(data.bp3[i]! - data.bp4[i]!),
  }))
}

test('each lane of a three-mate star takes its strand against the anchor', async () => {
  const display = await starDisplay()
  expect(display.rowAssemblies).toEqual([B, C, D])
  expect(
    [B, C, D].map(lane => display.laneDecisions.get(lane)?.flipped),
  ).toEqual([false, true, true])
  expect(
    display.laneHeaderRows.map(row => row.label.includes('[rev]')),
  ).toEqual([false, false, true, true])

  expect(display.laneLinksFetchSpecs).toEqual([])
  expect(display.pairLinks.size).toBe(0)

  display.setRibbonColorField('strand')
  const alpha = cssColorToABGR(display.ribbonColor) >>> 24
  const pos = withAbgrAlpha(cssColorToABGR(colorSchemes.strand.posColor), alpha)
  const neg = withAbgrAlpha(cssColorToABGR(colorSchemes.strand.negColor), alpha)
  const gutters = [0, 1, 2].map(row => gutter(display, row))
  expect(gutters.map(ribbons => ribbons.length)).toEqual([4, 4, 4])
  expect(
    gutters.map(ribbons => [...new Set(ribbons.map(r => r.color))]),
  ).toEqual([[pos], [neg], [neg]])
  expect(gutters.flat().some(r => r.crossed)).toBe(false)
})
