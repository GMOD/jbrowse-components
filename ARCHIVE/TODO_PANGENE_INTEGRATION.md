# Pangene Integration Plan

Integration of pangene gene-graph concepts into JBrowse. Two workstreams: (A)
enhance existing infrastructure, (B) new gene-level pangenome view.

---

## Workstream A: Enhance Existing GFA Infrastructure

### A1. Add W-line (Walk) parsing to gfaParser.ts

The existing parser handles H/S/L/E/P lines but not W-lines. W-lines are the
standard GFA way to represent haplotype paths and carry richer metadata than
P-lines (sample name, haplotype number, contig, coordinates).

**Files:** `plugins/graph/src/gfa/gfaParser.ts`

**What to do:**

- Add `GFAWalk` interface:
  `{ sample, haplotype, contig, start, end, segments: {name,strand}[], tags }`
- Parse W-lines: `W sample hap contig start end >seg1<seg2>seg3 [tags]`
  - The walk body uses `>` and `<` delimiters (not `,+/-` like P-lines)
- Add `walks: GFAWalk[]` to `GFAGraph`
- Update `gfaConverter.ts` to convert walks into `GraphPath` objects alongside
  P-line paths (walks carry more info but map to the same internal path concept)
- Add unit tests with real pangene GFA snippets

### A2. Port pangene bubble detection to JS/TS

Pangene's `pangene.js` has a complete bubble finder (~300 lines) that works on
bidirected GFA graphs. Port it as a standalone utility.

**Files:** new `plugins/graph/src/gfa/bubbleFinder.ts`

**What to do:**

- Port the `NetGraph` class (cycle equivalent class marking via Johnson's
  algorithm, ~300 lines)
- Port `get_bubble_all()` and `get_bubble_id()` for exhaustive bubble discovery
- Port `walk_ht()` + `count_allele()` for extracting allele paths and
  frequencies from walks
- Key data structures to port:
  - Vertex encoding: `v = segId*2 | strand` (matches pangene's convention)
  - Adjacency index: `idx[v] = {offset, count}` into sorted arc array
  - CEC marking: DFS with bracket lists for cycle classification
- Output: `Bubble { startVertex, endVertex, intermediateSegments[], alleles[] }`
  where each allele has `{ path: vertex[], count, samples: string[] }`
- Add unit tests using the pangene paper's examples (Fig 1, Fig 4)

### A3. Bubble overlay in GraphGenomeView

Use A2's bubble finder to highlight bubbles in the existing graph visualization.

**Files:** `plugins/graph/src/GraphGenomeView/model.ts`,
`plugins/graph/src/renderer/GeometryBuilder.ts`

**What to do:**

- After graph load, run bubble detection (in worker via RPC to avoid blocking)
- Store bubbles as volatile state on the model
- Add a `colorScheme: 'bubble'` option that colors nodes by which bubble they
  belong to (or grey if not in any bubble)
- On hover/click of a bubble boundary node, show tooltip with allele counts and
  sample lists
- Add a bubble list panel (similar to GraphStats) showing all detected bubbles
  with their allele frequencies

---

## Workstream B: Gene Pangenome View

A new linear display type that shows gene-level pangenome structure — gene
presence/absence, order, copy-number across haplotypes. This is the main novel
contribution from pangene's abstraction.

### B1. Define gene pangenome data model

**Files:** new `plugins/graph/src/GenePangenome/types.ts`

**What to do:**

- Define types for the gene-level graph:
  - `Gene { id, name, length, chromosome, offset, rank }`
  - `GeneArc { from: OrientedGene, to: OrientedGene, genomeCount, avgDistance }`
  - `GeneWalk { sample, haplotype, contig, genes: OrientedGene[] }`
  - `GeneBubble { start, end, genes: Gene[], alleles: GeneAllele[] }`
  - `GeneAllele { path: OrientedGene[], count, samples: string[] }`
  - `GenePangenome { genes, arcs, walks, bubbles }`
- This is the pangene GFA's S/L/W/bubble data, typed for JBrowse

### B2. Pangene GFA adapter

An adapter that reads pangene-format GFA (where segments are genes, not base
sequences) and serves it to the gene pangenome display.

**Files:** new `plugins/graph/src/GenePangenome/PangeneGfaAdapter.ts`

**What to do:**

- Accept a pangene GFA file (local or URL)
- Parse using the enhanced gfaParser (A1) — distinguish pangene GFA from
  sequence GFA by checking segment tags (SN, SO for chromosome mapping, pp for
  protein)
- Build adjacency index and run bubble detection (A2)
- Expose methods:
  - `getGenesInRegion(chr, start, end)` — genes whose reference position falls
    in range
  - `getWalksForGenes(geneIds)` — haplotype walks through specified genes
  - `getBubblesInRegion(chr, start, end)` — bubbles overlapping region
  - `getGenePresenceMatrix(geneIds)` — which samples have which genes

### B3. Gene presence/absence matrix display

A heatmap-style display showing gene content across samples. This is pangene's
`gfa2matrix` command as a JBrowse track.

**Files:** new display type in `plugins/graph/src/GenePangenome/`

**What to do:**

- Linear display where X-axis is reference genome coordinate, Y-axis is samples
  (like the multi-LGV synteny display but gene-granularity)
- Each cell = one gene in one sample: filled = present, empty = absent, colored
  = copy number
- Gene orientation shown as arrow direction (forward/reverse relative to ref)
- Highlight inversions (gene present but reversed orientation)
- Highlight accessory genes (present in <95% of samples)
- On hover: show gene name, sample, copy count, orientation
- On click: option to navigate to the sequence-level view at that gene's
  coordinates

### B4. Gene-centric navigation

Pangene's gfa-server uses gene names as the primary navigation target. Add this
as a search mode.

**Files:** `plugins/graph/src/GenePangenome/ImportForm.tsx` or extend existing
search

**What to do:**

- Text input that accepts gene names (autocomplete from pangene GFA segment
  names)
- On gene selection, extract the local subgraph (gene + N neighbors along walks)
  and display it
- "Expand neighborhood" button to grow the visible subgraph
- This complements coordinate-based navigation — users studying gene-level
  variation often think in terms of gene names, not coordinates

### B5. Gene bubble variant track

A track type that shows gene-level structural variants (from pangene bubbles) as
features on a linear genome view.

**Files:** new display type

**What to do:**

- Each bubble becomes a feature spanning from start-gene to end-gene coordinates
  on the reference
- Feature height/color encodes number of alleles or frequency of non-reference
  path
- Clicking a bubble shows the allele paths as a mini gene-order diagram (like
  pangene's gfa-server view but inline)
- Types of events to represent:
  - Gene copy-number change (bubble where paths have different gene counts)
  - Gene order change (bubble where paths have same genes but different order)
  - Gene inversion (bubble where a gene appears in opposite orientation)
  - Gene gain/loss (bubble where some paths skip a gene entirely)

---

## Workstream C: Connect to Existing Pangenome Infrastructure

### C1. Bridge pangene bubbles to existing bubble CS system

The current GfaTabixAdapter already has bubble annotation via
`annotateFeaturesWithBubbleCs()` using precomputed bubbles from vg deconstruct.
Pangene finds complementary bubbles at the gene level.

**Files:** `plugins/comparative-adapters/src/GfaTabixAdapter/gfaTabixUtils.ts`

**What to do:**

- Define a mapping from pangene gene-level bubbles to genomic coordinates (using
  the SN/SO tags that pangene stores per segment)
- Allow loading pangene bubbles alongside sequence-level bubbles — gene-level
  bubbles would appear as a separate annotation tier in the multi-LGV synteny
  display
- Color-code: sequence-level bubbles (SNPs, small indels) vs gene-level bubbles
  (CNVs, inversions, gene order changes)

### C2. Gene pangenome from existing sequence-level GFA

Not everyone will have a pangene GFA. Provide a way to derive gene-level
information from a sequence-level pangenome GFA + gene annotation.

**What to do:**

- Given: sequence-level GFA (e.g., from minigraph-cactus) + GFF3 gene
  annotations
- For each gene in the GFF3, find which GFA segments it overlaps in each
  haplotype walk
- Construct a derived gene graph: genes as nodes, adjacency from walks
- This is essentially what pangene does (protein→genome alignment) but using
  existing gene annotations instead of protein alignment
- Output the same `GenePangenome` data model from B1, so the same displays work

---

## Implementation Order

- **Phase 1** (foundation): A1 (W-line parsing) → A2 (bubble detection port)
- **Phase 2** (graph view enhancement): A3 (bubble overlay in GraphGenomeView)
- **Phase 3** (gene pangenome MVP): B1 (types) → B2 (adapter) → B3 (matrix
  display)
- **Phase 4** (polish): B4 (gene navigation) → B5 (bubble variant track)
- **Phase 5** (integration): C1 (bridge to existing bubbles) → C2 (derive from
  sequence GFA)

Phase 1 is independent and can start immediately. Phase 3 can start in parallel
with Phase 2 since they share only the bubble detection code.
