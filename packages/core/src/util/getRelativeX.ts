// Against an element handed in, deliberately: a rubberband drag tracks the
// pointer across the whole document, so the box it projects through is the one
// it started in and not whatever the cursor is now over. For the ordinary case —
// a handler measuring against its own element — see `eventPoint`.
export function getRelativeX(
  event: { clientX: number; target: EventTarget | null },
  element: HTMLElement | null,
) {
  return event.clientX - (element?.getBoundingClientRect().left ?? 0)
}
