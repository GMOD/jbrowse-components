---
id: mainthreadrpcdriver
title: MainThreadRpcDriver
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/rpc/mainThreadRpcConfig.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/MainThreadRpcDriver.md)

## Docs

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

### Inherited from [BaseRpcDriver](../baserpcdriver)

#### slot: workerCount

```js
workerCount: {
      type: 'number',
      description:
        'The number of workers to use. If 0 (the default) JBrowse will decide how many workers to use.',
      defaultValue: 0,
    }
```

### MainThreadRpcDriver - Derives from

- [BaseRpcDriver](../baserpcdriver)

```js
baseConfiguration: BaseRpcDriverConfigSchema
```
