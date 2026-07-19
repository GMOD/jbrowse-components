# @jbrowse/react-linear-genome-view2

React component for the [JBrowse 2](https://jbrowse.org/jb2/) linear genome
view.

Docs and live examples: https://jbrowse.org/storybook/lgv/

## Install

```
yarn add @jbrowse/react-linear-genome-view2
npm install @jbrowse/react-linear-genome-view2 --legacy-peer-deps
```

`--legacy-peer-deps` silences npm's peer-dep warnings.

## Usage

```tsx
import '@fontsource/roboto'
import {
  createViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view2'

function View() {
  const state = createViewState({
    assembly: {/* assembly */},
    tracks: [/* tracks */],
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
```

The component uses [Roboto](https://fonts.google.com/specimen/Roboto) when
available. Add
[`@fontsource/roboto`](https://www.npmjs.com/package/@fontsource/roboto) to pull
it in.

For the full embedding guide, see
https://jbrowse.org/jb2/docs/embedded_components/ — and browse the live example
gallery at https://jbrowse.org/storybook/lgv/

## Previous package

Earlier `@jbrowse/react-linear-genome-view` (no `2` suffix) was renamed in
v3.2.0. Its README is preserved on npm:
https://www.npmjs.com/package/@jbrowse/react-linear-genome-view

## License

MIT
