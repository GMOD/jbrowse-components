import { parseArgs } from './args.ts'

test('a typical invocation', () => {
  const args = parseArgs([
    '--genome',
    'hg38',
    '--loc',
    'BRCA1',
    '--track',
    'hg38-ncbiRefSeqCurated',
    '--track',
    'hg38-clinvarMain',
    '-o',
    'out.png',
  ])
  expect(args.genome).toBe('hg38')
  expect(args.loc).toBe('BRCA1')
  expect(args.tracks).toEqual(['hg38-ncbiRefSeqCurated', 'hg38-clinvarMain'])
  expect(args.out).toBe('out.png')
})

test('a viewport is a whole number of pixels', () => {
  expect(() => parseArgs(['--width', '1400.5'])).toThrow(
    '--width needs a whole number, got "1400.5"',
  )
  expect(parseArgs(['--dpr', '1.5']).dpr).toBe(1.5)
})

test('only one JSON flag reads stdin', () => {
  expect(() => parseArgs(['--spec', '-', '--annotations', '-'])).toThrow(
    '--spec and --annotations cannot both read stdin',
  )
  expect(parseArgs(['--spec', '-', '--annotations', '[]']).spec).toBe('-')
})

test('--name=value and flags', () => {
  const args = parseArgs(['--width=1600', '--headed', '--fullPage'])
  expect(args.width).toBe(1600)
  expect(args.headed).toBe(true)
  expect(args.fullPage).toBe(true)
  expect(args.verbose).toBe(false)
})

// a dash opens a flag, so a value that starts with one is written with =
test('a locstring with a leading dash needs the = form', () => {
  expect(parseArgs(['--loc=-1:100-200']).loc).toBe('-1:100-200')
  expect(() => parseArgs(['--loc', '-1:100-200'])).toThrow(
    '--loc needs a value; write one that starts with a dash as --loc=<value>',
  )
})

test('an unknown flag is an error, not a silent no-op', () => {
  expect(() => parseArgs(['--tracks', 'a,b'])).toThrow(
    "Unknown option '--tracks'",
  )
})

test('a missing value is an error', () => {
  expect(() => parseArgs(['--genome'])).toThrow('--genome needs a value')
})

test('a non-numeric size is an error', () => {
  expect(() => parseArgs(['--width', 'wide'])).toThrow(
    '--width needs a number, got "wide"',
  )
})

test('a switch takes true or false, as jb2export and Desktop read one', () => {
  expect(parseArgs(['--fullPage=false']).fullPage).toBe(false)
  expect(parseArgs(['--fullPage', 'true']).fullPage).toBe(true)
  expect(() => parseArgs(['--fullPage=yes'])).toThrow(
    '--fullPage takes true or false, got "yes"',
  )
})

// A negative reaches the range check only in the `=` form; the separated form
// is the dash ambiguity above. Either way it never reaches puppeteer, which is
// the property that matters — a zero size fails there naming neither the flag
// nor the value.
test('a zero or negative viewport dimension is an error', () => {
  expect(() => parseArgs(['--dpr', '0'])).toThrow(
    '--dpr needs a positive number, got "0"',
  )
  expect(() => parseArgs(['--width=-5'])).toThrow(
    '--width needs a positive number, got "-5"',
  )
  expect(() => parseArgs(['--width', '-5'])).toThrow('--width needs a value')
})

// `--timeout 0` means "no timeout at all" to puppeteer and "already expired" to
// the waits polled from node, so the run either hangs forever or fails instantly
// depending on which stage it reaches.
test('a zero or negative timeout is an error', () => {
  expect(() => parseArgs(['--timeout', '0'])).toThrow(
    '--timeout needs a positive number, got "0"',
  )
  expect(() => parseArgs(['--timeout=-1'])).toThrow(
    '--timeout needs a positive number, got "-1"',
  )
})

test('a bare positional is an error', () => {
  expect(() => parseArgs(['hg38'])).toThrow("Unexpected argument 'hg38'")
})

test('list takes its genome and filter as positionals, and still rejects flags', () => {
  const args = parseArgs(['list', 'hg38', 'conservation'])
  expect(args.command).toBe('list')
  expect(args.positionals).toEqual(['hg38', 'conservation'])
  expect(() => parseArgs(['list', 'hg38', '--foo'])).toThrow(
    "Unknown option '--foo'",
  )
})

test('a subcommand refuses a flag it does not use', () => {
  expect(parseArgs(['url', '--genome', 'hg38']).genome).toBe('hg38')
  expect(() => parseArgs(['url', '--genome', 'hg38', '-o', 'x.png'])).toThrow(
    '-o does not apply to `jb2capture url`',
  )
  expect(() => parseArgs(['list', '--genome', 'hg38'])).toThrow(
    '--genome does not apply to `jb2capture list`',
  )
  expect(parseArgs(['url', '--help']).help).toBe(true)
})

// a url carries no callouts, so the flag that draws them is a capture's alone
test('--annotations is a capture flag', () => {
  expect(parseArgs(['--annotations', 'callouts.json']).annotations).toBe(
    'callouts.json',
  )
  expect(() =>
    parseArgs(['url', '--genome', 'hg38', '--annotations', 'callouts.json']),
  ).toThrow('--annotations does not apply to `jb2capture url`')
})

test('anything else is a capture', () => {
  expect(parseArgs(['--genome', 'hg38', '-o', 'x.png']).command).toBe('capture')
})

test.each(['--constructor', '--toString'])(
  'an inherited Object key is still an unknown flag (%s)',
  flag => {
    expect(() => parseArgs([flag, 'x'])).toThrow('Unknown option')
  },
)

// node hands back the `default: []` array off the option table itself, so
// without a copy every parse shares one instance.
test('tracks is a fresh array each time', () => {
  const first = parseArgs([]).tracks
  first.push('mutated')
  expect(parseArgs([]).tracks).toEqual([])
})

test('batch takes its manifest as a positional and the capture flags as defaults', () => {
  const args = parseArgs(['batch', 'captures.json', '--genome', 'hg38'])
  expect(args.command).toBe('batch')
  expect(args.positionals).toEqual(['captures.json'])
  expect(args.genome).toBe('hg38')
  expect(parseArgs(['batch', '-', '--concurrency', '8']).concurrency).toBe(8)
})

test('an image path belongs to a batch entry, and concurrency to a batch', () => {
  expect(() => parseArgs(['batch', 'captures.json', '-o', 'x.png'])).toThrow(
    '-o does not apply to `jb2capture batch`',
  )
  expect(() => parseArgs(['--concurrency', '2', '-o', 'x.png'])).toThrow(
    '--concurrency applies only to `jb2capture batch`',
  )
})

test('a track takes the settings every display takes, as Desktop writes them', () => {
  const args = parseArgs([
    '--genome',
    'hg38',
    '--loc',
    'EGFR',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:200',
    'force',
    '--track',
    'hg38-gc',
    '{"height":50}',
    '--view',
    'axis.grid=false',
    'trackLabels=offset',
    '-o',
    'egfr.png',
  ])
  expect(args.tracks).toEqual([
    { trackId: 'hg38-ncbiRefSeqCurated', height: 200, forceLoad: true },
    { trackId: 'hg38-gc', height: 50 },
  ])
  expect(args.view).toEqual({ axis: { grid: false }, trackLabels: 'offset' })
  expect(parseArgs(['--track', 'a']).tracks).toEqual(['a'])
})

test('a modifier writing one setting on every display it applies to is written', () => {
  expect(
    parseArgs([
      '--track',
      'reads',
      'arcs:up',
      'mapq:20',
      'heightMode:fit:200',
      '--track',
      'genes',
      'display:marks',
    ]).tracks,
  ).toEqual([
    {
      trackId: 'reads',
      readConnections: { show: true, mark: 'arc', placement: 'up' },
      filter: { minMapq: 20 },
      heightMode: 'fit',
      height: 200,
    },
    { trackId: 'genes', type: 'LinearMarkDisplay' },
  ])
})

test('a modifier that needs the opened track names the apps that apply it', () => {
  expect(() => parseArgs(['--track', 'reads', 'color:strand'])).toThrow(
    '--track reads: track option "color:" writes a different setting on each kind of track',
  )
  expect(() =>
    parseArgs(['--track', 'reads', 'sort:base', 'color.field=tags.HP']),
  ).toThrow(
    '--track reads sort:base color.field=tags.HP: jb2capture opens a track in one step',
  )
})

test('--loc takes several regions, unquoted', () => {
  expect(
    parseArgs(['--loc', 'chr3:25,325,000-25,361,000', 'chr10:1-100']).loc,
  ).toBe('chr3:25,325,000-25,361,000 chr10:1-100')
})

test('a flag given twice is an error, not the last one winning', () => {
  expect(() => parseArgs(['--genome', 'hg38', '--genome', 'mm39'])).toThrow(
    '--genome is given more than once',
  )
})

test('a word after a value applies to nothing, so it is an error', () => {
  expect(() => parseArgs(['--genome', 'hg38', 'mm39'])).toThrow(
    '--genome takes one value, so "mm39" applies to nothing',
  )
})

test.each([
  [['reads.bam', '--genome', 'hg38'], 'reads.bam is a data file.'],
  [
    ['--genome', 'hg38', 'https://x.test/reads.cram'],
    'https://x.test/reads.cram is a data file.',
  ],
  [['--bam', 'reads.bam'], '--bam opens a data file.'],
  [['--fasta', 'ref.fa'], '--fasta opens a data file.'],
])('a data file names the tools that open one (%j)', (argv, start) => {
  expect(() => parseArgs(argv)).toThrow(
    `${start} jb2capture opens the tracks a config lists and cannot serve a data file to its browser. Draw it with jb2export, or open it in JBrowse Desktop, which take the same command line`,
  )
})

test('url takes track and view settings', () => {
  const args = parseArgs([
    'url',
    '--genome',
    'hg38',
    '--view',
    'axis.grid=false',
  ])
  expect(args.view).toEqual({ axis: { grid: false } })
})

test("batch's manifest comes right after the word", () => {
  expect(parseArgs(['batch', '--genome', 'hg38']).positionals).toEqual([])
  expect(() =>
    parseArgs(['batch', '--genome', 'hg38', 'captures.json']),
  ).toThrow('--genome takes one value, so "captures.json" applies to nothing')
})
