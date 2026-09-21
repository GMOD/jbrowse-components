import { SimpleFeature } from '@jbrowse/core/util'
import { when } from 'mobx'

import { captureStackViewports } from '../LinearSyntenyViewHelper/offscreenMateNav.ts'
import { createDisplayWithSession } from './testEnv.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'

// testAssembly() answers every name as volvox, so `reanchor` does not move the
// anchor here; these navigate the view onto the other genome directly

const A = 'volvox'
const B = 'volvox_random'
const C = 'volvox_ins'

interface Side {
  assemblyName: string
  refName: string
  start: number
}

function record(
  id: string,
  name: string,
  anchor: Side,
  mate: Side,
  strand = 1,
) {
  return new SimpleFeature({
    uniqueId: id,
    name,
    refName: anchor.refName,
    start: anchor.start,
    end: anchor.start + 60,
    strand,
    assemblyName: anchor.assemblyName,
    mate: { ...mate, end: mate.start + 60 },
  })
}

const on = (assemblyName: string, start: number, refName = 'ctgA') => ({
  assemblyName,
  refName,
  start,
})
const onC = (start: number) => on(C, 20_000 + start, 'ctgB')

function setup() {
  const { display } = createDisplayWithSession({
    trackAssemblyNames: [A, B, C],
    geneTracks: [],
    rpc: () => new Promise(() => {}),
  })
  return display
}

async function settled(display: MultiWaySyntenyDisplayModel) {
  for (let i = 0; i < 200 && display.laneDecisions.size === 0; i++) {
    await new Promise(r => setTimeout(r, 5))
  }
  expect(display.laneDecisions.size).toBeGreaterThan(0)
}

function onto(display: MultiWaySyntenyDisplayModel, assemblyName: string) {
  display.lgv.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 1000, assemblyName },
  ])
}

// how far each group's placement on `lane` sits from its anchor placement
function slipOf(display: MultiWaySyntenyDisplayModel, lane: string) {
  const { lanes } = display.laneStack
  const anchor = lanes[0]!
  const mate = lanes.find(l => l.assemblyName === lane)!
  return [...mate.placements].flatMap(([key, { spans }]) => {
    const a = anchor.placements.get(key)?.spans[0]
    const m = spans[0]
    return a && m ? [Math.round((m[0] + m[1]) / 2 - (a[0] + a[1]) / 2)] : []
  })
}

const flippedOf = (display: MultiWaySyntenyDisplayModel, lane: string) =>
  display.laneDecisions.get(lane)?.flipped

test('the lanes line up under the new anchor where both genomes spell the contig alike', async () => {
  const starts = [100, 250, 400, 550, 700]
  const display = setup()
  display.setFeatures(
    starts.flatMap((s, i) => [
      record(`aC${i}`, `g${i}`, on(A, s), onC(s)),
      ...(i < 4 ? [record(`aB${i}`, `g${i}`, on(A, s), on(B, s + 150))] : []),
    ]),
  )
  await settled(display)
  expect(slipOf(display, C).every(d => d === 0)).toBe(true)

  onto(display, B)
  display.setFeatures(
    starts.flatMap((s, i) => [
      record(`bC${i}`, `g${i}`, on(B, s + 150), onC(s)),
      ...(i < 4 ? [record(`bA${i}`, `g${i}`, on(B, s + 150), on(A, s))] : []),
    ]),
  )
  const slip = slipOf(display, C)
  expect(slip.length).toBeGreaterThan(0)
  expect(slip.every(d => d === 0)).toBe(true)
})

// four shared groups are under the five the deadband needs to mirror a lane,
// so an old genome's forward reading held through the settle would stick
test('an inverted lane flips under the new anchor rather than keeping the old reading', async () => {
  const starts = [100, 250, 400, 550]
  const display = setup()
  display.setFeatures(
    starts.flatMap((s, i) => [
      record(`aC${i}`, `g${i}`, on(A, s), onC(s)),
      ...(i < 3
        ? [record(`aB${i}`, `g${i}`, on(A, s), on(B, 700 - s), -1)]
        : []),
    ]),
  )
  await settled(display)
  expect(flippedOf(display, C)).toBe(false)

  onto(display, B)
  display.setFeatures(
    starts.flatMap((s, i) => [
      record(`bC${i}`, `g${i}`, on(B, 700 - s), onC(s), -1),
      ...(i < 3
        ? [record(`bA${i}`, `g${i}`, on(B, 700 - s), on(A, s), -1)]
        : []),
    ]),
  )
  expect(flippedOf(display, C)).toBe(true)
})

// B places a fifth gene on C, enough to mirror the lane there even against an
// incumbent; back on A the four shared groups cannot mirror it again, so B's
// reading carried through the Undo would stick
test('Undo back onto the first genome decides from its own groups again', async () => {
  const display = setup()
  const aFeatures = [100, 250, 400, 550].flatMap((s, i) => [
    record(`aC${i}`, `g${i}`, on(A, s), onC(s)),
    record(`aB${i}`, `g${i}`, on(A, s), on(B, 800 - s), -1),
  ])
  display.setFeatures(aFeatures)
  await settled(display)
  expect(flippedOf(display, C)).toBe(false)

  const undo = captureStackViewports([display.lgv])
  onto(display, B)
  display.setFeatures(
    [100, 250, 400, 550, 700].flatMap((s, i) => [
      record(`bC${i}`, `g${i}`, on(B, 800 - s), onC(s), -1),
      ...(i < 4
        ? [record(`bA${i}`, `g${i}`, on(B, 800 - s), on(A, s), -1)]
        : []),
    ]),
  )
  expect(flippedOf(display, C)).toBe(true)

  undo()
  expect(display.anchorAssemblyName).toBe(A)
  display.setFeatures(aFeatures)
  expect(flippedOf(display, C)).toBe(false)
})

// a fetch issued before the navigation can still land after it, before the
// debounced refetch supersedes it
test('a fetch landing after the navigation is labelled with the anchor it asked on', async () => {
  const landings: ((features: SimpleFeature[]) => void)[] = []
  const { display } = createDisplayWithSession({
    trackAssemblyNames: [A, B, C],
    geneTracks: [],
    rpc: name =>
      name === 'CoreGetFeatures'
        ? new Promise(resolve => landings.push(resolve))
        : Promise.resolve([]),
  })
  for (let i = 0; i < 200 && landings.length === 0; i++) {
    await new Promise(r => setTimeout(r, 5))
  }
  onto(display, B)
  landings[0]!(
    [100, 250, 400, 550].map((s, i) =>
      record(`aC${i}`, `g${i}`, on(A, s), onC(s)),
    ),
  )
  await when(() => display.fetchedFeatures !== undefined, { timeout: 5000 })
  expect(display.features).toBeUndefined()
  expect(display.laneDecisions.size).toBe(0)
})
