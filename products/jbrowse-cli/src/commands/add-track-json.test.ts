/**
 * @jest-environment node
 */

import fs from 'node:fs'

import {
  ctxDir,
  dataDir,
  readConf,
  runCommand,
  runInTmpDir,
} from '../testUtils.ts'

const { copyFile, writeFile } = fs.promises

const track = {
  type: 'FeatureTrack',
  trackId: 'genes',
  name: 'Genes',
  assemblyNames: ['testAssembly'],
}

async function initctx(ctx: { dir: string }) {
  await copyFile(dataDir('test_config.json'), ctxDir(ctx, 'config.json'))
}

test('malformed inline JSON reports the parse error, not a missing file', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    const { error } = await runCommand([
      'add-track-json',
      '{"trackId": "genes"',
    ])
    expect(error?.message).toContain('JSON')
    expect(error?.message).not.toContain('ENOENT')
  })
})

test('adds a track from a JSON file', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await writeFile(ctxDir(ctx, 'track.json'), JSON.stringify(track))
    const { stdout, error } = await runCommand(['add-track-json', 'track.json'])
    expect(error).toBeUndefined()
    expect(stdout).toContain('Added track with name "Genes"')
    expect(readConf(ctx).tracks).toEqual([track])
  })
})

test('adds a track from inline JSON', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    const { error } = await runCommand([
      'add-track-json',
      JSON.stringify(track),
    ])
    expect(error).toBeUndefined()
    expect(readConf(ctx).tracks).toEqual([track])
  })
})

test('refuses a duplicate trackId without --update', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand(['add-track-json', JSON.stringify(track)])
    const { error } = await runCommand([
      'add-track-json',
      JSON.stringify({ ...track, name: 'Other' }),
    ])
    expect(error?.message).toContain('a track with that trackId already exists')
    expect(readConf(ctx).tracks).toEqual([track])
  })
})

test('--update replaces the track with the same trackId', async () => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    await runCommand(['add-track-json', JSON.stringify(track)])
    const replacement = { ...track, name: 'Other' }
    const { stdout, error } = await runCommand([
      'add-track-json',
      JSON.stringify(replacement),
      '--update',
    ])
    expect(error).toBeUndefined()
    expect(stdout).toContain('Overwrote track with name "Other"')
    expect(readConf(ctx).tracks).toEqual([replacement])
  })
})

test.each([
  ['an array', JSON.stringify([track])],
  ['an object without a trackId', JSON.stringify({ name: 'Genes' })],
  ['an object with a numeric trackId', JSON.stringify({ trackId: 7 })],
  ['a string', JSON.stringify('genes')],
])('rejects %s', async (_label, json) => {
  await runInTmpDir(async ctx => {
    await initctx(ctx)
    const { error } = await runCommand(['add-track-json', json])
    expect(error?.message).toContain(
      'must be an object with a string "trackId"',
    )
    expect(readConf(ctx).tracks).toEqual([])
  })
})
