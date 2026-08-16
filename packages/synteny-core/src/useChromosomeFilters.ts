import { useState } from 'react'

/**
 * The chromosome-restriction boxes of one import form: whether they are shown at
 * all, and what is typed in each. One entry per row — a dotplot's two axes are
 * rows 0 (x) and 1 (y).
 *
 * **Off unless asked for.** Empty text fields sitting between the reader and
 * Launch read as required, and the case they exist for — an assembly fragmented
 * into hundreds of scaffolds — is the rare one (review: "it could be optional to
 * show the search boxes ... most people might not care, and might think they
 * NEED to use them which is not intended"). Hiding therefore has to *clear*, or
 * a view comes back restricted by a box nobody can see, which is the one failure
 * a disclosure can introduce that the flat form could not.
 *
 * What is typed is ABOUT a particular assembly: `*_MATERNAL` on a different one
 * at best names nothing and unrestricts the row with a warning, at worst matches
 * and quietly shows the wrong thing. So `remap` keeps a value only where the row
 * still names the same assembly, which covers every edit to some *other* row for
 * free, and `reset` is what the Quick start handover uses when the whole set of
 * rows is replaced.
 */
export function useChromosomeFilters() {
  const [shown, setShownState] = useState(false)
  const [values, setValues] = useState<string[]>([])

  return {
    shown,
    /** what row `idx` restricts to; '' is the whole assembly */
    get(idx: number) {
      return values[idx] ?? ''
    },
    /** every row's, in order, for the form's doSubmit */
    values,
    setShown(next: boolean) {
      setShownState(next)
      if (!next) {
        setValues([])
      }
    },
    set(idx: number, value: string) {
      setValues(prev =>
        Array.from({ length: Math.max(prev.length, idx + 1) }, (_, i) =>
          i === idx ? value : (prev[i] ?? ''),
        ),
      )
    },
    remap(from: string[], to: string[]) {
      setValues(prev =>
        to.map((asm, i) => (asm === from[i] ? (prev[i] ?? '') : '')),
      )
    },
    reset() {
      setValues([])
    },
  }
}

/** what `useChromosomeFilters` hands back, for a form that passes it down */
export type ChromosomeFilters = ReturnType<typeof useChromosomeFilters>
