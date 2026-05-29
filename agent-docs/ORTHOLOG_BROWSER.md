# Navigating to homologous genes in synteny views

## Problem

In `linear-comparative-view` (synteny), two pains make exploration hard:

- **Navigate to a specific homologous gene.** There is no way to say "show me
  gene X across all these genomes." Search works per-row only.
- **Set up multiway synteny views.** Building an N-genome view is a manual,
  row-by-row assembly that most users never get through.

## What exists today

- Synteny features are matched **purely by coordinates** via PAF/CIGAR — never
  by gene name/ID (`PAFAdapter`, `SyntenyFeatureData`). No ortholog concept.
- The one navigation primitive is `navToSynteny`
  (`plugins/linear-comparative-view/src/LGVSyntenyDisplay/components/util.ts`):
  right-click a synteny feature → it projects the clicked region across **one**
  alignment using `findPosInCigar`/`parseCigar2`, then **spawns a new 2-way
  `LinearSyntenyView`**. This is already the single-hop version of IMPG's
  `project_overlapping_interval`.
- Multiway is built by **appending one pairwise track at the terminal end**
  (`AddRowDialog` → `appendRow` in `LinearComparativeView/model.ts`). N views →
  N-1 levels, each level a pairwise synteny track between adjacent rows.
- **No cross-genome search.** Searching a gene in row 1 navigates only row 1;
  other rows don't follow.
- PR #4985 (open) adds an **all-vs-all PanSN PAF adapter**: one
  `minimap2 self.fa self.fa` file encodes every pairwise relationship between N
  assemblies, so all comparisons are known up front. This is the *data* backbone
  for both auto-multiway-setup and fan-out projection.

## The format question answers itself: pangene

We don't need to invent an ortholog-table format. The
[pangene](https://github.com/lh3/pangene) pipeline (vendored at
`~/src/vendor/pangene`) already produces it, two layers deep:

- **Gene → coordinates per genome** is literally the *input* miniprot PAFs.
  `miniprot --outs=0.97 --no-cs -Iut16 genomeX.fna proteins.faa > genomeX.paf`
  gives, per line, `protein(gene) → (contig, start, end, strand)` for one
  genome. Group those across all per-genome PAFs by gene name and you have the
  whole table. Protein names are conventionally `GENE:ENSP...` so the gene name
  is the key.
- **pangene's GFA** adds *relationships* on top: nodes = gene names, L-lines =
  genomic adjacency, W-lines = per-contig gene order. (W-lines carry gene order
  but `*` for coordinates — coordinates live in the input PAFs / placement
  records, `format.c:83`.) Nice for "what's next to this gene"; **not needed**
  for navigation.

So the minimal substrate is a **tidy columnar table**:

```
gene    assembly    refName    start    end    strand
```

pangene/miniprot generates it; a ~20-line converter normalizes it; a user can
also hand-author it or export from Ensembl Compara / OrthoFinder. GFA is an
optional later enhancement, not a v1 dependency.

## Recommended smallest thing: pangene-backed gene locator

A coordinate-projection-only action (reuse `findPosInCigar`) helps *only*
navigation, *only* where CIGAR alignments are loaded between every pair, and is
fuzzy for present/absent or rearranged genes. The gene table hits **both** pains
with one mechanism:

> A "locate gene" box on `LinearSyntenyView` that, given a gene name, looks up
> its row(s) in the table and launches/syncs a multiway view positioned on that
> gene in every genome where it occurs.

Setup difficulty disappears because the view is **derived from the gene**, not
hand-assembled row by row.

### v1 slice

- **Format spec** — tidy `gene/assembly/refName/start/end/strand` (TSV or JSON),
  loaded as a session-level resource. Ship a tiny `miniprot-paf → table`
  converter.
- **Index** — in-memory `Map<geneName, Placement[]>`; gene-name search reusing
  the existing fuzzy/autocomplete search UI pattern.
- **Launch** — on select, build `views: [{assembly, loc}, …]` for the assemblies
  present and call the existing
  `session.addView('LinearSyntenyView', { init })`. Auto-pick the pairwise
  synteny track between consecutive rows using the same session lookup
  `AddRowDialog` already does; fall back to whatever pairwise tracks exist.
- **Sync** — for an already-open view, a "jump to gene" action that calls
  `navTo` on each row.

This reuses all existing multiway plumbing (`appendRow`/level wiring, `addView`
init) and the per-row search UI. No new renderer, no new synteny adapter.

### Files likely touched

- New: ortholog/placement resource + loader (tidy table → `Map`), and the
  miniprot-PAF converter (script or small util).
- New: gene-locator search-box component for the synteny-view header
  (mirror `HeaderSearchBoxes.tsx`).
- Edit: `LinearSyntenyView/model.ts` — a `locateGene(name)` action that builds
  init `views`/`tracks` and calls `addView`, plus `jumpToGene` for an open view.

## Alternative / complement: PanSN + IMPG (coordinate projection)

When there are **alignments but no gene annotations**, the table has nothing to
key on. That's the IMPG case: project a locus *transitively* through an
all-vs-all PanSN PAF (#4985) to get its homologous span in every genome.

- `findPosInCigar` is already the single-hop projection. The increment is
  chaining it across levels / fanning out over the all-vs-all file — i.e. a
  JS port of IMPG's `query_transitive_dfs` bounded to the loaded levels (visited
  ranges, min length, merge nearby). IMPG itself is a pure Rust CLI with no
  JS/WASM bindings, so we port the algorithm rather than bind to it.
- Same "snap all rows" UX as the gene locator, different backend (coordinates
  vs. gene names). Treat as a **second path**, not the first build.
- IMPG can also be used **offline** (`impg query`/`partition`) to *precompute*
  projection or placement tables, feeding the tidy-table path above.

## Decision

Build the **pangene-backed gene locator** first: tidy table → gene-name search →
launch/sync multiway view. Smallest end-to-end change that fixes the stated
pain, sidesteps format invention, and leans on an established vendored tool.
Keep PanSN+IMPG projection as the complementary path for the
alignments-without-annotations case.

## Prior art: NCBI MCGV (what to copy)

NCBI's [Multiple Comparative Genome Viewer](https://www.ncbi.nlm.nih.gov/mcgv)
(and its single-pair predecessor CGV) gets several things right that bear
directly on both pains:

- **Anchor-assembly model.** One reference (e.g. GRCh38) with every other
  assembly aligned *to the anchor*, not chained adjacent-pairwise. "Find a gene
  on anchor assembly" searches once, then all other rows follow. Switchable
  anchor. This is simpler and more gene-centric than our chained
  `appendRow`/N-1-levels layout — see the view-model note below.
- **Tiered level-of-detail.** The display changes representation by zoom:
  chromosome overview → alignment blocks colored by % identity (95–25%) /
  orientation → a **sequence-conservation graph** (proportion of assemblies
  matching per position) → per-nucleotide columns *only below ~1 Mbp*. You never
  fetch per-base data when zoomed out.
- **Compressed view** to fit more assemblies on screen.
- Exports GFF3 / XLSX for the whole alignment, FASTA only up to ~200 kb.

### The zoomed-out MAF problem in JBrowse

Our MAF viewer (`plugins/maf`) is **always per-base**: `LinearMafDisplay` fetches
full alignment columns for every sample at every zoom via the
`LinearMafGetAlignmentData` worker RPC, then renders base-by-base. There is a
worker-computed coverage/SNP band but it is still derived from per-base fetches,
and there is **no conservation/identity summary and no LOD switch**. Loading a
large region of a UCSC bigMaf is therefore enormous and slow — exactly the gap
MCGV's tiered model closes.

### Proposal: preprocess bigMaf into tiers, reuse existing renderers

Rather than build a new summarizing renderer, **preprocess** the large bigMaf
into two coarse representations JBrowse already renders well, and switch by zoom
(mirrors the SAM/BAM/CRAM **multi-tier file format** principle — coarse summary +
detailed base data, not a single layout):

- **Coarse (zoomed out): alignment blocks as synteny.** Convert each species'
  MAF blocks vs. the anchor into per-pair synteny features with an identity
  score (PIF-like; the `de:f:`/`pafIdentity` identity path already exists). The
  existing GPU synteny renderer in `linear-comparative-view` then draws the
  multiway comparison with no per-base fetch — identity coloring comes for free.
- **Conservation graph: a quantitative summary.** A per-bin "fraction of
  assemblies matching the anchor" track is just a wiggle — render it with the
  existing wiggle/`ScoreScaleModel` infra (or reuse a UCSC phastCons/phyloP
  bigWig where one exists, which is the conventional conservation source).
- **Fine (below a bp/px threshold): the current per-base `LinearMafDisplay`.**
  Unchanged; only activated when zoomed in, so the heavy fetch happens only when
  it's cheap and wanted.

Net: the preprocessing step (a CLI/util that emits a synteny/PIF tier + a
conservation bigWig from a bigMaf) is the new work; rendering reuses synteny +
wiggle + existing MAF display, switched by `bpPerPx`.

### View-model note: anchor vs. chained

Our `LinearSyntenyView` chains adjacent pairwise levels (row *i* ↔ *i+1*). MCGV's
anchor model (all rows ↔ row 0) is a better fit for the gene-locator and the
MAF-as-synteny tier, because a MAF/all-vs-anchor alignment *is* anchor-shaped and
because "find gene on anchor → snap all rows" is one projection from the anchor,
not a hop chain. Worth evaluating an anchor-mode for the view (or at least making
the gene locator place the anchor at row 0 and derive the rest) rather than
forcing everything through the chained-pairwise model.

## References

- `~/src/vendor/pangene` — gene graph / miniprot PAF pipeline (format source)
- `~/src/vendor/impg` — transitive coordinate projection (Rust CLI; algorithm
  reference, `src/impg.rs` `query_transitive_dfs`)
- PR GMOD/jbrowse-components#4985 — all-vs-all PanSN PAF adapter (open)
- `plugins/linear-comparative-view/src/LGVSyntenyDisplay/components/util.ts` —
  existing single-hop projection (`navToSynteny` + `findPosInCigar`)
- `plugins/linear-comparative-view/src/LinearSyntenyView/components/AddRowDialog.tsx`
  — existing multiway row-append + synteny-track lookup
- `plugins/maf` — `LinearMafDisplay` + `BigMafAdapter`/`MafTabixAdapter`/
  `BgzipTaffyAdapter`; always per-base, no LOD/conservation summary today
- NCBI MCGV — <https://www.ncbi.nlm.nih.gov/mcgv> (help:
  <https://www.ncbi.nlm.nih.gov/mcgv/cm/mcgv/help>); CGV paper:
  <https://doi.org/10.1371/journal.pbio.3002405> — anchor-assembly model, tiered
  LOD, conservation graph
