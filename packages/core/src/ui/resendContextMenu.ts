/**
 * A right-click while a menu is open lands on that menu's backdrop, which left
 * the menu up under the browser's own. The menu closes instead, and the click
 * goes on to whatever the backdrop was covering, once the closed menu is out of
 * the way, so right-clicking a second feature opens that feature's menu.
 *
 * Only the closing menu is looked through: a dialog the menu was opened from
 * still takes the click, rather than the page behind it. The lookup starts
 * from the backdrop's own root, since an embedded view may live in a shadow
 * root that `document` cannot see into.
 */
export function resendContextMenu(
  backdrop: Element,
  clientX: number,
  clientY: number,
) {
  const menuRoot = backdrop.closest('.MuiModal-root')
  const root = backdrop.getRootNode()
  setTimeout(() => {
    const target = (root instanceof ShadowRoot ? root : document)
      .elementsFromPoint(clientX, clientY)
      .find(element => !menuRoot?.contains(element))
    for (const type of ['mousemove', 'contextmenu']) {
      target?.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX,
          clientY,
          button: type === 'contextmenu' ? 2 : 0,
        }),
      )
    }
  }, 0)
}
