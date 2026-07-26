# taffy `.tai` gaps: a block's second reference row is unreachable by region query

Explained, minimally reproducible, upstream's to fix (2026-07-26).

When a MAF block carries **more than one row for the reference genome**, taffy's
`.tai` files the block under row 0's coordinates only. The other copies are in
the file but no region query can reach them, unless some other block's row 0
happens to cover the same coordinates.

On the hosted E. coli pggb demo alignment that costs **1,773 bp, 0.038%** of the
reference positions the file covers, in two clusters. Every position covered by
a row-0 reference row is reachable; the failures are entirely non-anchor copies
that sit far from their anchor.

Two earlier sessions mistook symptoms of this for bugs in
`scripts/reroot_maf.py` and spent a lot of effort "fixing" the wrong layer. See
[PANGENOME_FIGURE_HANDOFF.md](PANGENOME_FIGURE_HANDOFF.md) and the
`reroot_maf.py` docstring.

## Minimal reproducer

Twelve lines of MAF, no source data and no docker. The middle block carries two
`REF.chr` rows, the second one far from the first.

```
##maf version=1

a
s	REF.chr	0	10	+	1000	ACGTACGTAC
s	OTH.chr	0	10	+	1000	ACGTACGTAC

a
s	REF.chr	10	10	+	1000	ACGTACGTAC
s	REF.chr	500	10	+	1000	ACGTACGTAC
s	OTH.chr	10	10	+	1000	ACGTACGTAC

a
s	REF.chr	20	10	+	1000	ACGTACGTAC
s	OTH.chr	20	10	+	1000	ACGTACGTAC
```

```bash
taffy view -i dup.maf > dup.taf && bgzip -c dup.taf > dup.taf.gz
taffy index -i dup.taf.gz

taffy view -i dup.taf.gz -r REF.chr:500-510 -m
# Region REF.chr:500-510 not found in taffy index; emitting header-only output

taffy view -i dup.taf.gz -r REF.chr:0-30 -m
# returns the block, second REF row and all
```

The row is only ever reachable by riding along inside a block fetched through
row 0.

## Measuring it on a real file

Exhaustively, not by sampling. Compare full-stream coverage against the union of
windowed index queries.

```bash
# every reference row the file contains, block index and row index kept
taffy view -i x.taf.gz -m |
  awk 'BEGIN{blk=0} /^a/{blk++; ri=0; next}
       $1=="s"{ if($2=="K12.chr" && $4>0) print blk, ri, $3, $3+$4; ri++ }'

# what the index returns, walked in 100 kb windows
for ((a=0; a<4641652; a+=100000)); do
  taffy view -i x.taf.gz -r K12.chr:$a-$((a+100000)) -m
done | awk '$1=="s" && $2=="K12.chr" && $4>0 {print $3, $3+$4}'
```

Diff the covered position sets. On `ecoli_pggb.taf.gz`
(md5 `d64c811a1562e493ca14462f8b02f6bb`): stream 4,640,542 positions, index
4,638,769, missing 1,773 in exactly two runs, **1211940-1212074** and
**4170830-4172469**. Nothing the index returns is absent from the stream.

Both runs are covered only by row-index-1 K12 rows in blocks anchored hundreds
of kb away, e.g. block 4023 is `K12.chr 3945848 +851` at row 0 and
`K12.chr 4170785 +851` at row 1.

Query width and start do not matter. A 1 bp query and a 100 kb one both miss;
neither is a workaround.

Do not measure this with block-order or overlap counts off a `taffy view -m`
dump. Those describe taffy's re-blocking rather than the input, and they are
what misled the earlier passes. Retrieval is the metric that matters.

## What has been ruled out, with evidence

- **Not `reroot_maf.py`'s anchor choice.** It anchors on the first reference row
  in a block. Re-anchoring on the leftmost was tried and is measurably worse
  (out-of-order blocks in taffy's own output, more lost queries, never fewer).
  Both variants show the defect.
- **Not out-of-order blocks.** taffy's own output has 179 places where a block's
  row-0 start goes backwards relative to its predecessor, and retrieval does not
  care: all 4,636,851 row-0-covered positions come back.
- **Not a stale taffy binary.** Built taffy from upstream HEAD
  (`af7a752a`, 2026-05-28) against the local Jan 2025 binary. The newer build
  produces a **byte-identical** `.taf.gz` from the same MAF and the same
  failures, and the minimal reproducer above fails on it. Upgrading is not the
  fix.
- **Not missing data in the input.** The positions are present in the MAF that
  taffy consumed.

An earlier pass recorded this cause as ruled out, on the grounds that 53 of 60
positions covered only by a non-anchor row retrieved fine. That test was
misleading: most non-anchor copies sit close enough to their anchor that another
block's row 0 covers them anyway. The 7 that failed were the real signal.
Position 17,139, listed then as a failure, is not one at all: no K12 row in the
stream covers it, so it is a hole in the alignment rather than in the index.

## Options

- **Report upstream.** The reproducer above is self-contained and needs no
  context from this repo.
  https://github.com/ComparativeGenomicsToolkit/taffy, active (HEAD 2026-05-28).
  The question for them is whether `impl/tai.c` should emit an index entry per
  reference row rather than per block.
- **Fix it on our side by splitting.** `reroot_maf.py` could emit one block per
  reference row, so every copy anchors itself. Only 48 pggb blocks carry
  duplicate K12 rows, so the file grows negligibly, and there is now an exact
  acceptance metric: unreachable positions go 1,773 to 0. This is *not* the
  re-anchoring change that was tried and reverted twice; it changes block
  membership, not which row goes first. It does move the demo file's md5, which
  [PANGENOME_FIGURE_HANDOFF.md](PANGENOME_FIGURE_HANDOFF.md) treats as a
  tripwire, so it needs a re-upload and a measured before/after.
- **Do nothing.** Defensible; see below.

## Should anyone care

Probably not, and for a stronger reason than the last revision of this doc gave.

Both published pggb MAF figure loci were checked position by position against
full-stream coverage and are **100% reachable**: `chr:2,120,000-2,140,000`
(20,000 of 20,000) and `chr:4,540,000-4,600,000` (60,000 of 60,000). The
unreachable runs are two isolated repeat collapses, 0.038% of the axis, nowhere
near a figure.

It matters more if a new MAF figure lands inside `1211940-1212074` or
`4170830-4172469`, or if a user brings a repeat-rich pggb MAF, where blocks with
duplicate reference rows are denser and 0.038% could be much larger.

`BgzipTaffyAdapter` reads through the same `.tai`, so whatever the index cannot
return, JBrowse cannot draw. There is no adapter-side workaround; the fixes are
upstream's index or our block splitting.
