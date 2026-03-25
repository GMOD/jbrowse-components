# Plan: Per-bubble precomputed CS using vg snarls

## Context

We need base-level detail (SNPs, indels) on synteny lines between any pair of assemblies, without O(n²) precomputation. Previous approaches (bidirectional all-vs-all pairwise aln) caused combinatorial explosion. Solution: use vg's battle-tested snarl decomposition to identify bubbles, precompute CS between allele pairs at each bubble, and look up at runtime.

**Core idea**: Each bubble/snarl in the graph has a small number of distinct alleles. The CS between any two alleles is computed once. At runtime, for any pair of assemblies, look up which allele each has and retrieve the precomputed CS. Storage is O(bubbles × allele_pairs), not O(n²).

## Pipeline overview

```
User's preprocessing:
  vg snarls graph.vg > snarls.pb           (identify bubbles)
  vg deconstruct -p REF -e graph.vg > var.vcf  (extract alleles + genotypes)

Our tool:
  gfa-to-tabix --bubbles var.vcf graph.gfa output_prefix
    → output_prefix.bubbles.bed.gz + .tbi   (tabix-indexed bubble CS)
    → output_prefix.bubbles.meta             (genome list, allele counts)

Runtime (TypeScript):
  Tabix query bubbles.bed.gz for visible region
  For each bubble: look up ref/query alleles → get precomputed CS
```

## Why vg deconstruct VCF

`vg deconstruct` already solves the hard problems:
- Snarl decomposition (via integrated snarl finder)
- Allele enumeration per snarl
- Genotyping (which sample has which allele)
- Reference-relative coordinates
- Handles nested snarls, complex topology

The VCF output contains:
- `CHROM/POS` = reference position (tabix-indexable)
- `REF/ALT` = allele sequences
- Per-sample `GT` = which allele each genome has
- `AT` field = allele traversal through graph nodes

We compute CS between each pair of alleles from their sequences.

## File format: `bubbles.bed.gz`

Tab-separated, bgzip + tabix indexed. One record per allele pair per snarl.

```
#genomes=GRCh38#0,CHM13#0,HG00438#1,HG00438#2,...
ref_path  start  end  allele_a  allele_b  identity  cs  genomes_a  genomes_b
```

- `ref_path/start/end`: reference coordinates of the snarl (from VCF CHROM/POS)
- `allele_a`, `allele_b`: allele indices (0=ref, 1+=alt)
- `identity`: match_bp / (match_bp + mismatch_bp), precomputed
- `cs`: CS string between allele_a and allele_b sequences
- `genomes_a`: comma-separated genome indices carrying allele_a
- `genomes_b`: comma-separated genome indices carrying allele_b

For biallelic sites: 1 record (allele 0 vs 1)
For triallelic: 3 records (0v1, 0v2, 1v2)

### Why text/tabix not binary

- Debuggable: `zcat | head` to inspect
- Standard tooling: tabix for range queries, same as pos.bed.gz
- Proven: same infrastructure already in use
- Adequate performance: small records, fast parsing

## Build-time algorithm (Rust tool)

New flag: `--bubbles <vcf_file>` (replaces `--aln`)

### Input
- VCF from `vg deconstruct` (bgzipped + tabix OK)
- GFA (for header/genome info already parsed)

### Algorithm
```
Parse VCF header → sample names, map to genome indices
For each VCF record:
  ref_seq = REF column
  alt_seqs = ALT column (split by comma)
  all_alleles = [ref_seq, alt_seq_1, alt_seq_2, ...]
  genotypes = parse GT field per sample → allele index per genome

  For each pair (i, j) where i < j and i,j are distinct alleles present in samples:
    cs = compute_cs(all_alleles[i], all_alleles[j])
    identity = compute_identity(cs)
    genomes_i = list of genome indices with allele i
    genomes_j = list of genome indices with allele j
    Write record: chrom, pos, pos+len(ref), i, j, identity, cs, genomes_i, genomes_j

Pipe through sort|bgzip, then tabix
```

### Memory: O(1 VCF record)
Process one record at a time, stream to output. No accumulation.

## Runtime algorithm (TypeScript)

### At zoomed-out levels (bpPerPx > 50)
No change — existing segment-based CIGAR with identity estimate.

### At zoomed-in levels (bpPerPx < 50)
Enhanced `getMultiPairFeaturesFromSegments`:

1. **Existing**: Find shared segments, build synteny features with CIGAR
2. **New**: Query `bubbles.bed.gz` via tabix for the visible region
3. **New**: For each bubble overlapping a synteny feature:
   - Determine which allele the ref assembly has (from `genomes_a`/`genomes_b`)
   - Determine which allele the query assembly has
   - If same allele → match region (no CS detail needed)
   - If different alleles → use precomputed CS
4. **New**: Integrate bubble CS into the feature's CS string
   - Between bubbles: match regions from shared segments
   - At bubbles: CS from bubble lookup

### Reference-free capability
When viewing from assembly X to assembly Y:
- Bubble positions in X's coordinates come from mapping through shared segments
- The allele each assembly carries is recorded in `genomes_a`/`genomes_b`
- The CS between alleles is the same regardless of which is "reference"
- Note: bubbles.bed.gz is indexed in the ref assembly's coordinates, so non-ref views require coordinate translation through the existing segment mapping

## Files to modify

| File | Action |
|------|--------|
| `tools/gfa-to-tabix/src/main.rs` | Add `--bubbles` VCF processing, CS computation, streaming output. Remove `--aln` code |
| `plugins/comparative-adapters/src/GfaTabixAdapter/gfaTabixUtils.ts` | Add bubble file loading, runtime CS lookup in segment renderer |
| `plugins/comparative-adapters/src/GfaTabixAdapter/configSchema.ts` | Add `bubblesLocation`/`bubblesIndex` config slots |
| `plugins/comparative-adapters/src/ShardedGfaTabixAdapter/configSchema.ts` | Same config additions |

## Size estimates (HPRC chr20, 90 assemblies)

- Variant sites (snarls): ~500k-1M for chr20
- Most are biallelic: 1 CS record each
- Average CS text: ~10-50 bytes (most variants are SNPs or small indels)
- **Total bubbles.bed.gz: ~10-30MB** compressed
- Fast to generate: linear scan of VCF, no graph traversal

## Verification

- Run `vg deconstruct` on synthetic_4genome (small, verifiable)
- Generate bubbles, inspect by hand
- Run on chrM (44 genomes), verify bubble count and CS correctness
- Run on chr20, verify size and generation time
- Load in JBrowse: zoom into chrM, verify base-level detail appears on synteny lines
- Switch reference assembly, verify CS still works for non-ref pairs
