interface Press {
  target: EventTarget | null
  currentTarget: EventTarget | null
}

/**
 * Whether an event reached a container's React handler from outside the
 * container's DOM. React bubbles a portal's events to its React parent, so a
 * press in a dialog or menu that a track opened arrives at every handler above
 * the track.
 */
export function isFromPortal({ target, currentTarget }: Press) {
  return (
    target instanceof Node &&
    currentTarget instanceof Node &&
    !currentTarget.contains(target)
  )
}

/**
 * Whether a container's own drag gesture leaves a press alone: one from a
 * portal, or one on a control that claimed it (`[data-gesture-owner]`,
 * JBrowse's marker on the parts that drag on their own), a button, or a
 * draggable element. `closest`, because the press usually lands on an icon
 * inside the control.
 */
export function isClaimedPress(event: Press) {
  const { target } = event
  return (
    isFromPortal(event) ||
    (target instanceof HTMLElement && target.draggable) ||
    (target instanceof Element &&
      target.closest('button, [data-gesture-owner], [draggable="true"]') !==
        null)
  )
}
