/**
 * @jest-environment node
 */

import fs from 'node:fs'

import { ctxDir, dataDir, runCommand, runInTmpDir } from '../testUtils.ts'

const { copyFile } = fs.promises

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
