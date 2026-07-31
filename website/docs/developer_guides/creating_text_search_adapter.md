---
title: Text search adapters
description: Implement a custom backend for the search box
guide_category: Plugins
---

The search box queries one or more **text search adapters**. Each adapter
implements `searchIndex()` and returns a list of results; the framework handles
fuzzy matching, ranking, and navigation.

**TL;DR:** extend `BaseAdapter`, implement `searchIndex()` returning
`BaseResult[]`, give the config an `assemblyNames` slot, and register the type
in your plugin.

The built-in adapters are `TrixTextSearchAdapter` (pre-built trix indexes) and
`JBrowse1TextSearchAdapter` (JBrowse 1 `names/` indexes). Add your own to search
any data source: an API, a local file, or a SQLite database.

## The interface

Your adapter extends `BaseAdapter` and implements one method.

```ts
interface BaseTextSearchAdapter extends BaseAdapter {
  searchIndex(args: BaseTextSearchArgs): Promise<BaseResult[]>
}

interface BaseTextSearchArgs {
  queryString: string
  searchType?: 'full' | 'prefix' | 'exact'
  stopToken?: StopToken
  limit?: number
  pageNumber?: number
}
```

## Implementing the adapter

```ts
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { readConfObject } from '@jbrowse/core/configuration'
import { openLocation } from '@jbrowse/core/util/io'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

export default class MyTextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter
{
  constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const endpoint = readConfObject(config, 'endpoint')
    this.endpoint = endpoint as string
  }

  async searchIndex(args: BaseTextSearchArgs): Promise<BaseResult[]> {
    const { queryString, searchType, limit = 100 } = args

    const response = await fetch(
      `${this.endpoint}?q=${encodeURIComponent(queryString)}&limit=${limit}`,
    )
    const hits = (await response.json()) as ApiHit[]

    const results = hits.map(
      hit =>
        new BaseResult({
          label: hit.name,
          displayString: hit.displayName,
          locString: `${hit.refName}:${hit.start}..${hit.end}`,
          trackId: hit.trackId,
        }),
    )

    return searchType === 'exact'
      ? results.filter(
          r => r.getLabel().toLowerCase() === queryString.toLowerCase(),
        )
      : results
  }
}
```

## BaseResult fields

| Field           | Type          | Purpose                                              |
| --------------- | ------------- | ---------------------------------------------------- |
| `label`         | string        | Primary display text; used for exact-match filtering |
| `displayString` | string?       | Alternate display text (falls back to `label`)       |
| `locString`     | string?       | Location to navigate to, e.g. `chr1:1000..2000`      |
| `trackId`       | string?       | If set, the view opens or highlights this track      |
| `results`       | BaseResult[]? | Nested results; shown in a disambiguation dialog     |

Results with `locString` navigate directly. Results with nested `results` show a
dialog. Results with neither treat the label as a reference name.

## Configuration schema

```ts
import { ConfigurationSchema } from '@jbrowse/core/configuration'

const MyTextSearchAdapter = ConfigurationSchema(
  'MyTextSearchAdapter',
  {
    endpoint: {
      type: 'string',
      defaultValue: '',
      description: 'URL of your search API',
    },
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'Assemblies covered by this adapter',
    },
  },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'textSearchAdapterId',
  },
)

export default MyTextSearchAdapter
```

`assemblyNames` is required; the TextSearchManager uses it to pick which
adapters to query for a given assembly.

## Plugin registration

```ts
import Plugin from '@jbrowse/core/Plugin'
import TextSearchAdapterType from '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType'

import configSchema from './MyTextSearchAdapter/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class MyPlugin extends Plugin {
  name = 'MyPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addTextSearchAdapterType(() => {
      return new TextSearchAdapterType({
        name: 'MyTextSearchAdapter',
        displayName: 'My text search adapter',
        configSchema,
        description: 'Searches my custom API',
        getAdapterClass: () =>
          import('./MyTextSearchAdapter/MyTextSearchAdapter.ts').then(
            d => d.default,
          ),
      })
    })
  }
}
```

## Config.json wiring

Add the adapter under `aggregateTextSearchAdapters` at the config root for
global search, or under a track's `textSearching` field for track-scoped search:

```json
{
  "aggregateTextSearchAdapters": [
    {
      "type": "MyTextSearchAdapter",
      "textSearchAdapterId": "my-search",
      "endpoint": "https://my-api.example.com/search",
      "assemblyNames": ["hg38"]
    }
  ]
}
```

Per-track:

```json
{
  "trackId": "myTrack",
  "textSearching": {
    "textSearchAdapter": {
      "type": "MyTextSearchAdapter",
      "textSearchAdapterId": "my-track-search",
      "endpoint": "https://my-api.example.com/search",
      "assemblyNames": ["hg38"]
    }
  }
}
```

## See also

- [Creating custom adapters](/docs/developer_guides/creating_adapter)
- [](/docs/developer_guides/configuration_schema)
- Built-in adapter configs: [](/docs/config/trixtextsearchadapter) and
  [](/docs/config/jbrowse1textsearchadapter)
- [](/docs/developer_guides/pluggable_elements)
