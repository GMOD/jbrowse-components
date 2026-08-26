import { contactsForRecord, isOffDiagonalOnly } from './contactChannels.ts'

import type { AlignmentRecord } from './contactChannels.ts'

const PAIRED = 0x1
const REVERSE = 0x10
const MATE_REVERSE = 0x20
const FIRST_IN_PAIR = 0x40
const SECONDARY = 0x100

function read(overrides: Partial<AlignmentRecord> = {}): AlignmentRecord {
  return {
    refName: '7',
    start: 1000,
    end: 1148,
    strand: 1,
    flags: PAIRED | FIRST_IN_PAIR,
    nextRefName: '7',
    nextPos: 1300,
    ...overrides,
  }
}

const discordant = { channel: 'discordant', minSpan: 1000 } as const
const sameStrand = { channel: 'sameStrand', minSpan: 1000 } as const
const outward = { channel: 'outward', minSpan: 1000 } as const

test('a proper pair inside minSpan is not discordant', () => {
  expect(contactsForRecord(read(), discordant)).toEqual([])
})

test('a pair 10kb apart is one discordant contact', () => {
  expect(contactsForRecord(read({ nextPos: 11000 }), discordant)).toEqual([
    { refName: '7', pos1: 1000, pos2: 11000 },
  ])
})

test('only the lower-positioned mate emits, so a pair is counted once', () => {
  const mate = read({
    start: 11000,
    end: 11148,
    nextPos: 1000,
    flags: PAIRED | REVERSE,
    strand: -1,
  })
  expect(contactsForRecord(mate, discordant)).toEqual([])
})

test('mates sharing a start are broken by first-in-pair', () => {
  const opts = { channel: 'discordant', minSpan: 0 } as const
  expect(contactsForRecord(read({ nextPos: 1000 }), opts)).toHaveLength(1)
  expect(
    contactsForRecord(read({ nextPos: 1000, flags: PAIRED }), opts),
  ).toEqual([])
})

test('a mate on another reference contributes nothing', () => {
  expect(
    contactsForRecord(read({ nextRefName: '8', nextPos: 11000 }), discordant),
  ).toEqual([])
})

test('a secondary alignment contributes nothing', () => {
  expect(
    contactsForRecord(
      read({ nextPos: 11000, flags: PAIRED | FIRST_IN_PAIR | SECONDARY }),
      discordant,
    ),
  ).toEqual([])
})

test('an SA split segment is a discordant contact of its own', () => {
  const split = read({
    nextPos: 1300,
    sa: '7,20001,+,100S48M,60,0;',
  })
  expect(contactsForRecord(split, discordant)).toEqual([
    { refName: '7', pos1: 1000, pos2: 20000 },
  ])
})

test('an SA segment on another reference is skipped', () => {
  expect(
    contactsForRecord(read({ sa: '8,20001,+,100S48M,60,0;' }), discordant),
  ).toEqual([])
})

test('splits are not counted on the other channels', () => {
  const split = read({
    sa: '7,20001,+,100S48M,60,0;',
    flags: PAIRED | FIRST_IN_PAIR | MATE_REVERSE,
  })
  expect(contactsForRecord(split, sameStrand)).toEqual([])
  expect(contactsForRecord(split, outward)).toEqual([])
})

test('a same-strand pair is a sameStrand contact', () => {
  const ll = read({ nextPos: 20000, flags: PAIRED | FIRST_IN_PAIR })
  expect(contactsForRecord(ll, sameStrand)).toEqual([
    { refName: '7', pos1: 1000, pos2: 20000 },
  ])
  const rr = read({
    nextPos: 20000,
    strand: -1,
    flags: PAIRED | FIRST_IN_PAIR | REVERSE | MATE_REVERSE,
  })
  expect(contactsForRecord(rr, sameStrand)).toEqual([
    { refName: '7', pos1: 1000, pos2: 20000 },
  ])
})

test('an FR pair is not a sameStrand contact', () => {
  const fr = read({
    nextPos: 20000,
    flags: PAIRED | FIRST_IN_PAIR | MATE_REVERSE,
  })
  expect(contactsForRecord(fr, sameStrand)).toEqual([])
})

test('a same-strand pair is not counted as outward either', () => {
  const ll = read({ start: 20000, end: 20148, nextPos: 1000 })
  expect(contactsForRecord(ll, outward)).toEqual([])
})

test('an everted pair is an outward contact, emitted by the forward read', () => {
  const forward = read({
    start: 20000,
    end: 20148,
    nextPos: 1000,
    flags: PAIRED | FIRST_IN_PAIR | MATE_REVERSE,
  })
  expect(contactsForRecord(forward, outward)).toEqual([
    { refName: '7', pos1: 1000, pos2: 20000 },
  ])
  const reverseMate = read({
    start: 1000,
    end: 1148,
    nextPos: 20000,
    strand: -1,
    flags: PAIRED | REVERSE,
  })
  expect(contactsForRecord(reverseMate, outward)).toEqual([])
})

test('a forward read within 5bp of its mate is not everted', () => {
  const barely = read({
    start: 1005,
    end: 1153,
    nextPos: 1000,
    flags: PAIRED | FIRST_IN_PAIR | MATE_REVERSE,
  })
  expect(contactsForRecord(barely, outward)).toEqual([])
})

test('the orientation channels are off-diagonal only', () => {
  expect(isOffDiagonalOnly('sameStrand')).toBe(true)
  expect(isOffDiagonalOnly('outward')).toBe(true)
  expect(isOffDiagonalOnly('discordant')).toBe(false)
  expect(isOffDiagonalOnly('depthDifference')).toBe(false)
})
