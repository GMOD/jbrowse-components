import { when } from 'mobx'

import { RING_GAP_PX } from './ringHost.ts'
import {
  CTG_A_BP,
  CTG_B_BP,
  fakeStrip,
  ringTestSession,
} from './ringTestSession.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const TWO_PI = 2 * Math.PI

function scores(refName: string, length: number, step: number) {
  const out = []
  for (let start = 0; start < length; start += step) {
    out.push({
      uniqueId: `${refName}-${start}`,
      refName,
      start,
      end: start + step,
      score: (start / step) % 7,
    })
  }
  return out
}

async function setup() {
  return ringTestSession({
    type: 'QuantitativeTrack',
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        ...scores('ctgA', CTG_A_BP, 100),
        ...scores('ctgB', CTG_B_BP, 100),
      ],
    },
  })
}

test('a bigwig-shaped track opens on the circle as a wiggle ring over the strip', async () => {
  const { view, display } = await setup()
  const host = view.ringHost
  expect(display.type).toBe('LinearWiggleDisplay')
  expect(display.host).toBe(host)
  expect(host.rings.map(r => r.display)).toEqual([display])

  // the strip is the circumference, one block per slice at the slice's arc
  expect(display.canvasWidthPx).toBeCloseTo(view.circumferencePx)
  const slices = view.staticSlices
  expect(host.visibleRegions.map(r => r.refName)).toEqual(['ctgA', 'ctgB'])
  for (const [i, region] of host.visibleRegions.entries()) {
    const slice = slices[i]!
    expect(region.screenStartPx).toBeCloseTo(slice.startRadians * view.radiusPx)
    expect(region.screenEndPx).toBeCloseTo(slice.endRadians * view.radiusPx)
    expect(region.displayedRegionIndex).toBe(i)
  }
  const [a, b] = display.renderBlocks
  expect(b!.screenStartPx - a!.screenEndPx).toBeCloseTo(view.effectiveSpacingPx)

  // the ring is the display's height, under the ruler
  const [ring] = host.rings
  expect(ring!.outerPx).toBe(view.radiusPx - RING_GAP_PX)
  expect(ring!.innerPx).toBe(ring!.outerPx - display.height)
  expect(host.chordRadiusPx).toBe(ring!.innerPx - RING_GAP_PX)

  // the strip fetched per slice
  await when(() => display.loadedRegions.size === 2)
  expect([...display.loadedRegions.keys()].sort()).toEqual([0, 1])
}, 30000)

test('a point on the wiggle ring unwarps to the strip column of its base', async () => {
  const { view, display } = await setup()
  const host = view.ringHost
  const [ring] = host.rings
  const { strip, canvas } = fakeStrip(Math.round(host.width), display.height)
  host.setStripElement(display.id, strip)
  const [cell] = host.ringCells
  expect(cell!.strip?.image).toBe(canvas)
  expect(cell!.channels.outerPx[0]).toBe(ring!.outerPx)

  // ctgB's midpoint, at the ring's middle, in the screen frame
  const slice = view.staticSlices[1]!
  const angle = (slice.startRadians + slice.endRadians) / 2
  const r = (ring!.innerPx + ring!.outerPx) / 2
  const screen = angle + view.offsetRadians
  const hit = host.ringHit(r * Math.cos(screen), r * Math.sin(screen))!
  expect(hit.ring).toBe(ring)
  expect(hit.y).toBeCloseTo(display.height / 2)
  const region = host.visibleRegions.find(
    v => hit.x >= v.screenStartPx && hit.x <= v.screenEndPx,
  )!
  expect(region.refName).toBe('ctgB')
  const bp =
    region.start +
    ((hit.x - region.screenStartPx) /
      (region.screenEndPx - region.screenStartPx)) *
      (region.end - region.start)
  expect(bp).toBeCloseTo(CTG_B_BP / 2, 0)

  // a full turn later is the same column
  const again = host.ringHit(
    r * Math.cos(screen + TWO_PI),
    r * Math.sin(screen + TWO_PI),
  )!
  expect(again.x).toBeCloseTo(hit.x)
}, 30000)
