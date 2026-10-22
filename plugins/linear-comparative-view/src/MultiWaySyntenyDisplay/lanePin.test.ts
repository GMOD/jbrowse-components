import { SimpleFeature } from '@jbrowse/core/util'
import { applySnapshot, getSnapshot } from '@jbrowse/mobx-state-tree'

import { laneHeaderMenuItems } from './menus.ts'
import { createDisplayWithSession } from './testEnv.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const A = 'volvox'
const B = 'volvox_random'
const C = 'volvox_ins'
const STARTS = [100, 250, 400, 550, 700]
// the last three genes land this far along C from the first two
const APART = 5_000_000

function record(i: number, start: number) {
  const mateStart = 20_000 + start + (i >= 2 ? APART : 0)
  return new SimpleFeature({
    uniqueId: `${i}`,
    name: `g${i}`,
    refName: 'ctgA',
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

async function until(test: () => boolean) {
  for (let i = 0; i < 200 && !test(); i++) {
    await new Promise(r => setTimeout(r, 5))
  }
  expect(test()).toBe(true)
}

function laneC(display: MultiWaySyntenyDisplayModel) {
  return display.laneStack.lanes.find(l => l.assemblyName === C)!
}

function click(items: MenuItem[], label: string) {
  const item = items.find(
    i =>
      'label' in i && typeof i.label === 'string' && i.label.startsWith(label),
  )
  expect(item).toBeDefined()
  ;(item as { onClick: () => void }).onClick()
}

test('a lane names its other block, and its menu draws it and lets go', async () => {
  const { display } = createDisplayWithSession({
    trackAssemblyNames: [A, B, C],
    geneTracks: [],
    rpc: () => new Promise(() => {}),
  })
  display.setFeatures(STARTS.map((s, i) => record(i, s)))
  await until(() => display.laneDecisions.get(C) !== undefined)

  const drawn = display.laneDecisions.get(C)!
  expect(drawn.fitMin).toBeGreaterThan(APART)
  expect(drawn.alsoAt).toEqual([{ start: 20_100, end: 20_310 }])

  click(
    laneHeaderMenuItems(display, laneC(display)),
    'Show ctgB:20,101..20,310',
  )
  await until(() => display.laneDecisions.get(C)!.fitMax < APART)
  expect(display.laneDecisions.get(C)!.pinned).toBe(true)
  expect(display.laneDecisions.get(C)!.alsoAt).toEqual([
    { start: drawn.fitMin, end: drawn.fitMax },
  ])

  click(
    laneHeaderMenuItems(display, laneC(display)),
    'Let the lane choose where it draws',
  )
  await until(() => display.laneDecisions.get(C)!.fitMin > APART)
  expect(display.lanePins).toBeUndefined()
})

test('a lane pin and a flip pin ride the session, and come back with it', async () => {
  const { display } = createDisplayWithSession({
    trackAssemblyNames: [A, B, C],
    geneTracks: [],
    rpc: () => new Promise(() => {}),
  })
  display.setFeatures(STARTS.map((s, i) => record(i, s)))
  await until(() => display.laneDecisions.get(C) !== undefined)
  const unpinned = getSnapshot(display)

  display.pinLane(C, { refName: 'ctgB', at: 20_200 })
  await until(() => display.laneDecisions.get(C)!.fitMax < APART)
  const flipped = !display.laneDecisions.get(C)!.flipped
  display.flipLane(C)
  await until(() => display.laneDecisions.get(C)!.flipped === flipped)
  const pinned = getSnapshot(display)
  expect(pinned.lanePins).toEqual([
    { lane: C, refName: 'ctgB', at: 20_200 },
    { lane: C, refName: 'ctgB', flipped, anchor: A },
  ])

  applySnapshot(display, unpinned)
  await until(() => display.laneDecisions.get(C)!.fitMin > APART)
  expect(display.pinsInForce).toEqual([])

  applySnapshot(display, pinned)
  await until(() => display.laneDecisions.get(C)!.fitMax < APART)
  expect(display.laneDecisions.get(C)!.flipped).toBe(flipped)
  expect(display.laneDecisions.get(C)!.orientationPinned).toBe(true)
})
