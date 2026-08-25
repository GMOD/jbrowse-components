import { isAbortException } from '@jbrowse/core/util/aborting'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Install a fetch that depends on an earlier fetch having landed: its specs are
 * derived from data the first one committed, so it cannot be issued until that
 * exists and has to be re-issued whenever the derived specs change identity.
 *
 * `specsOf` is read synchronously in the autorun body so everything it touches
 * is tracked, the round trips run off those tracked reads, and the commit is
 * stale-checked against the key the specs carry when it lands — a mid-flight
 * pan therefore discards its own result rather than labelling it with the new
 * specs. A superseded fetch is stopped through its token, so the abort it
 * rejects with is expected and is not logged.
 *
 * **The in-flight key is cleared when the specs go empty**, which is the whole
 * bookkeeping rule here and the one that was missing. Set-and-never-reset
 * stalls permanently: a fetch is in flight for key K, the specs go empty (a
 * region with no data, so they key as `''`), the fetch lands and is dropped as
 * stale, and coming back to the same view re-derives K — which the body reads
 * as "already in flight" and declines forever. Nothing refetches, the committed
 * key stays behind the specs, and any display phase gated on the two agreeing
 * sits at `loading` for good.
 */
export function installKeyedFetch<Spec, Result>(
  self: IStateTreeNode,
  {
    name,
    delay,
    specsOf,
    fetchOne,
    commit,
  }: {
    name: string
    delay: number
    specsOf: () => { key: string; specs: Spec[] }
    fetchOne: (
      spec: Spec,
      stopToken: StopToken,
    ) => Promise<readonly [string, Result]>
    commit: (key: string, entries: Map<string, Result>) => void
  },
) {
  let inflightKey: string | undefined
  let stopToken: StopToken | undefined
  addDisposer(
    self,
    autorun(
      () => {
        const { key, specs } = specsOf()
        if (specs.length === 0) {
          inflightKey = undefined
        } else if (key !== inflightKey) {
          inflightKey = key
          if (stopToken !== undefined) {
            stopStopToken(stopToken)
          }
          const fetchStopToken = createStopToken()
          stopToken = fetchStopToken
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            const isCurrent = () => isAlive(self) && specsOf().key === key
            try {
              const entries = await Promise.all(
                specs.map(spec => fetchOne(spec, fetchStopToken)),
              )
              if (isCurrent()) {
                commit(key, new Map(entries))
              }
            } catch (e) {
              if (!isAbortException(e)) {
                console.error(`${name} failed`, e)
              }
              // commit nothing rather than holding the phase at loading: an
              // empty result is current, so whatever gates on this settles
              if (isCurrent()) {
                commit(key, new Map())
              }
            }
          })()
        }
      },
      { delay, name },
    ),
  )
}
