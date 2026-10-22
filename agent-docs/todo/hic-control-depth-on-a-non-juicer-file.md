---
name: hic-control-depth-on-a-non-juicer-file
description: Hi-C observed/control scales two libraries by their raw total contacts, which holds for Juicer files whose normalization vectors keep the matrix sum. A `.hic` from another pipeline may balance rows to a sum of 1, leaving normalized counts far below 1 where the pseudocount swamps them. Unchecked on any non-Juicer file.
metadata:
  area: hic
  category: measure-first
  order: 1
  first_move: "build a `.hic` pair with hictk (one with and one without `--skip-all-vs-all`), open them as a comparison under KR and NONE, and compare against a downsampled-to-equal-depth log2 ratio"
---

# Hi-C observed/control's depth on a non-Juicer file

`executeRenderHicData.ts` scales both counts to the two libraries'
geometric-mean depth, each depth the file's `ALL`-map total
(`@gmod/hic`'s `getTotalContacts`), or the chromosome pair's sum where either
file has no `ALL` map, then adds a pseudocount of 1. Checked on the ENCODE
K562 and GM12878 maps (`hic/observed_control`), both Juicer-built.

Two premises are unconfirmed for other pipelines:

- **Normalized counts in raw units.** Juicer's KR and SCALE vectors keep the
  matrix's total, so a normalized count and a raw total share units. A vector
  scaled so rows sum to 1 makes every normalized count tiny, the pseudocount
  then dominates, and the ratio flattens toward 1.
- **The `ALL` map's total.** Juicer writes it from every contact. A tool that
  downsamples the `ALL` map, or writes it in other units, would scale one file
  wrongly; with `--skip-all-vs-all` there is none and the pair sums apply.

If either fails, the depth can come from summing the file's own chromosome-pair
maps at the binsize, which costs one matrix header read per pair.
