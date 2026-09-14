import { ThemeProvider } from '@mui/material'

import { StyleThemeProvider } from '../ui/PaletteContext.tsx'
import { resolveStyleTheme } from '../ui/styleTheme.ts'
import { createJBrowseTheme } from '../ui/theme.ts'

import type { ThemeOptions } from '@mui/material'

/**
 * Both theme providers, from the export's theme options. An export renders
 * outside every React tree the app mounted, so without them a `useTheme` body
 * gets MUI's default theme and a `usePalette` or `makeStyles` one JBrowse's
 * default light style theme — whatever theme the user picked. Every place an
 * export tree is rendered mounts this: the file, a live figure, a ring strip.
 */
export function SvgThemeProviders({
  theme,
  children,
}: {
  theme: ThemeOptions | undefined
  children: React.ReactNode
}) {
  return (
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <StyleThemeProvider theme={resolveStyleTheme({ configTheme: theme })}>
        {children}
      </StyleThemeProvider>
    </ThemeProvider>
  )
}
