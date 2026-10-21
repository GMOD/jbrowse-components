/// <reference types="jest" />

import { sessionSchemaProblems } from './specSessionSchema.ts'

import type { SessionUrlSpec } from './screenshot-spec-types.ts'

const spec = (session: object): SessionUrlSpec => ({
  mode: 'url',
  name: 'a',
  url: `?config=c.json&session=spec-${encodeURIComponent(JSON.stringify(session))}`,
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
