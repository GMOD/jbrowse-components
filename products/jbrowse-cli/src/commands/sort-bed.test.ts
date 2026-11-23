/**
 * @jest-environment node
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { runCommand } from '../testUtils.ts'

const bin = path.join(__dirname, '..', 'bin.ts')
const dataDir = path.join(__dirname, '..', '..', 'test', 'data')

function sortBed(args: string[], input?: string) {
  const { status, stdout, stderr } = spawnSync(
    'node',
    [bin, 'sort-bed', ...args],
    { encoding: 'utf8', input },
  )
  return { status, stdout, stderr }
}

const bed = [
  '#track name=x',
  'chr2\t5\t9\ta',
  'chr1\t100\t200\tb',
  '',
  'chr1\t20\t30\tc',
  '# a comment in the data',
  'chr1\t9\t10\td',
  '',
].join('\n')

const sorted = [
  '#track name=x',
  '# a comment in the data',
  'chr1\t9\t10\td',
  'chr1\t20\t30\tc',
  'chr1\t100\t200\tb',
  'chr2\t5\t9\ta',
  '',
].join('\n')

describe('sort-bed', () => {
  test('hoists # lines, drops blank lines and sorts numerically by start, from stdin', () => {
    const { status, stdout, stderr } = sortBed([], bed)
    expect(stderr).toBe('')
    expect(status).toBe(0)
    expect(stdout).toBe(sorted)
  })

  test('gives a file the same output as the same data on stdin', () => {
    const file = path.join(dataDir, 'volvox.bed')
    const fromFile = sortBed([file])
    const fromStdin = sortBed([], fs.readFileSync(file, 'utf8'))
    expect(fromFile.status).toBe(0)
    expect(fromFile.stdout).toBe(fromStdin.stdout)
    expect(fromFile.stdout.length).toBeGreaterThan(0)
  })

  test('surfaces an error for a nonexistent input file instead of exiting 0', async () => {
    const { error } = await runCommand([
      'sort-bed',
      path.join(dataDir, 'definitely-missing.bed'),
    ])
    expect(error?.message).toMatch(/does not exist/)
  })
})
