---
id: bigbedadapter
title: BigBedAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BigBedAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BigBedAdapter.md)

## Docs

### BigBedAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BigBedAdapter",
  "uri": "yourfile.bigBed"
}
```

### BigBedAdapter - Slots

#### slot: bigBedLocation

```js
bigBedLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bb',
        locationType: 'UriLocation',
      },
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
      defaultValue: 'geneName2',
    }
```
