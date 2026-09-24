/**
 * How many CSS pixels of the session lie below the window: the most any
 * scrolling column holding a view overflows, less the empty room `ViewStack`
 * leaves below the last view. Serialized into the page.
 */
export function sessionOverflowInPage(): number {
  let most = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  )
  for (const container of document.querySelectorAll(
    '[data-testid^="view-container-"]',
  )) {
    for (let el = container.parentElement; el; el = el.parentElement) {
      const { overflowY } = getComputedStyle(el)
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight
      ) {
        const room =
          el
            .querySelector('[data-testid="view-stack-overscroll"]')
            ?.getBoundingClientRect().height ?? 0
        most = Math.max(
          most,
          Math.ceil(el.scrollHeight - room - el.clientHeight),
        )
        break
      }
    }
  }
  return most
}
