Plugins can be loaded at runtime from a URL — the model JBrowse Web uses for
community-published plugins. Fetch the bundle(s) with `loadPlugins`, then pass
the resolved plugin classes to `createViewState` via the normal `plugins`
option:

```js
import {
  createViewState,
  loadPlugins,
} from '@jbrowse/react-linear-genome-view2'

const plugins = await loadPlugins([
  {
    name: 'UCSC',
    url: 'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
  },
])

const state = createViewState({
  assembly,
  tracks,
  plugins: plugins.map(p => p.plugin),
})
```

Because `loadPlugins` is async, run it in an effect and render the view only
once the state resolves. For plugins you author or `npm install` yourself, pass
the class directly — see [inline plugins](../with-inline-plugins/). The
[plugin store](https://jbrowse.org/jb2/plugin_store/) lists published plugins.
