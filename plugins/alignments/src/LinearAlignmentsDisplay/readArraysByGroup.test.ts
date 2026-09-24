import { namesToBlock } from '@jbrowse/alignments-core'

import {
  bootAlignmentsDisplay,
  makeEmptyAlignmentsResult,
  makeEmptyPileupData,
} from './testUtils.ts'

// n reads covering one span, so the layout stacks them n rows deep
function stackedReads(n: number) {
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

function seed(n: number) {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay()
  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
    getCanonicalRefName2: (refName: string) => refName,
  }
  const Session = baseSession.volatile(() => ({
    rpcManager: {
      call: jest.fn(() => Promise.resolve(makeEmptyAlignmentsResult())),
    },
    assemblyManager: {
      get: (name: string) => (name === 'volvox' ? asm : undefined),
      isValidRefName: () => true,
    },
  }))
  const { view, display } = mount(Session)
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  display.setRpcData(
    0,
    { groups: [{ key: '', label: '', data: stackedReads(n) }] },
    { refName: 'ctgA', start: 0, end: 10_000, assemblyName: 'volvox' },
  )
  return display
}

// The breakpoint split view connects a read past the row cap too: it is still
// in the arrays, and its rect is the overflow row the pileup draws it on.
test('a read past the row cap keeps a rect, on the overflow row', () => {
  const display = seed(40)
  display.setMaxHeight(40)

  expect(display.readArraysByGroup.get('')?.get(0)?.readKeys).toHaveLength(40)
  const tops = Array.from(
    { length: 40 },
    (_, i) => display.readLayoutRecord('', 0, i)?.[1],
  )
  expect(tops.every(t => t !== undefined)).toBe(true)
  expect(tops[39]).toBe(Math.max(...(tops as number[])))
  expect(new Set(tops).size).toBeLessThan(40)
})

// An overlay holds the method apart from the display it came from
test('readLayoutRecord answers when called detached', () => {
  const { readLayoutRecord } = seed(2)
  expect(readLayoutRecord('', 0, 1)).toEqual([
    1000,
    expect.any(Number),
    1100,
    expect.any(Number),
  ])
})
