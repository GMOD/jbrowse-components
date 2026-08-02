import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

// Regenerates the tutorial landing-page card thumbnails
// (static/img/tutorial-thumbs/<key>.webp) from the same figure PNGs the
// tutorials themselves show, so a card can't drift from its tutorial. Each card
// is a 5:3 cover-crop; frame a figure with `band`/`position` when a plain
// top-crop isn't the flattering part. Prefer a clean render as the source — the
// card is a gallery surface, so avoid figures carrying hand-added callout paint.
//
// Every card is managed here — there are no hand-made thumbs left. The ones
// this replaced were full-window captures scaled to card size, which read as
// unlegible app chrome, and one (pangenome_ecoli) was of a window no spec
// renders any more, so nothing could regenerate it. A tutorial with no figure to
// derive from gets the chromeless card instead (NO_THUMB in
// docs/tutorials/index.astro), not a stand-in image.
//
// The script regenerates exactly the keys listed here and leaves any other
// on-disk thumb alone (reported as unmanaged). `--check` fails if a managed thumb
// is stale and runs in push.yml beside gen-gallery-links --check: figures churn
// hard, and nothing else notices when a regenerated figure leaves its card
// behind — four cards had silently drifted before that gate existed.

interface ThumbSpec {
  // Source figure under static/img (the PNG the tutorial embeds).
  src: string
  // Vertical slice of the source to frame, as [top, bottom] fractions of its
  // height (full width kept). Omit to cover-crop the whole figure. Fractions,
  // not pixels, so a re-rendered figure of the same layout stays framed.
  band?: [number, number]
  // Horizontal slice, as [left, right] fractions of width (full height kept).
  // Use to frame a clean column of a wide figure, e.g. past a label gutter or a
  // baked-in region marker. Composes with `band`.
  xband?: [number, number]
  // Cover-crop anchor when the framed region isn't already 5:3. 'top' keeps the
  // header, 'left' keeps row labels. Default 'top'.
  position?: 'top' | 'left' | 'center'
  quality?: number
}

const THUMB_SPECS: Record<string, ThumbSpec> = {
  quickstart_web: {
    // volvox alignments, the first real track the walkthrough loads
    src: 'volvox_alignments.png',
    band: [0.22, 0.78],
  },
  quickstart_desktop: {
    // The Desktop landing screen. Every other figure on the page is an empty
    // volvox view or a dialog over one — the page walks through opening data, so
    // its captures are mid-flow; the front door is the one frame that reads as
    // "this is Desktop" on a card.
    src: 'desktop-landing.png',
    band: [0, 0.5],
    position: 'center',
  },
  display_settings: {
    src: 'display_settings_url_snapshot.png',
    band: [0.3, 1],
  },
  embed_linear_genome_view: {
    src: 'embed_linear_genome_view/final.png',
    band: [0.06, 0.56],
  },
  analyze_trio: {
    // the haplotype rows and their labels, starting at the connector zone,
    // past the gene track the figure gained for genomic scale
    src: 'trio-matrix-phased-clean.png',
    band: [0.51, 0.94],
    position: 'left',
  },
  dog10k_lof: {
    // the genotype column at the stop codon, breed labels kept
    src: 'dog10k-cyp1a2-nonsense.png',
    band: [0.26, 1],
    xband: [0, 0.62],
    position: 'left',
  },
  dog10k_selection: {
    // the clustered matrix and the dendrogram/swatch column that reads it, past
    // the app header and the gene track
    src: 'dog10k-igf1-haplotype.png',
    band: [0.3, 1],
    position: 'left',
  },
  dog10k_svs: {
    // the Collie rows carrying the deletion: the breed labels on the left and
    // the genotype blocks, dropping the empty right margin past them
    src: 'dog10k-nhej1-cea-deletion.png',
    band: [0.28, 1],
    xband: [0.005, 0.83],
    position: 'left',
  },
  local_ancestry: {
    // the haplotype rows and their breed labels, past the app header
    src: 'dog10k-wolfdog-ancestry.png',
    band: [0.28, 1],
    position: 'left',
  },
  rnaseq: {
    // sashimi arcs over the junction reads
    src: 'rnaseq/basic.png',
    band: [0.3, 1],
  },
  methylation: {
    // hg002 5mC at SNRPN. Not alignments/modifications2.png, which carries
    // hand-added callout boxes — the card is a gallery surface.
    src: 'methylation/hg002_snrpn_combined.png',
    band: [0.25, 1],
  },
  bisulfite: {
    // per-context Arabidopsis WGBS: CG/CHG/CHH stacked
    src: 'methylation/arabidopsis_wgbs_contexts.png',
    band: [0.22, 1],
    position: 'left',
  },
  chromhmm: {
    // the 127-epigenome state heatmap, not the gene lane above it
    src: 'chromhmm.png',
    band: [0.32, 1],
    position: 'left',
  },
  scatac_pseudobulk: {
    // the PBMC pseudobulk rows the page's own script builds, skipping the gene
    // lane above them
    src: 'scatac/pbmc5k_cd8a.png',
    band: [0.25, 1],
    position: 'left',
  },
  scrna_pseudobulk: {
    // the pseudobulk rows from the track header down, so the card carries the
    // nine cell-type labels beside the rows that have the pile
    src: 'scrna/lyz_monocyte.png',
    band: [0.4, 1],
    position: 'left',
  },
  linkage_disequilibrium: {
    // The LD triangle, starting past the figure's callout box at its left edge.
    src: 'ld/lct_lactase.png',
    band: [0.52, 1],
    xband: [0.28, 1],
    position: 'left',
  },
  bxd_qtl: {
    // the red/blue haplotype painting under the QTL scan, framed below the
    // figure's Tyrp1 callout
    src: 'qtl/bxd_tyrp1_locus.png',
    band: [0.38, 1],
    position: 'left',
  },
  population_genomics: {
    // the Fst plot only, left half of the genome: a centered crop lands on
    // 2R/3L and drops the 2L plateau that is the whole point of the figure
    src: 'popgen/fst_in2lt_2L.png',
    band: [0.36, 0.95],
    xband: [0, 0.5],
    position: 'left',
  },
  sv_multisamples: {
    src: 'multisv.png',
    band: [0.3, 1],
    position: 'left',
  },
  cancer_sv: {
    // The reconstruction zoomed to the junctions: four ribbons of comparable
    // width, no callout paint, and the one frame that says "derivative allele"
    // rather than "another read pileup"
    src: 'cancer_sv/derivative_inserts.png',
    band: [0.24, 0.88],
  },
  sv_visualization_cgiab: {
    // depth over BAF genome-wide; the translocation split view is the gallery
    // card, so the tutorial card takes the other half of the tutorial
    src: 'sv_cgiab/cnv_depth_baf.png',
    band: [0.25, 1],
  },
  protein_structure: {
    // The structure itself, in the right-hand panel. Framing the whole panel
    // lands on its sequence-alignment table and a hover tooltip; the folded
    // ribbon is the one card in the set that isn't a genome browser.
    src: 'protein/connected.png',
    band: [0.48, 1],
    xband: [0.56, 0.9],
  },
  synteny_visualization: {
    // gene-level ribbons, not the near-empty dotplot the hand-made thumb used
    src: 'sv_synteny/linear_synteny_genes.png',
    band: [0.2, 1],
  },
  mcscan_synteny: {
    // Both panels' block rows plus the ribbon fan between them — the two
    // adapters together, which is what the tutorial is about. Starts below the
    // app header so the card isn't a third menu bar.
    src: 'mcscan_anchors.png',
    band: [0.12, 0.95],
  },
  multiway_synteny: {
    // Left third only: the per-row "No tracks active / Open track selector"
    // blocks are horizontally centered, so a left frame gets the ribbons and the
    // genome labels without them.
    src: 'multiway_synteny/grape_peach_cacao.png',
    band: [0.14, 0.545],
    xband: [0, 0.36],
  },
  allvsall_synteny: {
    // The five-strain stack, past the app chrome. collapseEmptyRows on this
    // figure's own spec dropped every row's "No tracks active" chip to a bare
    // scalebar, so unlike multiway_synteny above there's no centered label to
    // dodge — the crop can run wide and read as whole-genome zoomed out.
    src: 'multiway_synteny/ecoli_pangenome.png',
    band: [0.17, 1],
    position: 'left',
  },
  pangenome_ecoli: {
    // Per-strain presence/absence, the projection that replaced the genotype
    // matrix on this card (see gallery.ts). Framed past the app chrome and
    // coordinate ruler, row labels kept on the left.
    src: 'pangenome/pav.png',
    band: [0.29, 1],
    position: 'left',
  },
  genomes_synteny: {
    // curved ribbons with transparent indels: the blue reverse-strand sweep
    // crossing the pink forward-strand, indels dropped to white
    src: 'genomes_synteny/ribbons_curved.png',
    // the two gene panels and the ribbons between them; the [0, 0.95] band drops
    // the app header, which also carries the figure's baked-in callout text
    band: [0.28, 0.95],
  },
  // The 464-haplotype clustered genotype matrix with its dendrogram: the
  // population-scale figure that best reads as "pangenome" on a card. Skip the
  // app header; keep the left edge so the dendrogram stays in frame.
  // The graph itself, which is what that tutorial is for: the sample-rows
  // braid over the segment lane, both in the reference-position ramp. Framed
  // past the app chrome and the gene lane so the card is graph rather than
  // toolbar.
  pangenome_graph_view: {
    src: 'pangenome/pggb_locus_sample_rows.png',
    band: [0.55, 1],
  },
  pangenome_hprc: {
    // The classic Bandage force-directed picture of the C4 subgraph, past the
    // view chrome and the LGV/bubbles lanes above it.
    src: 'pangenome/hprc_c4_subgraph.png',
    band: [0.49, 1],
  },
  // The HAL projected onto K12 as a MAF: the coverage band and one colored row
  // per strain, under the K12 gene lane. It used to be this tutorial's variant
  // matrix, deliberately echoing the pggb card — but the two cards then read as
  // the same genotype grid, and the base-level MAF is the projection only the
  // Cactus pipeline has. Frame the gene lane down through the strain rows, left
  // half only so their labels stay in.
  pangenome_cactus: {
    src: 'pangenome_cactus/maf.png',
    band: [0.4, 0.98],
    xband: [0, 0.47],
    position: 'left',
  },
  // The genome-wide TCGA-BRCA CNV cohort matrix. The lower half carries
  // hand-added gene callouts, so frame the clean heatmap band above them.
  tcga_cohort_cnv: {
    src: 'tcga/cohort_cnv_genome.png',
    band: [0.14, 0.56],
    position: 'center',
  },
  tcga_cohort_mutations: {
    // the histology-grouped CDH1 matrix, framed on the boundary between the
    // empty ductal band and the dense lobular one: a card cropped anywhere else
    // in this figure is flat gray
    src: 'tcga/mutations_cdh1_histology.png',
    band: [0.7, 0.97],
    position: 'left',
  },
  // The 2504-row cohort heatmap rather than the page's hero: the hero carries a
  // callout pill, and this one is the cleanest render of the same pattern.
  population_cnv: {
    src: 'cnv1000g/zarr_cohort.png',
    band: [0.26, 0.72],
    position: 'center',
  },
  // Overlaid multi-wiggle coverage, the most figure-like of the cookbook
  // recipes. Skip the app header and its navigation row.
  cookbook: {
    src: 'cookbook_multiwig.png',
    band: [0.24, 1],
  },
}

const WIDTH = 600
const HEIGHT = 360
const DEFAULT_QUALITY = 82

const here = dirname(fileURLToPath(import.meta.url))
const imgDir = join(here, '..', 'static', 'img')
const thumbDir = join(imgDir, 'tutorial-thumbs')

async function render(spec: ThumbSpec) {
  const input = sharp(join(imgDir, spec.src))
  const pipeline =
    spec.band || spec.xband
      ? await (async () => {
          const { height, width } = await input.metadata()
          const [t, b] = spec.band ?? [0, 1]
          const [l, r] = spec.xband ?? [0, 1]
          const top = Math.round(t * height)
          const left = Math.round(l * width)
          return input.extract({
            left,
            top,
            width: Math.round(r * width) - left,
            height: Math.round(b * height) - top,
          })
        })()
      : input
  return pipeline
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: spec.position ?? 'top' })
    .webp({ quality: spec.quality ?? DEFAULT_QUALITY })
    .toBuffer()
}

const check = process.argv.includes('--check')
const managed = new Set<string>()
let stale = 0

for (const [key, spec] of Object.entries(THUMB_SPECS)) {
  managed.add(`${key}.webp`)
  const out = join(thumbDir, `${key}.webp`)
  const next = await render(spec)
  const prev = await readFile(out).catch(() => undefined)
  if (prev && prev.equals(next)) {
    console.log(`≈ ${key} (unchanged)`)
    continue
  }
  if (check) {
    console.error(`✗ ${key} is stale — run \`pnpm gen:tutorial-thumbs\``)
    stale++
    continue
  }
  await writeFile(out, next)
  console.log(`✓ ${key} (${prev ? 'updated' : 'created'})`)
}

for (const file of await readdir(thumbDir)) {
  if (file.endsWith('.webp') && !managed.has(file)) {
    console.log(`· ${file} (unmanaged — hand-made, add a spec to manage it)`)
  }
}

if (stale > 0) {
  process.exit(1)
}
