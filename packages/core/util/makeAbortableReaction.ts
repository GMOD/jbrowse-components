import { addDisposer, isAlive } from 'mobx-state-tree'
import { reaction, IReactionPublic, IReactionOptions } from 'mobx'
import { isAbortException, checkAbortSignal } from './aborting'

/**
 * makes a mobx reaction with the given functions, that calls actions on the
 * model for each stage of execution, and to abort the reaction function when
 * the model is destroyed.
 *
 * Will call startedFunction(signal), successFunction(result), and
 * errorFunction(error) when the async reaction function starts, completes, and
 * errors respectively.
 *
 * @param self -
 * @param dataFunction -
 * @param asyncReactionFunction -
 * @param reactionOptions -
 * @param startedFunction -
 * @param successFunction -
 * @param errorFunction -
 */
export function makeAbortableReaction<T, U, V>(
  self: T,
  dataFunction: (arg: T) => U,
  asyncReactionFunction: (
    arg: U | undefined,
    signal: AbortSignal,
    model: T,
    handle: IReactionPublic,
  ) => Promise<V>,
  // @ts-expect-error
  reactionOptions: IReactionOptions,
  startedFunction: (aborter: AbortController) => void,
  successFunction: (arg: V) => void,
  errorFunction: (err: unknown) => void,
) {
  let inProgress: AbortController | undefined

  console.log('making new')
  function handleError(error: unknown) {
    if (!isAbortException(error)) {
      if (isAlive(self)) {
        errorFunction(error)
      } else {
        console.error(error)
      }
    }
  }

  addDisposer(
    self,
    reaction(
      () => {
        try {
          return dataFunction(self)
        } catch (e) {
          handleError(e)
          return undefined
        }
      },
      async (data, mobxReactionHandle) => {
        if (inProgress && !inProgress.signal.aborted) {
          console.log('abort new')
          inProgress.abort()
        }

        if (!isAlive(self)) {
          return
        }
        inProgress = new AbortController()

        const thisInProgress = inProgress
        startedFunction(thisInProgress)
        try {
          const result = await asyncReactionFunction(
            data,
            thisInProgress.signal,
            self,
            // @ts-expect-error
            mobxReactionHandle,
          )
          checkAbortSignal(thisInProgress.signal)
          if (isAlive(self)) {
            successFunction(result)
          }
        } catch (e) {
          if (!thisInProgress.signal.aborted) {
            console.log('abort catch')
            thisInProgress.abort()
          }
          handleError(e)
        }
      },
      reactionOptions,
    ),
  )
  addDisposer(self, () => {
    if (inProgress && !inProgress.signal.aborted) {
      console.log('abort dispose')
      inProgress.abort()
    }
  })
}
