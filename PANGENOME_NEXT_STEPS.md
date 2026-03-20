# Pangenome Synteny: Next Steps

## Current State (as of 2026-03-20)

### What's Implemented

**CLI (`jbrowse make-pif`)**
- 3-tier PIF format: full (t/q with CIGAR), summary (st/sq with absolute-position indels), structural (xt/xq with SyRI types)
- SyRI classification on all tiers via `sy:Z:` tag
- Format converters: PAF, SyRI `.syri.out`, BEDPE, GFA (P-lines + W-lines), MAF
- `--all-vs-all` mode with auto-ordering by syntenic coverage
- `--session` flag for session spec JSON generation
- Multi-pair PIF with pair-indexed prefixes (t0/q0, t1/q1, ...)

**Runtime**
- `PairwiseIndexedPAFAdapter`: 3-tier LOD, multi-pair support, `syriType` propagation
- `syri` color mode: SYN (gray), INV (orange), TRANS (blue), DUP (cyan)
- Color legend component in header
- Quick Import panel (single-file import with format auto-detection)
- Bulk assembly addition in import form

**Test data**
- Plotsr Arabidopsis 4-way (Col-0/Ler/Cvi/Eri) — SyRI output, PAF, BEDPE, genomes.txt
- PGGB chrM pangenome GFA (4 human mitochondrial genomes)
- HPRC minigraph rGFA (whole-genome, 90 haplotypes)
- Synthetic generators for 3-way, 8-way, all-vs-all PAF, and 4-genome GFA

### Validated Performance
- HPRC chr1 (46 assemblies, 123K PAF lines, 182MB): **2.3 seconds** to PIF
- Arabidopsis 4-way (39K SyRI records): **~1 second** to multi-pair PIF
- 3-tier LOD tested at chromosome scale through base level

---

## Phase A: Runtime GFA Integration

### A1. Indexed GFA Querying (High Priority)

A GFA graph viewer is being developed in parallel. Runtime GFA access is needed for both graph visualization AND synteny projection. This changes the architecture — instead of only pre-computing PIF files, we need on-the-fly extraction of pairwise synteny from a GFA.

**Approach: GFA Tabix Index**

GFA files aren't naturally tabix-compatible, but we can create an indexing scheme:

1. **Pre-process**: Sort GFA by segment stable coordinates (`SN:Z:`, `SO:i:`), bgzip, and create a custom index mapping chromosome ranges to file byte offsets
2. **Query**: Given a region (e.g., `chr20:1-5000000`), retrieve all segments and walks overlapping that region
3. **Project**: For selected paths, walk shared segments to produce synteny records on-the-fly

**Alternative: GFA → SQLite**

Convert GFA to a SQLite database with tables for segments, links, and path steps. Index by path name + offset. This gives us random access without loading the full graph.

```
segments(id, length, sequence_offset, sn, so, sr)
path_steps(path_id, step_index, segment_id, orientation, cumulative_offset)
paths(id, sample, haplotype, sequence, start, end)
```

Query: "Give me all segments on path X between offsets A-B" → simple range query on `path_steps`.

**Files to create:**
- `packages/core/src/data_adapters/GfaAdapter/` — base GFA adapter with SQLite or indexed access
- `plugins/comparative-adapters/src/GfaSyntenyAdapter/` — synteny-specific adapter that projects GFA paths into pairwise features

### A2. Dynamic Path Sub-selection

Users need to pick N paths from a large pangenome (e.g., 90 HPRC haplotypes) and get N-way synteny. This requires:

1. **Path catalog**: Parse GFA header/paths to list all available genomes
2. **Selection UI**: Searchable list with checkboxes, grouping by sample/haplotype
3. **On-demand extraction**: Only compute synteny for selected pairs
4. **Caching**: Cache computed pairs so switching between subsets is fast

**UI component:**
- `plugins/linear-comparative-view/src/LinearSyntenyView/components/ImportForm/GenomeSubsetSelector.tsx`
- Shows all available genomes from the GFA/PIF file
- Drag-to-reorder, checkbox to include/exclude
- "Auto-order by syntenic distance" button
- Shows estimated pair count: "5 selected → 4 pairs (adjacent) or 10 pairs (all)"

### A3. GFA-to-PIF Streaming Conversion

For large GFAs that can't be loaded into memory, implement streaming conversion:

1. Parse segments in one pass (store in Map — just IDs and lengths, not sequences)
2. Parse paths/walks, accumulate step offsets
3. For each pair, walk and emit synteny records directly to sort pipe
4. Never hold the full GFA in memory

This extends the current `parseRgfa()` to handle multi-GB files.

---

## Phase B: Multi-LGV Synteny Display

### B1. MultiLGVSyntenyDisplay Track Type

A new display type that shows synteny from **multiple** query genomes simultaneously within a single `LinearGenomeView`. Unlike the current `LGVSyntenyDisplay` (which shows one pairwise comparison as aligned read-like features), `MultiLGVSyntenyDisplay` stacks multiple comparisons:

```
┌──────────────────────────────────────────────────┐
│  Reference: GRCh38 chr20                         │
├──────────────────────────────────────────────────┤
│  ▸ CHM13   ████ SYN ████ INV ███ SYN ████████   │ ← row 1
│  ▸ HG002.1 ████ SYN ████████ SYN ██ DUP ████   │ ← row 2
│  ▸ HG002.2 ████ SYN █ INV ██████ SYN ████████   │ ← row 3
│  ▸ HG00438 ████ SYN ██████████████ SYN ███████   │ ← row 4
└──────────────────────────────────────────────────┘
```

Each row is a query genome. Features are colored by SyRI type. This provides a compact overview similar to genome browser alignment tracks.

**Interactions:**
- Click a row to highlight it
- Right-click → "Launch N-way synteny view" with the reference + clicked genome
- Click-and-drag to select a region → "Launch synteny view for selected region"
- Rubber-band select multiple rows → "Launch N-way synteny for selected genomes"

**Files to create:**
- `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/index.ts`
- `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/model.ts`
- `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/configSchemaF.ts`
- `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/components/MultiSyntenyRenderer.tsx`
- `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/components/LaunchMultiSyntenyDialog.tsx`

**Data flow:**
1. Adapter returns features from multi-pair PIF (or GFA projection), tagged with pair index
2. Display groups features by query genome
3. Each row rendered as a horizontal ribbon track (height ~20px per genome)
4. SyRI coloring applied per-block
5. Total height = numGenomes × rowHeight + padding

### B2. Genome Selection Panel for MultiLGVSyntenyDisplay

When a multi-pair PIF or GFA has many genomes, users need to sub-select which ones to display:

```
┌─ Displayed genomes (drag to reorder) ──────┐
│  ☑ CHM13        ↕                          │
│  ☑ HG002.1      ↕                          │
│  ☑ HG002.2      ↕                          │
│  ☐ HG00438      ↕                          │
│  ☐ HG00621      ↕                          │
│  ... (85 more)                              │
│  [Select all] [Deselect all] [Auto-order]   │
└─────────────────────────────────────────────┘
```

### B3. Launch Multi-Way Synteny from LGV

From `MultiLGVSyntenyDisplay`, users should be able to launch a full `LinearSyntenyView`:

1. User selects a region (rubber-band or zoom)
2. User selects genomes (checkboxes in the display, or by clicking rows)
3. Click "Launch synteny view" → creates `LinearSyntenyView` with N rows
4. Each pair gets a synteny level with pre-loaded tracks

This bridges the compact LGV view to the full comparative visualization.

---

## Phase C: Improved N-Way LinearSyntenyView

### C1. Scalable View for 8+ Genomes

The current `LinearSyntenyView` works for N genomes but the UI gets crowded. For 8+ genomes:

- Compress genome row heights dynamically based on count
- Add a minimap/overview showing which chromosomes are in view
- Collapsible synteny levels (hide/show individual pairs)
- "Focus mode": expand one pair, collapse others

### C2. Cross-Level Linking

When viewing N genomes (A, B, C, D), show relationships that skip levels:
- A↔B synteny + B↔C synteny visible by default
- Optional: A↔C "transitive" synteny computed from A↔B + B↔C
- Visual: dotted/faded lines for non-adjacent pairs

### C3. Diagonalization for N Genomes

The existing "Re-order chromosomes" works for 2 genomes. For N genomes:
- Optimize ordering to minimize crossing lines across ALL pairs simultaneously
- Use a weighted objective function: minimize total crossings where adjacent pairs have higher weight
- Consider phylogenetic ordering as a starting heuristic

---

## Phase D: Graph Viewer ↔ Synteny Integration

### D1. Bidirectional Navigation

Since a GFA graph viewer is being developed:

1. **Graph → Synteny**: User views a bubble/variant in the graph, clicks "Show synteny context" → opens synteny view centered on that variant's coordinates
2. **Synteny → Graph**: User clicks an inversion/translocation in the synteny view → opens graph viewer showing the underlying bubble structure

### D2. Path Highlighting in Graph View

When the synteny view has specific genomes selected:
- Highlight those paths in the graph view
- Show which bubbles differentiate the selected genomes

### D3. Shared Adapter Layer

Both the graph viewer and synteny projection should share the same GFA adapter:
- Single GFA file opened once
- Graph viewer queries segments + links for a region
- Synteny adapter queries paths for the same region
- Coordinate transforms shared between both views

---

## Test Data Construction

### Available Now

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

### Scripts

```bash
# Generate synthetic data
node test/data/synteny-demo/scripts/generate-synthetic-data.mjs

# Download real data
bash test/data/synteny-demo/scripts/download-real-data.sh

# Build PIF files from all datasets
bash test/data/synteny-demo/scripts/build-pif-files.sh
```

### Needed Next

1. **HPRC chr20 PAF**: Extract from PGGB untangle PAF (requires streaming ~877MB)
   ```bash
   curl -sL "https://s3-us-west-2.amazonaws.com/.../untangle.paf.gz" | zcat | grep "chr20" > hprc_chr20.paf
   ```

2. **Minigraph-cactus chr20 GFA**: Need to convert `.vg` → `.gfa` using `vg view`
   ```bash
   vg view -g hprc-v1.1-mc-grch38.chroms/chr20.vg > hprc_chr20_mc.gfa
   ```

3. **C. elegans multi-species PAF**: Small genomes, good for integration testing
   ```bash
   minimap2 -x asm20 c_elegans.fa c_briggsae.fa c_brenneri.fa > celegans_3way.paf
   ```

---

## Implementation Priority

| Priority | Phase | Task | Effort | Impact |
|----------|-------|------|--------|--------|
| 1 | B1 | MultiLGVSyntenyDisplay base | Large | Enables compact multi-genome overview in LGV |
| 2 | A2 | Genome sub-selection UI | Medium | Essential for large pangenomes |
| 3 | B3 | Launch multi-way from LGV selection | Medium | Key UX bridge between compact and full views |
| 4 | A1 | Indexed GFA adapter (SQLite) | Large | Enables runtime GFA for graph viewer + synteny |
| 5 | C1 | Scalable N-way view (8+ genomes) | Medium | Visual polish for many genomes |
| 6 | D1 | Graph ↔ Synteny navigation | Medium | Connects the two visualization modes |
| 7 | A3 | Streaming GFA conversion | Small | Handles very large GFAs |
| 8 | C2 | Cross-level linking | Small | Nice-to-have for transitive relationships |
| 9 | C3 | N-way diagonalization | Medium | Algorithmic improvement |
| 10 | D2-D3 | Shared adapter + path highlighting | Large | Deep integration with graph viewer |

---

## Key Design Decisions Still Open

1. **GFA indexing strategy**: SQLite vs custom tabix-like index vs server process?
   - SQLite: simplest, works offline, proven with large datasets
   - Custom index: lightest weight, serves over HTTP
   - Server: most flexible, but operational burden

2. **Multi-pair PIF vs runtime projection**: Pre-compute all pairs or compute on demand?
   - For ≤20 genomes: pre-compute adjacent pairs into PIF (fast, small)
   - For >20 genomes: must project on demand (too many pairs to pre-compute all)
   - Hybrid: pre-compute a subset, project the rest

3. **MultiLGVSyntenyDisplay rendering**: Canvas/WebGL or DOM-based?
   - WebGL: handles thousands of features efficiently, consistent with existing GPU pipeline
   - DOM: simpler for interactions (hover, click), but slow for many genomes
   - Likely: WebGL for rendering, invisible DOM overlay for interactions

4. **Assembly creation for graph genomes**: How to create JBrowse assemblies from GFA paths?
   - Each path could be a separate assembly, but 90 assemblies is unwieldy
   - Alternative: one "pangenome" assembly with paths as a metadata layer
   - The graph viewer may inform this — paths in the graph are natural assembly representations
