---
id: rpcoptions
title: RpcOptions
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/rpc/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/RpcOptions.md)

## Docs

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
