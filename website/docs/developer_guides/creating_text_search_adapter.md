---
title: Text search adapters
description: Implement a custom backend for the search box
guide_category: Plugins
---

**TL;DR:** the search box queries one or more text search adapters and handles
ranking and navigation itself. Extend `BaseAdapter`, implement `searchIndex()`
returning `BaseResult[]`, give the config an `assemblyNames` slot, and register
the type in your plugin.

The built-ins are `TrixTextSearchAdapter` (pre-built trix indexes) and
`JBrowse1TextSearchAdapter` (JBrowse 1 `names/` indexes). Add your own to search
any data source: an API, a local file, a database.

## The interface

Your adapter extends `BaseAdapter` and implements one method:

<!-- include: packages/core/src/data_adapters/BaseAdapter/BaseTextSearchAdapter.ts -->

```ts
import type BaseResult from '../../TextSearch/BaseResults.ts'
import type { BaseAdapter } from './BaseAdapter.ts'
import type { BaseTextSearchArgs } from './types.ts'

export interface BaseTextSearchAdapter extends BaseAdapter {
  searchIndex(args: BaseTextSearchArgs): Promise<BaseResult[]>
}
```

Everything the search box knows about the query arrives in that one argument:

<!-- include: packages/core/src/data_adapters/BaseAdapter/types.ts#textSearchArgs -->

```ts
export type SearchType = 'full' | 'prefix' | 'exact'

// Everything the search box hands an adapter. There is no result limit or page
// number here: an adapter returns everything it matched, and TextSearchManager
// ranks the merged results without filtering them, so any cap an adapter wants
// is its own to apply.
export interface BaseTextSearchArgs {
  queryString: string
  searchType?: SearchType
  stopToken?: StopToken
}
```

`searchType` is advisory — nothing enforces it, so an adapter that ignores
`'exact'` simply returns its prefix hits and the ranker floats the exact one.

**Prefer tagging exactness over filtering on it.** Set `exact: true` on the
results that matched precisely and one unrestricted search answers both "what
matches?" and "what matches exactly?". Only the adapter can make that judgement
— trix calls a hit exact when _any_ indexed attribute equals the query — so it
travels on the result. Filtering on `searchType === 'exact'` works, and the
built-ins also do it, but filtering on its own costs the search box two reads of
one index.

## Implementing the adapter

`JBrowse1TextSearchAdapter` is the smaller of the two built-ins and shows the
whole shape: a constructor that reads its config, a `searchIndex` that returns
`BaseResult[]`, and its own handling of `searchType === 'exact'`.

<!-- include: plugins/legacy-jbrowse/src/JBrowse1TextSearchAdapter/JBrowse1TextSearchAdapter.ts -->

```ts
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

import HttpMap from './HttpMap.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

interface SearchResults {
  prefix: ({ name: string } | string)[]
  // generate-names.pl record: [name, trackIndex, ?, refName, start, end]
  exact: [string, number, string, string, number, number][]
}

type IndexFile = Record<string, SearchResults>

// Uses index built by generate-names.pl
export default class JBrowse1TextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter
{
  httpMap: HttpMap

  tracksNames?: string[]

  constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const namesIndex = readConfObject(config, 'namesIndexLocation')
    const { baseUri, uri } = namesIndex
    this.httpMap = new HttpMap({
      url: baseUri ? new URL(uri, baseUri).href : uri,
    })
  }

  /**
   * Returns the contents of the file containing the query if it exists
   * else it returns empty
   * @param query - string query
   */
  async loadIndexFile(query: string): Promise<IndexFile> {
    return this.httpMap.getBucket(query)
  }

  async searchIndex(args: BaseTextSearchArgs) {
    const { searchType, queryString } = args
    const tracks = this.tracksNames ?? (await this.httpMap.getTrackNames())
    const str = queryString.toLowerCase()
    const entries = await this.loadIndexFile(str)
    const results = entries[str]
    return results ? this.formatResults(results, tracks, searchType) : []
  }
  formatResults(results: SearchResults, tracks: string[], searchType?: string) {
    return [
      ...(searchType === 'exact'
        ? []
        : results.prefix.map(
            result =>
              new BaseResult({
                label: typeof result === 'object' ? result.name : result,
              }),
          )),
      // the bucket is keyed by the query, so everything in its `exact` list
      // matched it exactly — which is what lets a caller ask once rather than
      // asking for exact hits and then for all of them
      ...results.exact.map(
        ([name, trackIndex, , refName, start, end]) =>
          new BaseResult({
            locString: `${refName || name}:${start}-${end}`,
            label: name,
            trackId: tracks[trackIndex],
            exact: true,
          }),
      ),
      // the index encodes an overflow bucket as a pseudo-hit; it is a message,
      // not a navigable location
    ].filter(result => result.getLabel() !== 'too many matches')
  }
}
```

The three constructor arguments are `BaseAdapter`'s, so pass them straight to
`super` even if you only use `config`. Backing the adapter with an API instead
of a file changes only `searchIndex`'s body — `fetch` the endpoint you read out
of the config and map each hit to a `BaseResult`.

A `searchIndex` that can be slow should honor `args.stopToken`: every keystroke
supersedes the previous query, and `TextSearchManager` treats an abort as a
normal outcome.

## BaseResult fields

<!-- SEARCH_RESULT_FIELDS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Field | Type | Purpose |
| --- | --- | --- |
| `label` (required) | `string` | primary display text, and the fallback for `displayString` |
| `displayString` | `string` | alternate display text; falls back to `label` |
| `locString` | `string` | where to navigate, e.g. `chr1:1000..2000`. A hit with neither this nor `results` is treated as a refName |
| `refName` | `string` | a refName to navigate to; `RefSequenceResult` reads it in place of `locString` |
| `trackId` | `string` | the track to open or highlight alongside the navigation |
| `results` | `BaseResult[]` | nested hits, shown as a disambiguation dialog instead of navigating |
| `exact` | `boolean` | this hit matched the query exactly, as the adapter judges it |

<!-- SEARCH_RESULT_FIELDS END -->

On Enter, the exact hits win if there are any and everything that matched is the
fallback; the winning set navigates when it holds one result and opens a picker
otherwise. So `exact` is what keeps a precise name from offering everything it
prefixes. Neither the label nor the display string decides it: those are display
text, and a hit that matched on an ID or a description has neither equal to the
query.

## Configuration schema

<!-- include: plugins/legacy-jbrowse/src/JBrowse1TextSearchAdapter/configSchema.ts -->

````ts
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config JBrowse1TextSearchAdapter
 * #trackType TextSearchAdapter
 * #fileFormat textsearch | JBrowse 1 names index | From JBrowse 1 `generate-names.pl`
 * note: metadata about tracks and assemblies covered by text search adapter
 *
 * #example
 * An entry in `aggregateTextSearchAdapters`, pointing at the `names/`
 * directory JBrowse 1's `generate-names.pl` wrote — so an existing instance's
 * search index is reused rather than rebuilt with `jbrowse text-index`:
 * ```js
 * {
 *   type: 'JBrowse1TextSearchAdapter',
 *   textSearchAdapterId: 'jbrowse1-names',
 *   namesIndexLocation: { uri: 'https://example.com/jbrowse1/data/names/' },
 *   assemblyNames: ['hg19'],
 * }
 * ```
 */
export default ConfigurationSchema(
  'JBrowse1TextSearchAdapter',
  {
    /**
     * #slot
     */
    namesIndexLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/volvox/names', locationType: 'UriLocation' },
      description: 'the location of the JBrowse1 names index data directory',
    },
    /**
     * #slot
     */
    tracks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
    },
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    },
  },
  {
    explicitlyTyped: true,
    /**
     * #identifier
     */
    explicitIdentifier: 'textSearchAdapterId',
  },
)
````

`assemblyNames` is required; `TextSearchManager` uses it to pick which adapters
to query for a given assembly. The `explicitIdentifier` is what a config's
`textSearchAdapterId` writes to, and what the adapter cache keys on — two
adapters sharing an id are one cache entry. (`TrixTextSearchAdapter` uses
`implicitIdentifier` instead, so its id is optional in a config.)

The `#config` / `#slot` JSDoc tags generate the published config page for the
adapter; they are optional.

## Plugin registration

<!-- include: plugins/trix/src/index.ts -->

```ts
import Plugin from '@jbrowse/core/Plugin'
import TextSearchAdapterType from '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType'

import configSchema from './TrixTextSearchAdapter/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class TrixPlugin extends Plugin {
  name = 'TrixPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addTextSearchAdapterType(() => {
      return new TextSearchAdapterType({
        name: 'TrixTextSearchAdapter',
        displayName: 'Trix text search adapter',
        configSchema,
        description: 'Trix text search adapter',
        getAdapterClass: () =>
          import('./TrixTextSearchAdapter/TrixTextSearchAdapter.ts').then(
            d => d.default,
          ),
      })
    })
  }
}
```

`getAdapterClass` is a dynamic import so the adapter's code stays out of the
bundle until something actually searches with it.

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

- [](/docs/developer_guides/creating_adapter)
- [](/docs/developer_guides/configuration_schema)
- Built-in adapter configs: [](/docs/config/trixtextsearchadapter) and
  [](/docs/config/jbrowse1textsearchadapter)
- [](/docs/developer_guides/pluggable_elements)
