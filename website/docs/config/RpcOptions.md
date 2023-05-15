---
id: rpcoptions
title: RpcOptions
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[packages/core/rpc/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/rpc/configSchema.ts)

### RpcOptions - Slots

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
