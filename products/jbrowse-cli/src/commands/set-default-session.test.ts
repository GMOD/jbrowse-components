/**
 * @jest-environment node
 */

import fs from 'node:fs'
import path from 'node:path'

import {
  ctxDir,
  dataDir,
  readConf,
  runCommand,
  runInTmpDir,
} from '../testUtil.ts'

const { copyFile, rename } = fs.promises

const simpleBam = dataDir('simple.bam')
const simpleDefaultSession = dataDir('sampleDefaultSession.json')
const testConfig = dataDir('test_config.json')

test('fails when no necessary default session information is provided', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

    await rename(
      path.join(ctx.dir, path.basename(testConfig)),
      path.join(ctx.dir, 'config.json'),
    )
    const { error } = await runCommand(['set-default-session'])
    expect(error?.message).toMatchSnapshot()
  })
})

test('fails when default session is not readable', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))
    await rename(
      path.join(ctx.dir, path.basename(testConfig)),
      path.join(ctx.dir, 'config.json'),
    )
    const { error } = await runCommand([
      'set-default-session',
      '--session',
      '{}',
    ])
    expect(error?.message).toMatchSnapshot()
  })
})
test('fails when file does not exist', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))
    await rename(
      path.join(ctx.dir, path.basename(testConfig)),
      path.join(ctx.dir, 'config.json'),
    )
    const { error } = await runCommand([
      'set-default-session',
      '--session',
      path.join(simpleDefaultSession, 'nonexist.json'),
    ])
    expect(error?.message).toContain('ENOTDIR')
  })
})

test('fails when file is does not have a default session to read', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

    await rename(
      path.join(ctx.dir, path.basename(testConfig)),
      path.join(ctx.dir, 'config.json'),
    )
    const { error } = await runCommand([
      'set-default-session',
      '--session',
      simpleBam,
    ])
    expect(error?.message).toMatchSnapshot()
  })
})
test('deletes a default session', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

    await rename(
      path.join(ctx.dir, path.basename(testConfig)),
      path.join(ctx.dir, 'config.json'),
    )
    await runCommand(['set-default-session', '--delete'])

    expect(readConf(ctx)).toMatchSnapshot()
  })
})

test('adds a default session from a file', async () => {
  await runInTmpDir(async ctx => {
    await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

    await rename(
      path.join(ctx.dir, path.basename(testConfig)),
      path.join(ctx.dir, 'config.json'),
    )
    await runCommand(['set-default-session', '--session', simpleDefaultSession])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})

// the session (or its "session" key) has to be an object: spreading a string or
// an array silently wrote a defaultSession of numeric character keys
test.each([
  ['{"session":"oops"}', 'under its "session" key'],
  ['["not","an","object"]', 'does not contain a session object'],
])('rejects a session file that is not an object (%s)', async (body, msg) => {
  await runInTmpDir(async ctx => {
    fs.copyFileSync(dataDir('test_config.json'), ctxDir(ctx, 'config.json'))
    fs.writeFileSync(ctxDir(ctx, 'bad.json'), body)
    const before = readConf(ctx)
    const { error } = await runCommand([
      'set-default-session',
      '--session',
      'bad.json',
    ])
    expect(error?.message).toContain(msg)
    // the config is left exactly as it was, rather than gaining a
    // defaultSession of numeric character keys
    expect(readConf(ctx)).toEqual(before)
  })
})
