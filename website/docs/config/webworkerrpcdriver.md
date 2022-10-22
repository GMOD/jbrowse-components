---
id: webworkerrpcdriver
title: WebWorkerRpcDriver
toplevel: true
---

### Slots

#### slot: workerCount

```js
workerCount: {
      type: 'number',
      description:
        'The number of workers to use. If 0 (the default) JBrowse will decide how many workers to use.',
      defaultValue: 0,
    }
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

## Derives from

```js
baseConfiguration: BaseRpcDriverConfigSchema
```
