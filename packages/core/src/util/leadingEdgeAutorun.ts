import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface LeadingEdgeAutorunOptions {
  /** autorun name, for the MobX devtools/spy stream */
  name: string
  /** how long to coalesce reruns once the body has started work once */
  delay: number
}

/**
 * An autorun that runs immediately until its body reports having started work,
 * and debounces every run after that.
 *
 * MobX's own `autorun(fn, { delay })` is trailing-edge only: it schedules the
 * *first* run through `setTimeout` too, so a cold open waits the whole delay
 * for no interaction to coalesce, and that latency lands directly on first
 * paint. Measured on the per-region fetch autorun, display creation to first
 * `fetchNeeded`: 683 ms under `{ delay: 600 }`, 112 ms under this.
 *
 * **The body returns `true` when it started the work the delay exists to
 * coalesce**, and that is what arms the debounce. Runs that bail on a guard —
 * a view not measured yet, a minimized track, a prerequisite that has not
 * landed — return nothing and stay on the leading edge, so the timer is never
 * armed by work that did not happen. Priming off the body's return rather than
 * an imperative `prime()` call is what makes a bail-out path unable to arm it
 * by accident: there is nothing to forget and nothing to misplace.
 *
 * The debounce is per-installation, so two autoruns on one model coalesce
 * independently.
 */
export function leadingEdgeAutorun(
  self: IAnyStateTreeNode,
  body: () => boolean | void,
  { name, delay }: LeadingEdgeAutorunOptions,
) {
  let primed = false
  addDisposer(
    self,
    autorun(
      () => {
        if (body()) {
          primed = true
        }
      },
      {
        name,
        scheduler: run => {
          if (primed) {
            setTimeout(run, delay)
          } else {
            run()
          }
        },
      },
    ),
  )
}
