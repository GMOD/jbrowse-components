# taffy `.tai` gaps: alignment present in the file, unreachable by region query

Open, low impact, unexplained (2026-07-26).

A small fraction of reference positions that a `.taf.gz` demonstrably contains
cannot be retrieved from it by an indexed region query. Measured on the hosted
E. coli pggb demo alignment: **1 in 250 to 400** reference positions that a full
stream of the file reports as covered return nothing when queried through the
`.tai`.

This is not known to affect any published figure. It is written down because two
earlier sessions mistook symptoms of it for bugs in
`scripts/reroot_maf.py` and spent a lot of effort "fixing" the wrong layer. See
[PANGENOME_FIGURE_HANDOFF.md](PANGENOME_FIGURE_HANDOFF.md) and the
`reroot_maf.py` docstring.

## Reproducing it

Self-contained, no source MAF and no docker needed. Compare what a full stream
of a file says it covers against what the file's own index will return.

```bash
# every reference row the file contains
taffy view -i x.taf.gz -m | awk '$1=="s" && $2=="K12.chr" && $4>0 {print $3, $3+$4}'

# whether the index returns a covering row for one position
taffy view -i x.taf.gz -r K12.chr:$p-$((p+1)) -m | awk '$1=="s" && $2=="K12.chr" && $4>0'
```

Sample a few hundred positions drawn from the first list and count how many the
second finds nothing for. Known failing positions in the hosted
`ecoli_pggb.taf.gz`: **17,139**, **4,171,240**, **4,171,990**.

Do not measure this with block-order or overlap counts off a `taffy view -m`
dump. Those describe taffy's re-blocking rather than the input, and they are
what misled the earlier passes. Retrieval is the metric that matters.

## What has been ruled out, with evidence

- **Not `reroot_maf.py`'s anchor choice.** It anchors on the first reference row
  in a block. Re-anchoring on the leftmost was tried and is measurably worse
  (out-of-order blocks in taffy's own output, more lost queries, never fewer).
  Both variants show the defect.
- **Not the duplicate reference rows themselves being unindexed.** The obvious
  theory is that a block with two reference rows gets filed under row 0 only, so
  the second copy is unreachable. Tested directly: of 60 positions covered
  *only* by a non-anchor reference row, 53 were retrievable. taffy's re-blocking
  splits those blocks, which is what makes them reachable at all.
- **Not a stale taffy binary.** Built taffy from upstream HEAD
  (`af7a752a`, 2026-05-28) against the local Jan 2025 binary. The newer build
  produces a **byte-identical** `.taf.gz` from the same MAF
  (md5 `d64c811a1562e493ca14462f8b02f6bb`) and the same 1/400 failure rate, and
  it also fails to read the affected positions out of the existing file.
  Upgrading taffy is not the fix.
- **Not missing data in the input.** The positions are present in the MAF that
  taffy consumed. Position 4,171,240 sits in a block whose K12 row is
  `4171164 +483`.

## Leading hypothesis: blocks with more than one reference row

The one structural difference between the affected file and a clean sibling
correlates perfectly, on a sample of two files:

| file                  | blocks | blocks with >1 K12 row | stream-covered positions unreachable |
| --------------------- | -----: | ---------------------: | -----------------------------------: |
| `ecoli_pggb.taf.gz`   |  4,736 |                     48 |                              1 in 250 |
| `ecoli_cactus.taf.gz` |  5,887 |                      0 |                              0 in 250 |

pggb collapses repeats, so one block can carry several rows for the same genome
(up to five for K12 here, and 374 surplus rows for Sakai). Cactus does not
produce that here. Failures cluster near those blocks without being confined to
them, which fits "taffy's re-blocking of a multi-reference-row block sometimes
emits a fragment the `.tai` does not cover" better than it fits a clean rule.

Two files is weak evidence. Confirming it needs a third.

## Next steps, cheapest first

- **Build a minimal reproducer.** Hand-write a small MAF with one
  two-reference-row block, convert and index it, and walk every position. If the
  gap reproduces in tens of lines, it is reportable upstream as-is.
- **Test the correlation on a third file.** Any MAF with duplicated reference
  rows per block that is not from pggb, or a pggb MAF with the duplicates
  removed, separates "duplicate rows" from "pggb" as the cause.
- **Look at `taffy/impl/tai.c`** (the index writer) against
  `taffy/impl/taf.c`'s re-blocking. The question is whether every emitted block
  gets an index entry, or only blocks that start a new coordinate run.
- **Report upstream** at
  https://github.com/ComparativeGenomicsToolkit/taffy once there is a
  reproducer. The project is active (HEAD is 2026-05-28).

## Should anyone care

Probably not yet, and that judgement should be revisited rather than inherited.

At 0.25 to 0.4 percent of positions, on a five-strain bacterial demo, with no
figure known to land on a gap, this is below the noise floor of what the demo
communicates. It matters more if:

- a MAF figure's locus turns out to sit on a gap (check a new MAF locus against
  the failing positions above, the same way
  [PANGENOME_FIGURE_HANDOFF.md](PANGENOME_FIGURE_HANDOFF.md) says to check it
  against the 30-cluster presence list), or
- a user brings a large pggb or repeat-rich MAF, where 0.25 percent is a lot of
  absolute sequence and the duplicate-row density is likely higher.

`BgzipTaffyAdapter` reads through the same `.tai`, so whatever the index cannot
return, JBrowse cannot draw. There is no adapter-side workaround short of
streaming, which is not viable at this file size.
