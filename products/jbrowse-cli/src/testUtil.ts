import fs from 'fs'
import os from 'os'
import path from 'path'
import { runCommand } from '@oclif/test'

const { mkdir, mkdtemp } = fs.promises

// increase test timeout for all tests
jest.setTimeout(20000)

// On macOS, os.tmpdir() is not a real path:
// https://github.com/nodejs/node/issues/11422
const tmpDir = fs.realpathSync(os.tmpdir())

export async function runInTmpDir(
  callbackFn: (args: { dir: string; originalDir: string }) => Promise<void>,
) {
  const originalDir = process.cwd()
  let dir: string | undefined
  try {
    const jbrowseTmpDir = path.join(tmpDir, 'jbrowse')
    await mkdir(jbrowseTmpDir, { recursive: true })
    dir = await mkdtemp(path.join(jbrowseTmpDir, path.sep))
    process.chdir(dir)
    await callbackFn({ dir, originalDir })
  } finally {
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    process.chdir(originalDir)
  }
}
export async function setup(str: string | string[]) {
  return runCommand(str)
}

type Conf = Record<string, any>

export function readConf(ctx: { dir: string }, ...rest: string[]): Conf {
  return JSON.parse(
    fs.readFileSync(path.join(ctx.dir, ...rest, 'config.json'), 'utf8'),
  )
}

export function readConfAlt(ctx: { dir: string }, ...rest: string[]): Conf {
  return JSON.parse(fs.readFileSync(path.join(ctx.dir, ...rest), 'utf8'))
}

export function dataDir(str: string) {
  return path.join(__dirname, '..', 'test', 'data', str)
}

export function ctxDir(ctx: { dir: string }, str: string) {
  return path.join(ctx.dir, str)
}
