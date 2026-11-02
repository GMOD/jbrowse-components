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

function problems(track: Record<string, unknown>) {
  return schemaProblems(configWith(track)).map(({ where, message }) => ({
    where,
    message,
  }))
}

const NAME_PAIRS = { scale: { domain: ['HG002'], range: ['#f00'] } }

// Per-row pairs live only in rows.colors (ADR-257).
test('rows.color under name with a scale.domain is reported, pointing at rows.colors', () => {
  for (const color of [NAME_PAIRS, { field: 'name', ...NAME_PAIRS }]) {
    expect(
      problems({
        displays: [{ type: 'LinearVariantDisplay', rows: { color } }],
      }),
    ).toEqual([
      {
        where: 'tracks[0].displays[0].rows.color.scale.domain',
        message: expect.stringContaining('rows.colors'),
      },
    ])
  }
  expect(
    problems({ displayDefaults: { rows: { color: NAME_PAIRS } } }),
  ).toEqual([
    {
      where: 'tracks[0].displayDefaults.rows.color.scale.domain',
      message: expect.stringContaining('rows.colors'),
    },
  ])
})

test('rows.colors, a palette under name and pairs over an attribute pass', () => {
  expect(
    problems({
      displays: [
        {
          type: 'LinearVariantDisplay',
          rows: {
            colors: { HG002: '#f00' },
            color: { scale: { range: ['#00f'], unknown: '' } },
          },
        },
      ],
    }),
  ).toEqual([])
  expect(
    problems({
      displayDefaults: {
        rows: { color: { field: 'population', ...NAME_PAIRS } },
      },
    }),
  ).toEqual([])
})
