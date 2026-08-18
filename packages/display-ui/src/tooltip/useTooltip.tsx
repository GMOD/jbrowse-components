import { Suspense, lazy, useEffect, useId, useRef, useState } from 'react'

import type { TooltipPlacement } from '@jbrowse/core/ui/BaseTooltip'
import type { ReactNode, Ref } from 'react'

// The bubble is `BaseTooltip`, the same component the ten display tooltips draw
// — this hook supplies the hover, the focus and the dismissal, and hands it an
// element to hang off instead of a cursor position. There is one tooltip in
// JBrowse and one @floating-ui in the tree; a second one here would have
// differed only in which reference it positioned against.
//
// The `lazy` is the point rather than an optimization. @floating-ui is ~266KB
// and this package's chrome — the plain overlay set, the corner control, the
// legend — is imported eagerly by every display that renders one, so a static
// import would put a positioning library on the cold shell's critical path of
// every JBrowse product and every embed for a box nobody has hovered yet.
// `@jbrowse/core` broke a published ABI over exactly this, moving `BaseTooltip`
// out of its `ui` barrel onto its own lazy module (see `ReExports/modules.ts`);
// `eagerBoundary.test.ts` beside this file is what stops someone quietly
// turning the import below into an `import … from`.
const BaseTooltip = lazy(() => import('@jbrowse/core/ui/BaseTooltip'))

// How long the pointer rests before the tooltip appears. The browser's own
// `title` waited about a second, which is long enough that people stop
// expecting anything and move on; this is roughly Material UI's delay.
//
// Keyboard focus skips it entirely — a tab landing on a control is deliberate
// in a way a pointer crossing it is not.
const ENTER_DELAY_MS = 400

export interface TooltipTrigger {
  /** Whether the bubble is up, for a caller that wants to style the trigger. */
  open: boolean
  /**
   * Spread onto the control the tooltip describes. `aria-describedby`, not
   * `aria-label`: the tooltip is a visual affordance, and a name pointing at a
   * node that exists only during a hover leaves the control unnamed the rest of
   * the time. **The control still needs its own accessible name.**
   */
  triggerProps: {
    ref: Ref<HTMLElement>
    'aria-describedby': string | undefined
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => void
    onPointerLeave: () => void
    onPointerDown: () => void
    onFocus: () => void
    onBlur: () => void
  }
  /** Render this. It is `null` until the bubble is up, and portals itself. */
  tooltip: ReactNode
}

/**
 * #api
 * A hover/focus label for one control, as props to spread — the headless half
 * of {@link Tooltip}, for a host writing its own chrome rather than restyling
 * ours. Same relationship `useTrackControlMenu` has to `plainTrackControl`.
 *
 * ```tsx
 * const { triggerProps, tooltip } = useTooltip('Hide legend')
 * return (
 *   <>
 *     <button {...triggerProps} aria-label="Hide legend" onClick={onDismiss}>
 *       ×
 *     </button>
 *     {tooltip}
 *   </>
 * )
 * ```
 *
 * `triggerProps` carries no `onClick`, so a control's own handler does not
 * collide with it. Any other handler on this list has to compose rather than
 * replace — spread first, then call `triggerProps.onFocus` from yours.
 */
export function useTooltip(
  /** What the bubble says. It stays down while this is empty. */
  title: ReactNode,
  { placement = 'top' }: { placement?: TooltipPlacement } = {},
): TooltipTrigger {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const id = useId()

  const cancel = () => {
    clearTimeout(timer.current)
    timer.current = undefined
  }
  const hide = () => {
    cancel()
    setOpen(false)
  }

  useEffect(() => {
    if (!open) {
      return
    }
    // Escape is the one dismissal a pointer leaving cannot cover: a tooltip
    // raised by keyboard focus stays up until the focus moves, and a bubble
    // over the thing being read is in the way. Scrolling and resizing need no
    // handler — the bubble follows its anchor through `autoUpdate` rather than
    // being measured once, which is the difference between this and the menu in
    // `useTrackControlMenu`, where a scroll dismisses.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  const show = open && !!anchor && title !== '' && title !== undefined

  return {
    open: show,
    triggerProps: {
      ref: setAnchor,
      'aria-describedby': show ? id : undefined,
      onPointerEnter: event => {
        // A touch "hover" is the press that is also about to be a click, and a
        // bubble over the thing being tapped helps nobody. Touch users get the
        // `aria-label` the control already carries.
        if (event.pointerType === 'touch') {
          return
        }
        cancel()
        timer.current = setTimeout(() => {
          setOpen(true)
        }, ENTER_DELAY_MS)
      },
      onPointerLeave: hide,
      // The press answers "what is this?", so a label still hanging over the
      // control that just did something reads as a stuck tooltip.
      onPointerDown: hide,
      onFocus: () => {
        cancel()
        setOpen(true)
      },
      onBlur: hide,
    },
    tooltip: show ? (
      <Suspense>
        <BaseTooltip id={id} anchor={anchor} placement={placement}>
          {title}
        </BaseTooltip>
      </Suspense>
    ) : null,
  }
}
