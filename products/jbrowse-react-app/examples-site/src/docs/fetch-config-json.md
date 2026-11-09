To bundle the file instead,
`import config from './config.json' with { type: 'json' }` and keep the
`addRelativeUris` call, against the URL its data is served from. The embedded
app does not load a config's `plugins`: `loadPlugins` does, its `baseUri`
resolving a relative plugin URL against the config.
