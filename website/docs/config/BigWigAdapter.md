---
id: bigwigadapter
title: BigWigAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/BigWigAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BigWigAdapter.md)

## Docs

### BigWigAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BigWigAdapter",
  "uri": "yourfile.bw"
}
```

### BigWigAdapter - Slots

#### slot: bigWigLocation

```js
bigWigLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bw',
        locationType: 'UriLocation',
      },
    }
```

#### slot: source

added as feature.get('source') on all features

```js
source: {
      type: 'string',
      defaultValue: '',
      description: 'Used for multiwiggle',
    }
```

#### slot: resolutionMultiplier

```js
resolutionMultiplier: {
      type: 'number',
      defaultValue: 1,
      description:
        'Initial resolution multiplier, <1 is higher resolution, >1 is lower resolution',
    }
```
