---
id: baseconnection
title: BaseConnection
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[packages/core/pluggableElementTypes/models/baseConnectionConfig.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/pluggableElementTypes/models/baseConnectionConfig.ts)

### BaseConnection - Identifier

#### slot: explicitIdentifier

### BaseConnection - Slots

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
