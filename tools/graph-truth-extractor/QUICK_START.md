# Graph Truth Extractor - Quick Start

## One-Command Audit

Test subgraph extraction across all available backends:

```bash
node --experimental-strip-types tools/graph-truth-extractor/cli.ts \
  --all-backends \
  --gfa <path-to-gfa> \
  --path <path-name> \
  --start <bp> --end <bp>
```

### Example: Volvox (50 samples)
```bash
node --experimental-strip-types tools/graph-truth-extractor/cli.ts \
  --all-backends \
  --gfa test_data/volvox/volvox_pangenome_50.gfa \
  --path 'ref#0#ctgA' \
  --start 1000 --end 5000
```

**Expected output:** All 4 backends succeed; vg ↔ naive isomorphic match

### Example: chrM (44 haplotypes)
```bash
node --experimental-strip-types tools/graph-truth-extractor/cli.ts \
  --all-backends \
  --gfa test/data/synteny-demo/hprc/hprc-v1.1-mc-grch38-chrM.gfa \
  --path 'GRCh38#0#chrM' \
  --start 1000 --end 5000
```

**Expected output:** 3 backends succeed (vg, naive, chunkix); odgi fails; vg ↔ naive isomorphic match

## Single Backend

Run one oracle:

```bash
# Using vg (reference)
node --experimental-strip-types tools/graph-truth-extractor/cli.ts \
  --backend vg \
  --gfa test_data/volvox/volvox_pangenome_50.gfa \
  --path 'ref#0#ctgA' \
  --start 1000 --end 5000 \
  --emit json

# Using naive (baseline)
node --experimental-strip-types tools/graph-truth-extractor/cli.ts \
  --backend naive \
  --gfa test_data/volvox/volvox_pangenome_50.gfa \
  --path 'ref#0#ctgA' \
  --start 1000 --end 5000
```

## Output Modes

```bash
--emit raw        # Raw GFA output (no normalization)
--emit canonical  # Canonicalized GFA (node-ID-independent)
--emit json       # JSON with metadata + canonical GFA
```

## Key Flags

| Flag | Purpose |
|------|---------|
| `--all-backends` | Run all 4 backends and compare |
| `--backend <name>` | Single backend: vg, odgi, chunkix, naive |
| `--context <k>` | Context expansion (default 1). Use `snarl` for snarl-aware |
| `--use-sequence` | Use actual sequences in canonicalization (Phase 1) |
| `--cache-dir <dir>` | Override cache location (default: gfa-path.truth-cache) |
| `--out <file>` | Write to file instead of stdout |

## Backends & Dependencies

| Backend | Status | Location | Note |
|---------|--------|----------|------|
| **vg** | ✓ Required | System PATH | Reference oracle |
| **naive** | ✓ Ready | Built-in | No dependencies |
| **odgi** | ✓ Built | ~/src/vendor/odgi/bin/ | Requires PATH setup |
| **chunkix** | ✓ Built | ~/src/vendor/sequenceTubeMap/ | Requires Python 3, tabix |

### Setup odgi for PATH

If odgi not in PATH:
```bash
export LIBRARY_PATH=~/src/vendor/odgi/build/fake-libs:$LIBRARY_PATH
export PATH=~/src/vendor/odgi/bin:$PATH
```

## Interpreting Results

### Success: All backends agree
```
# vg vs naive: isomorphic
# vg vs odgi: isomorphic
# vg vs chunkix: isomorphic
```
→ High confidence in subgraph extraction ✓

### Success: vg/naive agree (expected)
```
# vg vs naive: isomorphic
# vg vs odgi: DIVERGE (difference in 4-5 segments)
# vg vs chunkix: DIVERGE (difference in 4-5 segments)
```
→ odgi/chunkix use stricter boundary filtering (acceptable) ⚠

### Issue: vg/naive disagree
```
# vg vs naive: DIVERGE
```
→ Algorithm mismatch; investigate! 🔴

## Common Issues

**"path not found"** → Use correct PanSN format (e.g., `CHM13#0#chrM` not `NC_012920.1`)

**odgi path extraction fails** → Known issue with special characters in path names; use vg/naive instead

**Missing chunkix index** → Run `pgtabix.py -g <gfa>` to build it first

**Out of memory on large regions** → Use smaller region or increase heap: `node --max-old-space-size=8192 ...`

## For Integration Testing

Place this in your test suite:

```bash
# Verify vg/naive agreement for regression detection
node --experimental-strip-types tools/graph-truth-extractor/cli.ts \
  --backend vg \
  --gfa test_data/volvox/volvox_pangenome_50.gfa \
  --path 'ref#0#ctgA' \
  --start 1000 --end 5000 \
  --emit json > /tmp/vg_truth.json

node --experimental-strip-types tools/graph-truth-extractor/cli.ts \
  --backend naive \
  --gfa test_data/volvox/volvox_pangenome_50.gfa \
  --path 'ref#0#ctgA' \
  --start 1000 --end 5000 \
  --emit json > /tmp/naive_truth.json

# Compare canonical GFAs
diff <(jq .canonicalGfa /tmp/vg_truth.json) \
     <(jq .canonicalGfa /tmp/naive_truth.json)
```

Exit code 0 = agreement ✓
