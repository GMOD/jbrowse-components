---
name: credential-aware-chunk-cache
description: The chunk cache keys on URL alone, so two tracks on one URL behind different internet accounts are served chunks fetched under either token, and a credential change goes unnoticed. Keying it in JBrowse needs no package change.
---

# The chunk cache does not know whose credentials fetched a chunk

`@gmod/range-cache-filehandle` 2.0.0 exports `CachedFilehandle(inner, key)`, so
keying by identity in JBrowse (the fix below) needs no package change.

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

## The fix

The cache moved out of this repo — it is `@gmod/range-cache-filehandle`, and
`packages/core/src/util/io/RemoteFileWithRangeCache.ts` is now a re-export.
Key it in JBrowse: `openLocation` returns a `CachedFilehandle` over a handle
carrying the account's fetcher, keyed `${accountId}\n${url}`, and every
downstream function works unchanged.
`clearCacheFor`'s prefix behaviour (it clears any key merely *beginning* with
the one given — measured, deliberate) has to be re-read against the composite
key. Invalidating with `clearCacheFor(url)` on a token change instead would fix
only the stale half: two tracks with two live accounts on one URL still cross.

## Reproducing it

Two tracks on the same URL, two internet accounts, distinct tokens; assert the
`Authorization` header the server saw for the second track's chunks. Do not
assert through a mocked `fetch` on one handle — the bug is precisely that the
second handle's fetcher is never called.
