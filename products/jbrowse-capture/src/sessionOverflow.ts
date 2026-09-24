/**
 * How many CSS pixels of the session lie below the window.
 *
 * JBrowse scrolls a column inside the app rather than the document, so the
 * document is always exactly the window's height. The overflow is that column's,
 * found as `overflow` in jbApi finds it, less the trailing room `ViewStack`
 * leaves for scrolling the last view up, which is space rather than content. A
 * workspace scrolls each panel on its own, so the answer is the tallest one's.
 *
 * Serialized into the page, so it declares everything it uses.
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
