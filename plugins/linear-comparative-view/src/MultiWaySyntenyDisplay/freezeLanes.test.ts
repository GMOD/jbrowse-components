import { SimpleFeature } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { createDisplayWithSession } from './testEnv.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'

const A = 'volvox'
const B = 'volvox_random'
const C = 'volvox_ins'
const STARTS = [100, 250, 400, 550, 700]

function record(
  id: string,
  name: string,
  start: number,
  mateStart: number,
  refName = 'ctgA',
) {
  return new SimpleFeature({
    uniqueId: id,
    name,
    refName,
    start,
    end: start + 60,
    strand: 1,
    assemblyName: A,
    mate: {
      assemblyName: C,
      refName: 'ctgB',
      start: mateStart,
      end: mateStart + 60,
    },
  })
}

// the anchor's genes against C's, `shift` bp further along C
const pairs = (shift: number) =>
  STARTS.map((s, i) => record(`${shift}-${i}`, `g${i}`, s, 20_000 + s + shift))

async function setup() {
  const { display } = createDisplayWithSession({
    trackAssemblyNames: [A, B, C],
    geneTracks: [],
    rpc: () => new Promise(() => {}),
  })
  display.setFeatures(pairs(0))
  for (let i = 0; i < 200 && display.laneDecisions.size === 0; i++) {
    await new Promise(r => setTimeout(r, 5))
  }
  expect(display.laneDecisions.get(C)).toBeDefined()
  return display
}

// each group's px on C less its px on the anchor
function slipOf(display: MultiWaySyntenyDisplayModel) {
  const { lanes } = display.laneStack
  const mate = lanes.find(l => l.assemblyName === C)!
  return [...mate.placements].flatMap(([key, { spans }]) => {
    const a = lanes[0]!.placements.get(key)?.spans[0]
    const m = spans[0]
    return a && m ? [Math.round((m[0] + m[1]) / 2 - (a[0] + a[1]) / 2)] : []
  })
}

test('a frozen lane holds its frame where a live one re-aligns', async () => {
  const display = await setup()
  display.setLanesFrozen(true)
  const frozen = display.laneDecisions.get(C)
  expect(display.frozenDecisions.get(C)).toBe(frozen)

  display.setFeatures(pairs(300))
  expect(display.laneDecisions.get(C)).toBe(frozen)
  expect(slipOf(display).every(d => d !== 0)).toBe(true)

  display.setLanesFrozen(false)
  expect(display.lanesFrozen).toBe(false)
  expect(slipOf(display).every(d => d === 0)).toBe(true)
})

test('a slide draws through the lane map, then lands in the frozen frame once', async () => {
  const display = await setup()
  display.setLanesFrozen(true)
  const before = slipOf(display)
  const row = display.laneStack.lanes.findIndex(l => l.assemblyName === C)

  display.setLaneDragPx(C, 40)
  expect(display.laneMaps.get(row)).toEqual({ scale: 1, offset: 40 })
  expect(slipOf(display)).toEqual(before)

  display.endLaneDrag(C)
  expect(display.laneMaps.size).toBe(0)
  expect(slipOf(display)).toEqual(before.map(d => d + 40))
  expect(display.laneDecisions.get(C)).toBe(display.frozenDecisions.get(C))
})

test('the lanes unfreeze once the view leaves the window they froze on', async () => {
  const display = await setup()
  const view = display.lgv
  view.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 50_000, assemblyName: A },
  ])
  display.setLanesFrozen(true)
  view.horizontalScroll(view.width / 2)
  expect(display.lanesFrozen).toBe(true)

  view.horizontalScroll(view.width)
  expect(display.lanesFrozen).toBe(false)
  expect(display.frozenLanes).toBeUndefined()
})

test('only a frozen mate lane is slidable, and only over its own rows', async () => {
  const display = await setup()
  const lane = display.laneStack.lanes.find(l => l.assemblyName === C)!
  const y = lane.glyphTop + 1 - display.scrollTop
  expect(display.slidableLaneAt(y)).toBeUndefined()
  display.setLanesFrozen(true)
  expect(display.slidableLaneAt(y)).toBe(C)
  expect(display.slidableLaneAt(lane.bandTop - 4 - display.scrollTop)).toBe(
    undefined,
  )
  const anchor = display.laneStack.lanes[0]!
  expect(display.slidableLaneAt(anchor.glyphTop + 1)).toBeUndefined()
})

test('Flip lane on a frozen lane flips it and keeps it frozen', async () => {
  const display = await setup()
  display.setLanesFrozen(true)
  expect(display.frozenDecisions.get(C)!.flipped).toBe(false)
  display.flipLane(C)
  expect(display.frozenDecisions.get(C)!.flipped).toBe(true)
  expect(display.laneDecisions.get(C)).toBe(display.frozenDecisions.get(C))
})

test('Re-align lane fits a frozen lane to the window it shows now', async () => {
  const display = await setup()
  display.setLanesFrozen(true)
  display.setFeatures(pairs(300))
  expect(slipOf(display).every(d => d !== 0)).toBe(true)
  display.realignLane(C)
  expect(display.lanesFrozen).toBe(true)
  expect(slipOf(display).every(d => d === 0)).toBe(true)
})

test('the frozen frames are session state, stated against their anchor', async () => {
  const display = await setup()
  display.setLanesFrozen(true)
  display.nudgeLane(C, 25)
  const { frozenLanes } = getSnapshot(display) as {
    frozenLanes?: { anchor: string; decisions: Record<string, unknown> }
  }
  expect(frozenLanes?.anchor).toBe(A)
  expect(Object.keys(frozenLanes?.decisions ?? {})).toEqual([C])

  display.lgv.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 1000, assemblyName: B },
  ])
  expect(display.lanesFrozen).toBe(false)
  expect(display.frozenDecisions.size).toBe(0)
})
