import { execSync } from 'child_process'
import { existsSync, mkdtempSync, rmSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

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

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
}

// Test --help
test('jb2export --help shows usage', () => {
  const output = run('jb2export --help')
  if (!output.includes('jb2export')) {
    throw new Error('Expected jb2export in help output')
  }
  if (!output.includes('--fasta')) {
    throw new Error('Expected --fasta option in help output')
  }
})

// Test export with fasta only
test('jb2export with fasta creates SVG output', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'test-fasta.svg')
    run(`jb2export --fasta data/volvox.fa --loc ctgA:1-1000 --out ${outFile}`)

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

// Test export with fasta and bam
test('jb2export with fasta and bam creates SVG output', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'test-fasta-bam.svg')
    run(
      `jb2export --fasta data/volvox.fa --bam data/volvox-sorted.bam --loc ctgA:1-5000 --out ${outFile}`,
    )

    if (!existsSync(outFile)) {
      throw new Error(`Expected output file at ${outFile}`)
    }

    const stats = statSync(outFile)
    if (stats.size === 0) {
      throw new Error('Output file is empty')
    }

    // Check that the file size is reasonable (should have bam track data)
    if (stats.size < 1000) {
      throw new Error('Output file seems too small for fasta + bam')
    }
  } finally {
    rmSync(tmpDir, { recursive: true })
  }
})

// Test export with fasta and gff
test('jb2export with fasta and gff creates SVG output', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'test-fasta-gff.svg')
    run(
      `jb2export --fasta data/volvox.fa --gffgz data/volvox.sort.gff3.gz --loc ctgA:1-5000 --out ${outFile}`,
    )

    if (!existsSync(outFile)) {
      throw new Error(`Expected output file at ${outFile}`)
    }

    const stats = statSync(outFile)
    if (stats.size === 0) {
      throw new Error('Output file is empty')
    }

    // Check that the file size is reasonable (should have gff track data)
    if (stats.size < 1000) {
      throw new Error('Output file seems too small for fasta + gff')
    }
  } finally {
    rmSync(tmpDir, { recursive: true })
  }
})

// Test export with all three files
test('jb2export with fasta, bam, and gff creates SVG output', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'test-all.svg')
    run(
      `jb2export --fasta data/volvox.fa --bam data/volvox-sorted.bam --gffgz data/volvox.sort.gff3.gz --loc ctgA:1-10000 --out ${outFile}`,
    )

    if (!existsSync(outFile)) {
      throw new Error(`Expected output file at ${outFile}`)
    }

    const stats = statSync(outFile)
    if (stats.size === 0) {
      throw new Error('Output file is empty')
    }

    // Check that the file size is reasonable (should have all tracks)
    if (stats.size < 2000) {
      throw new Error('Output file seems too small for fasta + bam + gff')
    }
  } finally {
    rmSync(tmpDir, { recursive: true })
  }
})

// Test export with different output format (full region)
test('jb2export can render a larger region', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jb2export-test-'))
  try {
    const outFile = join(tmpDir, 'test-large.svg')
    run(
      `jb2export --fasta data/volvox.fa --bam data/volvox-sorted.bam --loc ctgA:1-50000 --out ${outFile}`,
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

console.log(
  `\n${failures === 0 ? 'All tests passed!' : `${failures} test(s) failed`}`,
)
process.exit(failures === 0 ? 0 : 1)
