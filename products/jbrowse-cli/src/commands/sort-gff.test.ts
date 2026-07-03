/**
 * @jest-environment node
 */

import path from 'node:path'

import { runCommand } from '../testUtil.ts'
import { validateFileArgument } from './shared/validators.ts'

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
    expect(() =>
      { validateFileArgument(existingGff, 'sort-gff', 'gff') },
    ).not.toThrow()
  })

  test('throws for a nonexistent file so a typo cannot silently produce empty output', () => {
    expect(() =>
      { validateFileArgument(
        path.join(dataDir, 'does-not-exist.gff3'),
        'sort-gff',
        'gff',
      ) },
    ).toThrow(/does not exist/)
  })

  test('throws when the path is a directory rather than a regular file', () => {
    expect(() => { validateFileArgument(dataDir, 'sort-gff', 'gff') }).toThrow(
      /not a regular file/,
    )
  })

  test('throws for a missing argument when stdin is a TTY', () => {
    withTty(true, () => {
      expect(() => { validateFileArgument(undefined, 'sort-gff', 'gff') }).toThrow(
        /Missing required argument/,
      )
    })
  })

  test('accepts a missing argument when stdin is piped (not a TTY)', () => {
    withTty(false, () => {
      expect(() =>
        { validateFileArgument(undefined, 'sort-gff', 'gff') },
      ).not.toThrow()
    })
  })
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
