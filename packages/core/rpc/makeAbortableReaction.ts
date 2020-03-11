import { reaction } from 'mobx'

import { addDisposer, isAlive } from 'mobx-state-tree'
import { isAbortException, checkAbortSignal } from '../util'

/**
 * makes a mobx reaction with the given functions, that calls actions
 * on the model for each stage of execution, and to abort the reaction function when the
 * model is destroyed.
 *
 * Will call flowNameStarted(signal), flowNameSuccess(result), and
 * flowNameError(error) actions on the given state tree model when the
 * async reaction function starts, completes, and errors respectively.
 *
 * @param {StateTreeNode} self
 * @param {string} flowName
 * @param {function} dataFunction -> data
 * @param {async_function} asyncReactionFunction(data, signal) -> result
 * @param {object} reactionOptions
 */
function makeAbortableReaction<T, U>(
  self: T,
  flowName: string,
  dataFunction: (arg: T, name: string) => U,
  asyncReactionFunction: (
    arg: U,
    signal: AbortSignal,
    model: T,
    handle: number,
  ) => Promise<void>,
  reactionOptions: { delay: number },
  startedFunction: (aborter: AbortController) => void,
  successFunction: (arg: any) => void,
  errorFunction: (err: Error) => void,
) {
  let inProgress: AbortController | undefined

  function handleError(error: Error) {
    if (!isAbortException(error)) {
      if (isAlive(self)) {
        errorFunction(error)
      } else {
        console.error(error)
      }
    }
  }

  const reactionDisposer = reaction(
    () => {
      try {
        return dataFunction(self, flowName)
      } catch (error) {
        handleError(error)
        return {}
      }
    },
    (data, mobxReactionHandle) => {
      if (inProgress && !inProgress.signal.aborted) {
        inProgress.abort()
      }

      if (!isAlive(self)) {
        return
      }
      inProgress = new AbortController()

      const thisInProgress = inProgress
      startedFunction(thisInProgress)
      Promise.resolve()
        .then(() =>
          asyncReactionFunction(
            data,
            thisInProgress.signal,
            self,
            mobxReactionHandle,
          ),
        )
        .then(result => {
          checkAbortSignal(thisInProgress.signal)
          if (isAlive(self)) {
            successFunction(result)
          }
        })
        .catch(error => {
          if (thisInProgress && !thisInProgress.signal.aborted)
            thisInProgress.abort()
          handleError(error)
        })
    },
    reactionOptions,
  )
  addDisposer(self, reactionDisposer)
  addDisposer(self, () => {
    if (inProgress && !inProgress.signal.aborted) inProgress.abort()
  })
}

export { makeAbortableReaction }
