import { parseInitHighlights } from './afterAttach.ts'

const validRefNames = new Set(['ctgA'])
const assemblyManager = {
  isValidRefName: (r: string) => validRefNames.has(r),
} as any

test('parses a loc string and stamps the default assembly', () => {
  const { highlights, errors } = parseInitHighlights(
    ['ctgA:100-200'],
    assemblyManager,
    'volvox',
  )
  expect(errors).toEqual([])
  expect(highlights[0]).toMatchObject({
    refName: 'ctgA',
    end: 200,
    assemblyName: 'volvox',
  })
})

test('parses a JSON object carrying color/label and its own assemblyName', () => {
  const json = JSON.stringify({
    refName: 'ctgB',
    start: 10,
    end: 20,
    assemblyName: 'other',
    color: 'rgba(1,2,3,0.3)',
    label: 'roi',
  })
  expect(
    parseInitHighlights([json], assemblyManager, 'volvox').highlights,
  ).toEqual([
    {
      refName: 'ctgB',
      start: 10,
      end: 20,
      assemblyName: 'other',
      color: 'rgba(1,2,3,0.3)',
      label: 'roi',
    },
  ])
})

test('JSON without assemblyName falls back to the default', () => {
  const json = JSON.stringify({ refName: 'ctgB', start: 10, end: 20 })
  expect(
    parseInitHighlights([json], assemblyManager, 'volvox').highlights[0],
  ).toMatchObject({
    assemblyName: 'volvox',
    color: undefined,
    label: undefined,
  })
})

test('mixes loc strings and JSON objects in one call', () => {
  const json = JSON.stringify({ refName: 'ctgB', start: 10, end: 20 })
  expect(
    parseInitHighlights(['ctgA:100-200', json], assemblyManager, 'volvox')
      .highlights,
  ).toHaveLength(2)
})

// a typo'd refName used to throw out of the whole init autorun, skipping the
// sibling highlights and the loc-nav that runs after them
test('a bad entry is reported without taking out its siblings', () => {
  const { highlights, errors } = parseInitHighlights(
    ['ctgA:100-200', 'nope:1-2', 'ctgA:300-400'],
    assemblyManager,
    'volvox',
  )
  expect(highlights).toHaveLength(2)
  expect(highlights.map(h => h.start)).toEqual([99, 299])
  expect(errors).toHaveLength(1)
  expect(errors[0]!.entry).toBe('nope:1-2')
})
