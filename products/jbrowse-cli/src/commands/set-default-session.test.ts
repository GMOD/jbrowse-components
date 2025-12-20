/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

import { dataDir, readConf, runCommand, runInTmpDir } from '../testUtil'

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
    expect(error?.message).toMatchSnapshot()
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
