# @jbrowse/react-app2

React component for the whole [JBrowse 2](https://jbrowse.org/jb2/) app — menu
bar, view manager, drawer widgets, and every view type. For a single track view,
[`@jbrowse/react-linear-genome-view2`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view2)
is smaller.

Docs and live examples: https://jbrowse.org/storybook/app/

## Install

```
yarn add @jbrowse/react-app2
npm install @jbrowse/react-app2 --legacy-peer-deps
```

`--legacy-peer-deps` silences npm's peer-dep warnings.

## Usage

```tsx
import '@jbrowse/react-app2/styles.css'

import { JBrowse } from '@jbrowse/react-app2'

function App() {
  return (
    <JBrowse
      assemblies={[/* assemblies */]}
      tracks={[/* tracks */]}
      views={[
        {
          type: 'LinearGenomeView',
          init: { assembly: 'volvox', loc: 'ctgA:1..50000' },
        },
      ]}
    />
  )
}
```

**The stylesheet is not optional**, unlike the single-view components, which
have none. It styles the tiled panel layout, so without it the panels, tabs and
dividers render unstyled while everything else looks correct. It is
self-contained, so a page not running a bundler can `<link>` it from the package
instead.

The component uses [Roboto](https://fonts.google.com/specimen/Roboto) when
available. Add
[`@fontsource/roboto`](https://www.npmjs.com/package/@fontsource/roboto) to pull
it in.

For the full embedding guide, see
https://jbrowse.org/jb2/docs/embedded_components/

## Previous package

Earlier `@jbrowse/react-app` (no `2` suffix) was renamed in v3.2.0. Its README
is preserved on npm: https://www.npmjs.com/package/@jbrowse/react-app

## License

MIT
