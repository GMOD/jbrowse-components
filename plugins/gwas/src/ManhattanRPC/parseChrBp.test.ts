import { parseChrBp } from './parseChrBp.ts'

test('parses a plain chr:bp locus', () => {
  expect(parseChrBp('chr2:100')).toEqual({ refName: 'chr2', bp: 100 })
})

test('splits on the last colon so a colon-bearing refName survives', () => {
  expect(parseChrBp('HLA:x:200')).toEqual({ refName: 'HLA:x', bp: 200 })
})

test('a bare rsID (no colon) is not a placeable locus', () => {
  expect(parseChrBp('rs12345')).toBeUndefined()
})

test('a non-integer position is rejected', () => {
  expect(parseChrBp('chr2:1e3')).toBeUndefined()
  expect(parseChrBp('chr2:')).toBeUndefined()
  expect(parseChrBp('chr2: 100')).toBeUndefined()
})

test('an empty refName (leading colon) is rejected', () => {
  expect(parseChrBp(':100')).toBeUndefined()
})
