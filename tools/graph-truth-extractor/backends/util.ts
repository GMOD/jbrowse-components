import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

import type { SpawnOptions } from 'child_process'

export interface RunOpts extends SpawnOptions {
  input?: string | Uint8Array
  // If true, captured stderr text is included in the thrown Error message
  // when the command exits non-zero. Default true.
  surfaceStderr?: boolean
}

export interface RunResult {
  stdout: string
  stderr: string
  code: number | null
}

export interface BinaryRunResult {
  stdout: Uint8Array
  stderr: string
  code: number | null
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

function runRaw(
  cmd: string,
  args: string[],
  opts: RunOpts = {},
): Promise<{ chunks: Uint8Array[]; stderr: string; code: number | null }> {
  const { input, surfaceStderr = true, ...spawnOpts } = opts
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      ...spawnOpts,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const chunks: Uint8Array[] = []
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => {
      chunks.push(new Uint8Array(d))
    })
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf8')
    })
    proc.on('error', err => {
      reject(err)
    })
    proc.on('close', code => {
      if (code !== 0) {
        const tail = surfaceStderr ? `\nstderr:\n${stderr}` : ''
        reject(
          new Error(
            `Command failed: ${cmd} ${args.join(' ')} (exit ${code})${tail}`,
          ),
        )
        return
      }
      resolve({ chunks, stderr, code })
    })
    if (input !== undefined) {
      proc.stdin.end(input)
    } else {
      proc.stdin.end()
    }
  })
}

export async function runCommand(
  cmd: string,
  args: string[],
  opts: RunOpts = {},
): Promise<RunResult> {
  const { chunks, stderr, code } = await runRaw(cmd, args, opts)
  const decoder = new TextDecoder()
  return {
    stdout: decoder.decode(concatUint8Arrays(chunks)),
    stderr,
    code,
  }
}

export async function runCommandBinary(
  cmd: string,
  args: string[],
  opts: RunOpts = {},
): Promise<BinaryRunResult> {
  const { chunks, stderr, code } = await runRaw(cmd, args, opts)
  return {
    stdout: concatUint8Arrays(chunks),
    stderr,
    code,
  }
}

export function which(cmd: string): string | undefined {
  const paths = (process.env.PATH ?? '').split(path.delimiter)
  for (const p of paths) {
    const full = path.join(p, cmd)
    if (fs.existsSync(full)) {
      try {
        const st = fs.statSync(full)
        if (st.isFile()) {
          return full
        }
      } catch {
        // ignore
      }
    }
  }
  return undefined
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

export function getCacheDir(gfaPath: string, override?: string): string {
  const dir = override ?? `${gfaPath}.truth-cache`
  ensureDir(dir)
  return dir
}

// Convert "PathName:start-end" → "PathName" (helper for vg find).
export function makeRegionString(
  pathName: string,
  start: number,
  end: number,
): string {
  return `${pathName}:${start}-${end}`
}
