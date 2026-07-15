import { useState } from 'react'

// Shared by the category/track rows that embed a "..." CascadingMenuButton: the
// row has a click action (toggle, open dialog), but clicks that land while the
// menu is open should be ignored, so opening/closing the menu doesn't also fire
// the row action. Wire setMenuOpen into the menu button's setOpen prop and wrap
// the row action in guard().
export function useMenuGuardedClick() {
  const [menuOpen, setMenuOpen] = useState(false)
  return {
    setMenuOpen,
    guard: (action: () => void) => {
      if (!menuOpen) {
        action()
      }
    },
  }
}
