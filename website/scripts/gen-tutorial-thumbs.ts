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
    src: 'scatac/pbmc5k_marker_swap.png',
    band: [0.25, 1],
    position: 'left',
  },
  scrna_pseudobulk: {
    // the marker panel from the track header down, so the card carries the nine
    // cell-type labels beside the diagonal the peaks walk down
    src: 'scrna/marker_panel.png',
    band: [0.35, 1],
    position: 'left',
  },
  ld_human: {
    // The single-panel triangle, which is the lower of the two lanes: the page
    // no longer embeds the solo lactase figure, and a card has to come from a
    // figure the page shows. Framed on the block rather than on the whole lane
    // — the left third of this window is the pale flank, so a left-anchored
    // cover-crop of the full width lands on white.
    src: 'ld/lct_pooled_vs_panel.png',
    band: [0.69, 1],
    xband: [0.25, 0.78],
    position: 'center',
  },
  ld_mosquitoes: {
    // Both lanes over the same span, one filled and one not, which is the whole
    // figure. This one keeps its callouts rather than framing past them: they sit
    // at x 0.62-0.9, so every crop that clears them also drops the filled
    // triangle and leaves a white card. Centered, so the cover-crop takes the
    // trim off both edges and neither callout ends up half a sentence.
    src: 'ld/anopheles_2la.png',
    band: [0.05, 1],
    xband: [0.08, 1],
    position: 'center',
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
    band: [0.36, 0.93],
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
  hic_structural_variants: {
    // Same split as sv_visualization_cgiab above: the translocation comparison
    // is this tutorial's gallery card, so the tutorial card takes its other
    // half. That figure is also the one carrying the callout arrow and pills,
    // and this one is a clean render — the arcs over the contact matrix, with
    // the gene lane cropped off the top.
    src: 'hic/loops_and_domains.png',
    band: [0.27, 1],
  },
  mappability_qc: {
    // The SMN1 half of the two-locus figure: the mappability lane mostly empty,
    // the coverage lane low, and a pileup that is entirely red. The compose is
    // the better figure and the worse card — a 5:3 crop of it either takes one
    // panel anyway or straddles the two window frames.
    src: 'qc/smn1_evidence.png',
    band: [0.2, 1],
    // Keeps the lane labels: the card is three lanes whose names are what say
    // what the red is, and a centred crop cuts them off mid-word.
    position: 'left',
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
  selection_pressure: {
    // The ribbon band with a gene row above it, past the app chrome and the
    // locus boxes. The card's whole content is one orange ribbon among blue
    // ones, so the crop has to keep enough width for the blue neighbours it is
    // being contrasted against.
    src: 'selection_pressure/lysozyme.png',
    band: [0.22, 0.78],
  },
  homoeolog_synteny: {
    // The dotplot itself, past the app chrome and the coordinate readout. A
    // dotplot card wants the plot area and nothing else: the scattered segments
    // are the whole shape, and they read at card size where the axis labels do
    // not. Cropped short of the rotated x labels along the bottom for the same
    // reason.
    src: 'homoeolog_synteny/oat_homoeologs.png',
    band: [0.152, 0.86],
  },
  orthofinder_synteny: {
    // Left third only, same reason as multiway_synteny below: the per-row "No
    // tracks active / Open track selector" chip is horizontally centered, so a
    // left frame keeps the ribbons and genome labels without it. Taller band
    // than that one (five rows here, not three) to carry two ribbon fans.
    src: 'orthofinder_synteny/vertebrates.png',
    band: [0.13, 0.6],
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
    // coordinate ruler, row labels kept on the left. The source figure now
    // carries the aggregate depth curve above those rows, and the band takes in
    // the bottom of it: a dark curve over four blue rows is a card with a shape,
    // where the rows alone were a flat blue rectangle.
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
  genomes_basics: {
    // The finished phyloP-over-TP53 view, which is also this page's gallery
    // card. The click-path figure above it on the page is two frames of app
    // chrome with a track drawer down one side, unreadable at card size.
    src: 'genomes_basics/phylop_tp53.png',
    // the stacked transcript rows and the phyloP band under them, which is the
    // pairing the page is about, starting below the app header and the ruler
    band: [0.36, 0.93],
    // the coding exons and the peaks over them; the left third of the figure is
    // the 3' UTR and one lone exon, which is the page's control rather than its
    // picture
    xband: [0.45, 1],
  },
  genomes_msa: {
    // The last of the click-path figure's three frames: the ortholog alignment
    // with NCBI's domain blocks over it. The two frames above it are a context
    // menu and a dialog, which read as app chrome on a card.
    src: 'genomes_msa/launch_sequence.png',
    // The gene in the linear view AND the alignment under it, which is the
    // pairing the page is about; the MSA panel alone is a short wide strip of
    // domain blocks over a tall empty canvas, and cover-cropping that to 5:3
    // keeps only the species tree. Starts below the app header, ends just past
    // the domain rows. `position: 'left'` drops the right edge, which is the
    // floating domain legend, unreadable at card size.
    band: [0.655, 0.86],
    position: 'left',
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
  // Cactus pipeline has. Frame the conservation band down through the strain
  // rows, left half only so their labels stay in — NOT from the gene lane down,
  // which is what [0.4, 0.98] did: three gene bars over a lot of white filled
  // half the card, and the alignment rows the card is about were a thin strip at
  // the bottom.
  pangenome_cactus: {
    src: 'pangenome_cactus/maf.png',
    band: [0.62, 0.96],
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
    // the histology-grouped CDH1 matrix: everything under the navigation row,
    // so the card carries the exons, the connector fan and the whole row stack
    // with its dense lobular band at the bottom. A tighter band on the bands
    // themselves is much wider than 5:3, so the cover-crop would keep a sixth
    // of the width and the card would be mostly empty gray.
    src: 'tcga/mutations_cdh1_histology.png',
    band: [0.175, 1],
    position: 'center',
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

// A key here is a card key, and nothing downstream says so: index.astro looks a
// thumb up BY key, so a spec whose page moved or was renamed keeps rendering a
// webp no card ever requests. `pangenome_graph_view` did exactly that after the
// page became user_guides/graph_genome_view.md, and every run kept reporting it
// as a managed thumb. Fail on it instead.
//
// A key is `docs/tutorials/<key>.md`, or `docs/<key>.md` for the handful of
// root-level pages index.astro pulls onto the page (EXTRA_DOCS: the quickstarts
// and the cookbook). Derived rather than listed, so adding one there needs no
// edit here.
const docsDir = join(here, '..', 'docs')
const mdSlugs = async (dir: string) =>
  (await readdir(dir))
    .filter(f => f.endsWith('.md') && f !== 'CLAUDE.md')
    .map(f => f.replace(/\.md$/, ''))
const slugs = new Set([
  ...(await mdSlugs(join(docsDir, 'tutorials'))),
  ...(await mdSlugs(docsDir)),
])
const orphans = Object.keys(THUMB_SPECS).filter(k => !slugs.has(k))
if (orphans.length > 0) {
  console.error(
    `✗ no docs/tutorials page for: ${orphans.join(', ')} — drop the spec (and its webp), or point it at the page's new slug`,
  )
  process.exit(1)
}

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
