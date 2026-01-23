import { execSync } from 'child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const REMOTE_BASE = 'https://jbrowse.org/code/jb2/main/test_data/volvox'
const FASTA = `${REMOTE_BASE}/volvox.fa`
const BAM = `${REMOTE_BASE}/volvox-sorted.bam`
const GFF = `${REMOTE_BASE}/volvox.sort.gff3.gz`

let failures = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    console.error(`  ${error.message}`)
    failures++
  }
}

// Add node_modules/.bin to PATH so we can call jb2export directly
const binPath = resolve('./node_modules/.bin')
const env = { ...process.env, PATH: `${binPath}:${process.env.PATH}` }

// Debug: verify bin setup
console.log('binPath:', binPath)
console.log('bin exists:', existsSync(binPath))
console.log('jb2export symlink exists:', existsSync(join(binPath, 'jb2export')))
if (existsSync(binPath)) {
  console.log('bin contents:', readdirSync(binPath))
}
console.log('PATH starts with:', env.PATH.slice(0, 200))

// Use symlink if available, otherwise fall back to direct node invocation
const jb2exportCmd = existsSync(join(binPath, 'jb2export'))
  ? 'jb2export'
  : 'node ./node_modules/@jbrowse/img/esm/bin.js'
console.log('Using command:', jb2exportCmd)

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env })
}

// Test --help
test('jb2export --help shows usage', () => {
  const output = run(`${jb2exportCmd} --help`)
  if (!output.includes('jb2export')) {
    throw new Error('Expected jb2export in help output')
  }
  if (!output.includes('--fasta')) {
    throw new Error('Expected --fasta option in help output')
  }
})

// Test export with local files
test('jb2export with local files creates SVG output', () => {
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

// Test export with remote fasta, bam, and gff
test('jb2export with remote files creates SVG output', () => {
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

// Test rendering a larger region
test('jb2export can render a larger region', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'test-large.svg')
    run(`${jb2exportCmd} --fasta ${FASTA} --bam ${BAM} --loc ctgA:1-50000 --out ${outFile}`)

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

console.log(
  `\n${failures === 0 ? 'All tests passed!' : `${failures} test(s) failed`}`,
)
process.exit(failures === 0 ? 0 : 1)
