import { execSync } from 'child_process'
import { existsSync, mkdtempSync, rmSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

import { renderRegion, setupEnv } from '@jbrowse/img'

setupEnv()

const REMOTE_BASE = 'https://jbrowse.org/code/jb2/main/test_data/volvox'
const FASTA = `${REMOTE_BASE}/volvox.fa`
const BAM = `${REMOTE_BASE}/volvox-sorted.bam`
const GFF = `${REMOTE_BASE}/volvox.sort.gff3.gz`

let failures = 0

async function test(name, fn, timeout = 40000) {
  const timer = setTimeout(() => {
    console.error(`\u2717 ${name} (timed out after ${timeout}ms)`)
    failures++
  }, timeout)
  try {
    await fn()
    clearTimeout(timer)
    console.log(`\u2713 ${name}`)
  } catch (error) {
    clearTimeout(timer)
    console.error(`\u2717 ${name}`)
    console.error(`  ${error.message}`)
    failures++
  }
}

function fp(f) {
  return resolve(`data/${f}`)
}

// Add node_modules/.bin to PATH so we can call jb2export directly
const binPath = resolve('./node_modules/.bin')
const env = { ...process.env, PATH: `${binPath}:${process.env.PATH}` }

const jb2exportCmd = existsSync(join(binPath, 'jb2export'))
  ? 'jb2export'
  : 'node ./node_modules/@jbrowse/img/esm/bin.js'

function run(cmd) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    })
  } catch (error) {
    const stderr = error.stderr
      ? `\n  stderr: ${error.stderr.slice(0, 500)}`
      : ''
    throw new Error(`Command failed: ${cmd}${stderr}`)
  }
}

// --- CLI tests ---

await test('jb2export --help shows usage', async () => {
  const output = run(`${jb2exportCmd} --help`)
  if (!output.includes('jb2export')) {
    throw new Error('Expected jb2export in help output')
  }
  if (!output.includes('--fasta')) {
    throw new Error('Expected --fasta option in help output')
  }
})

await test('jb2export with local files creates SVG output', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'test-local.svg')
    run(
      `${jb2exportCmd} --fasta data/volvox.fa --bam data/volvox-sorted.bam --loc ctgA:1-5000 --out ${outFile}`,
    )
    if (!existsSync(outFile)) {
      throw new Error(`Expected output file at ${outFile}`)
    }
    const stats = statSync(outFile)
    if (stats.size < 1000) {
      throw new Error('Output file seems too small')
    }
  } finally {
    rmSync(tmpDir, { recursive: true })
  }
})

await test('jb2export with remote files creates SVG output', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'test.svg')
    run(
      `${jb2exportCmd} --fasta ${FASTA} --bam ${BAM} --gffgz ${GFF} --loc ctgA:1-10000 --out ${outFile}`,
    )
    if (!existsSync(outFile)) {
      throw new Error(`Expected output file at ${outFile}`)
    }
    const stats = statSync(outFile)
    if (stats.size < 2000) {
      throw new Error('Output file seems too small')
    }
  } finally {
    rmSync(tmpDir, { recursive: true })
  }
})

await test('jb2export can render a larger region', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'test-large.svg')
    run(
      `${jb2exportCmd} --fasta ${FASTA} --bam ${BAM} --loc ctgA:1-50000 --out ${outFile}`,
    )
    if (!existsSync(outFile)) {
      throw new Error(`Expected output file at ${outFile}`)
    }
    const stats = statSync(outFile)
    if (stats.size === 0) {
      throw new Error('Output file is empty')
    }
  } finally {
    rmSync(tmpDir, { recursive: true })
  }
})

// --- Library API tests (ported from products/jbrowse-img/src/index.test.ts) ---

await test('renderRegion with variety of track types', async () => {
  const result = await renderRegion({
    fasta: fp('volvox.fa'),
    trackList: [
      ['bam', [fp('volvox-sorted.bam')]],
      ['cram', [fp('volvox-sorted.cram')]],
      ['bigwig', [fp('volvox-sorted.bam.coverage.bw')]],
      ['vcfgz', [fp('volvox.filtered.vcf.gz')]],
      ['gffgz', [fp('volvox.sort.gff3.gz')]],
      ['bigbed', [fp('volvox.bb')]],
      ['bedgz', [fp('volvox-bed12.bed.gz')]],
    ],
    loc: 'ctgA:1000-2000',
  })
  if (!result) {
    throw new Error('Expected truthy result')
  }
})

await test('renderRegion with csi index', async () => {
  const result = await renderRegion({
    fasta: fp('volvox.fa'),
    trackList: [
      [
        'bam',
        [fp('volvox-sorted.bam'), `index:${fp('volvox-sorted.bam.csi')}`],
      ],
    ],
    loc: 'ctgA:1000-2000',
  })
  if (!result) {
    throw new Error('Expected truthy result')
  }
})

await test('renderRegion alignments as snpcov', async () => {
  const result = await renderRegion({
    fasta: fp('volvox.fa'),
    trackList: [['bam', [fp('volvox-sorted.bam'), 'snpcov', 'height:1000']]],
    loc: 'ctgA:1000-2000',
  })
  if (!result) {
    throw new Error('Expected truthy result')
  }
})

await test('renderRegion with noRasterize', async () => {
  const result = await renderRegion({
    fasta: fp('volvox.fa'),
    trackList: [
      ['bam', [fp('volvox-sorted.bam')]],
      ['cram', [fp('volvox-sorted.cram')]],
      ['bigwig', [fp('volvox-sorted.bam.coverage.bw')]],
      ['vcfgz', [fp('volvox.filtered.vcf.gz')]],
      ['gffgz', [fp('volvox.sort.gff3.gz')]],
      ['bigbed', [fp('volvox.bb')]],
      ['bedgz', [fp('volvox-bed12.bed.gz')]],
    ],
    loc: 'ctgA:1000-2000',
    noRasterize: true,
  })
  if (!result) {
    throw new Error('Expected truthy result')
  }
})

await test('renderRegion configtracks with local files', async () => {
  const result = await renderRegion({
    config: fp('config.json'),
    trackList: [['configtracks', ['volvox_sv']]],
    assembly: 'volvox',
    loc: 'ctgA:1-50,000',
  })
  if (!result) {
    throw new Error('Expected truthy result')
  }
})

console.log(
  `\n${failures === 0 ? 'All tests passed!' : `${failures} test(s) failed`}`,
)
process.exit(failures === 0 ? 0 : 1)
