import {
  modifierValue,
  parseArgv,
  splitModifier,
  standardizeArgv,
} from './parseArgv.ts'

test('parses track types, flags, and per-track options', () => {
  const args =
    '--bam dad.bam color:red --vcf variants.vcf --bam mom.bam --defaultSession --out out.svg --noRasterize'

  expect(parseArgv(args.split(' '))).toEqual([
    ['bam', ['dad.bam', 'color:red']],
    ['vcf', ['variants.vcf']],
    ['bam', ['mom.bam']],
    ['defaultSession', []],
    ['out', ['out.svg']],
    ['noRasterize', []],
  ])
})

test('per-track options after a second track of the same type are captured', () => {
  const args =
    '--bam dad.bam color:red --vcf variants.vcf --bam mom.bam force:true --defaultSession --out out.svg --noRasterize'

  expect(parseArgv(args.split(' '))).toEqual([
    ['bam', ['dad.bam', 'color:red']],
    ['vcf', ['variants.vcf']],
    ['bam', ['mom.bam', 'force:true']],
    ['defaultSession', []],
    ['out', ['out.svg']],
    ['noRasterize', []],
  ])
})

test('--key=value is equivalent to --key value', () => {
  expect(parseArgv(['--width=1000', '--loc=chr1:1-100'])).toEqual([
    ['width', ['1000']],
    ['loc', ['chr1:1-100']],
  ])
})

test('--key=value seeds the entry, later tokens still accumulate', () => {
  expect(
    parseArgv('--bam=reads.bam color:red --out out.svg'.split(' ')),
  ).toEqual([
    ['bam', ['reads.bam', 'color:red']],
    ['out', ['out.svg']],
  ])
})

test('featureHeight options are parsed as track options', () => {
  const args =
    '--bam alignment.bam color:tag:XS featureHeight:super-compact --out out.svg'

  expect(parseArgv(args.split(' '))).toEqual([
    ['bam', ['alignment.bam', 'color:tag:XS', 'featureHeight:super-compact']],
    ['out', ['out.svg']],
  ])
})

test('splitModifier keeps colons in the value; rejects colon-less/leading-colon', () => {
  expect(splitModifier('loc:chr1:1-100')).toEqual(['loc', 'chr1:1-100'])
  expect(splitModifier('index:https://x/a.bai.csi')).toEqual([
    'index',
    'https://x/a.bai.csi',
  ])
  expect(splitModifier('name:')).toEqual(['name', ''])
  expect(splitModifier('force')).toBeUndefined()
  expect(splitModifier(':leading')).toBeUndefined()
})

test('modifierValue returns the first matching key value, else undefined', () => {
  const tokens = ['color:red', 'index:https://x/a.csi', 'name:My Track']
  expect(modifierValue(tokens, 'index')).toBe('https://x/a.csi')
  expect(modifierValue(tokens, 'name')).toBe('My Track')
  expect(modifierValue(tokens, 'missing')).toBeUndefined()
})

// a bare `-` names stdin, so it is a VALUE. Treating it as a flag made it an
// option named '' — `--spec -` warned "unknown option --" and left --spec empty.
test('parseArgv treats a bare "-" as a value, not a new flag', () => {
  expect(parseArgv(['--spec', '-'])).toEqual([['spec', ['-']]])
  expect(parseArgv(['--config', '-', '--loc', 'ctgA:1-100'])).toEqual([
    ['config', ['-']],
    ['loc', ['ctgA:1-100']],
  ])
  expect(standardizeArgv(parseArgv(['--tracks', '-']), []).tracks).toBe('-')
})

test('a single-dash flag names its option', () => {
  expect(parseArgv(['-w', '100'])).toEqual([['w', ['100']]])
  expect(parseArgv(['-w=100', '-out', 'out.svg'])).toEqual([
    ['w', ['100']],
    ['out', ['out.svg']],
  ])
})

test('a bare data file is a --file entry, wherever it sits', () => {
  expect(
    parseArgv(['reads.bam', '--loc', 'chr1:1-100', 'calls.vcf.gz']),
  ).toEqual([
    ['file', ['reads.bam']],
    ['loc', ['chr1:1-100']],
    ['file', ['calls.vcf.gz']],
  ])
})

test('a data file after a track flag opens its own entry', () => {
  expect(
    parseArgv('--bam a.bam height:100 b.bam color:red'.split(' ')),
  ).toEqual([
    ['bam', ['a.bam', 'height:100']],
    ['file', ['b.bam', 'color:red']],
  ])
})

test('a modifier naming a data file stays a modifier', () => {
  expect(parseArgv(['--bam', 'a.bam', 'name:tumor.bam'])).toEqual([
    ['bam', ['a.bam', 'name:tumor.bam']],
  ])
})

test('URLs and Windows paths are files, not modifiers', () => {
  expect(
    parseArgv([
      '--loc',
      'chr1',
      'https://x.org/a.bw',
      String.raw`C:\data\b.bam`,
    ]),
  ).toEqual([
    ['loc', ['chr1']],
    ['file', ['https://x.org/a.bw']],
    ['file', [String.raw`C:\data\b.bam`]],
  ])
})

test('a boolean flag takes only true or false', () => {
  const booleans = new Set(['noRasterize'])
  expect(parseArgv(['--noRasterize', 'reads.bam'], { booleans })).toEqual([
    ['noRasterize', []],
    ['file', ['reads.bam']],
  ])
  expect(parseArgv(['--noRasterize', 'false'], { booleans })).toEqual([
    ['noRasterize', ['false']],
  ])
  expect(() => parseArgv(['--noRasterize', 'oops'], { booleans })).toThrow(
    /Unexpected argument "oops"/,
  )
})

test('a leading token that is not a data file is an error', () => {
  expect(() => parseArgv(['notes.txt', '--loc', 'chr1'])).toThrow(
    /Unexpected argument "notes.txt"/,
  )
  expect(() => parseArgv(['height:100'])).toThrow(/Unexpected argument/)
})

test('standardizeArgv lists --file entries with the track flags', () => {
  expect(
    standardizeArgv(parseArgv(['reads.bam', '--bigwig', 'a.bw']), ['bigwig'])
      .trackList,
  ).toEqual([
    ['file', ['reads.bam']],
    ['bigwig', ['a.bw']],
  ])
})
