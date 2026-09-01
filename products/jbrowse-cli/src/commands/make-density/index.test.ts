/**
 * @jest-environment node
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { runCommand, runInTmpDir } from '../../testUtil.ts'
import {
  bedGraphLines,
  countFeatureStarts,
  densityFormat,
  resolveChromSizes,
} from './density-generator.ts'

const base = path.join(__dirname, '..', '..', '..', 'test', 'data')
const gffGz = path.join(base, 'volvox.sort.gff3.gz')
const gff = path.join(base, 'volvox.sort.gff3')
const bedGz = path.join(base, 'volvox.bed.gz')
const vcf = path.join(base, 'volvox.filtered.vcf')
const bam = path.join(base, 'simple.bam')

const volvox = new Map([
  ['ctgA', 50001],
  ['ctgB', 6079],
])

function hasBedGraphToBigWig() {
  try {
    execFileSync('sh', ['-c', 'command -v bedGraphToBigWig'], {
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

const withUcsc = hasBedGraphToBigWig() ? test : test.skip

async function binsOf(file: string, binSize = 1000) {
  const counts = await countFeatureStarts({
    file,
    format: densityFormat(file),
    binSize,
    chromSizes: volvox,
  })
  return {
    ...counts,
    lines: [
      ...bedGraphLines({ bins: counts.bins, chromSizes: volvox, binSize }),
    ],
  }
}

test('counts only top-level GFF3 features', async () => {
  const { lines, records } = await binsOf(gffGz)
  // 202 of the file's 242 feature lines carry no Parent=
  expect(records).toBe(202)
  expect(lines[0]).toBe('ctgA\t0\t1000\t4\n')
  expect(lines.reduce((sum, l) => sum + +l.split('\t')[3]!, 0)).toBe(202)
})

test('reads a plain GFF3 the same way as a bgzipped one', async () => {
  const { lines } = await binsOf(gff)
  const { lines: gzipped } = await binsOf(gffGz)
  expect(lines).toEqual(gzipped)
})

test('counts every BED and VCF record', async () => {
  const { records: bedRecords } = await binsOf(bedGz)
  const { records: vcfRecords } = await binsOf(vcf)
  expect(bedRecords).toBeGreaterThan(0)
  expect(vcfRecords).toBeGreaterThan(0)
})

test('covers every base of every reference, empty runs as single rows', async () => {
  const { lines } = await binsOf(gffGz)
  for (const [refName, length] of volvox) {
    const rows = lines
      .filter(l => l.startsWith(`${refName}\t`))
      .map(l => l.split('\t').map(Number))
    expect(rows[0]![1]).toBe(0)
    expect(rows.at(-1)![2]).toBe(length)
    rows.slice(1).forEach((row, i) => {
      expect(row[1]).toBe(rows[i]![2])
    })
  }
  expect(lines).toContain('ctgA\t2000\t3000\t0\n')
})

test('clips the last bin to the reference length', async () => {
  const { lines } = await binsOf(gffGz, 40000)
  expect(lines).toContain('ctgA\t40000\t50001\t46\n')
})

test('reports reference names the chrom.sizes does not have', async () => {
  const counts = await countFeatureStarts({
    file: gffGz,
    format: 'gff3',
    binSize: 1000,
    chromSizes: new Map([['chr1', 1000]]),
  })
  expect([...counts.unknownRefNames]).toEqual(['ctgA', 'ctgB'])
  expect(counts.bins.size).toBe(0)
})

test('reads reference lengths from the .fai beside an assembly', async () => {
  const sizes = resolveChromSizes({
    assembly: path.join(base, 'simple.fasta'),
  })
  expect(sizes.get('SEQUENCE_1')).toBe(233)
})

test('rejects an alignment file', async () => {
  const { error } = await runCommand(['make-density', bam])
  expect(error?.message).toContain('is an alignment file')
})

test('rejects an extension it cannot read', async () => {
  await runInTmpDir(async ctx => {
    const file = path.join(ctx.dir, 'mystery.xyz')
    fs.writeFileSync(file, '')
    const { error } = await runCommand(['make-density', file])
    expect(error?.message).toContain('Cannot tell what kind of file')
  })
})

test('requires reference lengths', async () => {
  const { error } = await runCommand(['make-density', gffGz])
  expect(error?.message).toContain('--chrom-sizes')
})

withUcsc('writes a bigWig beside the input by default', async () => {
  await runInTmpDir(async ctx => {
    const file = path.join(ctx.dir, 'volvox.sort.gff3.gz')
    fs.copyFileSync(gffGz, file)
    const sizes = path.join(ctx.dir, 'volvox.chrom.sizes')
    fs.writeFileSync(sizes, 'ctgA\t50001\nctgB\t6079\n')
    const { stdout, error } = await runCommand([
      'make-density',
      file,
      '--chrom-sizes',
      sizes,
    ])
    expect(error).toBe(undefined)
    expect(stdout).toContain('202 feature start(s)')
    const out = path.join(ctx.dir, 'volvox.sort.gff3.density.bw')
    expect(fs.existsSync(out)).toBe(true)
    expect(fs.readFileSync(out).length).toBeGreaterThan(0)
  })
})

withUcsc('honors --out and --bin', async () => {
  await runInTmpDir(async ctx => {
    const sizes = path.join(ctx.dir, 'volvox.chrom.sizes')
    fs.writeFileSync(sizes, 'ctgA\t50001\nctgB\t6079\n')
    const out = path.join(ctx.dir, 'coarse.bw')
    const { stdout, error } = await runCommand([
      'make-density',
      gffGz,
      '--chrom-sizes',
      sizes,
      '--bin',
      '10000',
      '--out',
      out,
    ])
    expect(error).toBe(undefined)
    expect(stdout).toContain('10000bp bin(s)')
    expect(fs.existsSync(out)).toBe(true)
  })
})

test('rejects a --bin that is not a positive whole number', async () => {
  await runInTmpDir(async ctx => {
    const sizes = path.join(ctx.dir, 'volvox.chrom.sizes')
    fs.writeFileSync(sizes, 'ctgA\t50001\n')
    const { error } = await runCommand([
      'make-density',
      gffGz,
      '--chrom-sizes',
      sizes,
      '--bin',
      '0',
    ])
    expect(error?.message).toContain('--bin must be a positive whole number')
  })
})
