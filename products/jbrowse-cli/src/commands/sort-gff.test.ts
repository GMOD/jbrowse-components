/**
 * @jest-environment node
 */

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { runCommand } from '../testUtils.ts'
import { validateFileArgument } from './shared/validators.ts'

const bin = path.join(__dirname, '..', 'bin.ts')
const dataDir = path.join(__dirname, '..', '..', 'test', 'data')
const existingGff = path.join(dataDir, 'two_records.gff3')

function withTty(isTty: boolean, fn: () => void) {
  const original = process.stdin.isTTY
  process.stdin.isTTY = isTty
  try {
    fn()
  } finally {
    process.stdin.isTTY = original
  }
}

describe('validateFileArgument', () => {
  test('accepts an existing readable file', () => {
    expect(() => {
      validateFileArgument(existingGff, 'sort-gff', 'gff')
    }).not.toThrow()
  })

  test('throws for a nonexistent file so a typo cannot silently produce empty output', () => {
    expect(() => {
      validateFileArgument(
        path.join(dataDir, 'does-not-exist.gff3'),
        'sort-gff',
        'gff',
      )
    }).toThrow(/does not exist/)
  })

  test('throws when the path is a directory rather than a regular file', () => {
    expect(() => {
      validateFileArgument(dataDir, 'sort-gff', 'gff')
    }).toThrow(/not a regular file/)
  })

  test('throws for a missing argument when stdin is a TTY', () => {
    withTty(true, () => {
      expect(() => {
        validateFileArgument(undefined, 'sort-gff', 'gff')
      }).toThrow(/Missing required argument/)
    })
  })

  test('accepts a missing argument when stdin is piped (not a TTY)', () => {
    withTty(false, () => {
      expect(() => {
        validateFileArgument(undefined, 'sort-gff', 'gff')
      }).not.toThrow()
    })
  })
})

function sortGff(args: string[], input?: string) {
  const { status, stdout, stderr } = spawnSync(
    'node',
    [bin, 'sort-gff', ...args],
    { encoding: 'utf8', input },
  )
  return { status, stdout, stderr }
}

const firstFourColumns = (output: string) =>
  output
    .trim()
    .split('\n')
    .map(line => line.split('\t').slice(0, 4).join(' '))

const expectedProkka = [
  '##gff-version 3',
  '##sequence-region contig_2 1 120',
  '##sequence-region contig_1 1 120',
  'contig_1 Prodigal:v2.6 CDS 4',
  'contig_1 Prodigal:v2.6 CDS 40',
  'contig_2 Prodigal:v2.6 CDS 61',
]

describe('the sort-gff pipeline', () => {
  test('drops a ##FASTA section, so the sorted file is all features tabix can index', () => {
    const { status, stdout } = sortGff([
      path.join(dataDir, 'prokka_with_fasta.gff3'),
    ])
    expect(status).toBe(0)
    expect(firstFourColumns(stdout)).toEqual(expectedProkka)
  })

  test('reads the same data from stdin, keeping headers first in input order', () => {
    const { status, stdout } = sortGff(
      [],
      fs.readFileSync(path.join(dataDir, 'prokka_with_fasta.gff3'), 'utf8'),
    )
    expect(status).toBe(0)
    expect(firstFourColumns(stdout)).toEqual(expectedProkka)
  })

  test('leaves a CRLF line ending on the line it came with', () => {
    const { stdout } = sortGff(
      [],
      '##gff-version 3\r\nchr1\tsrc\tgene\t20\t30\t.\t+\t.\tID=b\r\nchr1\tsrc\tgene\t5\t9\t.\t+\t.\tID=a\r\n',
    )
    expect(stdout).toBe(
      '##gff-version 3\r\nchr1\tsrc\tgene\t5\t9\t.\t+\t.\tID=a\r\nchr1\tsrc\tgene\t20\t30\t.\t+\t.\tID=b\r\n',
    )
  })

  test('sorts a last line that has no trailing newline', () => {
    const { stdout } = sortGff(
      [],
      'chr1\tsrc\tgene\t20\t30\t.\t+\t.\tID=b\nchr1\tsrc\tgene\t5\t9\t.\t+\t.\tID=a',
    )
    expect(firstFourColumns(stdout)).toEqual([
      'chr1 src gene 5',
      'chr1 src gene 20',
    ])
  })
})

test('an interrupted stdin run leaves no copy of the input in the temp dir', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sort-gff-interrupt-'))
  try {
    const child = spawn('node', [bin, 'sort-gff'], {
      env: { ...process.env, TMPDIR: tmpDir },
      stdio: ['pipe', 'ignore', 'ignore'],
    })
    child.stdin.write('chr1\tsrc\tgene\t20\t30\t.\t+\t.\tID=b\n')
    await new Promise(resolve => setTimeout(resolve, 500))
    const closed = new Promise(resolve => child.on('close', resolve))
    child.kill('SIGTERM')
    await closed
    expect(fs.readdirSync(tmpDir)).toEqual([])
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

describe('sort-gff command', () => {
  test('surfaces an error for a nonexistent input file instead of exiting 0', async () => {
    const { error } = await runCommand([
      'sort-gff',
      path.join(dataDir, 'definitely-missing.gff3'),
    ])
    expect(error?.message).toMatch(/does not exist/)
  })
})
