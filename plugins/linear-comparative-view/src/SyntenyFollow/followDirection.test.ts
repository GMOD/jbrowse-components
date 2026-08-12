import { followDirection, followDistance } from './followDirection.ts'

test('the ordinary pairwise view: the top row drives the bottom', () => {
  expect(followDirection(0, 0)).toEqual({
    stayingIndex: 0,
    movingIndex: 1,
    toMate: true,
  })
})

test('anchoring the bottom row of a pair reverses the direction', () => {
  // the same level, read the other way: the mate axis stays put and the query
  // axis is the one that moves
  expect(followDirection(0, 1)).toEqual({
    stayingIndex: 1,
    movingIndex: 0,
    toMate: false,
  })
})

test('a middle anchor propagates outward in both directions', () => {
  // rows 0,1,2 with row 1 anchored: level 0 pushes up, level 1 pushes down, and
  // both read row 1 — so neither level's move is an input to the other
  expect(followDirection(0, 1)).toMatchObject({
    stayingIndex: 1,
    movingIndex: 0,
  })
  expect(followDirection(1, 1)).toMatchObject({
    stayingIndex: 1,
    movingIndex: 2,
  })
})

test('a top anchor cascades down the stack one level at a time', () => {
  // each level's staying row is the row the level above it just placed, which
  // is what makes one outward pass settle the whole stack
  expect(followDirection(0, 0)).toMatchObject({
    stayingIndex: 0,
    movingIndex: 1,
  })
  expect(followDirection(1, 0)).toMatchObject({
    stayingIndex: 1,
    movingIndex: 2,
  })
  expect(followDirection(2, 0)).toMatchObject({
    stayingIndex: 2,
    movingIndex: 3,
  })
})

// The ordering the cascade above depends on. Only with a top anchor is it the
// same as level order, which is why sorting by it is not redundant.
test('distance counts levels out from the anchor, in both directions', () => {
  // four rows, middle anchor: levels 1 and 2 both touch row 2, then outward
  expect([0, 1, 2].map(l => followDistance(l, 2))).toEqual([1, 0, 0])
  // bottom anchor: the visiting order is the reverse of the level order
  expect([0, 1, 2].map(l => followDistance(l, 3))).toEqual([2, 1, 0])
  // top anchor: the one case where level order is already outward order
  expect([0, 1, 2].map(l => followDistance(l, 0))).toEqual([0, 1, 2])
})
