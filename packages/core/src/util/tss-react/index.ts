'use client'

import { useStyleTheme } from '../../ui/PaletteContext.tsx'
import { createMakeStyles } from './makeStyles.tsx'
import { classnames } from './tools/classnames.ts'

import type { CxArg } from './tools/classnames.ts'

export { keyframes } from '@emotion/react'

// The theme a `makeStyles` block is handed is JBrowse's own plain-data one, not
// Material UI's. It used to be MUI's, and the `useTheme` that fetched it pulled
// `createTheme` — ~51 KB — into the first paint of every host, whether or not
// anything Material was on the screen. See ui/styleTheme.ts.
export const { makeStyles } = createMakeStyles({ useTheme: useStyleTheme })

// Export cx as a standalone function (wrapper around classnames)

export function cx(...args: CxArg[]): string {
  return classnames(args)
}
