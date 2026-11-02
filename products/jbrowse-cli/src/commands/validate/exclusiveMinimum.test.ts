/**
 * @jest-environment node
 */
import { schemaProblems } from './schemaValidate.ts'

function configWith(track: Record<string, unknown>) {
  return {
    assemblies: [
      {
        name: 'hg38',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'hg38-ref',
          adapter: { type: 'BgzipFastaAdapter', uri: 'hg38.fa.gz' },
        },
      },
    ],
    tracks: [
      {
        type: 'VariantTrack',
        trackId: 'calls',
        name: 'Calls',
        assemblyNames: ['hg38'],
        adapter: { type: 'VcfTabixAdapter', uri: 'calls.vcf.gz' },
        ...track,
      },
    ],
  }
}

function stepProblems(track: Record<string, unknown>) {
  return schemaProblems(configWith(track)).map(({ where, message }) => ({
    where,
    message,
  }))
}

test('a step above 0, and "fit", pass', () => {
  expect(
    stepProblems({
      displays: [{ type: 'LinearVariantDisplay', rows: { step: 0.5 } }],
    }),
  ).toEqual([])
  expect(stepProblems({ displayDefaults: { rows: { step: 'fit' } } })).toEqual(
    [],
  )
})

test.each([0, -2])('a step of %d on a display entry is reported', step => {
  expect(
    stepProblems({
      displays: [{ type: 'LinearVariantDisplay', rows: { step } }],
    }),
  ).toEqual([
    {
      where: 'tracks[0].displays[0].rows.step',
      message: `expected a number above 0 or "fit", got ${step}`,
    },
  ])
})

test.each([0, -2])('a step of %d in displayDefaults is reported', step => {
  expect(stepProblems({ displayDefaults: { rows: { step } } })).toEqual([
    {
      where: 'tracks[0].displayDefaults.rows.step',
      message: `expected a number above 0 or "fit", got ${step}`,
    },
  ])
})

// a union beneath a member's reset is still the displayDefaults union's
// branch, so its failure is reported rather than shadowed by it
test('a step no display takes in displayDefaults is reported', () => {
  expect(stepProblems({ displayDefaults: { rows: { step: 'tall' } } })).toEqual(
    [
      {
        where: 'tracks[0].displayDefaults.rows.step',
        message: 'expected a number above 0 or "fit", got "tall"',
      },
    ],
  )
})
