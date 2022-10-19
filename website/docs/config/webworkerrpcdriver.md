---
id: webworkerrpcdriver
title: WebWorkerRpcDriver
toplevel: true
---

#### derives from:

```js
baseConfiguration: BaseRpcDriverConfigSchema
```

#### slot: defaultDriver

```js
defaultDriver: {
      type: 'string',
      description:
        'the RPC driver to use for tracks and tasks that are not configured to use a specific RPC backend',
      defaultValue: 'MainThreadRpcDriver',
    }
```

#### slot: drivers

```js
drivers: types.optional(
  types.map(
    types.union(
      MainThreadRpcDriverConfigSchema,
      WebWorkerRpcDriverConfigSchema,
    ),
  ),
  {
    MainThreadRpcDriver: { type: 'MainThreadRpcDriver' },
    WebWorkerRpcDriver: { type: 'WebWorkerRpcDriver' },
  },
)
```

#### slot: name

```js
name: {
      type: 'string',
      defaultValue: 'nameOfConnection',
      description: 'a unique name for this connection',
    }
```

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'optional list of names of assemblies in this connection',
    }
```
