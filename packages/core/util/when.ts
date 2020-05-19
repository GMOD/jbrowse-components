import { when as mobxWhen } from 'mobx'
import { makeAbortError } from './aborting'

interface WhenOpts {
  timeout?: number
  signal?: AbortSignal
  name?: string
}

/**
 * Wrapper for mobx `when` that adds timeout and aborting support.
 */
export function when(
  getter: () => boolean,
  { timeout, signal, name }: WhenOpts = {},
) {
  return new Promise((resolve, reject) => {
    let finished = false

    const whenPromise = mobxWhen(getter)

    // set up timeout
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let finishTimeout = () => {}
    if (timeout) {
      timeoutId = setTimeout(() => {
        if (!finished) {
          finished = true
          whenPromise.cancel()
          reject(new Error(`timed out waiting for ${name || 'whenPresent'}`))
        }
      }, timeout)
      finishTimeout = () => timeoutId && clearTimeout(timeoutId)
    }

    // set up aborting
    if (signal) {
      signal.addEventListener('abort', () => {
        if (!finished) {
          finished = true

          // mobx when supports a cancel method
          whenPromise.cancel()
          finishTimeout()

          reject(makeAbortError())
        }
      })
    }

    whenPromise
      .then(() => {
        if (!finished) {
          finished = true
          finishTimeout()

          resolve()
        }
      })
      .catch(err => {
        if (!finished) {
          finished = true
          finishTimeout()

          reject(err)
        }
      })
  })
}

/**
 * Wrapper for mobx `when` that makes a promise for the return value
 * of the given function at the point in time when it becomes not
 * undefined and not null.
 */
export async function whenPresent<FUNCTION extends () => unknown>(
  getter: FUNCTION,
  opts: WhenOpts = {},
): Promise<NonNullable<ReturnType<FUNCTION>>> {
  await when(() => {
    const val = getter()
    return val !== undefined && val !== null
  }, opts)

  return getter() as NonNullable<ReturnType<FUNCTION>>
}
