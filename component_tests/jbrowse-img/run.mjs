import { execSync } from 'child_process'
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
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

// Comparative modes (dotplot/synteny) need two distinctly-named assemblies: the
// basename of a FASTA becomes the assembly name, so the second is a copy of
// volvox under a different filename. volvox_fake_synteny.paf is a
// volvox-vs-volvox PAF that maps ctgA/ctgB onto themselves.
const cmpDir = mkdtempSync(join(tmpdir(), 'jb2export-cmp-'))
const fasta2 = join(cmpDir, 'volvox2.fa')
copyFileSync(fp('volvox.fa'), fasta2)
copyFileSync(fp('volvox.fa.fai'), `${fasta2}.fai`)
const paf = fp('volvox_fake_synteny.paf')

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

// --- CLI view-mode subcommand tests ---

await test('jb2export circular subcommand renders SV chords', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'circular.svg')
    run(
      `${jb2exportCmd} circular --fasta data/volvox.fa --vcfgz data/volvox.dup.vcf.gz --out ${outFile}`,
    )
    if (!existsSync(outFile)) {
      throw new Error(`Expected output file at ${outFile}`)
    }
    if (statSync(outFile).size < 1000) {
      throw new Error('Output file seems too small')
    }
  } finally {
    rmSync(tmpDir, { recursive: true })
  }
})

await test('jb2export dotplot subcommand renders two assemblies', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'dotplot.svg')
    run(
      `${jb2exportCmd} dotplot --fasta data/volvox.fa --fasta2 ${fasta2} --paf ${paf} --out ${outFile}`,
    )
    if (!existsSync(outFile)) {
      throw new Error(`Expected output file at ${outFile}`)
    }
    if (statSync(outFile).size < 1000) {
      throw new Error('Output file seems too small')
    }
  } finally {
    rmSync(tmpDir, { recursive: true })
  }
})

await test('jb2export synteny subcommand renders a region pair', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'synteny.svg')
    run(
      `${jb2exportCmd} synteny --fasta data/volvox.fa --fasta2 ${fasta2} --paf ${paf} --loc ctgA --loc2 ctgA --out ${outFile}`,
    )
    if (!existsSync(outFile)) {
      throw new Error(`Expected output file at ${outFile}`)
    }
    if (statSync(outFile).size < 1000) {
      throw new Error('Output file seems too small')
    }
  } finally {
    rmSync(tmpDir, { recursive: true })
  }
})

await test('jb2export unknown subcommand exits nonzero', async () => {
  let threw = false
  try {
    run(`${jb2exportCmd} bogus --fasta data/volvox.fa`)
  } catch {
    threw = true
  }
  if (!threw) {
    throw new Error('Expected unknown subcommand to fail')
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

// --- Library API view-mode tests ---

await test('renderRegion circular renders SV chords from a VCF', async () => {
  const result = await renderRegion({
    mode: 'circular',
    fasta: fp('volvox.fa'),
    trackList: [['vcfgz', [fp('volvox.dup.vcf.gz')]]],
  })
  if (!result.includes('<svg')) {
    throw new Error('Expected SVG output')
  }
  // chords + ideogram are drawn as <path>; the SV track adds chords on top of
  // the 2 ideogram paths.
  const paths = result.match(/<path/g) ?? []
  if (paths.length <= 2) {
    throw new Error(`Expected variant chords, got ${paths.length} paths`)
  }
})

// Comparative assemblies + per-level synteny are built from the parsed CLI
// entries (argv order): each --fasta opens an assembly, each synteny file binds
// to the gap it sits in.
await test('renderRegion dotplot renders two assemblies via a PAF', async () => {
  const result = await renderRegion({
    mode: 'dotplot',
    argv: [
      ['fasta', [fp('volvox.fa')]],
      ['paf', [paf]],
      ['fasta', [fasta2]],
    ],
  })
  if (!result.includes('<svg')) {
    throw new Error('Expected SVG output')
  }
  if (!result.includes('<image')) {
    throw new Error('Expected a rasterized dots layer')
  }
})

await test('renderRegion synteny renders two assemblies via a PAF', async () => {
  const result = await renderRegion({
    mode: 'synteny',
    argv: [
      ['fasta', [fp('volvox.fa')]],
      ['paf', [paf]],
      ['fasta', [fasta2]],
      ['loc', ['ctgA']],
      ['loc2', ['ctgA']],
    ],
  })
  if (!result.includes('<svg')) {
    throw new Error('Expected SVG output')
  }
  if (!result.includes('<image')) {
    throw new Error('Expected a rasterized ribbon layer')
  }
})

await test('renderRegion comparative without a second assembly throws', async () => {
  let message = ''
  try {
    await renderRegion({
      mode: 'dotplot',
      argv: [['fasta', [fp('volvox.fa')]], ['paf', [paf]]],
    })
  } catch (error) {
    message = error.message
  }
  if (!/second assembly/.test(message)) {
    throw new Error(`Expected a "second assembly" error, got: ${message}`)
  }
})

await test('renderRegion synteny stacks three assemblies into two levels', async () => {
  // Three volvox copies (volvox/volvox2/volvox3) with a PAF between each
  // adjacent pair. syntenyTrackLevels must place each track at the level of the
  // assemblies it compares: level 0 = volvox↔volvox2, level 1 = volvox2↔volvox3.
  const triDir = mkdtempSync(join(tmpdir(), 'jb2export-tri-'))
  const names = ['volvox', 'volvox2', 'volvox3']
  const assemblies = names.map(name => {
    const faPath = join(triDir, `${name}.fa`)
    copyFileSync(fp('volvox.fa'), faPath)
    copyFileSync(fp('volvox.fa.fai'), `${faPath}.fai`)
    return {
      name,
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}_refseq`,
        adapter: {
          type: 'IndexedFastaAdapter',
          fastaLocation: { localPath: faPath },
          faiLocation: { localPath: `${faPath}.fai` },
        },
      },
    }
  })
  const syntenyTrack = (id, assemblyNames) => ({
    type: 'SyntenyTrack',
    trackId: id,
    name: id,
    assemblyNames,
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { localPath: paf },
      assemblyNames,
    },
  })
  const configPath = join(triDir, 'config.json')
  writeFileSync(
    configPath,
    JSON.stringify({
      assemblies,
      tracks: [
        syntenyTrack('vol_v_vol2', ['volvox', 'volvox2']),
        syntenyTrack('vol2_v_vol3', ['volvox2', 'volvox3']),
      ],
    }),
  )
  try {
    const result = await renderRegion({
      mode: 'synteny',
      config: configPath,
      assembly: 'volvox',
      loc: 'ctgA',
      loc2: 'ctgA',
    })
    if (!result.includes('<svg')) {
      throw new Error('Expected SVG output')
    }
    if (!result.includes('<image')) {
      throw new Error('Expected rasterized ribbon layers across levels')
    }
  } finally {
    rmSync(triDir, { recursive: true })
  }
})

rmSync(cmpDir, { recursive: true })

console.log(
  `\n${failures === 0 ? 'All tests passed!' : `${failures} test(s) failed`}`,
)
process.exit(failures === 0 ? 0 : 1)
