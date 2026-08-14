import { parseInitHighlights } from './afterAttach.ts'

const validRefNames = new Set(['ctgA'])
const assemblyManager = {
  isValidRefName: (r: string) => validRefNames.has(r),
} as any

// A dotplot is the one view with two assemblies, so which one a refName is
// validated against is a real question. `volvox` has ctgA; `other` has ctgB.
const twoAssemblies = {
  isValidRefName: (r: string, asm: string) =>
    asm === 'other' ? r === 'ctgB' : r === 'ctgA',
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

// The band is routed to an axis by assemblyName (see axisHighlightRegion), so
// overwriting the one the locstring named put it on the wrong axis silently — at
// the other assembly's coordinates.
test('a {assembly}-prefixed loc string keeps the assembly it named', () => {
  const { highlights, errors } = parseInitHighlights(
    ['{other}ctgB:100-200'],
    twoAssemblies,
    'volvox',
  )
  expect(errors).toEqual([])
  expect(highlights[0]).toMatchObject({
    refName: 'ctgB',
    start: 99,
    end: 200,
    assemblyName: 'other',
  })
})

// and the refName is validated against that assembly, not the default: ctgB is
// unknown to volvox, so checking it there rejected the entry outright
test('a prefixed loc string validates against the assembly it named', () => {
  expect(
    parseInitHighlights(['{volvox}ctgA:1-2'], twoAssemblies, 'volvox')
      .highlights[0],
  ).toMatchObject({ refName: 'ctgA', assemblyName: 'volvox' })
  expect(
    parseInitHighlights(['{other}ctgA:1-2'], twoAssemblies, 'volvox').errors,
  ).toHaveLength(1)
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
