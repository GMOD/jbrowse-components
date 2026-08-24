import { deepMerge } from './deepMerge.ts'

test('nested objects merge key by key', () => {
  expect(
    deepMerge(
      { palette: { primary: { main: 'blue' }, secondary: { main: 'red' } } },
      { palette: { primary: { main: 'green' } } },
    ),
  ).toEqual({
    palette: { primary: { main: 'green' }, secondary: { main: 'red' } },
  })
})

test('an array replaces rather than concatenating', () => {
  expect(
    deepMerge({ assemblyNames: ['hg38'] }, { assemblyNames: ['hg19', 'mm10'] }),
  ).toEqual({ assemblyNames: ['hg19', 'mm10'] })
})

test('a scalar overriding an object, and an object overriding a scalar', () => {
  expect(deepMerge({ a: { b: 1 } }, { a: 2 })).toEqual({ a: 2 })
  expect(deepMerge({ a: 2 }, { a: { b: 1 } })).toEqual({ a: { b: 1 } })
})

test('keys only one side has survive', () => {
  expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
})

test('neither operand is aliased by the result', () => {
  const base = { adapter: { uri: 'a.bam' }, tags: ['x'] }
  const merged = deepMerge(base, { adapter: { index: 'a.bai' } })
  merged.adapter.uri = 'mutated'
  merged.tags.push('y')
  expect(base.adapter.uri).toBe('a.bam')
  expect(base.tags).toEqual(['x'])
})

test('the override contributes keys the base type never declared', () => {
  const base = { trackId: 't1', type: 'AlignmentsTrack' }
  expect(deepMerge(base, { adapter: { type: 'BamAdapter' } })).toEqual({
    trackId: 't1',
    type: 'AlignmentsTrack',
    adapter: { type: 'BamAdapter' },
  })
})
