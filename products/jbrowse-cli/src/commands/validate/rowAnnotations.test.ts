/**
 * @jest-environment node
 */
import { validateConfig } from './validateConfig.ts'

function problems(display: Record<string, unknown>) {
  return validateConfig({
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
        displays: [{ type: 'LinearVariantDisplay', ...display }],
      },
    ],
  }).problems.map(({ where, message }) => ({ where, message }))
}

// A bare string is the schema's plain string, so the refusals of `name` and
// of no field are the validator's to state, in the schema's words.
test.each([
  ['name', "field 'name' is the row itself"],
  ['', 'needs a field'],
])('rows.annotations entry %j is reported', (entry, message) => {
  expect(problems({ rows: { annotations: ['sex', entry] } })).toEqual([
    {
      where: 'tracks[0].displays[0].rows.annotations[1]',
      message: expect.stringContaining(message),
    },
  ])
})

test('rows.annotations on attributes is clean', () => {
  expect(
    problems({ rows: { annotations: ['sex', { field: 'population' }] } }),
  ).toEqual([])
})
