import { useLayoutEffect, useState } from 'react'

let holds = 0

function shownShell() {
  const el = document.getElementById('boot-shell')
  return el && !document.documentElement.classList.contains('no-boot-shell')
    ? el
    : undefined
}

/**
 * Whether index.html's static shell stands in for this loading state. The
 * shell stays up while any loading state holds it and goes in the commit that
 * unmounts the last one, whatever replaced it: the app, an error banner, or a
 * throw that tore the tree down. The release waits a microtask so a loading
 * state that hands over to another in the same commit keeps it.
 */
export function useBootShell() {
  const [held] = useState(() => shownShell() !== undefined)
  useLayoutEffect(() => {
    if (!held) {
      return
    }
    holds++
    return () => {
      holds--
      queueMicrotask(() => {
        if (holds === 0) {
          document.getElementById('boot-shell')?.remove()
        }
      })
    }
  }, [held])
  return held
}
