export function getRelativeX(
  event: { clientX: number; target: EventTarget | null },
  element: HTMLElement | null,
) {
  return event.clientX - (element?.getBoundingClientRect().left || 0)
}
