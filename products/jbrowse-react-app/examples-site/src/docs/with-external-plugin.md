Plugins can be loaded at runtime from a URL. This is the model JBrowse Web uses
for community-published plugins. Fetch the bundle(s) with `loadPlugins`, which
returns `{ plugin, pluginMetadata }[]`, then pass the resolved plugin classes to
`createViewState` via the normal `plugins` option:

```js
import { createViewState, loadPlugins } from '@jbrowse/react-app2'

const plugins = await loadPlugins([
  {
    name: 'UCSC',
    url: 'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
  },
])

const state = createViewState({
  config,
  plugins: plugins.map(p => p.plugin),
})
```

Because `loadPlugins` is async, run it in an effect and render the view only
once the state resolves. This example loads the UCSC plugin from unpkg and shows
a `UCSCAdapter` track on hg19. For plugins you author or `npm install` yourself,
pass the class directly. See [embedded plugins](../plugins/#embedded-plugin).
The [plugin store](https://jbrowse.org/jb2/plugin_store/) lists published
plugins.
