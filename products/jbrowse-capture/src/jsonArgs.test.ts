import { readAnnotations, readBatch, readJson, readSpec } from './jsonArgs.ts'

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
  expect(
    readAnnotations(' [{"type":"box","x":1,"y":2,"width":3,"height":4}]'),
  ).toHaveLength(1)
  expect(() => readAnnotations('{"type":"box"}')).toThrow(
    '--annotations must be a JSON array of callouts',
  )
})

test('a JSON syntax error names the flag', () => {
  expect(() => readSpec('{bad')).toThrow(/^--spec: /)
  expect(() => readJson('session', '{bad')).toThrow(/^--session: /)
  expect(() => readAnnotations('[bad')).toThrow(/^--annotations: /)
})

test('a batch manifest is an array whose every capture names its image', () => {
  expect(readBatch('[{"loc":"BRCA1","out":"a.png"}]')).toEqual([
    { loc: 'BRCA1', out: 'a.png' },
  ])
  expect(() => readBatch('{"out":"a.png"}')).toThrow(
    'the batch manifest must be a JSON array of captures',
  )
  expect(() => readBatch('[{"out":"a.png"},{"loc":"TP53"}]')).toThrow(
    'batch capture 1 has no "out" image path',
  )
})
