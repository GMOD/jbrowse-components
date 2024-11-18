import { when as mobxWhen, IWhenOptions } from 'mobx'
import { checkStopToken } from './stopToken'

interface WhenOpts extends IWhenOptions {
  stopToken?: string
}

/**
 * Wrapper for mobx `when` that adds timeout and aborting support.
 */
export function when(
  getter: () => boolean,
  { timeout, stopToken, name }: WhenOpts = {},
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
      finishTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    }

    // set up aborting
    if (stopToken !== undefined) {
      try {
        checkStopToken(stopToken)
      } catch (e) {
        finished = true
        whenPromise.cancel()
        finishTimeout()
        reject(new Error('aborted'))
      }
    }

    whenPromise
      .then(() => {
        if (!finished) {
          finished = true
          finishTimeout()

          resolve(true)
        }
      })
      .catch((err: unknown) => {
        if (!finished) {
          finished = true
          finishTimeout()
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
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
