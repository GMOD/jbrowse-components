---
id: rpcoptions
title: RpcOptions
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/rpc/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/RpcOptions.md)

## Overview

### RpcOptions - Slots

#### slot: defaultDriver

which RPC backend to use by default. Empty means "use the host
application's default" (web/desktop default to the web worker driver,
embedded/headless to the main thread). A per-track or per-call
`rpcDriverName` still overrides this.

```js
defaultDriver: {
      type: 'string',
      description:
        'the RPC driver to use for tracks and tasks that are not configured to use a specific RPC backend',
      defaultValue: '',
    }
```
#### slot: workerCount

number of web workers to spawn for the web worker RPC driver. 0 lets
JBrowse pick based on hardware concurrency.

```js
workerCount: {
      type: 'number',
      description:
        'The number of workers to use. If 0 (the default) JBrowse will decide how many workers to use.',
      defaultValue: 0,
    }
```
