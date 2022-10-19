---
id: webworkerrpcdriver
title: WebWorkerRpcDriver
toplevel: true
---

#### derives from: 
```js

    /**
     * !baseConfiguration
     */
    baseConfiguration: BaseRpcDriverConfigSchema
```
#### slot: defaultDriver
```js

    /**
     * !slot
     */
    defaultDriver: {
      type: 'string',
      description:
        'the RPC driver to use for tracks and tasks that are not configured to use a specific RPC backend',
      defaultValue: 'MainThreadRpcDriver',
    }
```
#### slot: drivers
```js

    /**
     * !slot
     */
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

    /**
     * !slot
     */
    name: {
      type: 'string',
      defaultValue: 'nameOfConnection',
      description: 'a unique name for this connection',
    }
```
#### slot: assemblyNames
```js

    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'optional list of names of assemblies in this connection',
    }
```
