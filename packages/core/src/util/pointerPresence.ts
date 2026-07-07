// Browsers latch a continuous wheel gesture to the element it began on: once a
// scroll gesture starts over an element, its momentum/continued wheel events
// keep targeting that element even after the pointer physically moves off it
// (and even when the page scrolls the element out from under a stationary
// cursor). A non-passive wheel handler that means to defer to the page once the
// cursor is elsewhere can't tell this from the event alone, so it would keep
// consuming and preventDefault-ing the latched events — staying "stuck" to the
// panel after the mouse has left.
//
// trackPointerPresence wires mouseenter/mouseleave on the element to a boolean
// the handler polls. mouseenter/mouseleave (unlike mouseover/mouseout) ignore
// transitions to descendants, so a pointer moving among an element's children
// still counts as present. Defaults to present: if the pointer is already over
// the element at mount no mouseenter fires, and mouseleave reliably flips it on
// exit — including the browser-fired leave when a scroll moves the element away
// from a stationary pointer.
export interface PointerPresence {
  readonly isOver: boolean
  dispose: () => void
}

export function trackPointerPresence(
  el: HTMLElement,
  onLeave?: () => void,
): PointerPresence {
  let over = true
  const enter = () => {
    over = true
  }
  const leave = () => {
    over = false
    onLeave?.()
  }
  el.addEventListener('mouseenter', enter)
  el.addEventListener('mouseleave', leave)
  return {
    get isOver() {
      return over
    },
    dispose() {
      el.removeEventListener('mouseenter', enter)
      el.removeEventListener('mouseleave', leave)
    },
  }
}
