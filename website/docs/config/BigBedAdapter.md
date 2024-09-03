---
id: bigbedadapter
title: BigBedAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/bed/src/BigBedAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BigBedAdapter/configSchema.ts)

### BigBedAdapter - Slots

#### slot: bigBedLocation

```js
bigBedLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bb', locationType: 'UriLocation' },
    }
```

#### slot: scoreColumn

```js
scoreColumn: {
      type: 'string',
      description: 'The column to use as a "score" attribute',
      defaultValue: '',
    }
```

#### slot: aggregateField

```js
aggregateField: {
      type: 'string',
      description: 'An attribute to aggregate features with',
      defaultValue: 'geneName',
    }
```
