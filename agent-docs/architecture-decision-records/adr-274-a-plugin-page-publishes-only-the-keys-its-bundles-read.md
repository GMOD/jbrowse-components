---
status: Accepted
summary: "jbrowse-web scans each UMD plugin bundle's text and publishes only the `JBrowseExports` keys it reads, each from its own `import()`; a bundle the scan cannot read (ESM, a computed key, `jbrequire`, no CORS) gets the whole registry. Supersedes ADR-128's lazy-registry rejection"
---

# ADR-274: A plugin page publishes only the keys its bundles read

## Status

Accepted (2026-11-18). Supersedes the first Rejected row of
[ADR-128](adr-128-the-runtime-abi-is-the-exports-maps.md) for UMD bundles, and
settles the parked idea `waiting-on-a-number/plugin-aware-re-export-registry`.

## Context

- **A config naming any runtime plugin fetched the whole registry**: every
  module of the four served packages and Material UI, in the page and again in
  the worker. The volvox demo's `umd_plugin.js` reads none of it.
- **ADR-128 rejected a lazy registry** because a UMD bundle reads
  `JBrowseExports[key]` at module scope and cannot await, and "the bundle does
  not carry" what it reads. It does: every bundler writes an external as a
  literal read off the global (`JBrowseExports["@jbrowse/core/util"]`, a
  minifier's backticks, `JBrowseExports.react`). On 2026-11-18 all 16 store
  bundles read the registry only that way, none through `jbrequire`.

## Decision

- **The generator emits a loader map beside each registry**
  (`reExportLoaders.generated.ts`, `workerReExportLoaders.generated.ts`, and
  core's `ReExports/loaders` and `workerLoaders`): the same keys, each behind
  its own `import()`. The worker map stubs the same keys the worker registry
  does. `reExports.test.ts` pins each loader to the registry's value.
- **Given the loader map, `PluginLoader` fetches each UMD bundle's text with
  CORS, publishes the keys `reExportKeysRead` finds, and evaluates the same
  bytes**: a `crossOrigin` script on the page, which reads the fetch from the
  HTTP cache (store hosts send `Vary: Origin`, so a no-CORS script would
  download again), and the text itself in the worker.
- **The whole registry, as before, when any bundle cannot say**: an ESM plugin
  (its chunks can read keys later), a computed read, the global passed whole,
  `jbrequire`, or a fetch that fails or is refused CORS.
- **A partial registry is marked partial** (`setReExportRegistry(libs, true)`),
  so `jbrequire` and the agent API's `ensureReExports` do not take it for the
  whole map, and a read the scan missed throws naming the scan rather than the
  plugin's build. A later load merges its keys into what is published.
- **`index.html` fetches each named bundle's text when the config arrives**,
  and preloads the loader map's chunks rather than the registry's.

## Consequences

Measured 2026-11-18 on ada, gzipped JS page plus worker
(`pnpm measure-web-bundle --worker`), and load timing over HTTP/2 with gzip
and immutable caching, cold loads, medians of 9-11:

| page | main | scan | ready, 0 ms per response | ready, 150 ms per response |
| --- | ---: | ---: | --- | --- |
| volvox, plugin reads nothing | 1087 KB | 753 KB | 1231 → 925 ms | 1887 → 1929 ms |
| UCSC store plugin, 5 keys | 1087 KB | 757 KB | | |
| TView store plugin, 21 keys | 1087 KB | 817 KB | 2361 → 2230 ms (4 tracks) | 3145 → 3232 ms (4 tracks) |
| volvox, four tracks | 1498 KB | 1330 KB | 2263 → 2040 ms | 3401 → 3230 ms |

- **A plugin reading many keys pays about 90 ms at 150 ms per response**: its
  key modules are requested when `main.js` reaches plugin loading, where the
  whole registry was preloaded from the HTML. Preloading the read keys' chunks
  from the HTML would need a key-to-chunk map in the page.
- **Desktop and the embedded products still publish the whole registry**; they
  install no loader map.
- **ESM plugins get the whole registry.** Following an ESM entry's static
  chunk imports would cover them; three of the 16 store plugins are ESM.
