# @jbrowse/react-circular-genome-view2

React component for the [JBrowse 2](https://jbrowse.org/jb2/) circular genome
view.

Docs and live examples: https://jbrowse.org/storybook/cgv/

## Install

```
yarn add @jbrowse/react-circular-genome-view2
npm install @jbrowse/react-circular-genome-view2 --legacy-peer-deps
```

`--legacy-peer-deps` silences npm's peer-dep warnings.

## Usage

```tsx
import '@fontsource/roboto'

import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'

function View() {
  return (
    <CircularGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      tracks={[
        {
          trackId: 'svs',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
        },
      ]}
      view={{ tracks: ['svs'] }}
    />
  )
}
```

The component uses [Roboto](https://fonts.google.com/specimen/Roboto) when
available. Add
[`@fontsource/roboto`](https://www.npmjs.com/package/@fontsource/roboto) to pull
it in.

Choosing between the embedded packages:
https://jbrowse.org/jb2/docs/embedded_components/

## Previous package

Earlier `@jbrowse/react-circular-genome-view` (no `2` suffix) was renamed in
v3.2.0. Its README is preserved on npm:
https://www.npmjs.com/package/@jbrowse/react-circular-genome-view

## License

MIT
