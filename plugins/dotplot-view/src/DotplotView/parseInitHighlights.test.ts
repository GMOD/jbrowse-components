import { parseInitHighlights } from './afterAttach.ts'

const validRefNames = new Set(['ctgA'])
const assemblyManager = {
  isValidRefName: (r: string) => validRefNames.has(r),
} as any

test('parses a loc string and stamps the default assembly', () => {
  const [h] = parseInitHighlights(['ctgA:100-200'], assemblyManager, 'volvox')
  expect(h).toMatchObject({
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
  expect(parseInitHighlights([json], assemblyManager, 'volvox')).toEqual([
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
    parseInitHighlights([json], assemblyManager, 'volvox')[0],
  ).toMatchObject({
    assemblyName: 'volvox',
    color: undefined,
    label: undefined,
  })
})

test('mixes loc strings and JSON objects in one call', () => {
  const json = JSON.stringify({ refName: 'ctgB', start: 10, end: 20 })
  expect(
    parseInitHighlights(['ctgA:100-200', json], assemblyManager, 'volvox'),
  ).toHaveLength(2)
})
