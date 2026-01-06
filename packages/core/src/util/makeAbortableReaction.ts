import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import { isAbortException } from './aborting.ts'
import { createStopToken, stopStopToken } from './stopToken.ts'

import type { StopToken } from './stopToken.ts'
import type { IReactionOptions, IReactionPublic } from 'mobx'

/**
 * makes a mobx reaction with the given functions, that calls actions on the
 * model for each stage of execution, and to abort the reaction function when
 * the model is destroyed.
 *
 * Will call startedFunction(stopToken), successFunction(result), and
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
    stopToken: StopToken,
    model: T,
    handle: IReactionPublic,
  ) => Promise<V>,
  // @ts-expect-error
  reactionOptions: IReactionOptions,
  startedFunction: (stopToken: StopToken) => void,
  successFunction: (arg: V) => void,
  errorFunction: (err: unknown) => void,
) {
  let inProgress: StopToken | undefined

  function handleError(error: unknown) {
    if (!isAbortException(error)) {
      if (isAlive(self)) {
        console.error(error)
        errorFunction(error)
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
        if (inProgress) {
          stopStopToken(inProgress)
        }

        if (!isAlive(self)) {
          return
        }
        inProgress = createStopToken()

        startedFunction(inProgress)
        try {
          const result = await asyncReactionFunction(
            data,
            inProgress,
            self,
            // @ts-expect-error
            mobxReactionHandle,
          )
          if (isAlive(self)) {
            successFunction(result)
          }
        } catch (e) {
          handleError(e)
        }
      },
      reactionOptions,
    ),
  )
  addDisposer(self, () => {
    if (inProgress) {
      stopStopToken(inProgress)
    }
  })
}
