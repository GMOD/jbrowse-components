import {
  batchCapture,
  readAnnotations,
  readBatch,
  readJson,
  readSpec,
} from './jsonArgs.ts'
import { assertCoherentOptions } from './url.ts'

import type { CaptureOptions } from './capture.ts'
import type { BatchEntry } from './jsonArgs.ts'

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
  expect(() => readBatch('[{"hub":"hg38","out":"a.png"}]')).toThrow(
    'batch capture 0 has a key no capture reads: "hub"',
  )
  expect(() => readBatch('{"out":"a.png"}')).toThrow(
    'the batch manifest must be a JSON array of captures',
  )
  expect(() => readBatch('[{"out":"a.png"},{"loc":"TP53"}]')).toThrow(
    'batch capture 1 has no "out" image path',
  )
})

test('a batch entry keeps the defaults it does not contradict', () => {
  const capture = batchCapture(
    { genome: 'hg38', tracks: ['clinvar'], width: 800 },
    { out: 'a.png', loc: 'TP53' },
  )
  expect(capture).toEqual({
    genome: 'hg38',
    tracks: ['clinvar'],
    width: 800,
    loc: 'TP53',
    out: 'a.png',
  })
  expect(() => {
    assertCoherentOptions(capture)
  }).not.toThrow()
})

test.each<[string, CaptureOptions, BatchEntry]>([
  [
    'a config over a default genome',
    { genome: 'hg38' },
    { out: 'a.png', config: 'https://example.org/config.json' },
  ],
  [
    'a genome over a default config',
    { config: 'https://example.org/config.json' },
    { out: 'a.png', genome: 'mm39' },
  ],
  [
    'a locus over a default spec',
    { genome: 'hg38', spec: { views: [] } },
    { out: 'a.png', loc: 'TP53' },
  ],
  [
    'a spec over a default locus and tracks',
    { genome: 'hg38', loc: 'BRCA1', tracks: ['clinvar'] },
    { out: 'a.png', spec: { views: [] } },
  ],
  [
    'a saved session over a default spec',
    { genome: 'hg38', spec: { views: [] } },
    { out: 'a.png', session: { session: { views: [] } } },
  ],
])('%s replaces it', (_name, defaults, entry) => {
  expect(() => {
    assertCoherentOptions(batchCapture(defaults, entry))
  }).not.toThrow()
})
