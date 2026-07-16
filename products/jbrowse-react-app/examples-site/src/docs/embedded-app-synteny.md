Everything else on this site drives the [`<JBrowse>`](../basic-example/) React
component. `@jbrowse/embedded-app` exposes the same engine a different way:
`createApp(element, options)` — a framework-agnostic **imperative** mount with
no React in its signature. It's the multi-view counterpart to
[`@jbrowse/embedded-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/embedded-linear-genome-view)'s
`createLinearGenomeView`, and the primitive that non-React hosts (Jupyter
anywidgets, R htmlwidgets, plain `<script>` pages) wrap.

Because it drives the full app, one declarative `views` list reaches every view
type — here a `LinearSyntenyView`, the exact same `{ type, init }` shape the
[`<JBrowse>` synteny example](../synteny-views/#synteny-example) uses:

```js
import { createApp } from '@jbrowse/embedded-app'

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

The `init` field is the same vocabulary JBrowse Web serializes into its
`?session=spec-…` URLs, so anything expressible there — synteny, dotplot,
circular, breakpoint-split — is one entry in `views`.
