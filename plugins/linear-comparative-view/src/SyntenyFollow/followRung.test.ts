import { followRung } from './followRung.ts'

const windows = [
  { refName: 'chr1', start: 0, end: 100 },
  { refName: 'chr2', start: 0, end: 50 },
]

test('no window is no rung', () => {
  expect(followRung([], undefined)).toBeUndefined()
})

test('one window is the single rung whatever was decided', () => {
  expect(followRung([windows[0]!], { spreading: false, onto: 'chr2' })).toEqual(
    { kind: 'single', window: windows[0] },
  )
})

test('several windows spread until the settle refuses', () => {
  expect(followRung(windows, undefined)).toEqual({ kind: 'spread' })
  expect(followRung(windows, { spreading: true })).toEqual({ kind: 'spread' })
})

test('a refusal places from the contig it was refused onto', () => {
  expect(followRung(windows, { spreading: false, onto: 'chr2' })).toEqual({
    kind: 'single',
    window: windows[1],
  })
})

test('and from the widest window once that contig has scrolled off', () => {
  expect(followRung(windows, { spreading: false, onto: 'chr7' })).toEqual({
    kind: 'single',
    window: windows[0],
  })
})
