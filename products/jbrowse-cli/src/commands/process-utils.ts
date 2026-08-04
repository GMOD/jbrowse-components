import type { ChildProcess } from 'node:child_process'

// how a spawned child ended. `code` is null when the child was killed by a
// signal rather than exiting, in which case `signal` names it.
export interface ProcessExit {
  code: number | null
  signal: NodeJS.Signals | null
}

export async function waitForProcessClose(
  child: ChildProcess,
): Promise<ProcessExit> {
  return new Promise((resolve, reject) => {
    child.on('close', (code, signal) => {
      resolve({ code, signal })
    })

    child.on('error', err => {
      reject(err)
    })
  })
}

// A downstream consumer closing the pipe early — `jbrowse sort-bed big.bed |
// head` — is that consumer's choice, not a failure of ours. `sh` reports a
// pipeline member's death by SIGPIPE as 128+13 rather than propagating the
// signal, so both spellings have to be recognized.
export function diedOfSigpipe({ code, signal }: ProcessExit) {
  return signal === 'SIGPIPE' || code === 128 + 13
}

// for an error message: the exit code, or the signal when the child was killed
export function describeExit({ code, signal }: ProcessExit) {
  return code === null ? `signal ${signal}` : `code ${code}`
}
