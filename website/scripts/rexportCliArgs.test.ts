import { rExportCliArgs } from './rexportCliArgs.ts'

import type { RExportCli } from './screenshot-spec-types.ts'

const view = {
  type: 'LinearGenomeView',
  assembly: 'volvox',
  loc: 'ctgA:1-8,000',
  tracks: ['volvox_bam'],
}

const cli: RExportCli = {
  fasta: 'test_data/volvox/volvox.fa',
  tracks: [
    {
      trackId: 'volvox_bam',
      flag: 'bam',
      file: 'test_data/volvox/volvox-sorted.bam',
    },
  ],
}

const BASE = 'https://jbrowse.org/code/jb2/main/'

test('a repo-relative path is rewritten onto the hosted mirror, a url is not', () => {
  expect(
    rExportCliArgs('rexport/alignments', { ...cli, aliases: 'a/b.txt' }, view),
  ).toEqual([
    '--fasta',
    `${BASE}test_data/volvox/volvox.fa`,
    '--aliases',
    `${BASE}a/b.txt`,
    '--loc',
    'ctgA:1-8,000',
    '--bam',
    `${BASE}test_data/volvox/volvox-sorted.bam`,
  ])
  expect(
    rExportCliArgs(
      'x',
      { ...cli, fasta: 'https://example.com/ref.fa' },
      view,
    ).slice(0, 2),
  ).toEqual(['--fasta', 'https://example.com/ref.fa'])
})

// `--multiwig` takes its sources as one comma-separated value, and each of them
// is a path in its own right.
test('a file list is hosted per entry and joined with commas', () => {
  const args = rExportCliArgs(
    'x',
    {
      fasta: 'ref.fa',
      tracks: [
        {
          trackId: 'multi',
          flag: 'multiwig',
          file: ['a/v1.bw', 'https://example.com/v2.bw'],
        },
      ],
    },
    { ...view, tracks: ['multi'] },
  )
  expect(args.at(-1)).toBe(`${BASE}a/v1.bw,https://example.com/v2.bw`)
})

// The whole point of deriving rather than declaring: the loc and the display
// state come from the browser figure's own session spec.
test('the source view supplies the loc and each track its display state', () => {
  const args = rExportCliArgs('x', cli, {
    ...view,
    loc: 'ctgA:100-200',
    tracks: [{ trackId: 'volvox_bam', height: 300, showSoftClipping: true }],
  })
  expect(args).toContain('ctgA:100-200')
  expect(args.at(-1)).toBe('{"height":300,"showSoftClipping":true}')
})

// Inline keys ARE display props (normalizeTrackInit), and an explicit
// displaySnapshot wins over an inline key of the same name.
test('displaySnapshot folds in over the inline keys', () => {
  const args = rExportCliArgs('x', cli, {
    ...view,
    tracks: [
      {
        trackId: 'volvox_bam',
        height: 300,
        displaySnapshot: { height: 90, type: 'LinearAlignmentsDisplay' },
      },
    ],
  })
  expect(args.at(-1)).toBe('{"height":90}')
})

test('a declared {json} opt merges under the spec, non-JSON opts pass through', () => {
  const args = rExportCliArgs(
    'x',
    {
      ...cli,
      tracks: [
        {
          ...cli.tracks[0]!,
          opts: ['name:My reads', '{"showOnlyGenes":true,"height":10}'],
        },
      ],
    },
    { ...view, tracks: [{ trackId: 'volvox_bam', height: 300 }] },
  )
  expect(args.slice(-3)).toEqual([
    `${BASE}test_data/volvox/volvox-sorted.bam`,
    'name:My reads',
    '{"showOnlyGenes":true,"height":300}',
  ])
})

// A `type` the flag opens anyway is noise in the published command; anything
// else has to be asked for.
test('display: is emitted only for a non-default display', () => {
  const args = (type: string) =>
    rExportCliArgs('x', cli, {
      ...view,
      tracks: [{ trackId: 'volvox_bam', type }],
    })
  expect(args('LinearAlignmentsDisplay')).not.toContain(
    'display:LinearAlignmentsDisplay',
  )
  expect(args('LinearPileupDisplay')).toContain('display:LinearPileupDisplay')
})

test('a track the source shows and the cli does not name is an error', () => {
  expect(() =>
    rExportCliArgs('rexport/x', cli, {
      ...view,
      tracks: ['volvox_bam', 'genes'],
    }),
  ).toThrow(/cli names no file for genes/)
})

test('a dropped track is allowed, and does not shift panel order', () => {
  const args = rExportCliArgs(
    'x',
    { ...cli, dropTracks: [{ trackId: 'cpg', why: 'no adapter here' }] },
    { ...view, tracks: ['cpg', 'volvox_bam'] },
  )
  expect(args).toContain('--bam')
  expect(args.filter(a => a.startsWith('--'))).toEqual([
    '--fasta',
    '--loc',
    '--bam',
  ])
})

// Panel order follows argv order, so a reordered browser figure must not leave
// the published command stacking its panels differently from the picture.
test('cli.tracks listed out of the source order is an error', () => {
  expect(() =>
    rExportCliArgs(
      'rexport/x',
      {
        fasta: 'ref.fa',
        tracks: [
          { trackId: 'b', flag: 'bam', file: 'b.bam' },
          { trackId: 'a', flag: 'bam', file: 'a.bam' },
        ],
      },
      { ...view, tracks: ['a', 'b'] },
    ),
  ).toThrow(/ordered b, a but the source spec shows a, b/)
})

// The guard that keeps a new view setting from vanishing: the R export draws
// none of the listed chrome, so those are dropped; anything else stops the build.
test('a view setting with no file-flag equivalent is an error unless listed', () => {
  expect(() =>
    rExportCliArgs('rexport/x', cli, { ...view, showCenterLine: true }),
  ).not.toThrow()
  expect(() =>
    rExportCliArgs('rexport/x', cli, { ...view, stickyViewHeaders: true }),
  ).toThrow(/source view sets stickyViewHeaders/)
})
