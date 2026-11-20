import { createContext } from 'react'

// True under a surface the pointer cannot reach, such as a hover tooltip.
export const UnreachableContext = createContext(false)
