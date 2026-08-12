import { followDirection } from './followDirection.ts'

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
