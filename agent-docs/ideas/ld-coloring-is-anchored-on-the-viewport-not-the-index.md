---
name: ld-coloring-is-anchored-on-the-viewport-not-the-index
description: The Manhattan LD read queries the .ld file over the viewport, so panning the index SNP off screen greys every point — measured on the shipped SLE fixture, 1212 partners to 0 for a 200 kb pan — and the display ships a banner calling that expected. Anchoring the query on the index is ~20 lines and fixes it; the abandoned wip commit that also splits LD into its own RPC buys ~11 ms at that fixture, needs three files it never touched, and re-litigates ADR-016 without saying so.
---

# The LD query is anchored on the viewport, not on the index SNP

`buildLdToIndex` asks the PLINK adapter for records over `region` — the fetch's
viewport window — and then keeps the pairs where one side is the index SNP
(`plugins/gwas/src/ManhattanRPC/ldToIndex.ts`). PLINK writes each pair once and
tabix finds a row by its A side, so a window that does not contain the index
returns no row that mentions it.

Measured against `test_data/gwas/SLE.ld`, the fixture the `sle_gwas_ld` demo
track and the `gwas-locuszoom` browser suite both use, with the index at its
own lead SNP `2:191958656`:

| query window | `indexFound` | partners |
| --- | --- | --- |
| 191790000-192120000 (the demo's own view) | true | 1212 |
| 191990000-192320000 (panned right 200 kb) | false | 0 |
| 191500000-191830000 (panned left 200 kb) | false | 0 |

Every row in that file carries the index as its A side, so both directions
fail, not just one. `bufferedVisibleRegions` adds half a screen either side, so
in the app it takes about one and a half screen-widths of panning; after that
every point is grey.

The display already knows: `isIndexSnpOffscreen` exists to tell the two causes
apart, and `LdIndexWarning` prints *"Index SNP is off-screen — pan or zoom to it
to color points by LD"*. That banner is the defect described as behaviour.

## The fix is the query, not the architecture

Anchor the read on the index and widen by the file's own `--ld-window-kb`
instead of by the viewport: query `[indexBp - windowBp, indexBp + windowBp]`,
keep the same one-side-is-the-index scan. The file does not record the window it
was written at, so `windowBp` is a config slot (plink's own default is 1000 kb).
Panning then re-reads nothing at all, and `isIndexSnpOffscreen`, its test and
the banner's off-screen branch all become dead.

While in there: partners are keyed by SNP id *as well as* position
(`r2ByKey.set(r.snpB, r.r2)`), and PLINK writes `.` for an unnamed variant, so
every such partner collides onto one entry —

```
records: rsIndex@100 ↔ .@200 r²=0.9,  rsIndex@100 ↔ .@300 r²=0.1
r2ByKey: { ".": 0.1, "2:200": 0.9, "2:300": 0.1 }
```

— and `lookupR2` checks the name first, so a feature named `.` reads a
neighbour's r², and any feature named `.` with no LD record at all is coloured
as a partner. Keying partners by position only removes it.

## The larger rearchitecture the same wip contains

`ebb015077a` on `wip-gwas-ld-rearchitecture` ("does not typecheck yet") also
splits the LD read into its own `GetLdToIndex` RPC, takes `indexSnp` off
`rpcProps()`, and joins r² into each region's colours in `installUpload`'s
`encode`. The reasoning is sound and main's infrastructure is ready for it —
`installUpload` already takes `inputs`/`encode`, `createEncodeMemo` already
re-encodes per cell rather than per arrival, and `installFetch` already carries
a second fetch beside the primary in three other places. It is not worth landing
as it stands, for three separate reasons.

**The perf case does not carry it.** One `GetManhattanData` in LD mode over the
SLE locus (1991 SNPs, warm adapter, local file):

| step | ms |
| --- | --- |
| `getFeaturesArray` | 7.2 |
| `buildManhattanResult` (LD evaluators) | 3.5 |
| `buildLdToIndex` | 0.8 |
| **one refetch** | **11.5** |
| the split's replacement: `GetLdToIndex` + main-thread join | 0.9 |

So moving the index saves ~11 ms and one round trip at the fixture that
matters — and the auto-pick autorun spends that twice on every LD-mode load,
which `ldAutoIndex.test.ts` pins as `toHaveBeenCalledTimes(4)` for two regions.
It is genuinely large only at the genome-wide `giant_bmi_locuszoom` demo, where
chr16 alone (69,562 SNPs) is 510 ms of `getFeaturesArray` plus 219 ms of LD
evaluation per region against 21 ms for the join — ~17 s versus ~0.5 s across
24 regions. That is the extreme fixture, not the typical one.

**The draft is incomplete past typechecking.** The join writes colours, glyphs
and r² into the *encoded* map, but `renderSvg.tsx` paints from
`model.rpcDataMap` and `findManhattanHit` reads `data.r2s` off it too — so as
written the SVG export draws normal colours instead of LD ones and the tooltip's
r² row goes blank. `createEncodeMemo`'s own doc prescribes the fix ("a display
that needs the encoded map itself — for a hit test, an SVG export — holds one in
a `.views` closure"), and the wip touches none of those three files.

**It re-opens ADR-016 silently.** ADR-016 rejected moving wiggle's pos/neg split
main-thread-ward and states the general rule: a setting that feeds an expensive
per-feature worker loop and *changes rarely* stays in `rpcProps()`. `indexSnp`
fails the second half — the auto-pick fires on every load and right-click
re-anchoring is this display's primary interaction — which is exactly the
criterion ADR-016 says flips the answer, and its 2026-08-30 corollary supplies
the arithmetic. That makes the split arguable, but it makes it an ADR, not a
refactor.

## What is actually wrong underneath

`rpcProps()` must return only user-controlled settings
([FETCH_KEYS.md](../reference/FETCH_KEYS.md) §"`rpcProps()` loop trap"). GWAS
returns `indexSnp`, and `ManhattanAdoptTopSnp` writes `topSnp` — derived from
the fetched data — into it. The loop is real and currently held open by
`viewportWithinLoadedData && !isLoading`, a deterministic tie-break in `topSnp`,
a `dataSuperseded` supersession hook and a 212-line test. It converges, and at
the typical fixture it costs the 11 ms above, so it is not urgent; but it is the
one thing in this display that a fresh reader will keep rediscovering, and the
RPC split is the only fix for it. Whoever takes that up should land the query
anchoring first, separately, because it is the half that fixes something a user
can see.
