import {
  DASH,
  SPACE,
  firstDrawn,
  isGapByte,
  isUnknownBase,
  lastDrawn,
  sameBase,
} from './alignedBytes.ts'

const code = (c: string) => c.charCodeAt(0)

test('a gap and row padding are no base, and an N is a base', () => {
  expect(isGapByte(DASH)).toBe(true)
  expect(isGapByte(SPACE)).toBe(true)
  for (const c of 'ACGTacgtNn') {
    expect(isGapByte(code(c))).toBe(false)
  }
})

test('an N in either case is the unknown base, and nothing else is', () => {
  expect(isUnknownBase(code('N'))).toBe(true)
  expect(isUnknownBase(code('n'))).toBe(true)
  for (const c of 'ACGTacgt-') {
    expect(isUnknownBase(code(c))).toBe(false)
  }
})

test('bases match regardless of case', () => {
  expect(sameBase(code('a'), code('A'))).toBe(true)
  expect(sameBase(code('a'), code('C'))).toBe(false)
})

test('the drawn columns skip the gap runs at either end', () => {
  const bytes = new TextEncoder().encode('xx--AC-G-- ')
  const first = firstDrawn(bytes, 2, 9)
  expect(first).toBe(2)
  expect(lastDrawn(bytes, 2, 9, first)).toBe(5)
  const empty = new TextEncoder().encode('---')
  expect(firstDrawn(empty, 0, 3)).toBe(3)
})
