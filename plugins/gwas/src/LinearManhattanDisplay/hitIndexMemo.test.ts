import Flatbush from '@jbrowse/core/util/flatbush'

import { manhattanFixture } from './manhattanFixture.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'

// Reference identity, not a spy: a reused index IS the same object, a rebuilt
// map is a fresh Map. Exact, and no mocking needed.
//
// `flatbushes` is a getter over the per-region store rather than a second
// observable map beside it, and its only reader is `findManhattanHit`, which
// runs in a pointer handler where nothing is tracked — so MobX suspends it and
// every rAF-coalesced mousemove rebuilds it unless the display holds it
// observed. `ManhattanHitIndexes` is that keep-alive, and this is what says so.

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

function makeResult(positions: number[]): ManhattanRpcResult {
  return manhattanFixture({
    x: positions,
    y: positions.map(() => 5),
    indexFound: true,
  })
}

describe('the hit-test indexes survive a frame', () => {
  it('hands back the same map and the same Flatbush across a pan', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setRpcData(0, makeResult([100, 200]), ctgA)
    const map = display.flatbushes
    const index = map.get(0)

    expect(index).toBeInstanceOf(Flatbush)
    view.scrollTo(view.offsetPx + 1)
    view.zoomTo(view.bpPerPx * 1.1)

    expect(display.flatbushes).toBe(map)
    expect(display.flatbushes.get(0)).toBe(index)
  })

  // The other half of what folding the Flatbush into the payload has to keep:
  // a second region arriving must not re-wrap the first. That was the reason
  // the wrapped indexes were a second map kept in lockstep with the data, and
  // wrapping at the commit is what makes it structural instead.
  it('does not re-wrap a region a later fetch did not touch', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, makeResult([100]), ctgA)
    const first = display.flatbushes.get(0)

    display.setRpcData(1, makeResult([300]), {
      ...ctgA,
      refName: 'ctgB',
    })

    expect(display.flatbushes.get(0)).toBe(first)
  })
})
