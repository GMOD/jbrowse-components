JBrowse Web auto-loads a `config.json` from the current directory (or
`?config=`). The embedded component does not — it makes no assumptions about
URLs and leaves how and when to load the config to you.

If the config ships in your bundle, a regular ES import is enough; bundlers
handle JSON natively and there is no runtime fetch:

```js
import config from './config.json'

const state = createViewState({ config })
```

**One gotcha**: URIs inside a `config.json` resolve relative to wherever the
file was downloaded from. Bundling a config authored for another host means
tagging each location with a `baseUri`, as this example does. The top-level
shape is
[JBrowseRootConfig](https://jbrowse.org/jb2/docs/config/jbrowserootconfig/); to
load from a server at runtime, see
[Fetch a config.json](../loading-config/#with-fetch-config-json).
