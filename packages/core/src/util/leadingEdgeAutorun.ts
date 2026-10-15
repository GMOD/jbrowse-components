import { namedAutorun } from '@jbrowse/render-core/namedReactions'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface LeadingEdgeAutorunOptions {
  /** autorun name, for the MobX devtools/spy stream */
  name: string
  /** how long to coalesce reruns once the body has started work once */
  delay: number
  /**
   * Run on the leading edge again once the last run that started work is at
   * least `delay` old. A change that arrives after the autorun has sat idle,
   * such as a jump to a new locus, has nothing to coalesce with, so waiting the
   * delay out only adds latency. A change within `delay` of that work is
   * coalesced as before.
   */
  idleLeading?: boolean
}

/**
 * An autorun that runs on the leading edge until its body reports having
 * started work, and debounces every run after that.
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
 * **The leading edge is a microtask, not the install call itself**, and that
 * one hop is what keeps the debounce's whole point. A model is routinely built
 * and then configured in the same synchronous block — a session applying a
 * display setting, a caller flipping a mode right after `create` — and a fetch
 * issued between those two lines is issued against the un-configured state,
 * invalidated by the setting that follows, and reissued. Yielding once collapses
 * every such pair back into one run, while still starting three orders of
 * magnitude sooner than the timer did. What it deliberately does not coalesce is
 * a change that arrives after an await: that is a later decision, and it costs
 * the refetch it should.
 *
 * The debounce is per-installation, so two autoruns on one model coalesce
 * independently.
 */
export function leadingEdgeAutorun(
  self: IAnyStateTreeNode,
  body: () => boolean | void,
  { name, delay, idleLeading = false }: LeadingEdgeAutorunOptions,
) {
  let primed = false
  let lastWork = Number.NEGATIVE_INFINITY
  return namedAutorun(
    self,
    () => {
      if (body()) {
        primed = true
        lastWork = performance.now()
      }
    },
    {
      name,
      scheduler: run => {
        const idle = idleLeading && performance.now() - lastWork >= delay
        if (primed && !idle) {
          setTimeout(run, delay)
        } else {
          queueMicrotask(run)
        }
      },
    },
  )
}
