import { createContext } from 'react'

/**
 * The radius an export starts its chords at, which differs from the screen's
 * where the export leaves a ring out: the circle settles which rings it draws
 * only after its chord displays have handed over their paths.
 */
export const ExportChordRadiusContext = createContext<number | undefined>(
  undefined,
)
