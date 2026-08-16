import { createContext, use } from 'react'

// Which toggle a FileSelector opens on when its slot is still empty, for a form
// whose surrounding UI has already answered the question — the add-genome pane
// sets 'url' while its box of pasted URLs is on screen, so the index inputs
// underneath don't offer a local file picker to someone working remotely.
//
// A context rather than a prop because it would otherwise thread four levels
// down through components shared with other forms (the advanced options, the
// per-format inputs), none of which have any business knowing about it.
const EmptySourceTypeContext = createContext<string | undefined>(undefined)

export const EmptySourceTypeProvider = EmptySourceTypeContext.Provider

export function useEmptySourceType() {
  return use(EmptySourceTypeContext)
}
