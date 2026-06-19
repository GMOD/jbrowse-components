The **managed** `<JBrowse>` component owns the view engine internally — there's
no `createViewState` call and no nested `config` object to hand-assemble. You
pass `assemblies`, `tracks`, and a `views` list as plain props, and the
component constructs and holds the session model for you:

```jsx
import { JBrowse } from '@jbrowse/react-app2'
;<JBrowse
  assemblies={assemblies}
  tracks={tracks}
  views={[
    {
      type: 'LinearGenomeView',
      init: {
        assembly: 'volvox',
        loc: 'ctgA:1..50000',
        tracks: ['volvox_cram'],
        tracklist: true,
      },
    },
  ]}
/>
```

`views` lists what to open, each entry with its own view-type `init` blob — the
same `init` shape used in [`defaultSession.views`](../basic-example/). This is
the lowest-ceremony way to drop the app onto a page. When you need to read or
drive the underlying model from outside (observers, imperative navigation), use
the unmanaged [`createViewState`](../basic-example/) flow instead.
