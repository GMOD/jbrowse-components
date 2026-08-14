# Deep sequencing track

```
wgsim volvox.fa out1.fq out2.fq
bwa mem -t 32 volvox.fa out1.fq out2.fq | samtools fixmate -u -m - - | samtools sort -u -@2 - | samtools markdup -@8 --reference volvox.fa - tmp.cram
samtools view tmp.cram ctgA:1000-2000 -o deep_sequencing.cram
```

# Translocation track (`volvox-translocation.bam`)

```
node generate_translocation_bam.mjs   # requires samtools on PATH
```

A purpose-built ctgA↔ctgB event for the read-connection arcs, with every
coordinate fixed so a test can assert exact counts. The generator carries the
reasoning; this is the map:

| group | what                                                           | records | draws as                                                                             |
| ----- | -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| 1     | split-read junction ctgA:20,000 ↔ ctgB:3,000, identical coords | 6 × 2   | **one** arc, support 6 — `arcKey` coalesces on the exact coordinate                  |
| 2     | mate-pair translocation, ctgA 19,800–19,975 ↔ ctgB 2,900–3,075 | 8 pairs | a fan of 8 arcs; both sides cluster, so it clears `minInterchromSupport: 2`          |
| 3     | decoy pairs ctgA:20,050–20,070 ↔ ctgB:5,900–5,920              | 3 pairs | 3 **ticks** on ctgA when the ctgB window is 2,500–3,500 — far foot displayed nowhere |
| 4     | same-chromosome long-range pairs ctgA:20,000 ↔ ctgA:30,000     | 5 pairs | cross-region arcs in a two-ctgA-region view; ordinary long-insert arcs in one        |

Interchromosomal records carry TLEN 0, which is what SAM sets across references
and what the read cloud's arc/tick decision turns on.

`browser-tests/suites/arcs-display.ts` reads it through the
`volvox_translocation` track, at three region layouts over the same data — the
third being the single-region control, without which the other two are also
satisfied by an overlay that draws everything.

# SNP self-alignment (`volvox_snp.fa` / `volvox_snp.paf`)

```
node generate_snp_alignment.mjs   # requires minimap2 on PATH
```
