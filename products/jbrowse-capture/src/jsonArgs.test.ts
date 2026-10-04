import { readAnnotations, readJson, readSpec } from './jsonArgs.ts'

test('a session or spec is an object, and an array is refused rather than wrapped', () => {
  expect(() => readSpec('[{"type":"LinearGenomeView"}]')).toThrow(
    '--spec must be a JSON object',
  )
  expect(() => readJson('session', '[]')).toThrow(
    '--session must be a JSON object',
  )
  expect(readSpec('{"type":"LinearGenomeView"}')).toEqual({
    views: [{ type: 'LinearGenomeView' }],
  })
})

test('callouts are an array', () => {
  expect(readAnnotations(' [{"type":"box"}]')).toEqual([{ type: 'box' }])
  expect(() => readAnnotations('{"type":"box"}')).toThrow(
    '--annotations must be a JSON array of callouts',
  )
})
