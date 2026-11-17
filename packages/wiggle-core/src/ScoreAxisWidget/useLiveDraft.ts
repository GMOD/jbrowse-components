import { useRef, useState } from 'react'

import { useFinalUnmount } from '@jbrowse/core/util/hooks'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const DEBOUNCE_MS = 300

interface Draft<T> {
  value: T
  base: string
}

/**
 * What a form holds while it edits a model value live. The draft remembers the
 * model it was typed against (`held`), so a write from anywhere else (undo,
 * Reset, a menu, an agent) leaves it stale and the form shows the model again,
 * rather than writing the stale draft back. `write` runs once typing pauses,
 * and at once on `flush` or when the form unmounts, so typing 250 neither
 * redraws at 2 and 25 nor leaves an undo step per keystroke.
 */
export function useLiveDraft<T>({
  node,
  held,
  write,
}: {
  node: IAnyStateTreeNode
  held: () => string
  write: (value: T) => void
}) {
  const [draft, setDraft] = useState<Draft<T>>()
  const latest = useRef(draft)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const store = (next?: Draft<T>) => {
    latest.current = next
    setDraft(next)
  }

  const flush = () => {
    clearTimeout(timer.current)
    timer.current = undefined
    const pending = latest.current
    if (pending && isAlive(node)) {
      if (pending.base === held()) {
        write(pending.value)
        store({ value: pending.value, base: held() })
      } else {
        store(undefined)
      }
    }
  }
  useFinalUnmount(flush)

  return {
    draft: draft?.base === held() ? draft.value : undefined,
    edit: (value: T) => {
      store({ value, base: held() })
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, DEBOUNCE_MS)
    },
    flush,
  }
}
