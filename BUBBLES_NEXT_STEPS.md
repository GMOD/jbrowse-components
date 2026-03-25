# Bubbles next steps

## What's done

- **Rust tool**: `--bubbles <vcf>` flag reads VCF from `vg deconstruct`, computes
  CS between allele pairs, outputs `bubbles.bed.gz` + `.tbi`. Tested on chrM (544
  records, 7KB).
- **TypeScript runtime**: `bubblesLocation`/`bubblesIndex` config added to both
  adapter schemas. `annotateFeaturesWithBubbleCs()` queries bubbles at zoom-in
  (bpPerPx < 50), finds genome alleles, attaches CS to features.
- **Cleanup**: All binary aln code removed (binaryAlnReader.ts, binaryCs.ts,
  alnBin config). All text aln code removed (getMultiPairFeaturesFromAln,
  alnFile, alnLocation config). Bubbles is the only approach.
- **chr20 VCF generated**: `vg deconstruct -p "GRCh38#0#chr20" -a chr20.gfa`
  produced 32MB compressed VCF at
  `test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20.vcf.gz`
  (already tabix indexed).
- **Plan**: `SNARLS_PLAN.md` committed.

## What remains

### Generate chr20 bubbles

The system kept OOM'ing during chr20 bubble generation. The Node.js script
worked but the downstream sort|bgzip pipe got killed. Try again after reboot:

```bash
cd /home/cdiesh/src/jbrowse-components

# Option A: use the Rust tool (requires reading full GFA which uses ~3GB RAM)
./tools/gfa-to-tabix/target/release/gfa-to-tabix \
  --bubbles test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20.vcf.gz \
  --ref-assembly "GRCh38#0" \
  test/data/synteny-demo/gfa-tabix-output/downloads/hprc-v1.1-mc-grch38.chr20.gfa \
  test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20

# Option B: standalone Node.js (lighter, doesn't read GFA)
# Write to temp file first, then sort+bgzip separately
node --experimental-strip-types scripts/vcf-to-bubbles.ts \
  test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20.vcf.gz \
  > /tmp/chr20_bubbles_unsorted.tsv
sort -t$'\t' -k1,1 -k2,2n /tmp/chr20_bubbles_unsorted.tsv | bgzip \
  > test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20.bubbles.bed.gz
tabix -c '#' -p bed \
  test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20.bubbles.bed.gz
```

Consider extracting the VCF→bubbles logic into a standalone script
(`scripts/vcf-to-bubbles.ts` or similar) so it doesn't require loading the
full GFA.

### Refactor Rust tool: separate --bubbles from GFA processing

Currently `--bubbles` requires a GFA input because it runs as part of the full
gfa-to-tabix pipeline. The bubble generation only needs the VCF — it doesn't
use any GFA data. Options:

- Add a mode where GFA is optional when only `--bubbles` is specified
- Or just make a separate standalone tool/script for VCF→bubbles

### Browser testing

- Load chrM in JBrowse with bubbles config
- Zoom in to bpPerPx < 50
- Verify CS data appears on synteny features
- Check that different query genomes show correct allele-specific CS
- Test the `annotateFeaturesWithBubbleCs` code path end-to-end

### Fix bubble CS annotation logic

The current `annotateFeaturesWithBubbleCs` in gfaTabixUtils.ts has a
simplistic approach to matching genomes to alleles. It needs refinement:

- The genome indices in bubbles.bed.gz are VCF sample indices (from vg
  deconstruct), while the genome names in JBrowse come from the GFA
  `#genomes=` header. These may not match directly — need a mapping.
- The current code assumes allele 0 = ref. For non-ref-centric views,
  need to handle the case where the "ref" assembly in the view is not
  allele 0 in the VCF.
- Sort the overlapping bubbles by position before building CS.

### Consider: identity from bubbles

Currently identity is computed from segment overlap ratio in the segment-based
renderer. With bubbles, we could compute more accurate identity by counting
match/mismatch bases from the bubble CS data. This would give true base-level
identity rather than segment-level approximation.
