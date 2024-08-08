import { runCommand } from '@oclif/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

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
      fs.rmSync(dir, { recursive: true })
    }
    process.chdir(originalDir)
  }
}
export async function setup(str: string | string[]) {
  return runCommand(str)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// source https://stackoverflow.com/a/64255382/2129219
export async function copyDir(src: string, dest: string) {
  await fs.promises.mkdir(dest, { recursive: true })
  const entries = await fs.promises.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    entry.isDirectory()
      ? await copyDir(srcPath, destPath)
      : await fs.promises.copyFile(srcPath, destPath)
  }
}
