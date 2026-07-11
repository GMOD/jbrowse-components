import { parseArgv } from './parseArgv.ts'

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
