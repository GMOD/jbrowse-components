import { laneHeaderRows } from './laneHeader.ts'

import type { Lane } from './laneStack.ts'

const lane = {
  assemblyName: 'peach',
  isAnchor: false,
  hasAnnotation: true,
  glyphTop: 40,
  canon: (ref: string) => ref,
  frame: {
    refName: 'Pp1',
    min: -40,
    max: 1960,
    flipped: false,
    fitMin: 0,
    fitMax: 1000,
    alsoOn: [],
  },
} as unknown as Lane

// A live pan derives a frame's min from the pivot unclamped, so content near a
// contig's start can put it below zero. The menu's locstring clamps
// (`laneLocString`); the header prints the same coordinate through the same
// `frameStartBp`.
test('the header never prints a negative coordinate', () => {
  const [row] = laneHeaderRows([lane], 2000, '')
  expect(row!.label).toContain('Pp1:0')
  expect(row!.label).not.toContain('-40')
})
