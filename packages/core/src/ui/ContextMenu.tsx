import { observer } from 'mobx-react'

import Menu from './CascadingMenu.tsx'
import { CONTEXT_MENU_Z_INDEX } from './zIndexes.ts'

import type { MenuItemsGetter } from './MenuTypes.ts'

/**
 * Where the menu opens, in viewport coordinates — i.e. an event's
 * `clientX`/`clientY`, whatever produced it (a right-click, the release of a
 * drag-selection). `undefined` is the closed state: displays keep the click
 * point and the menu's open-ness as one value rather than two that can
 * disagree.
 */
export interface ContextMenuAnchor {
  clientX: number
  clientY: number
}

/**
 * Nudge off the click point, so the pixel that was right-clicked — a mismatch
 * column, a variant cell — stays visible beside the menu instead of under it.
 */
const DEFAULT_OFFSET = { x: 12, y: 0 }

/**
 * The popup menu every display raises from a click point: right-click menus,
 * and the dotplot's drag-release menu.
 *
 * Its own observer, and the one place `menuItems` is resolved: a display passes
 * the getter rather than a built array, so rebuilding the items re-renders this
 * component alone. Built inline in a display body instead, the per-mousemove
 * coordinate state there re-ran the whole menu build — with fresh item
 * identities — on every move while a menu was open.
 *
 * Mounts only while open, and only with something to show: MUI keeps a Paper
 * that fades out on close, so an anchored-but-empty menu flashes an empty box
 * at the cursor. `onClose` is the single close path — Menu's
 * `closeAfterItemClick` default already fires it ahead of the clicked item's
 * callback, so an item's `onClick` must not read state that closing clears
 * (capture it when the items are built).
 */
const ContextMenu = observer(function ContextMenu({
  anchor,
  menuItems,
  onClose,
  offset = DEFAULT_OFFSET,
}: {
  anchor: ContextMenuAnchor | undefined
  menuItems: MenuItemsGetter
  onClose: () => void
  offset?: { x: number; y: number }
}) {
  if (!anchor) {
    return null
  }
  const items = Array.isArray(menuItems) ? menuItems : menuItems()
  return items.length > 0 ? (
    // A REACT EVENT DOES NOT STOP AT THE PORTAL. The menu renders into
    // document.body, but React bubbles a portal's events through the COMPONENT
    // tree, and every display that raises this menu renders it inside the same
    // element whose `onClick` hit-tests the pointer. So picking any item also
    // ran that hit test, and every right-click route ended with the clicked
    // feature's details drawer open beside the thing the item had just done.
    //
    // `display: contents` because this wrapper is only here to catch events:
    // the menu itself is portalled out, so the div holds nothing to lay out,
    // and a box in the display's flow would move what is under it.
    <div
      style={{ display: 'contents' }}
      onClick={e => {
        e.stopPropagation()
      }}
      onContextMenu={e => {
        e.stopPropagation()
      }}
    >
      <Menu
        open
        onMenuItemClick={callback => {
          callback()
        }}
        onClose={onClose}
        anchorReference="anchorPosition"
        anchorPosition={{
          top: anchor.clientY + offset.y,
          left: anchor.clientX + offset.x,
        }}
        style={{ zIndex: CONTEXT_MENU_Z_INDEX }}
        menuItems={items}
      />
    </div>
  ) : null
})

export default ContextMenu
