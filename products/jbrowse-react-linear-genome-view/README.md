# @jbrowse/react-linear-view

> JBrowse 2 linear genome view React component

[JBrowse 2](https://jbrowse.org/jb2/) is a pluggable open-source platform for
visualizing and integrating biological data. This component consist of a single
linear view of the same type exists in the full JBrowse 2 application.

## Usage

```tsx
import React from 'react'
import 'fontsource-roboto'
import {
  createViewState,
  createJBrowseTheme,
  JBrowseLinearGenomeView,
  ThemeProvider,
} from '@jbrowse/react-linear-view'

const theme = createJBrowseTheme()

function View() {
  const state = createViewState({
    assembly: {
      /* assembly */
    },
    tracks: [
      /* tracks */
    ],
  })
  return (
    <ThemeProvider theme={theme}>
      <JBrowseLinearGenomeView viewState={state} />
    </ThemeProvider>
  )
}
```

For a full working example, see [this example](./docs/example).

## Install

With [yarn](https://yarnpkg.com/):

```
$ yarn add @jbrowse/react-linear-view
```

Or with [npm](https://npmjs.org/):

```
$ npm install @jbrowse/react-linear-view
```

### Note on fonts

[Roboto](https://fonts.google.com/specimen/Roboto) is the recommended font for
JBrowse, and this component will use that font if it is available. The easiest
way to add it is to add the
[`fontsource-roboto`](https://www.npmjs.com/package/fontsource-roboto) package
to your project and import it in your root `index.js`.

## Academic Use

This package was written with funding from the [NHGRI](https://genome.gov/) as
part of the JBrowse project. If you use it in an academic project that you
publish, please cite the most recent JBrowse paper, which will be linked from
[jbrowse.org](https://jbrowse.org/).

## License

MIT
