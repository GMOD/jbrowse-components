---
name: a-zoomed-out-gc-track-reads-the-whole-chromosome
description: A GC content track over a whole human chromosome downloads and scans every base of it (chr1 is 77 MB over the wire and 1.3 GB in the worker), and a whole-genome view would ask for about 12 times that, because the wiggle display never gates on bytes. The call is whether to put the wiggle display behind the region-too-large gate with `GCContentAdapter` answering `getRegionByteSize`, or to accept the cost.
---

# A zoomed-out GC track reads the whole chromosome

`GCContentAdapter` computes from the sequence, so its fetch is the sequence of
every visible region. The wiggle display composes `RegionTooLargeMixin` through
`MultiRegionDisplayMixin`, but its `gateEnabled` is the mixin's `false` and its
RPC passes no `byteLimit`, so nothing stops a chromosome-wide read. BigWig never
needed the gate, since its zoom levels bound what a zoomed-out fetch reads.

Measured 2026-10-22 from the laptop against the hosted
`GRCh38/fasta/hg38.prefix.fa.gz` (`BgzipIndexedFasta` with `RemoteFile`, one
cold fetch per span, then a GC count over the string):

| span on chr1 | over the wire | fetch and inflate | count | worker RSS |
| --- | --- | --- | --- | --- |
| 1 Mb | 1.2 MB | 687 ms | 13 ms | 99 MB |
| 10 Mb | 4.1 MB | 456 ms | 111 ms | 194 MB |
| 50 Mb | 17.5 MB | 1270 ms | 516 ms | 373 MB |
| 249 Mb (all of chr1) | 77.3 MB | 5663 ms | 3046 ms | 1289 MB |

The adapter's default `step: 'auto'` keeps the output to one or two bins per
pixel, so the read and the scan are the whole cost. At a fixed 100 bp step, all
of chr1 is also 2.49M bins, 30 MB of typed arrays across the worker boundary.

## Options

- **Gate it.** `GCContentAdapter.getRegionByteSize` answers the sequence
  adapter's estimate, or one byte per base where it has none, and the wiggle
  display opts into the gate with a `fetchSizeLimit` row in
  `scripts/gatedAdapterBudgets.json`. The gate's banner and force-load button
  then work unchanged. The cost is the wiggle RPC learning
  `measureRegionBytes`, and `MultiWiggleAdapter`, which already answers
  `getRegionByteSize`, starting to gate as well.
- **Throw the refusal.** The adapter throws an error with `regionTooLarge: true`
  (`isRegionTooLargeError`) past a span. The display shows it with no Retry and
  no force-load, so a reader cannot ask for a chromosome-wide GC curve at all.
- **Accept it.** Bacterial genomes, where GC skew is read, are a few Mb and cost
  well under a second. The cost bites on a large eukaryotic chromosome, where a
  precomputed bigWig (UCSC's `gc5Base`) is the usual source anyway.

Sampling one window per pixel reads less but scores something else. A bgzip
FASTA is read in 64 KB blocks, about 20 KB compressed on chr1, so a thousand
scattered 1 kb windows still inflate a thousand blocks, about a quarter of the
whole read, and each pixel then shows the GC of 1 kb out of its 250 kb.

The multi-way synteny view's lane layers already stop a computed adapter at
`LANE_TEMPLATE_MAX_BP` (5 Mb) and say so in the band's title, so a span cap on
the wiggle display would match a rule the app already has.
