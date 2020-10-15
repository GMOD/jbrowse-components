# @jbrowse/react-linear-view

> JBrowse 2 linear genome view React component

[JBrowse 2](https://jbrowse.org/jb2/) is a pluggable open-source platform for
visualizing and integrating biological data. This component consist of a single
linear view of the same type exists in the full JBrowse 2 application.

## Usage

```tsx
import React from 'react'
import {
  createViewState,
  createJBrowseTheme,
  JBrowseLinearView,
  ThemeProvider,
} from '@jbrowse/react-linear-view'

const theme = createJBrowseTheme()

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
    <ThemeProvider theme={theme}>
      <JBrowseLinearView viewState={state} />
    </ThemeProvider>
  )
}
```

## Install

With [yarn](https://yarnpkg.com/):

```
$ yarn add @jbrowse/react-linear-view
```

Or with [npm](https://npmjs.org/):

```
$ npm install @jbrowse/react-linear-view
```

## Academic Use

This package was written with funding from the [NHGRI](https://genome.gov/) as
part of the JBrowse project. If you use it in an academic project that you
publish, please cite the most recent JBrowse paper, which will be linked from
[jbrowse.org](https://jbrowse.org/).

## License

MIT
