---
id: rpcoptions
title: RpcOptions
toplevel: true
---






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



 
