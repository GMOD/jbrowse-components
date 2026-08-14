import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

// Off-screen but not `display:none` / `visibility:hidden` / `aria-hidden` — any
// of those takes the node out of the accessibility tree, which is exactly what a
// live region must not be. The 1px-clipped box is the long-standing spelling of
// "readable by assistive tech, occupying no layout".
const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const

/**
 * The one thing that tells a screen-reader user a pan, a zoom or a search
 * actually moved the view: a polite live region restating where the view now is.
 *
 * **It reads `coarseVisibleLocStrings`, never `visibleLocStrings`**, and that is
 * the whole design. The fine one changes on every `offsetPx` write — every frame
 * of a drag, a wheel zoom or a keyboard slide — and a live region driven by it
 * queues an utterance per frame, which does not merely say too much: it makes
 * the screen reader unusable for as long as the drag lasts, because polite
 * announcements are a queue rather than a latest-value. The coarse blocks are
 * already the view's settled signal, published by a `delay: 500` autorun
 * (`setupCoarseDynamicBlocksAutorun`) and flushed synchronously by `moveTo` so a
 * discrete jump — a search, a bookmark, `navToLocString` — announces at once
 * instead of 500ms later. Both properties are what this needs, so this adds no
 * timer of its own; if the debounce ever moves, this moves with it.
 *
 * Its own observer so the view container does not re-render when the locus
 * settles: this component is a text node with no children, and the container
 * mounts every track.
 *
 * The region is rendered with its text from the first render rather than being
 * filled after mount. A live region whose content is present when the node is
 * inserted is generally not announced (the region has to exist before the
 * change), so in practice a freshly-mounted view says nothing; where a reader
 * does announce it, "chr1:1..1,000" as the view appears is a fair thing to hear,
 * and it is one utterance per view rather than one per frame.
 */
const NavigationAnnouncer = observer(function NavigationAnnouncer({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { coarseVisibleLocStrings, coarseTotalBpDisplayStr } = model
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={visuallyHidden}
    >
      {coarseVisibleLocStrings
        ? `${coarseVisibleLocStrings} (${coarseTotalBpDisplayStr})`
        : ''}
    </div>
  )
})

export default NavigationAnnouncer
