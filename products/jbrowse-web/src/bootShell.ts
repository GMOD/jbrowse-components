import { useLayoutEffect, useState } from 'react'

let holds = 0

const shell = () => document.getElementById('boot-shell')

function holdable() {
  const hidden = document.documentElement.classList.contains('no-boot-shell')
  if (hidden) {
    shell()?.remove()
  }
  return !hidden && shell() !== null
}

/**
 * Whether index.html's static shell stands in for this loading state. The
 * shell stays up while any loading state holds it and goes in the commit that
 * unmounts the last one, whatever replaced it: the app, an error banner, or a
 * throw that tore the tree down. The release waits a microtask so a loading
 * state that hands over to another in the same commit keeps it. A shell the
 * stored theme hid goes at the first loading state.
 */
export function useBootShell() {
  const [held] = useState(holdable)
  useLayoutEffect(() => {
    if (!held) {
      return
    }
    holds++
    return () => {
      holds--
      queueMicrotask(() => {
        if (holds === 0) {
          shell()?.remove()
        }
      })
    }
  }, [held])
  return held
}
