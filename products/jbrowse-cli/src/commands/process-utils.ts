import type { ChildProcess } from 'child_process'

export async function waitForProcessClose(
  child: ChildProcess,
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    child.on('close', code => {
      resolve(code)
    })

    child.on('error', err => {
      reject(err)
    })
  })
}
