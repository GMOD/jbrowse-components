import React, { ReactNode } from 'react'
import { createJBrowseTheme as coreCreateJBrowseTheme } from '@jbrowse/core/ui'
import { Theme, ThemeOptions } from '@material-ui/core/styles'

export function createJBrowseTheme(theme?: ThemeOptions) {
  console.warn(
    'Deprecation warning: `createJBrowseTheme` will be removed in a future ' +
      'release. It can be imported from @jbrowse/core/ui if needed.',
  )
  return coreCreateJBrowseTheme(theme)
}

export function ThemeProvider({
  _theme,
  children,
}: {
  _theme: Theme
  children: ReactNode
}) {
  console.warn(
    'Deprecation warning: `ThemeProvider` is no longer supported as a way to ' +
      'theme @jbrowse/react-linear-genome-view. If using a custom theme, ' +
      'please pass the theme in to the "configuration" of `createViewState` ' +
      'instead.',
  )
  return <>{children}</>
}
