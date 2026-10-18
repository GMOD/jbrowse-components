---
status: Accepted
summary: "@gmod/range-cache-filehandle 2.0 stores the exact byte extents it fetched per file, instead of rounding every read onto a 256 KiB grid: reads issued in one microtask turn plan together, a gap under 64 KiB grows to 64 KiB, gaps within 64 KiB share a request, and memory is 256 MiB of bytes in pieces of at most 1 MiB. 32 HPRC gene lanes went from 10.7 MB to 3.4 MB in the same 32 requests, .hic from 18 requests to 8. Range-supporting servers only: a 200 to a range request is an error. Amends ADR-059, whose fifteen-minute sweep and 256 MiB stand"
---

# ADR-234: The range cache stores the extents it fetched

## Status

Accepted (2026-10-18), shipped as `@gmod/range-cache-filehandle` 2.0.0. Amends
[ADR-059](adr-059-the-raw-chunk-cache-is-the-long-tail-layer.md): its 256 KB
chunks and entry-count cap are gone; its fifteen-minute idle sweep, its 256 MiB
bound and its long-tail argument stand.

## Context

1.6.0 rounded every parser read onto a 256 KiB grid. One cell was the unit of
request, storage, eviction, the EOF encoding and in-flight joining at once.

- The HPRC portal's 32 haplotype gene lanes, small reads scattered over ~2 MB
  BED files, downloaded 10.7 MB for 3.4 MB of parser reads.
- A 16 KiB grid cut that to 3.8 MB, and one review then found four defects in
  it, each a rule that assumed the cell's size: eviction cost, a blocked
  readahead, EOF re-requested forever, and a whole-file download per read.

A study replayed read traces recorded from the real parsers through simulators
of each design; the A and B simulators matched the real libraries byte for byte.

## Decision

- Per file, a sorted list of the exact extents fetched. A read takes what they
  and the requests in flight cover, and fetches only its gaps.
- A read with gaps waits one microtask, so a turn's reads plan together. A gap
  under `MIN_REQUEST` (64 KiB) grows forward to it, and gaps within it of each
  other share one request.
- 256 MiB of bytes per realm, LRU over pieces of at most 1 MiB.
- A size a source states (a Content-Range total, a short body, `stat`, a
  subclass's `recordSize`) replaces the last; a bare 416 only bounds it.
- Range-supporting servers only. A 200 to a range request is an error.

Cold pass through the real parsers against a counting server, MB / requests:

| workload | 1.6.0 | 2.0.0 |
| --- | --- | --- |
| 32 HPRC gene lanes | 10.72 / 32 | 3.38 / 32 |
| RNA-seq BAM | 8.39 / 11 | 6.12 / 11 |
| 1000x BAM | 49.55 / 12 | 48.71 / 6 |
| 20x BAM | 2.10 / 5 | 1.38 / 6 |
| .hic | 4.72 / 18 | 4.24 / 8 |
| bigWig | 3.67 / 14 | 0.98 / 15 |

A revisit made no request in either version.

## Consequences

- `setChunkCacheLimit` is `setCacheLimit`, with exact bytes;
  `packages/tables/src/cache.ts` calls it. `CHUNK_SIZE` and `MAX_CACHE_ENTRIES`
  are gone.
- `rangecache-probe.ts` attributes retained memory by counting 1 MiB buffers,
  the size of a long body's pieces, where it counted 256 KiB chunks.
- The TAF and MAF adapters no longer `stat` their bgzf file: a query past the
  last chromosome's last `.tai` entry reads to EOF in doubling steps.

### What was rejected

- **A smaller fixed grid (16 KiB):** each fix for the cell added another
  cell-shaped rule.
- **No raw retention, leaning on the parsed caches and the browser's HTTP
  cache:** revisits with cold parsers cost a full re-download, 2x the bytes on
  every workload.
- **32 KiB or 128 KiB for `MIN_REQUEST`:** 32 KiB cost bigWig and .hic
  requests (15 → 18, 7 → 10); 128 KiB added 0.7 MB to the gene lanes for no
  request saved.
