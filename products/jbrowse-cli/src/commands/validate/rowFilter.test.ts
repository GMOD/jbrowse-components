/**
 * @jest-environment node
 */
import { validateConfig } from './validateConfig.ts'

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

function problems(track: Record<string, unknown>) {
  return validateConfig(configWith(track)).problems.map(
    ({ where, message }) => ({ where, message }),
  )
}

// A row's identity names it, which rows.kept does (ADR-257). One schema rule
// covers the list, and its message names the entry's own field.
const IDENTITY_FIELDS = [
  'name',
  'sampleName',
  'sample',
  'source',
  'HP',
  'label',
  'color',
  'rowColor',
]

const identityProblem = (where: string, field: string) => ({
  where: `${where}.rows.filter[0].field`,
  message: `field '${field}' names a row rather than an attribute of one: a row's name goes in rows.kept, as kept: ['HG002']`,
})

test.each(IDENTITY_FIELDS)(
  'rows.filter on %s is reported, naming it and pointing at rows.kept',
  field => {
    expect(
      problems({
        displays: [
          {
            type: 'LinearVariantDisplay',
            rows: { filter: [{ field, oneOf: ['HG002'] }] },
          },
        ],
      }),
    ).toEqual([identityProblem('tracks[0].displays[0]', field)])
    expect(
      problems({
        displayDefaults: { rows: { filter: [{ field, equal: 'x' }] } },
      }),
    ).toEqual([identityProblem('tracks[0].displayDefaults', field)])
  },
)

test.each([
  [{ field: 'jexl:row.population == "EUR"', equal: true }],
  ['jexl:row.population == "EUR"'],
])('rows.filter on a jexl: expression %j is reported', entry => {
  expect(
    problems({
      displays: [
        {
          type: 'LinearVariantDisplay',
          rows: { filter: [entry] },
        },
      ],
    }),
  ).toEqual([
    {
      where: 'tracks[0].displays[0].rows.filter[0].field',
      message: expect.stringContaining('rows.filter computes none'),
    },
  ])
})

test('rows.filter on an attribute is clean', () => {
  expect(
    problems({
      displays: [
        {
          type: 'LinearVariantDisplay',
          rows: { filter: [{ field: 'population', oneOf: ['EUR'] }] },
        },
      ],
    }),
  ).toEqual([])
})

// The top-level filter tests variants, so an entry on an attribute the rows
// carry points at the rows' own filter.
test('a top-level filter on a stated row attribute points at rows.filter', () => {
  expect(
    problems({
      displays: [
        {
          type: 'LinearVariantDisplay',
          rows: { color: 'population' },
          filter: [{ field: 'population', equal: 'EUR' }],
        },
      ],
    }),
  ).toEqual([
    {
      where: 'tracks[0].displays[0].filter[0]',
      message: expect.stringContaining('rows.filter keeps rows'),
    },
  ])
  expect(
    problems({
      displayDefaults: {
        rows: { filter: [{ field: 'population', oneOf: ['AFR'] }] },
        filter: [{ field: 'population', equal: 'EUR' }],
      },
    }),
  ).toEqual([
    {
      where: 'tracks[0].displayDefaults.filter[0]',
      message: expect.stringContaining('rows.filter keeps rows'),
    },
  ])
})

test('a mark display points a top-level filter on group at rows.filter', () => {
  expect(
    problems({
      displays: [
        {
          type: 'LinearMultiRowFeatureDisplay',
          rows: { field: 'sample', groups: [{ match: '^A', group: 'A' }] },
          filter: [{ field: 'group', equal: 'A' }],
        },
      ],
    }),
  ).toEqual([
    {
      where: 'tracks[0].displays[0].filter[0]',
      message: expect.stringContaining('rows.filter keeps rows'),
    },
  ])
})
