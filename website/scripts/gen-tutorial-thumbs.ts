import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { TUTORIAL_NO_THUMB } from '../src/lib/guide-categories.ts'

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
// on-disk thumb alone (reported as unmanaged). `dev`, `build` and `index` run
// it, and the output is gitignored and excluded from the figure store, so a
// card is recomputed from whatever its source figure currently is and there is
// no second copy to drift. It used to be stored with a `--check` gate instead,
// and figures churn hard enough that the gate reddened main on three separate
// pushes in one day — see isDerivedFigure in figure-store.ts.
//
// What this script still fails on is structural and cannot be recomputed: a
// spec whose page was renamed, a tutorial with no card, a spec naming a source
// figure that does not exist.

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
  alphagenome: {
    // The claim the page is built on, and the only figure on it that reads at
    // card size: two predicted RNA-seq rows on one axis with the gene model
    // above them. Anchored left rather than centered so the row labels — which
    // are what say the two traces are different cell lines — survive the crop.
    src: 'alphagenome/expression_two_cell_lines.png',
    band: [0.24, 0.86],
    position: 'left',
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
  // All three Dog10K cards come off the DENSE figure on their page rather than
  // the single-variant one, which is the same call gallery.ts made for the
  // gallery tile and for the same measured reason: a genotype column is a thin
  // band in a mostly empty frame, and at card size the empty frame is what a
  // reader sees. The lof card used to crop dog10k-cyp1a2-nonsense through its
  // callout ("Arg37…", "metabol…") and the svs card kept the 85% of the NHEJ1
  // window that is grey, because the deletion sits at the right edge of a
  // whole-gene view and no 5:3 crop holds both the row labels and the blocks.
  dog10k_lof: {
    // the two copy-number lanes, named animals over the collection: a red
    // expansion block against grey diploid, which is legible at card size where
    // the nonsense variant's single column is not
    src: 'dog10k-cyp1a2-cohort-copy-number.png',
    band: [0.34, 1],
    xband: [0.05, 1],
  },
  dog10k_selection: {
    // the Manhattan scan rather than the IGF1 matrix. gallery.ts:311 rejected the
    // matrix for this exact surface ("looks cool but is not a very clear
    // message") and the tutorial card should not disagree with the gallery tile
    // about the page's own picture.
    // the scan half on its own, not the composed two-panel figure: cropping that
    // one to 5:3 leaves the Manhattan a sliver above a second full app window.
    // band drops the chrome, and center keeps the two labelled peaks.
    src: 'dog10k-size-fst-scan-genome.png',
    band: [0.34, 1],
    position: 'center',
  },
  dog10k_svs: {
    // the FGF4 retrocopy stack: two pink synteny ribbons with the parent gene's
    // genotype blocks between them. The amylase and NHEJ1 panels both carry a
    // callout arrow across the middle of the frame, so no crop of either clears
    // the paint without also cutting the blocks; this figure keeps its callouts
    // in the left margin, which xband drops.
    src: 'dog10k-fgf4-retrogene-synteny.png',
    band: [0.16, 0.95],
    xband: [0.22, 1],
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
  dtu: {
    // the colored transcript stack, below the two coverage lanes: the ramp is
    // what the card is about and it only exists in the gene lane
    src: 'dtu/dtu_colored_gene_glyph.png',
    band: [0.35, 1],
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
    // 2R/3L and drops the 2L plateau that is the whole point of the figure.
    //
    // This is a compose PART now (of popgen/in2lt_inversion) rather than a
    // figure the page embeds directly, which is fine and deliberate: a part is
    // still rendered and still carries a figures.lock line, and cropping the
    // composite instead would mean re-deriving `band` against a frame twice as
    // tall for the same picture.
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
    // rather than "another read pileup".
    //
    // The band is the same CONTENT it has always framed — ribbons down through
    // the top of the realigned pileup — re-derived every time that figure's
    // layout moved, which is four times now (0.24, 0.41, 0.52, 0.427: an hg38
    // read lane arrived above the ribbons, came off a 1px pitch, then gave its
    // coverage band back while the lane BELOW the ribbons took one). A
    // fraction only survives a re-render of the SAME layout, and both
    // directions move it.
    src: 'cancer_sv/derivative_inserts.png',
    band: [0.427, 0.781],
  },
  sv_visualization_cgiab: {
    // depth over BAF genome-wide; the translocation split view is the gallery
    // card, so the tutorial card takes the other half of the tutorial
    src: 'sv_cgiab/cnv_depth_baf.png',
    band: [0.25, 1],
  },
  sv_callset_review: {
    // Cropped to the band that carries the junction itself — the fan of curves
    // between two panels — rather than to any one pileup, since the connections
    // are the only thing on this page a card can show at thumbnail size.
    //
    // The TUMOUR PANEL rather than the three-panel composition the page shows,
    // which is a card-framing decision and not a second figure: a 5:3 crop of
    // 3072 px lands inside one panel whatever `position` says, and of the three
    // only this one has connectors in it -- centred it took the matched normal,
    // which is by construction the panel with none, so the card was a
    // featureless grey pileup for exactly the reason the figure exists.
    src: 'jbrowse-img/sv_review_tumor.png',
    band: [0.3, 0.75],
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
  genomes_proteins: {
    // The structure itself, in the right-hand panel. Framing the whole panel
    // lands on its sequence-alignment table and a hover tooltip; the folded
    // ribbon is the one card in the set that isn't a genome browser.
    //
    // The page covers the alignment half too, and the alignment's own figure
    // (genomes_msa/launch_sequence) is the weaker card of the two: cropped to
    // 5:3 it is a strip of domain blocks over empty canvas, where this one is
    // the only card in the set a reader can identify at thumbnail size.
    src: 'protein/connected.png',
    band: [0.48, 1],
    xband: [0.56, 0.9],
  },
  synteny_visualization: {
    // gene-level ribbons, not the near-empty dotplot the hand-made thumb used
    src: 'sv_synteny/linear_synteny_genes.png',
    band: [0.2, 1],
  },
  mcscan_synteny_grape_peach: {
    // Both panels' block rows plus the ribbon fan between them — the two
    // adapters together, which is what the tutorial is about. Starts below the
    // app header so the card isn't a third menu bar.
    src: 'mcscan_anchors.png',
    band: [0.12, 0.95],
  },
  multiway_synteny_lgv_track: {
    // The lane stack alone, below the reference gene track and the ruler: the
    // card is the one-lane-per-genome shape, not the browser around it.
    src: 'multiway_synteny/lgv_track_lanes.png',
    band: [0.44, 1],
  },
  multiway_synteny_grape_peach_cacao: {
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
  hg002_haplotypes: {
    // The ribbon band with a chain track above and below it, which is the whole
    // shape of this card: one sweep crossing between two haplotypes of the same
    // chromosome, and the same block as a long reverse-strand bar on each side
    // of it. Still a left frame, but no longer to dodge the "No tracks active"
    // chip (the panels carry tracks now) — a 2:1 card cannot hold the full
    // width of a 3:1 capture, and a centered crop lands entirely inside the
    // inversion, dropping the collinear flanks that are what make it read as
    // one. The left edge keeps a flank against the start of the inverted block.
    src: 'hg002_haplotypes_8p23_inversion.png',
    band: [0.36, 0.93],
    position: 'left',
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
    // Almost the whole figure: five genomes and four ribbon fans is the card's
    // point, not any one band of it. The source is already close to 5:3, so
    // dropping just the app chrome top and bottom gets there at full width.
    src: 'orthofinder_synteny/vertebrates.png',
    band: [0.05, 0.95],
  },
  allvsall_synteny: {
    // The five-strain stack, past the app chrome. collapseEmptyRows on this
    // figure's own spec dropped every row's "No tracks active" chip to a bare
    // scalebar, so unlike the grape/peach/cacao card above there's no centered
    // label to dodge — the crop can run wide and read as whole-genome zoomed
    // out.
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
  // The partitioned track, which is the page's whole result, from its track
  // header down. Anchored left because the class names down the gutter are the
  // half that says what happened — the same window packed into one lane is the
  // top part of the same figure.
  //
  // The band is into the COMPOSED figure, whose two equal-height parts are the
  // colored form over the partitioned one, so the lower part starts at 0.5 and
  // the 0.42 that used to skip the app header is 0.71 here.
  repeatmasker_classes: {
    src: 'cookbook_color_by_type_two_ways.png',
    band: [0.71, 1],
    position: 'left',
  },
}

const WIDTH = 600
const HEIGHT = 360
const DEFAULT_QUALITY = 82

const here = dirname(fileURLToPath(import.meta.url))
const imgDir = join(here, '..', 'static', 'img')
// Created here rather than assumed: nothing installs this directory any more.
// `figures:pull` used to, as a side effect of writing thumbs into it, and that
// is the one thing a fresh clone would otherwise have to have done first.
const thumbDir = join(imgDir, 'tutorial-thumbs')
await mkdir(thumbDir, { recursive: true })

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

const managed = new Set<string>()

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
// Both directions are collected before either is reported: they are two halves
// of one mismatch, and a page rename produces one of each — so exiting on the
// orphan meant fixing it, re-running, and only then being told about the card
// with no thumb behind it.
const problems: string[] = []

const orphans = Object.keys(THUMB_SPECS).filter(k => !slugs.has(k))
if (orphans.length > 0) {
  problems.push(
    `✗ no docs/tutorials page for: ${orphans.join(', ')} — drop the spec (and its webp), or point it at the page's new slug`,
  )
}

// And the other direction. index.astro renders an <img> for every card key it
// does not find in TUTORIAL_NO_THUMB, so a tutorial page with no spec here isn't
// a missing card — it is a card pointing at a webp that does not exist, which
// nothing reported until the website link checker found the 404 on a built site.
// Only tutorials/ is checked: the root-level pages index.astro also pulls onto
// the landing page (EXTRA_DOCS) are a hand-picked few among all of docs/, so the
// slug list alone can't tell which of those are cards.
const uncarded = (await mdSlugs(join(docsDir, 'tutorials'))).filter(
  s => !(s in THUMB_SPECS) && !TUTORIAL_NO_THUMB.has(s),
)
if (uncarded.length > 0) {
  problems.push(
    `✗ no thumbnail spec for: ${uncarded.join(', ')} — add one pointing at a figure the page embeds, or add the slug to TUTORIAL_NO_THUMB for the chromeless card`,
  )
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
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
  await writeFile(out, next)
  console.log(`✓ ${key} (${prev ? 'updated' : 'created'})`)
}

for (const file of await readdir(thumbDir)) {
  if (file.endsWith('.webp') && !managed.has(file)) {
    console.log(`· ${file} (unmanaged — hand-made, add a spec to manage it)`)
  }
}
