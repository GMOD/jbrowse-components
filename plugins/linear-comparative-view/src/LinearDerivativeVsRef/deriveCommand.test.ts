import { alignmentFileOf, deriveCommand, deriveLoci } from './deriveCommand.ts'

import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

function candidate(
  observed: { refName: string; start: number; end: number; strand?: number }[],
  flank = 2000,
): DerivativeCandidate {
  const observedSegments = observed.map(s => ({ strand: 1, ...s }))
  const last = observedSegments.length - 1
  return {
    segments: observedSegments.map((s, i) => ({
      ...s,
      start: i === 0 ? s.start - flank : s.start,
      end: i === last ? s.end + flank : s.end,
    })),
    observedSegments,
    readCount: 28,
    pathId: observed.map(s => `${s.refName}:${s.start}`).join('|'),
    locString: '',
    refNames: [...new Set(observed.map(s => s.refName))],
    extendsOffScreen: false,
  }
}

const der3 = candidate([
  { refName: 'chr3', start: 25326821, end: 25359568 },
  { refName: 'chr10', start: 58717463, end: 58717662 },
  { refName: 'chr12', start: 72273111, end: 72273294, strand: -1 },
  { refName: 'chr3', start: 25352683, end: 25359111, strand: -1 },
])

test('both sides of every junction, in path order, off the observed segments', () => {
  expect(deriveLoci(der3)).toEqual([
    'chr3:25359568',
    'chr10:58717463',
    'chr10:58717662',
    'chr12:72273294',
    'chr12:72273111',
    'chr3:25359111',
  ])
})

test('an inverted segment is entered at its high coordinate', () => {
  const loci = deriveLoci(
    candidate([
      { refName: 'chrA', start: 0, end: 20000 },
      { refName: 'chrA', start: 10000, end: 16000, strand: -1 },
    ]),
  )
  expect(loci).toEqual(['chrA:20000', 'chrA:16000'])
})

test('the command names the track file when the adapter has one', () => {
  expect(deriveCommand(der3, 'https://example.org/COLO829_tumor.cram')).toBe(
    [
      'python3 sv_multihop.py derive',
      '--aln https://example.org/COLO829_tumor.cram',
      '--ref <reference.fa>',
      '--loci chr3:25359568,chr10:58717463,chr10:58717662,chr12:72273294,chr12:72273111,chr3:25359111',
      '--out der_chr3_chr10_chr12 --name der_chr3_chr10_chr12',
    ].join(' \\\n  '),
  )
})

test('a track with no file leaves a placeholder rather than an empty flag', () => {
  expect(deriveCommand(der3, undefined)).toContain('--aln <reads.bam>')
})

test('the alignment file comes from either adapter type', () => {
  expect(
    alignmentFileOf({
      bamLocation: { uri: 'a.bam', locationType: 'UriLocation' },
    }),
  ).toBe('a.bam')
  expect(
    alignmentFileOf({
      cramLocation: { uri: 'a.cram', locationType: 'UriLocation' },
    }),
  ).toBe('a.cram')
  expect(
    alignmentFileOf({
      bamLocation: { localPath: '/d/a.bam', locationType: 'LocalPathLocation' },
    }),
  ).toBe('/d/a.bam')
  expect(alignmentFileOf({})).toBeUndefined()
})
