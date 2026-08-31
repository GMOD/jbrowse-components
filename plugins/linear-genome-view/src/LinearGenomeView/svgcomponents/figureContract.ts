import { useEffect, useRef } from 'react'

import { svgNodeId } from '@jbrowse/core/svg/svgId'
import {
  contractReportsOn,
  reportContractViolation,
} from '@jbrowse/render-core/contractReports'

import type { RefObject } from 'react'

/**
 * Checks that a live SVG figure is being used the way it can work.
 *
 * `useViewSvgFigure` publishes a figure whose two halves are drawn at different
 * moments and only agree by construction, and both ways of breaking that are
 * invisible in the output: the drawing is still a plausible picture of
 * somewhere, just not of one moment or not with its own clips. So the run
 * reports instead, through the `[jbrowse <family> contract]` channel every
 * check in the tree uses — `config/jest/contractGate.js` fails the test that
 * collects one, and ARCHITECTURAL_LIMITS.md §"Ordering is the contract" is the
 * register. `figure` rather than `svg-figure` because the gate's family pattern
 * is `\w+`, which a hyphen is not.
 *
 * Reported and never thrown, as the rest of that family: a figure is chrome a
 * host renders beside its own, and taking the host's tree down over a drawing
 * is worse than the drawing being wrong.
 */
function report(message: string) {
  reportContractViolation('figure', message)
}

// Live figures per view, keyed the way their SVG ids are. A count rather than a
// flag: the report belongs on the second mount, and the first has to survive the
// second unmounting.
const figuresPerView = new Map<string, number>()

/**
 * One live figure per view.
 *
 * Every id a figure mints is `<what>-${svgNodeId(view)}`, deterministic so that
 * exporting an unchanged view twice produces the same bytes (see `svgNodeId`).
 * The same property makes two figures of ONE view collide on all of them, and
 * SVG ids are document-global with `url(#…)` resolving to the first match — so
 * the second figure's tracks are clipped by the first figure's rects. With
 * different options on the two (the reason to draw two in the first place) those
 * rects are the wrong size, and it reads as a track drawn unclipped or a
 * highlight band cut short.
 *
 * Deliberately not fixed by scoping the ids per figure. The determinism is load
 * bearing for the file export that shares these components, and a second figure
 * of one view is a thing to do differently rather than a case to support.
 */
export function useOneFigurePerView(view: { id: string }) {
  useEffect(() => {
    // captured, not re-derived on cleanup: by then the view may have left the
    // tree, and `svgNodeId` walks it
    const key = svgNodeId(view)
    const live = (figuresPerView.get(key) ?? 0) + 1
    figuresPerView.set(key, live)
    if (live > 1) {
      report(
        `${live} live figures of one view are mounted at once. They mint the ` +
          `same SVG ids (ruler-clip-${key}, track-clip-${key}-<trackId>, …), ` +
          `ids are document-global, and url(#…) resolves to the first match — ` +
          `so every figure after the first is clipped by the first one's rects ` +
          `and draws its tracks and highlights at the wrong extent. Render one ` +
          `figure per view.`,
      )
    }
    return () => {
      const left = (figuresPerView.get(key) ?? 1) - 1
      if (left > 0) {
        figuresPerView.set(key, left)
      } else {
        figuresPerView.delete(key)
      }
    }
  }, [view])
}

/**
 * Nothing inside a figure re-renders itself.
 *
 * A figure's track bodies are built once and frozen; its ruler, scalebar and
 * seams re-derive from the model on any render they get. The `memo` in
 * `useViewSvgFigure` is what keeps those in step, and it sits between the figure
 * and its PARENT — it is not between a component inside the figure and MobX. An
 * `observer` in there re-renders on its own subscription and slides across
 * bodies drawn at a moment in the past, which is a rendering bug the picture
 * gives no sign of.
 *
 * Checked as the state rather than the shape, because the shape is not
 * detectable: `observer(f)` on a function component is `memo(f)` with no marker
 * on it, so it cannot be told from a plain `memo`, which is harmless. Watching
 * for the symptom also covers what an enumeration would miss — a plugin's
 * component reached through `LinearGenomeView-HighlightSVGComponent`, an
 * observer a display's `renderSvg` returned, or a subscription that is not
 * MobX's at all.
 *
 * A mutation is only a violation while the snapshot is unchanged. React's own
 * commit for a NEW snapshot mutates this subtree too, so `rendered` moves to
 * that snapshot during the render that precedes the commit and the records are
 * ignored.
 */
export function useFrozenFigureContract(
  ref: RefObject<SVGSVGElement | null>,
  snapshot: object,
) {
  const rendered = useRef(snapshot)
  rendered.current = snapshot
  useEffect(() => {
    const el = ref.current
    // the one check here with a cost of its own — a `MutationObserver` over the
    // whole figure subtree — so unlike its neighbour it asks whether the
    // channel is armed rather than running and reporting into it
    if (!contractReportsOn() || !el) {
      return undefined
    }
    const observer = new MutationObserver(() => {
      if (rendered.current !== snapshot) {
        return
      }
      // once is the whole message; a drifting subtree mutates every frame
      observer.disconnect()
      report(
        `a figure redrew part of itself against a snapshot that did not ` +
          `change, so its chrome and its track bodies now describe different ` +
          `moments and a pan slides one across the other. Something inside it ` +
          `is subscribed to the view — most often an observer component a ` +
          `plugin contributed to LinearGenomeView-HighlightSVGComponent, or ` +
          `one a display's renderSvg returned. Nothing inside a figure may be ` +
          `an observer: the memo that freezes it is between the figure and its ` +
          `parent, not between an observer and MobX.`,
      )
    })
    observer.observe(el, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
    return () => {
      observer.disconnect()
    }
  }, [ref, snapshot])
}
