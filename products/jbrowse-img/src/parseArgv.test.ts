import { parseArgv } from './parseArgv.ts'

test('parse', () => {
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

test('parse', () => {
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

test('featureHeight options are parsed as track options', () => {
  const args =
    '--bam alignment.bam color:tag:XS featureHeight:super-compact --out out.svg'

  expect(parseArgv(args.split(' '))).toEqual([
    ['bam', ['alignment.bam', 'color:tag:XS', 'featureHeight:super-compact']],
    ['out', ['out.svg']],
  ])
})
