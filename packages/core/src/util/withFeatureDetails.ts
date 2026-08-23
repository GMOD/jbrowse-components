import { isAlive } from '@jbrowse/mobx-state-tree'

import { notifyFeatureDetailsMiss } from './openFeatureWidget.ts'
import { getNotificationSink } from './sessionServices.ts'

import type { Feature } from './simpleFeature.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Run `onFeat` on the feature a details lookup answers with, and say something
 * when it answers with nothing.
 *
 * Every display paints from slim render arrays and re-fetches the whole feature
 * on demand, so "click a feature, open its details" is always a round trip that
 * can come back empty. Six call sites across three plugins had written that
 * round trip out, and the shape they shared was
 * `if (feature && isAlive(self)) { … }` — a guard that reads as defensive and is
 * really the whole of what a click does when the lookup fails. Five of the six
 * did nothing at all, which is the worst answer to a click: the user cannot tell
 * a missing feature from a dead menu item.
 *
 * **The three outcomes are separated here because only here can they be told
 * apart**, and conflating any two of them is a bug this replaces:
 *
 * - **threw** — reported with its own reason, through `notifyError`. A `fetch`
 *   passed in must therefore let its errors out; one that catches and answers
 *   `undefined` turns its failure into the miss below, and the user is told off
 *   twice for one click, the second time less usefully.
 * - **answered nothing** — `onMiss`, which defaults to the shared sentence.
 * - **the node died mid-flight** — nothing but the console. A track can be
 *   unticked while the fetch is in flight, and every branch below reaches
 *   `getSession(self)`, which throws on a detached node — inside a floating
 *   promise, where nothing catches it.
 *
 * `onMiss` is a parameter rather than fixed because one caller legitimately
 * stays quiet: the pileup pre-warms the read behind a context menu before the
 * user has asked for anything, so a miss there just leaves the menu without its
 * feature items. Passing `() => {}` is how a call site says it is speculative.
 */
export async function withFeatureDetails(
  self: IStateTreeNode,
  fetch: () => Promise<Feature | undefined>,
  onFeat: (feat: Feature) => void,
  onMiss: () => void = () => {
    notifyFeatureDetailsMiss(self)
  },
) {
  try {
    const feature = await fetch()
    if (!isAlive(self)) {
      return
    }
    if (feature) {
      onFeat(feature)
    } else {
      onMiss()
    }
  } catch (e) {
    // Logged whatever happened, and only toasted while the display is still
    // there: `getSession` throws on a detached node, and a message naming a
    // track the user has already closed is noise they cannot act on.
    console.error(e)
    if (isAlive(self)) {
      getNotificationSink(self).notifyError(`${e}`, e)
    }
  }
}
