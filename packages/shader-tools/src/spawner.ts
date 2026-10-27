// The build's child processes start here, in a process with a small heap.
// fork() copies the caller's page tables, so a spawn from the build itself took
// 25 ms of its one main thread where a spawn from here takes 3.
import { spawn } from 'node:child_process'

export interface SpawnRequest {
  id: number
  bin: string
  args: string[]
}

export interface SpawnResult {
  id: number
  status: number | null
  signal: string | null
  output: string
  error?: string
}

process.on('message', ({ id, bin, args }: SpawnRequest) => {
  const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  let settled = false
  const reply = (result: Omit<SpawnResult, 'id'>) => {
    if (!settled) {
      settled = true
      process.send!({ id, ...result } satisfies SpawnResult)
    }
  }
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => (output += chunk))
  child.stderr.on('data', (chunk: string) => (output += chunk))
  child.on('error', err => {
    reply({ status: null, signal: null, output, error: err.message })
  })
  child.on('close', (status, signal) => {
    reply({ status, signal, output })
  })
})
