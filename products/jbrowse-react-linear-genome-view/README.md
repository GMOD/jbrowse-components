# @jbrowse/react-linear-genome-view

> JBrowse 2 linear genome view React component

[JBrowse 2](https://jbrowse.org/jb2/) is a pluggable open-source platform for
visualizing, integrating, and sharing biological data. This component consists
of a single JBrowse 2 linear view.

## Usage

```tsx
import React from 'react'
import '@fontsource/roboto'
import {
  createViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view'

function View() {
  const state = createViewState({
    assembly: {
      /* assembly */
    },
    tracks: [
      /* tracks */
    ],
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
```

For working examples, see https://jbrowse.org/jb2/docs/embedded_components/

## Install

With [yarn](https://yarnpkg.com/):

```
$ yarn add @jbrowse/react-linear-genome-view
```

Or with [npm](https://npmjs.org/):

```
$ npm install @jbrowse/react-linear-genome-view --legacy-peer-deps
```

The --legacy-peer-deps helps with installing via NPM to avoid warnings about the
peer dependencies not being met while installing.

## Documentation

The latest documentation for the component is hosted at
https://jbrowse.org/storybook/lgv/main

### Note on fonts

[Roboto](https://fonts.google.com/specimen/Roboto) is the recommended font for
JBrowse, and this component will use that font if it is available. The easiest
way to add it is to add the
[`@fontsource/roboto`](https://www.npmjs.com/package/@fontsource/roboto) package
to your project and import it in your root `index.js`.

## Academic Use

This package was written with funding from the [NHGRI](https://genome.gov/) as
part of the JBrowse project. If you use it in an academic project that you
publish, please cite the most recent JBrowse paper, which will be linked from
[jbrowse.org](https://jbrowse.org/).

## License

MIT
