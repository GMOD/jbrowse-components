`createApp(element, options)` mounts the same engine as
[`<JBrowse>`](../basic-example/) imperatively, with no React in its signature.
It's the multi-view counterpart to `@jbrowse/react-linear-genome-view2`'s
`createLinearGenomeView`, and the primitive non-React hosts (Jupyter anywidgets,
R htmlwidgets, plain `<script>` pages) wrap. `react` and `react-dom` are still
peers: `createApp` saves you writing JSX and managing a React root, not React
itself.

One declarative `views` list reaches every view type — here a
`LinearSyntenyView`, the same `{ type, init }` shape the
[`<JBrowse>` synteny example](#synteny-example) uses:

```js
import '@jbrowse/react-app2/styles.css'

import { createApp } from '@jbrowse/react-app2'

const controller = createApp(document.getElementById('root'), {
  assemblies,
  tracks,
  views: [
    {
      type: 'LinearSyntenyView',
      init: {
        views: [{ assembly: 'volvox' }, { assembly: 'volvox_del' }],
        tracks: ['volvox_del.paf'],
      },
    },
  ],
})

// later: controller.addView({ type: 'DotplotView', init: {...} })
// on teardown: controller.destroy()
```

The stylesheet import is required — without it the view manager's tabs render
unstyled. A host with no CSS loader can link
`node_modules/@jbrowse/react-app2/dist/styles.css` instead.

The `init` field is the same vocabulary JBrowse Web serializes into its
`?session=spec-…` URLs, so anything expressible there (synteny, dotplot,
circular, breakpoint-split) is one entry in `views`.
