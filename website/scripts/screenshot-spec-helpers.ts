import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type {
  Annotation,
  CliSpec,
  ScreenshotAction,
} from './screenshot-spec-types.ts'

export const VOLVOX = 'test_data/volvox/config.json'
// volvox_sv_cram's adapter, reused to build the two strand-split session tracks
// that the group-by spec renders. Session tracks don't inherit the config's
// baseUri, so an absolute url is used (the same volvox test data jbrowse.org
// hosts) — works in both the local generator and the live-link instance.
export const VOLVOX_SV_CRAM =
  'https://jbrowse.org/code/jb2/latest/test_data/volvox'
export const VOLVOX_SV_CRAM_ADAPTER = {
  type: 'CramAdapter',
  cramLocation: {
    uri: `${VOLVOX_SV_CRAM}/volvox-sv.cram`,
    locationType: 'UriLocation',
  },
  craiLocation: {
    uri: `${VOLVOX_SV_CRAM}/volvox-sv.cram.crai`,
    locationType: 'UriLocation',
  },
}
// HG002 ultralong ONT BAM (the same NCBI GIAB file the DEMO_CONFIG
// hg002_nanopore track points at). Used to build the two HP-grouped session
// subtracks the smalldel group-by figure renders.
export const HG002_NANOPORE_BAM =
  'https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/Ultralong_OxfordNanopore/combined_2018-08-10/HG002_ONTrel2_16x_RG_HP10xtrioRTG.cram.bam'
export const HG002_NANOPORE_ADAPTER = {
  type: 'BamAdapter',
  bamLocation: { uri: HG002_NANOPORE_BAM, locationType: 'UriLocation' },
  index: {
    location: { uri: `${HG002_NANOPORE_BAM}.bai`, locationType: 'UriLocation' },
    indexType: 'BAI',
  },
}
// HG00151 Oxford Nanopore reads from the 1000 Genomes ONT Sequencing Consortium
// (s3://1000g-ont), minimap2-aligned to hg38. Deliberately the MINIMAP2_ALIGNED_BAMS
// file, NOT the NAPU/PMDV_FINAL.haplotagged.bam — the DeepVariant-haplotagged
// output drops the supplementary (SA-tag) split alignments, so an inversion's
// split reads vanish from it; the minimap2 alignment is the one the consortium's
// SV callers used and where the fwd/rev split at the breakpoint is visible.
// Paired with HG00151's Illumina high-coverage CRAM (HG00151.final, in the KG
// config) for the same-sample short-vs-long inversion figure.
export const HG00151_ONT_1000G_BAM =
  'https://1000g-ont.s3.amazonaws.com/PROCESSED_DATA/ALIGNED_TO_HG38/MINIMAP2_ALIGNED_BAMS/HG00151-ONT-hg38-R9-LSK110-guppy-sup-5mC.phased.bam'
export const HG00151_ONT_1000G_ADAPTER = {
  type: 'BamAdapter',
  bamLocation: { uri: HG00151_ONT_1000G_BAM, locationType: 'UriLocation' },
  index: {
    location: {
      uri: `${HG00151_ONT_1000G_BAM}.bai`,
      locationType: 'UriLocation',
    },
    indexType: 'BAI',
  },
}
// NA12878 direct-RNA nanopore reads sliced to just the PTEN locus and re-hosted,
// so the collapse-introns/sashimi figure downloads a ~2 MB deterministic file
// instead of range-querying the whole-genome BAM (which never quiesced before
// the loading-overlay timeout — the source of that figure's run-to-run flakiness).
export const PTEN_RNASEQ_BAM =
  'https://jbrowse.org/demos/rnaseq/NA12878-DirectRNA.PTEN.bam'
export const PTEN_RNASEQ_ADAPTER = {
  type: 'BamAdapter',
  bamLocation: { uri: PTEN_RNASEQ_BAM, locationType: 'UriLocation' },
  index: {
    location: { uri: `${PTEN_RNASEQ_BAM}.bai`, locationType: 'UriLocation' },
    indexType: 'BAI',
  },
}
export const DOTPLOT_CONFIG = 'test_data/config_dotplot.json'
export const HS1_MM39_CONFIG = 'test_data/hs1_vs_mm39/config.json'
export const DEMO_CONFIG = 'test_data/config_demo.json'
// hg38 + NCBI RefSeq + ClinVar, loading the Protein3d plugin from the
// version-agnostic jbrowse.org plugin-store `latest/` path (served no-cache), so
// there's no pinned version to bump on a protein3d release. The protein-feature
// data-testid clicks in the spec below need protein3d >= v0.4.14, which `latest/`
// satisfies. Rendered against the *local* build (bare ?config=), which has the
// workspaces split API (setPendingMove) the side-by-side launch needs.
export const PROTEIN3D_CONFIG = 'test_data/protein3d_config.json'
// Load the remote demo configs against the *local* build (a bare ?config= url
// that the generator prefixes with localhost), so unreleased display settings
// like the LinearSyntenyView drawCurves view property render — jbrowse.org/code/
// jb2/latest is an older release that ignores them. specLiveUrl still turns the
// bare url into a jbrowse.org/code/jb2/latest link for the docs reader links.
export const CGIAB_BASE = `?config=${encodeURIComponent('https://jbrowse.org/demos/cgiab/config.json')}`
export const HPYLORI_BASE = `?config=${encodeURIComponent('https://jbrowse.org/demos/hpylori/config.json')}`

// hg38 NCBI RefSeq (UCSC hub build, jbrowse.org/ucsc/hg38) as a session track —
// reviewer's preferred gene track over the MANE bigBed in a few figures.
// geneGlyphMode: 'longestCoding' on the display collapses isoforms the way
// MANE Select did.
export const HG38_NCBI_GENE_TRACK = {
  type: 'FeatureTrack',
  trackId: 'ncbi_genes_hg38_ucsc',
  name: 'NCBI RefSeq (UCSC)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: {
      uri: 'https://jbrowse.org/ucsc/hg38/hg38.gff.gz',
      locationType: 'UriLocation',
    },
    index: {
      location: {
        uri: 'https://jbrowse.org/ucsc/hg38/hg38.gff.gz.csi',
        locationType: 'UriLocation',
      },
      indexType: 'CSI',
    },
  },
}

// GENCODE v48 promoter windows (UCSC hub build, jbrowse.org/ucsc/hg38) as a
// session track, for figures that want promoter context without the full
// ENCODE cCRE/chromatin-state tracks.
export const HG38_GENCODE_PROMOTER_TRACK = {
  type: 'FeatureTrack',
  trackId: 'gencode_promoter_hg38_ucsc',
  name: 'GENCODE v48 promoter windows (UCSC)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: {
      uri: 'https://jbrowse.org/ucsc/hg38/gencode.v48.promoter_windows.sorted.gff3.gz',
      locationType: 'UriLocation',
    },
    index: {
      location: {
        uri: 'https://jbrowse.org/ucsc/hg38/gencode.v48.promoter_windows.sorted.gff3.gz.csi',
        locationType: 'UriLocation',
      },
      indexType: 'CSI',
    },
  },
}

export function sessionSpec(config: string, session: object) {
  return `?config=${config}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}

// The overwhelmingly common spec shape: a session with a single
// LinearGenomeView. `view` carries the view-level props (assembly/loc/tracks and
// any extras like colorByCDS/trackLabels); `type: 'LinearGenomeView'` is filled
// in. Encodes identically to the hand-written `sessionSpec(cfg, { views: [{ type:
// 'LinearGenomeView', ...view }] })`, so it never changes a rendered image.
export function lgvSession(
  config: string,
  view: { assembly: string } & Record<string, unknown>,
) {
  return sessionSpec(config, {
    views: [{ type: 'LinearGenomeView', ...view }],
  })
}

// Expand a menu drill-down into wait/hover/delay actions: each non-terminal item
// is hovered to open its submenu; the terminal item is only waited for. The
// caller lists the whole path, so an intermediate level can't be skipped — the
// failure that left `modifications1` waiting on a submenu its parent never
// opened. Pair with `cascadeBoxes` to keep the callout boxes on the same path.
export function menuCascade(path: string[], delayMs = 500): ScreenshotAction[] {
  return path.flatMap((text, i) => {
    const parent = path[i - 1]
    return [
      ...(parent ? [{ type: 'hover' as const, text: parent }] : []),
      { type: 'waitForText' as const, text },
      { type: 'delay' as const, ms: delayMs },
    ]
  })
}

// Box every item along a menu path — the callout counterpart to `menuCascade`,
// so the highlighted items can't drift from the items actually hovered.
export function cascadeBoxes(path: string[]): Annotation[] {
  return path.map(text => ({ type: 'box' as const, anchor: { text } }))
}

export const trackMenuIcon = (trackId: string): ScreenshotAction => ({
  type: 'click',
  selector: `[data-testid="track_menu_icon"][data-trackid="${trackId}"]`,
})

// Open the alignments "Set feature height..." submenu and leave it open.
// CascadingSubmenu opens on click as well as hover (onClick -> onOpen), and a
// click is deterministic where a hover is timing-sensitive (the pileup keeps
// re-laying-out while reads stream, so the hovered row can move out from under
// the cursor). Target the submenu row by its data-testid prefix.
export const openFeatureHeightSubmenu = (): ScreenshotAction[] => [
  { type: 'waitForText', text: 'Set feature height' },
  { type: 'delay', ms: 300 },
  {
    type: 'click',
    selector: '[data-testid^="cascading-submenu-set_feature_height"]',
  },
  { type: 'waitForText', text: 'Super-compact' },
  { type: 'delay', ms: 500 },
]

// A stage that ends with its submenu open must be fully dismissed before the
// next stage clicks a different track's menu, or the lingering menu's backdrop
// swallows that click and it lands on the wrong track. Escape does NOT close
// these menus (keyboard focus isn't inside the popover), but the invisible modal
// backdrop does on click — two clicks on a neutral spot (the view title bar)
// pop the submenu then the main menu; then wait for the menu text to be gone.
export const dismissMenus = (): ScreenshotAction[] => [
  { type: 'click', from: { x: 550, y: 58 } },
  { type: 'delay', ms: 300 },
  { type: 'click', from: { x: 550, y: 58 } },
  { type: 'waitForText', text: 'Set feature height', hidden: true },
  { type: 'delay', ms: 300 },
]

// ── Trio crossover callouts (analyze_trio.md) ──────────────────────────────
// The six VCF haplotype rows, top→bottom, sharing the hap-ibd painting's
// Father/Mother hapN names so the sidebar and the painting read consistently.
// `name`/`sampleName` keep the canonical "HG020xx HPn" identity; `label` is the
// friendly sidebar text. trioRowY(label) is the CSS-y of that row's top.
export const TRIO_HAPLOTYPES = [
  { sample: 'HG02024', hp: 0, label: 'Child hap1' },
  { sample: 'HG02024', hp: 1, label: 'Child hap2' },
  { sample: 'HG02025', hp: 0, label: 'Mother hap1' },
  { sample: 'HG02025', hp: 1, label: 'Mother hap2' },
  { sample: 'HG02026', hp: 0, label: 'Father hap1' },
  { sample: 'HG02026', hp: 1, label: 'Father hap2' },
]
export const trioVcfLayout = TRIO_HAPLOTYPES.map(h => ({
  name: `${h.sample} HP${h.hp}`,
  sampleName: h.sample,
  HP: h.hp,
  label: h.label,
}))
// top of Child hap1, just under the painting track — the CSS-y of the
// variant_canvas top, measured live in the rendered page (scripts/measure-trio.ts)
// rather than guessed, since the painting-track height above it drifts this value.
export const TRIO_VCF_ROW_TOP = 268
// the VCF display auto-fits its `TRIO_VCF_DISPLAY_H` px body across the 6
// haplotype rows (LinearMultiSampleVariantDisplay has no line zone), so the true
// per-row pitch is height/rows ≈ 43.33 — NOT a round 44, which drifts the frames
// ~3px low by the bottom row (boxes don't exactly match the rows).
export const TRIO_VCF_DISPLAY_H = 260
export const TRIO_VCF_ROW_PITCH = TRIO_VCF_DISPLAY_H / TRIO_HAPLOTYPES.length
export const trioRowY = (label: string) =>
  TRIO_VCF_ROW_TOP +
  TRIO_VCF_ROW_PITCH * TRIO_HAPLOTYPES.findIndex(h => h.label === label)

// the crossover is centered in the 400 kb window; the genotype canvas spans the
// full ~1500 px view width
export const TRIO_XOVER_X = 750
export const TRIO_HL_FILL = 0.16 // translucent wash inside each highlight frame
// distinct palettes so the two figures aren't mistaken for each other
export const TRIO_MATERNAL_COLORS = { left: '#15a01a', right: '#ff6f00' } // green/orange
export const TRIO_PATERNAL_COLORS = { left: '#caa200', right: '#8e44ad' } // yellow/purple

// hap-ibd painting: the display is filtered to one parent's 2 haplotype rows,
// which render at the auto-fit 20px row height (multirow_canvas top/height,
// measured live). trioPaintingStep boxes both rows the crossover steps between.
export const TRIO_PAINT_TOP = 193
export const TRIO_PAINT_ROW_H = 20
export const trioPaintingStep = (topRow: number) => ({
  type: 'box' as const,
  color: '#333',
  x: 722,
  y: TRIO_PAINT_TOP + topRow * TRIO_PAINT_ROW_H,
  width: 56,
  height: TRIO_PAINT_ROW_H * 2,
})

// Colour-code the two sides of a crossover: the left-colour frame wraps the
// parental copy matched left of the breakpoint plus the matching left half of
// the child row; the right-colour frame wraps the copy matched right of it plus
// the child's right half; each lightly tinted. A neutral box marks the painting
// step and an arrow drops from it to the crossover point on the child row.
export function crossoverHighlights(opts: {
  child: string
  leftSource: string
  rightSource: string
  palette: { left: string; right: string }
  paintingTopRow: number
  leftText: string
  rightText: string
}): Annotation[] {
  const { child, leftSource, rightSource, palette } = opts
  const step = trioPaintingStep(opts.paintingTopRow)
  const leftW = TRIO_XOVER_X - 3
  const rightW = 1495 - TRIO_XOVER_X
  const frame = (color: string, x: number, row: string, width: number) =>
    ({
      type: 'box',
      color,
      fillOpacity: TRIO_HL_FILL,
      x,
      y: trioRowY(row),
      width,
      height: TRIO_VCF_ROW_PITCH,
    }) satisfies Annotation
  const caption = (color: string, x: number, text: string) =>
    ({
      type: 'text',
      color,
      x,
      y: trioRowY('Father hap2') + 70,
      text,
      maxWidth: 600,
    }) satisfies Annotation
  return [
    step,
    {
      type: 'arrow',
      // thinner line -> smaller arrowhead (head was too big)
      strokeWidth: 2,
      from: { x: TRIO_XOVER_X, y: step.y + step.height },
      to: { x: TRIO_XOVER_X, y: trioRowY(child) },
    },
    frame(palette.left, 3, leftSource, leftW),
    frame(palette.left, 3, child, leftW),
    frame(palette.right, TRIO_XOVER_X, rightSource, rightW),
    frame(palette.right, TRIO_XOVER_X, child, rightW),
    caption(palette.left, 60, opts.leftText),
    caption(palette.right, 800, opts.rightText),
  ]
}

export function cgiabUrl(session?: object) {
  if (!session) {
    return CGIAB_BASE
  }
  return `${CGIAB_BASE}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}

export function hpyloriUrl(session: object) {
  return `${HPYLORI_BASE}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}

// remote 1000-genomes config loaded against the *local* build (a bare ?config=
// url), so new display settings like readConnections render — jbrowse.org/code/
// jb2/latest is an older release that ignores them. specLiveUrl still turns
// this into a jbrowse.org link for readers.
export const KG_CONFIG =
  'https://jbrowse.org/genomes/GRCh38/1000genomes/config_1000genomes.json'

export function kgUrl(session: object) {
  return `?config=${encodeURIComponent(KG_CONFIG)}&session=${encodeSessionSpec(session)}&sessionName=Screenshot`
}

// Thin local config wiring the ce11 assembly + the real UCSC ce11 26-way multiz
// MAF (data hosted on jbrowse.org/demos/ce + UCSC) to the *built-in* MAF
// support. The jbrowse.org/demos/ce config itself loads the old external
// mafviewer UMD plugin, which would shadow the built-in conservation band and
// trip the cross-origin-plugin trust dialog — so a local config path is used to
// render with the local build's code instead.
export const CE_MAF = 'test_data/ce_maf.json'

// Same ce11 26-way MAF, plus an `annotationAdapter` sub-adapter (a local bigBed
// built from the real UCSC ce11 multiz26wayFrames data) on the MAF adapter, so
// the per-species CDS reading-frame overlay + codon view render.
export const CE_MAF_FRAMES = 'test_data/ce_maf_frames.json'

// UCSC hg38 470-way multiz (Zoonomia + more) config.
export const HG38_470WAY = 'test_data/hg38_multiz470way.json'

// A representative ~30-species slice of the hg38 470-way spanning the major
// mammalian clades (primates, rodents+glires, laurasiatheria, afrotheria,
// xenarthra) plus opossum and platypus as marsupial/monotreme outgroups — close
// to the classic UCSC "30-way vertebrate" sampling. Exact leaf names from
// hg38.470way.nh (the Cactus alignment uses HL-prefixed names for many
// assemblies). Used as a `subtreeFilter`; the pruned guide tree then reads as a
// clean ~30-leaf dendrogram instead of the full 470-species tree.
export const HG38_470WAY_30 = [
  'hg38', // human
  'panTro6', // chimp
  'gorGor6', // gorilla
  'ponAbe3', // orangutan
  'rheMac10', // rhesus macaque
  'HLcalJac4', // marmoset
  'otoGar3', // bushbaby
  'mm39', // mouse
  'rn6', // rat
  'cavPor3', // guinea pig
  'hetGla2', // naked mole-rat
  'oryCun2', // rabbit
  'tupBel1', // tree shrew
  'bosTau9', // cow
  'HLoviAri5', // sheep
  'susScr11', // pig
  'vicPac2', // alpaca
  'turTru2', // dolphin
  'equCab3', // horse
  'cerSim1', // white rhino
  'felCat9', // cat
  'canFam4', // dog
  'ursMar1', // polar bear
  'myoLuc2', // little brown bat
  'eriEur2', // hedgehog
  'HLloxAfr4', // elephant
  'echTel2', // tenrec
  'oryAfe1', // aardvark
  'dasNov3', // armadillo
  'monDom5', // opossum
  'HLornAna3', // platypus
]

// Three H. pylori strains stacked top-to-bottom, with a synteny track between
// each adjacent pair and a gene annotation track on each genome, used by the
// synteny_visualization.md tutorial.
//
// `geneColor` (optional) is a color slot applied to every gene track's canvas
// display — pass a `jexl:randomColor(...)` expression to palettize genes by an
// attribute. Because randomColor hashes deterministically, the same attribute
// value gets the same hue in all three panels, so a shared key like the gene
// symbol (Name, effectively the ortholog id in bacteria) makes orthologous
// genes light up the same color across strains with no cross-track state.
export function hpyloriSyntenyWithGenes(geneColor?: string) {
  // showOnlyGenes collapses each locus to its gene glyph (no CDS/mRNA
  // sub-features), so the colored variant traces one hue per gene cleanly and
  // the uncolored variant reads as a tidy row of genes rather than nested boxes
  const geneTrack = (trackId: string) => ({
    trackId,
    displaySnapshot: geneColor
      ? { showOnlyGenes: true, color: geneColor }
      : { showOnlyGenes: true },
  })
  return hpyloriUrl({
    views: [
      {
        type: 'LinearSyntenyView',
        // curved bezier ribbons connect the aligned blocks more legibly than
        // straight quadrilaterals across the three stacked strains
        drawCurves: true,
        // 2-D form: tracks[i] is the synteny shown between views[i] and
        // views[i+1]. A flat string[] is treated as a single level-0 entry, so
        // the level-1 band (chc155 vs j99) stayed empty — this nests each track
        // onto its own adjacent-pair level.
        tracks: [['26695_vs_chc155.pif'], ['chc155_vs_j99.pif']],
        views: [
          {
            loc: 'NC_018939.1:177696-190329',
            assembly: 'hpylori_26695',
            tracks: [geneTrack('hpylori_26695.gff')],
          },
          {
            loc: 'NZ_AP026446.1:287157-299790',
            assembly: 'hpylori_chc155',
            tracks: [geneTrack('hpylori_chc155.gff')],
          },
          {
            // j99 aligns to chc155 in inverted orientation, so the [rev]
            // suffix flips this panel (declarative loc-string reverse) to
            // straighten the level-1 ribbons — otherwise they cross in an X
            loc: 'NZ_CP011330.1:872350-884982[rev]',
            assembly: 'hpylori_j99',
            tracks: [geneTrack('hpylori_j99.gff')],
          },
        ],
      },
    ],
  })
}

// Human (hg38) vs chimp (panTro6) synteny from the hosted UCSC hg38->panTro6
// liftOver PIF + RefSeq genes + RepeatMasker on jbrowse.org/ucsc.
export const HG38_PANTRO6_CONFIG = 'test_data/hg38_panTro6_synteny/config.json'

// RB1 (retinoblastoma tumor suppressor): a full-length ~6 kb L1HS — the youngest,
// still-active human LINE-1 subfamily — sits in an intron in human but is absent
// at the orthologous chimp intron (chimp has only old L1PA13/14/16). It is
// flanked by repeats conserved in both species (L1ME3A upstream, MER21C
// downstream), so it renders as a clean human-specific transposon insertion; the
// RepeatMasker track labels it "L1HS" exactly at the insertion.
export const RB1_L1_LOCUS = {
  hg38: 'chr13:48,459,000-48,477,500',
  panTro6: 'chr13:29,450,000-29,459,000',
}

// VAPB (ALS8 / spinal muscular atrophy gene): a full-length ~2 kb SVA_F — a
// composite, human-specific retrotransposon — inserted in the human lineage
// between a conserved AluSz6 and a conserved UCON33 element; the orthologous
// chimp interval runs AluSz6 -> UCON33 with no SVA (zero SVA anywhere in chimp
// VAPB). RepeatMasker names it SVA_F at the insertion.
export const VAPB_SVA_LOCUS = {
  // zoomed out ~1.6x from the tight 12 kb / 9.5 kb windows so the SVA insertion
  // reads with more flanking context (reviewer)
  hg38: 'chr20:58,404,000-58,424,000',
  panTro6: 'chr20:58,043,000-58,058,000',
}

// PICALM (Alzheimer's-associated): a ~0.3 kb AluYb8 — a young, human-specific Alu
// subfamily and the commonest kind of human-specific mobile-element insertion —
// dropped in downstream of a conserved AluY; the orthologous chimp interval keeps
// the AluY but has no AluYb8 (none anywhere in chimp PICALM). Shows that even a
// small lineage-specific insertion reads clearly as an indel.
export const PICALM_ALU_LOCUS = {
  hg38: 'chr11:85,978,000-85,986,000',
  panTro6: 'chr11:81,727,500-81,735,000',
}

// A hosted liftOver chain is one chromosome-scale block; drawn zoomed in it
// exercises the oversized-block viewport clip (the worker trims the block to the
// visible slice, else the ribbon would vanish). "Transparent indels" (cigarMode
// 'matches') shows the indel as a see-through gap, "Colored indels" ('full') as
// a painted wedge.
export function hg38ChimpSynteny(
  cigarMode: 'matches' | 'full',
  locus: { hg38: string; panTro6: string } = RB1_L1_LOCUS,
) {
  // collapse each gene to its single longest coding transcript: MANE isn't
  // available for panTro6, so geneGlyphMode 'longestCoding' is the way to cut
  // the dense NCBI isoform stacks on both genomes (reviewer)
  const genes = (id: string) => ({
    trackId: id,
    displaySnapshot: {
      geneGlyphMode: 'longestCoding',
      // default featureHeight (10px) reads as a bare sliver at this zoom —
      // these loci have few, widely-spaced exons and no isoform stacking to
      // fill a row, so there's nothing else shrinking them (verified
      // autoHeight/height are not the cause: pinning both had no effect)
      featureHeight: 18,
    },
  })
  // RepeatMasker: 'grow' height mode — the track auto-sizes to exactly the few
  // rows of repeats at these TE loci, so it stays compact without crowding the
  // gene track, while every element keeps its NORMAL feature height (no fit-mode
  // scaling that inflates the boxes) and every name is drawn (no fit-ladder label
  // decimation). Reviewer: repeats should be normal-height and compact but still
  // labeled (SVA_F, L1HS, AluY… at the insertions) — not the tall, label-dropping
  // 'fit' band.
  const rmsk = (id: string) => ({
    trackId: id,
    displaySnapshot: {
      heightMode: 'grow',
    },
  })
  return sessionSpec(HG38_PANTRO6_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        cigarMode,
        drawCurves: true,
        tracks: [['hg38_panTro6_synteny']],
        views: [
          {
            assembly: 'hg38',
            loc: locus.hg38,
            // RepeatMasker last so it sits against the synteny band, where its
            // elements line up with the indels
            tracks: [genes('hg38-genes'), rmsk('hg38-rmsk')],
            trackLabels: 'offset',
          },
          {
            assembly: 'panTro6',
            loc: locus.panTro6,
            // RepeatMasker first so it sits against the synteny band above it
            tracks: [rmsk('panTro6-rmsk'), genes('panTro6-genes')],
            trackLabels: 'offset',
          },
        ],
      },
    ],
  })
}

// S3-hosted yeast comparison (S. cerevisiae R64 vs the YJM1447 strain), used by
// the dotplot/synteny CliSpecs below.
export const YEAST =
  'https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447'

export function cliSpec(name: string, args: string[]): CliSpec {
  return { mode: 'cli', name: `jbrowse-img/${name}`, args }
}

export const jbrowseImgSpecs: CliSpec[] = [
  // Headline (README "## Screenshot"): a multi-track human view from public
  // files — NCBI RefSeq genes, ClinGen gene-disease, phyloP conservation,
  // SKBR3 nanopore. --aliases reconciles the 1 / chr1 / NC_000001.10 refname
  // styles across files.
  cliSpec('1', [
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--aliases',
    'https://jbrowse.org/genomes/hg19/hg19_aliases.txt',
    '--gffgz',
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz',
    // reduced-representation gene view (drop mRNA/exon/CDS speckle, keep gene
    // glyphs) so the RefSeq track reads cleanly at this multi-gene zoom
    '{"showOnlyGenes":true}',
    '--bigbed',
    'https://hgdownload.soe.ucsc.edu/gbdb/hg19/bbi/clinGen/clinGenGeneDisease.bb',
    '--bigwig',
    'https://hgdownload.cse.ucsc.edu/goldenpath/hg19/phyloP100way/hg19.100way.phyloP100way.bw',
    '--cram',
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.cram',
    '--loc',
    '1:19,197,000-19,233,000',
    '--width',
    '1200',
  ]),

  // Whole-genome dotplot: every YJM1447 contig (x) vs every R64 contig (y).
  // --autoDiagonalize reorders the R64 contigs so the main alignment forms a
  // clean diagonal instead of a staircase.
  cliSpec('yeast_dotplot', [
    'dotplot',
    '--fasta',
    `${YEAST}/yjm1447.fa`,
    '--fasta2',
    `${YEAST}/r64.fa`,
    '--paf',
    `${YEAST}/r64_vs_yjm1447.paf`,
    '--autoDiagonalize',
    '--width',
    '1100',
  ]),

  // Single-chromosome synteny ribbon: YJM1447 chr I vs R64 chr I
  // (NC_001133.9). --drawCurves renders the ribbon as a smooth bezier instead
  // of straight trapezoids.
  cliSpec('yeast_synteny', [
    'synteny',
    '--fasta',
    `${YEAST}/yjm1447.fa`,
    '--loc',
    'I',
    '--fasta2',
    `${YEAST}/r64.fa`,
    '--loc2',
    'NC_001133.9',
    '--paf',
    `${YEAST}/r64_vs_yjm1447.paf`,
    '--drawCurves',
    '--width',
    '1400',
  ]),

  // Whole-genome multi-chromosome synteny straight from the CLI (assemblies
  // stack in argv order, the PAF binds to the gap between them). autoDiagonalize
  // reorders grape chromosomes for least overlap; colorBy query tints ribbons by
  // peach chromosome.
  cliSpec('grape_peach_synteny', [
    'synteny',
    '--chromSizes',
    'data/comparative/peach.chrom.sizes',
    '--paf',
    'https://s3.amazonaws.com/jbrowse.org/genomes/synteny/peach_grape.paf.gz',
    '--chromSizes',
    'data/comparative/grape.chrom.sizes',
    '--autoDiagonalize',
    '--colorBy',
    'query',
    '--alpha',
    '0.4',
    '--levelHeights',
    '350',
    '--drawCurves',
    '--width',
    '1400',
  ]),

  // Mammalian-scale: human (hs1) vs mouse (mm39). --minAlignmentLength 500000
  // drops short alignments so the large syntenic blocks stay legible.
  cliSpec('hs1_mm39_synteny', [
    'synteny',
    '--chromSizes',
    'data/comparative/hs1.chrom.sizes',
    '--chain',
    'https://jbrowse.org/demos/hs1ToMm39/hs1ToMm39.over.chain.gz',
    '--chromSizes',
    'data/comparative/mm39.chrom.sizes',
    '--minAlignmentLength',
    '500000',
    '--autoDiagonalize',
    '--colorBy',
    'query',
    '--alpha',
    '0.4',
    '--levelHeights',
    '350',
    '--drawCurves',
    '--cigarMode',
    'matches',
    '--width',
    '1400',
  ]),

  // Three-level stack: hg38 / hs1 / mm39 (one ribbon per adjacent pair — a UCSC
  // liftOver chain between each, each placed between the two assemblies it
  // relates).
  cliSpec('hg38_hs1_mm39_synteny', [
    'synteny',
    '--chromSizes',
    'data/comparative/hg38.chrom.sizes',
    '--chain',
    'data/comparative/hg38ToHs1.over.chain.gz',
    '--chromSizes',
    'data/comparative/hs1.chrom.sizes',
    '--chain',
    'https://jbrowse.org/demos/hs1ToMm39/hs1ToMm39.over.chain.gz',
    '--chromSizes',
    'data/comparative/mm39.chrom.sizes',
    '--minAlignmentLength',
    '500000',
    '--autoDiagonalize',
    '--colorBy',
    'query',
    '--alpha',
    '0.4',
    '--levelHeights',
    '300,300',
    '--drawCurves',
    '--cigarMode',
    'matches',
    '--width',
    '1400',
  ]),

  // Circular structural-variant chord plot (bundled volvox SV VCF).
  cliSpec('circular_chords', [
    'circular',
    '--fasta',
    'data/volvox/volvox.fa',
    '--vcfgz',
    'data/volvox/volvox.dup.vcf.gz',
    '--width',
    '800',
  ]),

  // Gene/feature track over the reference sequence: hosted hg38 NCBI RefSeq
  // (--hub, --track) with --refseq adding the DNA-base + six-frame-translation
  // sequence track below it. Zoomed to a TP53 coding exon so the CDS lines up
  // with the reference bases and translation frames (docs "Gene tracks and the
  // reference sequence"). Supersedes the old standalone `sequence` refseq spec.
  cliSpec('gene_track', [
    '--hub',
    'hg38',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:110',
    '--refseq',
    '--loc',
    'chr17:7,676,045-7,676,130',
    '--width',
    '1500',
  ]),

  // Hi-C contact matrix: the public hg19 demo .hic streamed from S3. The
  // triangular heatmap shows TAD structure along chr1.
  cliSpec('hic', [
    '--hub',
    'hg19',
    '--track',
    'hg19-ncbiRefSeqCurated',
    '--hic',
    'https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic',
    'height:400',
    '--loc',
    '1:2,500,000-12,500,000',
    '--width',
    '1200',
  ]),

  // Dark theme, human demo (reviewer ask): hg38 PTEN locus via --hub — a clean
  // single-canonical-transcript gene (unlike TP53's isoform thicket) — a tall
  // NCBI RefSeq gene track over phyloP conservation, rendered with darkStock.
  cliSpec('dark_theme', [
    '--hub',
    'hg38',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:100',
    '--track',
    'hg38-phyloP100way',
    'height:140',
    '--loc',
    'chr10:87,860,000-87,975,000',
    '--themeName',
    'darkStock',
    '--width',
    '1200',
  ]),

  // Plain alignments pileup (bundled volvox BAM).
  cliSpec('alignments_pileup', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--bam',
    'data/volvox/volvox-sorted.bam',
    '--loc',
    'ctgA:1-20000',
    '--width',
    '1200',
  ]),

  // sort:base — HG008-T PacBio HiFi reads over CUZD1 sorted by the base at the
  // center position, so every read carrying the ~1.8 kb somatic deletion pulls
  // into one contiguous band (matches the README "sort:base" example; the
  // legacy `alignments_readgroup` filename is kept for the doc image URL).
  cliSpec('alignments_readgroup', [
    '--hub',
    'hg38',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:55',
    '--bam',
    'https://jbrowse.org/demos/cgiab/HG008-T_chr10_CUZD1_deletion.bam',
    'sort:base',
    'height:420',
    '--loc',
    'chr10:122,830,900-122,840,000',
    '--width',
    '1200',
  ]),

  // group:tag:HP splits the pileup into one sub-track per haplotype. HG002
  // ultralong ONT (hg19) streamed from the GIAB FTP; the het deletion sits in
  // one haplotype only.
  cliSpec('alignments_haplotype', [
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--bam',
    'https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/Ultralong_OxfordNanopore/combined_2018-08-10/HG002_ONTrel2_16x_RG_HP10xtrioRTG.cram.bam',
    'group:tag:HP',
    'color:tag:HP',
    'height:400',
    '--loc',
    '1:63,005,675-63,007,432',
    '--width',
    '1200',
  ]),

  // color:methylation paints per-base CpG calls from a modified-base CRAM.
  // COLO829 nanopore (hg38) over the chr20:18.50-18.51Mb CpG islands (the same
  // islands the modifications/gallery figures use — a region with real
  // methylation signal, not the prior featureless window). The UCSC CpG-island
  // BED on top (reviewer ask) marks the island boundaries, so the methylated
  // (red) flanks vs the unmethylated (blue) island cores read against the
  // annotation. --aliases reconciles the chr20/20 refname styles for both the
  // CRAM and the chr-named CpG BED.
  cliSpec('methylation', [
    '--fasta',
    'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    '--aliases',
    'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    // UCSC CpG islands (BedTabix, .csi index); argv order puts it above the
    // methylation CRAM below.
    '--bedgz',
    'https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz',
    'index:https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz.csi',
    '--cram',
    'https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram',
    'color:methylation',
    'height:350',
    '--loc',
    'chr20:18,503,000-18,509,000',
    '--width',
    '1200',
  ]),

  // Variant track (bundled volvox VCF).
  cliSpec('variants', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--vcfgz',
    'data/volvox/volvox.filtered.vcf.gz',
    '--loc',
    'ctgA:1-20000',
    '--width',
    '1200',
  ]),

  // Multi-sample variant genotype matrix: display:multivariant selects the
  // LinearMultiSampleVariantDisplay. Each column is a variant, each row a
  // sample; alt genotypes paint over the reference background. This draws the
  // real 1000 Genomes phase-3 chr11 callset (2,504 samples) over the HBB
  // β-globin locus, with the hosted NCBI RefSeq gene track (via --hub/--track)
  // for context — common variants read as solid vertical bands, rarer ones as
  // sparse speckle. Matches the README command exactly.
  //
  // (The old volvox stand-in and its "SSR renders the matrix empty for real
  // data" note are gone: the SSR path paints real 1000 Genomes genotypes fine —
  // verified by rendering both display:multivariant and display:multivariantmatrix
  // against the phase-3 chr11 VCF.)
  cliSpec('multisample_variants', [
    '--hub',
    'hg19',
    '--track',
    'hg19-ncbiRefSeqCurated',
    '--vcfgz',
    'https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/ALL.chr11.phase3_shapeit2_mvncall_integrated_v5b.20130502.genotypes.vcf.gz',
    'display:multivariant',
    'height:450',
    'force:true',
    '--loc',
    'chr11:5,246,000-5,251,000',
    '--width',
    '1200',
  ]),

  // Sashimi: sashimi:auto overlays splice-junction arcs on the coverage band,
  // sized by junction read depth. Public strand-specific paired-end RNA-seq
  // (hg19) over B2M via --hub — the long first intron reads as one big arc, the
  // downstream exon junctions as smaller arcs. coverageHeight makes the
  // coverage/sashimi band tall enough for the arcs to be legible.
  cliSpec('sashimi_junctions', [
    '--hub',
    'hg19',
    '--track',
    'hg19-ncbiRefSeqCurated',
    'height:90',
    '--bam',
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/paired_end_rnaseq/Pairend_StrandSpecific_51mer_Human_hg19.bam',
    'sashimi:auto',
    'coverageHeight:170',
    'height:420',
    '--loc',
    'B2M',
    '--width',
    '1400',
  ]),

  // SV read-connection arcs: arcs:up links the split-read breakpoints of a
  // structural variant above the pileup. HG00151 ONT long reads (1000G-ONT S3,
  // the MINIMAP2_ALIGNED_BAMS file that keeps the SA-tag split alignments) over
  // a ~1.2 kb chr1 inversion — the two breakpoints show as clipped-read columns
  // with the connecting arcs between them. (No color:pairOrientation: that's a
  // paired-end concept, meaningless on long reads; the arcs are the SV signal.)
  cliSpec('sv_read_arcs', [
    '--hub',
    'hg38',
    '--bam',
    HG00151_ONT_1000G_BAM,
    'arcs:up',
    'coverageHeight:80',
    'height:440',
    '--loc',
    'chr1:197,786,900-197,789,700',
    '--width',
    '1400',
  ]),

  // MultiWiggle: --multiwig aggregates many BigWigs into one multi-row
  // quantitative track. The sources JSON (data/scatac_catlas.json, 16 curated
  // subadapters carrying per-row name/color/group) is the CATlas single-cell
  // ATAC accessibility-by-cell-type data (Zhang et al 2021), rendered over GCG
  // (glucagon) via --hub hg38 + the RefSeq gene track. Alpha (glucagon) cells —
  // the pancreatic cell type that expresses GCG — show strong accessibility
  // across the locus while the other 15 cell types stay quiet on the shared
  // autoscale: cell-type-specific chromatin accessibility at a marker gene.
  cliSpec('scatac_multiwiggle', [
    '--hub',
    'hg38',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:60',
    '--multiwig',
    'data/scatac_catlas.json',
    'height:520',
    '--loc',
    'GCG',
    '--width',
    '1400',
  ]),

  // SKBR3 cell-line whole-genome coverage (hg19, --loc all), log scale — the
  // cancer karyotype's amplifications/deletions stand out.
  cliSpec('skbr3_cov', [
    '--loc',
    'all',
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--bigwig',
    'https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw',
    'scaletype:log',
    'fill:false',
    'resolution:superfine',
    'height:400',
    'color:purple',
    'minmax:1:1024',
    '--width',
    '1400',
  ]),
]
