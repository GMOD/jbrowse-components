---
name: credential-aware-chunk-cache
description: The chunk cache keys on URL alone, so two tracks on one URL behind different internet accounts share chunks and one of them plans the fetch — bytes fetched under A's token are served to B, and a credential change is invisible for the 15-minute idle window. Where the identity would have to go, and why it is now a decision about a published @gmod package.
---

# The chunk cache does not know whose credentials fetched a chunk

`InternetAccountModel.openLocation` hands each handle its own fetcher:

```ts
openLocation(location: UriLocation) {
  return new RemoteFileWithRangeCache(location.uri, {
    fetch: self.getFetcher(location),
  })
}
```

but the cache under it keys on `this.url`. `CachedFilehandle` takes `(inner,
key)` and every key in `chunkCache.ts` — `cacheKey`, `oncePerKey`, `recordSize`,
`clearCacheFor` — is that string. So one URL is one cache entry no matter how
many handles, and `fetchRun` binds `doFetch` from whichever handle happened to
plan the run. Two tracks on the same URL with different accounts cross over:
the bytes one reader sees may have been fetched under the other's token, and
which reader planned the run is a race.

Nothing calls `clearCacheFor`, so the crossing outlives a credential change by
the idle sweep's window rather than being invalidated when the token is.

**The cancellation half of the same mechanism is correct** and should not be
re-derived: `joinRun`/`abortIfUnwanted` reference-count readers, so one reader
giving up does not abort a run another is still waiting on.

## What a fix has to decide

The cache moved out of this repo — it is `@gmod/range-cache-filehandle`, and
`packages/core/src/util/io/RemoteFileWithRangeCache.ts` is now a re-export. So
the choice is between:

- **Key the cache by identity, in the @gmod package.** The honest fix:
  `CachedFilehandle` already takes a key separate from the URL, so the caller
  could pass `${accountId}\n${url}` and every downstream function works
  unchanged. It costs a released package a change to what a key means, and
  `clearCacheFor`'s prefix behaviour (it clears any key merely *beginning* with
  the one given — measured, deliberate) has to be re-read against a composite
  key before it can be trusted.
- **Key it in JBrowse, by handing `openLocation` a distinct key.** Same effect
  without touching the package, if the constructor surface allows it.
- **Invalidate rather than partition.** Call `clearCacheFor(url)` when an
  account's token changes. Cheaper, and it fixes the stale half only — two
  tracks with two live accounts on one URL still cross.

## Reproducing it

Two tracks on the same URL, two internet accounts, distinct tokens; assert the
`Authorization` header the server saw for the second track's chunks. Do not
assert through a mocked `fetch` on one handle — the bug is precisely that the
second handle's fetcher is never called.
