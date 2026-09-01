---
name: row-count-follows-the-fetch-window
description: A feature's height is the count of subfeatures the fetch happened to return, so the GFF3 redispatch bound cannot be tightened past "everything that could have children" without reflowing tracks. Latent today because the bound is total; investigate whether layout can key off the feature instead.
---

# A feature's row count follows the fetch window

Opened 2026-09-01 out of the `dontRedispatch` work that landed in `42952d1d01`.
Nothing here is broken on screen today. What is open is whether a coupling that
is currently *masked* can be removed, because it is what prices the redispatch.

## The coupling

`layoutSubfeatures`
([`plugins/canvas/src/RenderFeatureDataRPC/glyphs/subfeatures.ts:392-417`](../../plugins/canvas/src/RenderFeatureDataRPC/glyphs/subfeatures.ts))
gives every subfeature a row and sums their heights:

```ts
for (const [i, child] of subfeatures.entries()) {
  currentYPx += layoutStackedChild(child, args).height
  if (i < subfeatures.length - 1) { currentYPx += heightPx * TRANSCRIPT_PADDING_RATIO }
}
const totalHeightPx = currentYPx > 0 ? currentYPx : heightPx
```

`subfeatures` is whatever the fetch returned. `totalHeightPx` becomes
`featureHeightPx` in the flatbush item, then `bodyHeightPx`, then the rect handed
to `GranularRectLayout.addRect` — so the count of subfeatures a fetch happened to
return sets the feature's height and, through the packing, every neighbour's row.

## Why it is invisible today

Because the redispatch bound is total: it expands for every record that *could*
have children, so it always fetches all of them. Measured on
`test_data/volvox/volvox.sort.gff3.gz`, panning a 1 kb window across
`mRNA:12999-17200` in 500 bp steps under the shipped bound — subfeature count
`3` at all ten offsets. `mRNA:17399-23000` reads `5` at both offsets that see it.
Stable, by construction.

**So this is not pan-jitter anyone can see now, and an earlier note in this
thread saying otherwise was wrong.** The redispatch is what buys the stability.

## Why it matters anyway

It is the reason the bound cannot be tightened. The obvious next tightening —
expand only for records whose `ID` is actually referenced as a `Parent` by a line
in the query's own read — is correct for everything *painted* (`packRenderArrays`
clips every primitive to the fetched region) and wrong for what is *laid out*.
Same file, `ctgA:12000-13000`:

| bound | `BAC:999-20000` | `mRNA:12999-17200` |
| --- | --- | --- |
| shipped | 2 subfeatures `[clone_start, clone_end]` | 3 `[CDS, CDS, CDS]` |
| parenthood | 0 | 0 |

Both records overlap the window; none of their children does. Under the tighter
bound the gene drops from an N-row stack to one bare row and the track repacks.
15 of 3000 sampled windows differ that way, all on the two volvox copies.

That tightening was declined for this reason — see the ABI note and reasoning in
[REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md) and `42952d1d01`. The
`ID`-based bound that did ship is exactly the subset that needs no such
tightening, because a record with no `ID` has no children to miss.

## The question to answer

**Can a feature's row count be a function of the feature rather than of the
fetch?** Concretely: a gene knows how many transcripts it has, and a transcript
how many exons, from its own attributes and from the parent line — before any
child line is read. If the layout took its stack height from that rather than
from `subfeatures.length`, the tighter bound becomes available and the redispatch
stops being all-or-nothing.

Things to establish, roughly in order:

- Whether the count is derivable at all without the children. GFF3 has no
  child-count attribute; the honest sources are the parent's own span plus
  whatever the format guarantees. If the answer is "no", say so and close this —
  the current design is then correct rather than merely cautious.
- What else reads the whole subtree. Three known, none reachable by the tighter
  bound today because each needs a child *in* the window: `makeUTRs`' implied-UTR
  boundaries (`filterSubparts.ts`), the peptide reading frame stitched from all
  CDS segments (`peptides/cdsSegments.ts`), and the `longestCoding` isoform pick
  (`glyphUtils.ts:157-183`). Any of them could become reachable.
- Whether the payoff is real. On every hosted and in-tree GFF3 surveyed, the
  `ID` rule already reduces the bound to what the parenthood rule would give —
  the two differ only on files with a wide record carrying an unreferenced `ID`,
  of which hosted hg19 RefSeq's chromosome-long `region` is the one known
  example. **If that stays the only one, this is not worth building.**

## Repro

`/private/tmp/claude-501/-Users-colin-src-jbrowse-components/848f8859-670b-4437-9e51-a092d250eee1/scratchpad/`
holds `rowcount.mjs` (the table above) and `panjitter.mjs` (the stability check)
if that scratchpad still exists; both are ~90 lines driving `@gmod/tabix` +
`gff-nostream` through the adapter's read sequence, and are quicker to rewrite
than to recover. The fixture and coordinates above are the whole input.

## When this closes

If the count turns out to be derivable and worth it, the proposal belongs in
[ideas/](../ideas/README.md) and this file goes. If it does not, the finding —
"the layout's dependence on the fetched subfeature set is what makes the
redispatch bound total, and that is deliberate" — belongs in
[REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md) beside the parenthood bound,
and this file goes then too.
