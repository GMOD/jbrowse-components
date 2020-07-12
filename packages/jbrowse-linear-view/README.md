# JBrowse React Linear View

Example usage:

```tsx
import React from 'react'
import {
  createViewState,
  defaultJBrowseTheme,
  JBrowseLinearView,
  ThemeProvider,
} from 'jbrowse-react-linear-view'

function View() {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    location: 'ctgA:1105..1221',
    onChange: patch => {
      console.log('patch', patch)
    },
  })
  return (
    <ThemeProvider theme={defaultJBrowseTheme}>
      <JBrowseLinearView viewState={state} />
    </ThemeProvider>
  )
}
```
