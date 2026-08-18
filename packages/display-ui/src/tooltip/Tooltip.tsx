import { cloneElement } from 'react'

import { useTooltip } from './useTooltip.tsx'

import type { TooltipPlacement } from '@jbrowse/core/ui/BaseTooltip'
import type { ReactElement, ReactNode, Ref } from 'react'

interface TriggerProps {
  ref?: Ref<HTMLElement>
  onPointerEnter?: (event: React.PointerEvent<HTMLElement>) => void
  onPointerLeave?: (event: React.PointerEvent<HTMLElement>) => void
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void
}

function compose<E>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void,
) {
  return (event: E) => {
    theirs?.(event)
    ours(event)
  }
}

/**
 * #api
 * A hover/focus label for a control, drawn rather than delegated to the
 * browser's `title` attribute — positioned so it clears the display's
 * `contain: strict` box and the window edge, dismissed by Escape, and drawn
 * like every other JBrowse tooltip instead of like whatever the host OS
 * renders.
 *
 * `title` is what this chrome used to use, and it was the wrong tool three
 * ways: it can be neither styled nor positioned, it waits about a second and
 * then disappears on a timer of its own, and on a control that already carries
 * an `aria-label` some screen readers announce both strings. This reaches no UI
 * toolkit, so the package's no-Material-UI guarantee holds.
 *
 * Takes a single element child and clones it rather than wrapping it: the
 * controls that want a tooltip are absolutely positioned inside a legend or sit
 * in a flex row, where an extra `<span>` moves them. The child keeps its own
 * handlers — these compose on top of them.
 *
 * ```tsx
 * <Tooltip title="Hide legend">
 *   <button type="button" aria-label="Hide legend" onClick={onDismiss}>
 *     ×
 *   </button>
 * </Tooltip>
 * ```
 *
 * **The child still needs its own accessible name**, because this sets
 * `aria-describedby` and never `aria-label` — see {@link useTooltip}, which is
 * this without the cloning, for a host writing its own markup.
 */
export default function Tooltip({
  title,
  placement,
  children,
}: {
  /** What the bubble says. Nothing renders while this is empty. */
  title: ReactNode
  /** Preferred side. `flip()` overrides it near a viewport edge. */
  placement?: TooltipPlacement
  /** Exactly one element, cloned rather than wrapped. */
  children: ReactElement<TriggerProps>
}) {
  const { triggerProps, tooltip } = useTooltip(title, { placement })
  const props = children.props

  return (
    <>
      {cloneElement(children, {
        ...triggerProps,
        ref: (node: HTMLElement | null) => {
          ;(triggerProps.ref as (node: HTMLElement | null) => void)(node)
          const theirs = props.ref
          if (typeof theirs === 'function') {
            theirs(node)
          } else if (theirs) {
            theirs.current = node
          }
        },
        onPointerEnter: compose(
          props.onPointerEnter,
          triggerProps.onPointerEnter,
        ),
        onPointerLeave: compose(
          props.onPointerLeave,
          triggerProps.onPointerLeave,
        ),
        onPointerDown: compose(props.onPointerDown, triggerProps.onPointerDown),
        onFocus: compose(props.onFocus, triggerProps.onFocus),
        onBlur: compose(props.onBlur, triggerProps.onBlur),
      })}
      {tooltip}
    </>
  )
}
