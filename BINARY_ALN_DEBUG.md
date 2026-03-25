# Binary Alignment Debug Plan

## Problem

When loading chr20 in the browser, `getMultiPairFeatures` returns 0 features
from the binary aln adapter. The log shows:

```
[MultiSyntenyFetch] RPC complete, genomeRows keys: [] total features: 0
```

## Root Cause (identified)

The aln.bin files were generated with CHM13#0 as the reference assembly (the
first assembly in the GFA), but the JBrowse config uses GRCh38#0 as the
browsing assembly. The alignment records are stored under `CHM13#0#chr20` as
the ref chrom, but the adapter queries for `GRCh38#0#chr20`.

## Fix Applied (in progress)

Regenerating with `--ref-assembly GRCh38#0` so records are anchored to
GRCh38's coordinate space. chrM has been regenerated and re-uploaded. chr20
regeneration was started but interrupted — needs to be completed:

```bash
./tools/gfa-to-tabix/target/release/gfa-to-tabix \
  --aln-bin --ref-assembly "GRCh38#0" \
  test/data/synteny-demo/gfa-tabix-output/downloads/hprc-v1.1-mc-grch38.chr20.gfa \
  test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20
```

Then upload:
```bash
aws s3 cp test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20.aln.bin \
  s3://jbrowse.org/demos/gfadata/hprc-v1.1-mc-grch38/hprc-v1.1-mc-grch38-chr20.aln.bin
aws s3 cp test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20.aln.idx \
  s3://jbrowse.org/demos/gfadata/hprc-v1.1-mc-grch38/hprc-v1.1-mc-grch38-chr20.aln.idx
```

Takes ~4 minutes to generate (43s for aln step).

## Also regenerate pggb-chrM

The pggb-chrM data uses chm13#1 as ref. The pggb demo config may use a
different assembly name — check before regenerating. Current test data at
`test/data/synteny-demo/gfa-tabix-output/pggb-chrM.aln.{bin,idx}` was
generated with chm13#1 as ref.

## Verification steps

1. After regeneration, verify records are queryable from the browsing assembly:
```bash
node --experimental-strip-types -e "
import { loadAlnIndex, queryAlnBin } from './plugins/comparative-adapters/src/binaryAlnReader.ts';
import { LocalFile } from 'generic-filehandle2';
const idx = await loadAlnIndex(new LocalFile('test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20.aln.idx'));
const recs = await queryAlnBin(new LocalFile('test/data/synteny-demo/gfa-tabix-output/hprc-v1.1-mc-grch38-chr20.aln.bin'), idx, 'GRCh38#0#chr20', 0, 1000000);
console.log('Records for GRCh38#0#chr20:', recs.length);
"
```
Should show >0 records.

2. Rebuild jbrowse-web (`yarn start` or `yarn build`) since the adapter code
   changes (alnBinLocation config, getMultiPairFeaturesFromAlnBin) are new.

3. Load `config_hprc_chr20.json` in browser and verify features appear.

4. Zoom to base level — should see SNP marks from the binary CS data.

## Longer-term consideration

The `--ref-assembly` flag should match whatever assembly the JBrowse config
uses for browsing. The `gfa-to-tabix` tool defaults to the first assembly in
the GFA (usually CHM13 for HPRC data). For JBrowse configs that browse from
GRCh38, pass `--ref-assembly GRCh38#0`.

Alternatively, the adapter could support querying from any genome (not just the
ref used at generation time) by also indexing records by query genome chrom
names. This would require either bidirectional records or a secondary index.

## S3 paths

All files go to `s3://jbrowse.org/demos/gfadata/hprc-v1.1-mc-grch38/`
(matching the prefix in config_hprc_chr20.json).

## Files involved

- `tools/gfa-to-tabix/src/main.rs` — `--ref-assembly` flag, `--aln-bin` generation
- `plugins/comparative-adapters/src/GfaTabixAdapter/gfaTabixUtils.ts` — `getMultiPairFeaturesFromAlnBin()` chrom name resolution
- `plugins/comparative-adapters/src/binaryAlnReader.ts` — binary format reader
- `plugins/comparative-adapters/src/binaryCs.ts` — binary CS codec
- `plugins/comparative-adapters/src/GfaTabixAdapter/configSchema.ts` — `alnBinLocation` / `alnBinIdxLocation`
- `test/data/synteny-demo/hprc/config_hprc_chr20.json` — demo config (prefix-based)
