# jbrowse-core

[![NPM version](https://img.shields.io/npm/v/@jbrowse/core.svg?style=flat-square)](https://npmjs.org/package/@jbrowse/core)

Core JBrowse libraries used by most JBrowse plugins.

## Documentation

See [docs](docs/README.md)

## Academic Use

This package was written with funding from the [NHGRI](http://genome.gov) as
part of the [JBrowse](http://jbrowse.org) project. If you use it in an academic
project that you publish, please cite the most recent JBrowse paper, which will
be linked from [jbrowse.org](http://jbrowse.org).

## License

Apache-2.0 © Evolutionary Software Foundation

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### getConf

Reads a configuration value from a state model that has a `.configuration`
member (a track or display state model). For a raw configuration model, use
`readConfObject` instead.

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>> | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>>(model: { ...; }, slotPath?: SLOT | undefined, args?: Record<...>) => SLOT extends string ? ConfigurationSlotValue<...> : any
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/util.ts)

### getContainingDisplay

Returns the display model that contains the given node. Throws if the node has
no containing display.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractDisplayModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getContainingTrack

Returns the track model that contains the given node. Throws if the node has no
containing track.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractTrackModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getContainingView

Returns the view model that contains the given node. Throws if the node has no
containing view.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractViewModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getEnv

Returns the MST environment for a node, which carries the `pluginManager`.

```js
// type signature
(obj: IAnyStateTreeNode) => { pluginManager: PluginManager; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### getSession

Returns the JBrowse session model for any node in the state tree. Throws if the
node has no session ancestor.

```js
// type signature
(node: IAnyStateTreeNode) => AbstractSessionModel
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/mstUtils.ts)

### readConfObject

Given a configuration model (an instance of a ConfigurationSchema), read the
configuration value at the given path. Use this when you hold the configuration
model directly, e.g. an entry from `session.tracks`.

```js
// type signature
<CONFMODEL extends AnyConfigurationModel, SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>> | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>>(confObject: CONFMODEL, slotPath?: SLOT | undefined, args?: Record<...> | undefined) => SLOT extends string ? ConfigurationSl...
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/util.ts)

<!-- API_DOCS_END -->
