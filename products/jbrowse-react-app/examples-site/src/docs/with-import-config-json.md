JBrowse Web auto-loads a `config.json` from the current directory (or the
`?config=` URL parameter). The embedded `react-app2` component does **not**. It
makes no assumptions about URLs and lets you control how and when the config is
loaded.

If your config is part of your app bundle, use a regular ES import. Bundlers
handle the JSON natively and the config ships alongside your JavaScript, with no
runtime fetch:

```js
import config from './config.json'

const state = createViewState({ config })
```

One gotcha: URIs inside a `config.json` are resolved relative to wherever the
file was downloaded from. When you bundle a config authored for another host,
tag each location with a `baseUri` (as this example does) so JBrowse resolves
them correctly. To load the config from a server at runtime instead, see
[Fetch a config.json](../loading-config/#with-fetch-config-json).

The top-level shape (`assemblies`, `tracks`, `configuration`, `defaultSession`)
is documented in
[JBrowseRootConfig](https://jbrowse.org/jb2/docs/config/jbrowserootconfig/), and
the global `configuration` block in
[JBrowseConfiguration](https://jbrowse.org/jb2/docs/config/jbrowseconfiguration/).
