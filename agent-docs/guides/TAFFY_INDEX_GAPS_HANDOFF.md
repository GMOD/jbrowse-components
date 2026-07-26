# taffy `.tai` gaps: a block's second reference row is unreachable by region query

Explained and fixed on our side (2026-07-26). Upstream question filed as
[taffy#89](https://github.com/ComparativeGenomicsToolkit/taffy/issues/89); it is
arguably a known limitation of taffy's model rather than a bug, which is why the
issue asks for a warning rather than asserting one.

**Fixed by `scripts/reroot_maf.py` emitting one block per reference row**
(unreachable K12 positions 1,773 to 0). The hosted demo file has not been
regenerated yet, so the defect is still live in production data. See "Our fix"
below.

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

Two traps, both of which have already produced wrong answers in this repo. Get
either wrong and the result moves by thousands of positions.

- **Strand.** A row with strand `-` covers
  `[srcsize-start-size, srcsize-start)`, not `[start, start+size)`. Scoring it
  naively invents intervals no query can ever return, which is where the
  original "1 in 250 positions" rate came from.
- **Clip to the queried window.** A region query returns whole blocks, so a
  returned row may lie far outside the range asked for. Credit a row as reachable
  only for the part inside the window you queried, or coverage retrieved by a
  query for a different locus makes the gap vanish entirely (this one produced a
  false "0 unreachable" on a file that has 1,773).

Then it is exhaustive, not sampled: compare full-stream coverage against the
union of windowed index queries.

```bash
# forward-strand interval of every K12 row, for either pass
fwd='$1=="s" && $2=="K12.chr" && $4>0 {
       if($5=="+"){s=$3;e=$3+$4} else {s=$6-$3-$4;e=$6-$3} print s"\t"e }'

# what the file contains
taffy view -i x.taf.gz -m | awk "$fwd" > stream.bed

# what the index returns, walked in 100 kb windows and clipped to each window
for ((a=0; a<4641652; a+=100000)); do
  b=$((a+100000))
  taffy view -i x.taf.gz -r K12.chr:$a-$b -m |
    awk -v a=$a -v b=$b "$fwd"'{ if($1<a)$1=a; if($2>b)$2=b; if($2>$1)print }' OFS='\t'
done > reachable.bed
```

Diff the covered position sets. On the hosted `ecoli_pggb.taf.gz`
(md5 `d64c811a1562e493ca14462f8b02f6bb`): stream 4,640,495 positions, reachable
4,638,722, missing 1,773 in exactly two runs, **1211940-1212074** and
**4170830-4172469**. Nothing the index returns is absent from the stream. On the
split rebuild: stream 4,641,652 (complete), reachable 4,641,652, missing 0.

Add block and row indices (`/^a/{blk++; ri=0}`) to the stream pass to attribute
each gap to a row, which is what identified the cause.

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

## Why the fix cannot live in the index

The tempting fix is an index entry per reference row. It does not work without
redesigning the iterator. `.tai` records are `(name, seq_pos) -> file_pos`, and
`tai_iterator` in `impl/tai.c` bounds its forward scan with
`file_pos >= tair_2->file_pos`, where `tair_2` is the first record at or past the
query end. That is only sound while coordinate order matches file order. An entry
for a copy 300 kb from its block's anchor breaks the correspondence and would
abort scans for unrelated queries. Blocks in the file itself must be sorted by
row-0 start for the same reason, which is also why splitting has to be followed
by a sort.

So a query can only ever be answered by a block whose row 0 covers it. The fix is
to make that true of every copy.

## Our fix: one block per reference row

`scripts/reroot_maf.py` emits one block per reference row, each rooted on its own
copy, and its existing sort puts them in order. Not the re-anchoring that was
tried and reverted twice: it changes block membership, not which row goes first.

Measured on the five-strain graph:

| metric                    |        unsplit |         split |
| ------------------------- | -------------: | ------------: |
| unreachable K12 positions |          1,773 |         **0** |
| K12 stream coverage       |      4,640,495 | 4,641,652 (all) |
| blocks                    |          4,736 |         4,791 |
| `.taf.gz` size            |        3.82 MB |       3.89 MB |

The non-reference strains churn under 0.05% in both directions (Sakai +4,892,
NCTC86 +962, CFT073 -1,592, IAI39 -2,086). That is taffy's re-blocking, not this
script: at the MAF level, before taffy runs, per-strain coverage is identical
between split and unsplit output. Both figure loci retrieve 100% on the split
file.

**Not yet regenerated.** The hosted demo still has the defect. Rebuilding gives
md5 `461e60e4d3e50cd82e5b1204cb3d3bfb` where the hosted file is
`d64c811a1562e493ca14462f8b02f6bb`, so shipping it means re-uploading
`ecoli_pggb.taf.gz{,.tai}` and invalidating CloudFront. Whether 1,773 bp is worth
a demo-data re-upload is a judgement call, and the mixed non-reference churn is
the argument against.

## Should anyone care

The defect as it stands in production is small and away from anything shown. Both
published pggb MAF figure loci are **100% reachable**: `chr:2,120,000-2,140,000`
(20,000 of 20,000) and `chr:4,540,000-4,600,000` (60,000 of 60,000). The
unreachable runs are two isolated repeat collapses, 0.038% of the axis.

It matters more if a new MAF figure lands inside `1211940-1212074` or
`4170830-4172469`, or if a user brings a repeat-rich pggb MAF, where blocks with
duplicate reference rows are denser and 0.038% could be much larger. For a user's
own data the answer is now concrete: split the blocks.

`BgzipTaffyAdapter` reads through the same `.tai`, so whatever the index cannot
return, JBrowse cannot draw. There is no adapter-side workaround.
