# Pangenome Synteny: Completed Work

## CLI (`jbrowse make-pif`)

- 3-tier PIF format: full (t/q with CIGAR), summary (st/sq with absolute-position indels), structural (xt/xq with SyRI types)
- SyRI classification on all tiers via `sy:Z:` tag
- Format converters: PAF, SyRI `.syri.out`, BEDPE, GFA (P-lines + W-lines), MAF
- `--all-vs-all` mode with auto-ordering by syntenic coverage
- `--session` flag for session spec JSON generation
- Multi-pair PIF with pair-indexed prefixes (t0/q0, t1/q1, ...)
- GFA parser emits `sg:Z:` segment IDs for cross-pair tracking
- `segmentId` field on `PAFLikeRecord`, emitted as `sg:Z:` tag in PAF output

## PairwiseIndexedPAFAdapter

- 3-tier LOD, multi-pair support, `syriType` propagation
- `getMultiPairFeatures()`: fetches all pairs for a region, grouped by query genome
- `getPairInfo()`: exposes pair metadata from PIF header
- `segmentId` support via `sg:Z:` PAF tag for cross-pair shared alignment tracking

## MultiLGVSyntenyDisplay (B1, A2, B3)

- Custom ReactComponent with Canvas2D rendering (not block-based)
- afterAttach autorun: fetches multi-pair features, groups by genome, debounced (300ms)
- Genome sub-selection dialog (searchable checkbox list, select/deselect all)
- Track menu: row height, genome selector, N-way and 2-way synteny view launch options
- "Launch N-way synteny view" opens full LinearSyntenyView with ref + all displayed genomes (uses `init` for assembly loading)
- "Launch 2-way synteny with..." per-genome submenu (also uses `init`)
- Segment-based coloring: features with shared `segmentId` get consistent colors across rows
- `height` auto-calculated from genome count × row height
- Mouse hover tooltips showing genome name, coordinates, size, type, identity, segmentId

## Scalable N-Way LinearSyntenyView (C1)

- Collapsible synteny levels: each level has `collapsed` property, renders as 10px bar when collapsed
- Focus mode: expand one level, collapse all others (header menu)
- Auto-scale level heights for 4+ levels: `max(40, min(100, 400/numLevels))`
- Collapsed levels skip data fetching (afterAttach checks `isLevelCollapsed`)
- `effectiveHeight` getter on levels, respected by LinearSyntenyDisplay height
- "Synteny levels" header submenu: expand/collapse all, auto-scale, per-level focus radio

## Runtime UI

- `syri` color mode: SYN (gray), INV (orange), TRANS (blue), DUP (cyan)
- Color legend component in header
- Quick Import panel (single-file import with format auto-detection)
- Bulk assembly addition in import form

## Test Data

| Dataset | Location | Format | Size | Genomes |
|---------|----------|--------|------|---------|
| Plotsr Arabidopsis | `test/data/synteny-demo/plotsr/` | SyRI, PAF, BEDPE | 3.6MB | 4 (Col-0, Ler, Cvi, Eri) |
| PGGB chrM | download script | GFA (P-lines) | 23KB | 4 human mitochondrial |
| HPRC minigraph | `test/data/synteny-demo/hprc/` | rGFA | 850MB | 90 haplotypes |
| ntSynt great apes | `test/data/synteny-demo/ntsynt/` | TSV blocks | 1.7MB | 6 primates |
| Synthetic 3-way | `test/data/synteny-demo/synthetic/` | PAF | 350KB | 3 genomes, 3 chr |
| Synthetic 8-way | `test/data/synteny-demo/synthetic/` | PAF | 3.4MB | 8 genomes, 5 chr |
| Synthetic all-vs-all | `test/data/synteny-demo/synthetic/` | PAF | 930KB | 5 genomes, 2 chr |
| Synthetic 4-genome GFA | `test/data/synteny-demo/synthetic/` | GFA (P-lines) | 32KB | 4 genomes, 1 chr |
| Volvox N-way | `test_data/config_synteny_nway.json` | PIF | small | 3 (volvox, volvox_ins, volvox_del) |

### Validated Performance

- HPRC chr1 (46 assemblies, 123K PAF lines, 182MB): **2.3 seconds** to PIF
- Arabidopsis 4-way (39K SyRI records): **~1 second** to multi-pair PIF
- 3-tier LOD tested at chromosome scale through base level
