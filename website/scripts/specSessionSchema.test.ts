/// <reference types="jest" />

import {
  redundantDisplayTypes,
  sessionSchemaProblems,
} from './specSessionSchema.ts'

import type { SessionUrlSpec } from './screenshot-spec-types.ts'

const spec = (session: object, config = 'c.json'): SessionUrlSpec => ({
  mode: 'url',
  name: 'a',
  url: `?config=${config}&session=spec-${encodeURIComponent(JSON.stringify(session))}`,
})
const problems = (session: object) =>
  sessionSchemaProblems([spec(session)]).join('\n')
const lgv = (track: object) => ({
  views: [{ type: 'LinearGenomeView', assembly: 'hg38', tracks: [track] }],
})

test('a track entry key the named display does not declare', () => {
  expect(
    problems(lgv({ trackId: 't', type: 'LinearAlignmentsDisplay', heigth: 3 })),
  ).toMatch('tracks[0].heigth')
})

test('a track entry key no display declares', () => {
  expect(problems(lgv({ trackId: 't', heigth: 3 }))).toMatch('tracks[0]')
})

test('a retired display type', () => {
  expect(
    problems(lgv({ trackId: 't', type: 'LinearPileupDisplay', height: 3 })),
  ).toMatch('tracks[0]')
})

test("a plugin display's keys pass unchecked", () => {
  expect(
    problems(
      lgv({ trackId: 't', type: 'LinearGraphDisplay', layoutMode: 'x' }),
    ),
  ).toBe('')
})

test('a session track adapter key', () => {
  expect(
    problems({
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 't',
          assemblyNames: ['hg38'],
          adapter: { type: 'BamAdapter', bamLocatoin: { uri: 'x.bam' } },
        },
      ],
    }),
  ).toMatch('did you mean "bamLocation"')
})

test('a stage url is checked too', () => {
  expect(
    sessionSchemaProblems([
      {
        mode: 'url',
        name: 'a',
        url: '?x',
        stages: [{ url: spec(lgv({ trackId: 't', heigth: 3 })).url }],
      },
    ]).join('\n'),
  ).toMatch('a stage 0')
})

const VOLVOX = 'test_data/volvox/config.json'

test('an entry naming no display is checked against the one it opens as', () => {
  expect(
    sessionSchemaProblems([
      spec(lgv({ trackId: 'volvox_bam', geneGlyphMode: 'all' }), VOLVOX),
    ]).join('\n'),
  ).toMatch('tracks[0]')
})

test('a type naming the display the track opens as anyway', () => {
  const redundant = (type: string) =>
    redundantDisplayTypes([spec(lgv({ trackId: 'volvox_bam', type }), VOLVOX)])
  expect(redundant('LinearAlignmentsDisplay').join('\n')).toMatch(
    '"volvox_bam" names type LinearAlignmentsDisplay',
  )
  expect(redundant('LinearMarkDisplay')).toEqual([])
})

test('a track outside the core plugins keeps its type', () => {
  expect(
    redundantDisplayTypes([
      spec(lgv({ trackId: 't', type: 'LinearBasicDisplay' })),
    ]),
  ).toEqual([])
})
