/**
 * @jest-environment node
 *
 * Node, not the default jsdom: this is main-process code doing real filesystem
 * work, and generateFastaIndex is handed web streams built from node ones.
 */

import fs from 'node:fs'
import path from 'node:path'

import { getFaiPath } from '../paths.ts'
import { registerFileHandlers } from './fileHandlers.ts'
import { captureHandlers, makeTestPaths } from './testUtil.ts'

import type { AppPaths } from '../paths.ts'

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  app: { getPath: jest.fn(), quit: jest.fn() },
  dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn() },
}))

const VOLVOX = path.join(__dirname, '../../../../test_data/volvox')

let dir: string
let paths: AppPaths
let invoke: ReturnType<typeof captureHandlers>

beforeEach(() => {
  ;({ dir, paths } = makeTestPaths())
  fs.mkdirSync(paths.faiDir, { recursive: true })
  invoke = captureHandlers(() => {
    registerFileHandlers(paths)
  })
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

// The desktop-only path behind "Open new genome" when the user brings a bare
// FASTA. It had no test at all, and it is where the E2E test used to go — badly
// enough that the run failed about half the time (see the note on
// openVolvoxGenome). Testing the handler directly is what lets that run take the
// 2bit route without giving up on covering this one.
test('indexFasta writes a .fai matching the one shipped beside the FASTA', async () => {
  const faiPath = await invoke(
    'indexFasta',
    { localPath: path.join(VOLVOX, 'volvox.fa') },
    'job1',
  )

  expect(faiPath.startsWith(paths.faiDir)).toBe(true)
  // byte-identical to samtools faidx's own output, which is what is committed
  expect(fs.readFileSync(faiPath, 'utf8')).toEqual(
    fs.readFileSync(path.join(VOLVOX, 'volvox.fa.fai'), 'utf8'),
  )
})

// The name carries a timestamp precisely so re-opening the same FASTA doesn't
// collide with the index already on disk. (Nothing prunes them, which is why
// `reset` clears faiDir.)
test('indexing the same FASTA twice writes two files, not one', async () => {
  const first = await invoke(
    'indexFasta',
    { localPath: path.join(VOLVOX, 'volvox.fa') },
    'job1',
  )
  const second = await invoke(
    'indexFasta',
    { localPath: path.join(VOLVOX, 'volvox.fa') },
    'job2',
  )

  expect(first).not.toEqual(second)
  expect(fs.readdirSync(paths.faiDir)).toHaveLength(2)
})

// A rejected index has already written part of the .fai, and leaving it behind
// litters faiDir with files that look valid — a later open would find a
// truncated index rather than build a good one.
test('a FASTA that cannot be indexed leaves no partial .fai behind', async () => {
  const bogus = path.join(dir, 'ragged.fa')
  // ragged line widths: legal FASTA, but not indexable
  fs.writeFileSync(bogus, '>seq\nACGTACGTAC\nACGT\nACGTACGTAC\n')

  await expect(
    invoke('indexFasta', { localPath: bogus }, 'job1'),
  ).rejects.toThrow()
  expect(fs.readdirSync(paths.faiDir)).toEqual([])
})

// A cancelled read ends its stream cleanly, so generateFastaIndex resolves over
// a truncated FASTA and the .fai it wrote reads as a whole one — the worst
// outcome available, since the next open would trust it. Rejecting routes it to
// the same cleanup a rejected index gets.
test('a cancelled index rejects and leaves no .fai behind', async () => {
  const pending = invoke(
    'indexFasta',
    { localPath: path.join(VOLVOX, 'volvox.fa') },
    'job1',
  )
  invoke('cancelIndexFasta', 'job1')

  await expect(pending).rejects.toThrow(/cancel/i)
  expect(fs.readdirSync(paths.faiDir)).toEqual([])
})

// The dialog cancels whenever it closes, which is normally long after the index
// finished — and the id is reused by nothing, so this has to be inert rather
// than reach whatever ran next.
test('cancelling a job that already finished does nothing', async () => {
  await invoke(
    'indexFasta',
    { localPath: path.join(VOLVOX, 'volvox.fa') },
    'job1',
  )

  expect(() => invoke('cancelIndexFasta', 'job1')).not.toThrow()
  expect(fs.readdirSync(paths.faiDir)).toHaveLength(1)
})

// The index name is built from the FASTA's own basename, which is whatever the
// user picked in the file dialog or typed as a url. getFaiPath reduces it to
// ASCII word characters, so a name carrying spaces, a separator or `..` still
// resolves to one file directly inside faiDir rather than somewhere up the tree.
test.each([
  'my genome (v2)',
  'a/b',
  '../escape',
  String.raw`c:\windows\style`,
  'star*and?marks',
  'ヒトゲノム参照配列',
])('getFaiPath keeps the name %p inside faiDir', name => {
  const faiPath = getFaiPath(paths, name)

  expect(path.dirname(faiPath)).toEqual(paths.faiDir)
  expect(path.resolve(faiPath)).toEqual(faiPath)
  // every character Windows rejects in a filename
  expect(path.basename(faiPath)).not.toMatch(/[<>:"/\\|?*]/)
})

// The name arrives as `<basename>-<Date.now()>`, so its length is the user's to
// choose. Percent-encoding was what bounded it before, and it does the opposite
// for anything non-ASCII: nine characters out per character in, which is
// ENAMETOOLONG at ~28 characters of Japanese and well inside what a real file is
// called. Nothing reads this name back, so it is truncated and disambiguated by
// a hash of the whole thing rather than kept reversible.
test('getFaiPath bounds the name and still separates two long ones', () => {
  const a = getFaiPath(paths, `${'ゲノム'.repeat(40)}-1`)
  const b = getFaiPath(paths, `${'ゲノム'.repeat(40)}-2`)

  expect(path.basename(a).length).toBeLessThanOrEqual(255)
  expect(a).not.toEqual(b)
})

test('a FASTA whose name needs escaping still indexes', async () => {
  const odd = path.join(dir, 'my genome (v2).fa')
  fs.copyFileSync(path.join(VOLVOX, 'volvox.fa'), odd)

  const faiPath = await invoke('indexFasta', { localPath: odd }, 'job1')

  expect(path.dirname(faiPath)).toEqual(paths.faiDir)
  expect(fs.readFileSync(faiPath, 'utf8')).toEqual(
    fs.readFileSync(path.join(VOLVOX, 'volvox.fa.fai'), 'utf8'),
  )
})
