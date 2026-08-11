import { displaySettled, encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type {
  Annotation,
  AnnotationAnchor,
  CliSpec,
  ScreenshotAction,
} from './screenshot-spec-types.ts'

export const VOLVOX = 'test_data/volvox/config.json'
// volvox_sv_cram's adapter, used to build the read_cloud session track. Session
// tracks don't inherit the config's baseUri, so an absolute url is used (the
// same volvox test data jbrowse.org hosts) — works in both the local generator
// and the live-link instance.
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
// HG002 ultralong ONT BAM (the same file the DEMO_CONFIG hg002_nanopore track
// points at). Used to build the two HP-grouped session subtracks the smalldel
// group-by figure renders.
//
// A rehosted slice of GIAB's HG002_ONTrel2_16x_RG_HP10xtrioRTG.cram.bam, not
// the NCBI original: ftp-trace throttles concurrent range requests and answered
// one with a 503 mid-run, which fails a capture on infrastructure rather than on
// anything the figure is about. The slice carries the three hs37d5 windows every
// HG002 figure uses (1:55.69-55.72Mb, 1:62.99-63.02Mb, 1:161.155-161.2Mb), so a
// spec that pans outside them sees no reads.
export const HG002_NANOPORE_BAM =
  'https://jbrowse.org/demos/hg002/HG002.ONTrel2.HP.hs37d5.demo_slices.bam'
export const HG002_NANOPORE_ADAPTER = {
  type: 'BamAdapter',
  bamLocation: { uri: HG002_NANOPORE_BAM, locationType: 'UriLocation' },
  index: {
    location: { uri: `${HG002_NANOPORE_BAM}.bai`, locationType: 'UriLocation' },
    indexType: 'BAI',
  },
}
// HG008-T tumor PacBio HiFi Revio reads, the same rehosted slice the hosted
// cgiab config's own reads track points at. Same reasoning as
// HG002_NANOPORE_BAM: the NCBI original is 118 GB with a ~26 MB BAI that
// downloaded on every fresh-tab capture. The slice covers the SV_20
// translocation windows (chr3 / chr13) and CDKN2A (chr9) and nothing else.
export const HG008_T_PACBIO_BAM =
  'https://jbrowse.org/demos/cgiab/HG008-T_PacBio-HiFi-Revio_116x.demo_slices.bam'
// The HP-grouped HG002 ONT session track shared by the haplotype / groupby /
// smalldel figures (session tracks don't inherit the config, so it carries its
// own adapter). Referenced as a const so all three encode byte-identically.
export const HG002_NANOPORE_HP_TRACK = {
  type: 'AlignmentsTrack',
  trackId: 'hg002_nanopore_hp',
  name: 'HG002 ONT',
  assemblyNames: ['hg19'],
  adapter: HG002_NANOPORE_ADAPTER,
}
// HG00151 Oxford Nanopore reads from the 1000 Genomes ONT Sequencing Consortium
// (s3://1000g-ont), minimap2-aligned to hg38. Deliberately the MINIMAP2_ALIGNED_BAMS
// file, NOT the NAPU/PMDV_FINAL.haplotagged.bam — the DeepVariant-haplotagged
// output drops the supplementary (SA-tag) split alignments, so an inversion's
// split reads vanish from it; the minimap2 alignment is the one the consortium's
// SV callers used and where the fwd/rev split at the breakpoint is visible.
// Paired with HG00151's Illumina high-coverage CRAM (HG00151.final, in the KG
// config) for the same-sample short-vs-long inversion figure.
// Sliced to chr1:197,780,000-197,796,000 and re-hosted, the same treatment (and
// for the same two reasons) as PTEN_RNASEQ_BAM below: the whole-genome file
// lives on a bucket we do not run, and range-querying it is what a CI figure
// sweep would depend on. 4 MB, and the slice keeps what the figures read — all
// 87 SA-tag split alignments across the inversion, and the MM/ML calls.
export const HG00151_ONT_1000G_BAM =
  'https://jbrowse.org/demos/ont/HG00151-ONT-hg38.chr1_inversion.bam'
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
// hg38 vs T2T-CHM13 (hs1) from the hosted UCSC hg38->hs1 liftOver PIF, plus
// NCBI RefSeq genes on both. Backs the TNNT3 figure that reproduces the
// genomes.jbrowse.org/demos/ session.
export const HG38_HS1_CONFIG = 'test_data/hg38_hs1_synteny/config.json'

// genomes.jbrowse.org's own hg38 config: the UCSC hub build, which already
// carries every `hg38_to_<db>_liftOver` SyntenyTrack plus the RefSeq gene
// tracks. The genomes_synteny tutorial figures load *this* file (against the
// local build) rather than a repo test_data config, so the click-path they
// document is the one a reader gets on the real site. It declares only hg38,
// but it also loads the Hubs plugin, whose Core-handleUnrecognizedAssembly
// handler pulls in hs1 the moment the hg38->hs1 liftOver track references it —
// which is why no sessionAssembly is needed to make the launch item appear.
export const UCSC_HG38_CONFIG = encodeURIComponent(
  'https://jbrowse.org/ucsc/hg38/config.json',
)
export const DEMO_CONFIG = 'test_data/config_demo.json'
// hg38 + NCBI RefSeq + ClinVar, loading the Protein3d plugin from the
// version-agnostic jbrowse.org plugin-store `latest/` path (served no-cache), so
// there's no pinned version to bump on a protein3d release. The protein-feature
// data-testid clicks in the spec below need protein3d >= v0.4.14, which `latest/`
// satisfies. Rendered against the *local* build (bare ?config=), which has the
// workspaces split API (session `init`) the side-by-side launch needs.
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

// UCSC RepeatMasker for hg38 (jb2hubs golden-path build) as a session track: a
// BedTabix whose `#`-header exposes a `repClass` column (SINE/LINE/LTR/DNA/
// Simple_repeat/Low_complexity/…). The repo's one feature track with real
// categorical variety, so it backs both the color-by-category recipe and the
// multi-row figures, where `repClass` is what a row is split on.
export const HG38_RMSK_TRACK = {
  type: 'FeatureTrack',
  trackId: 'rmsk_hg38_ucsc',
  name: 'RepeatMasker',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    bedGzLocation: {
      uri: 'https://jbrowse.org/ucsc/hg38/rmsk.bed.gz',
      locationType: 'UriLocation',
    },
    index: {
      indexType: 'CSI',
      location: {
        uri: 'https://jbrowse.org/ucsc/hg38/rmsk.bed.gz.csi',
        locationType: 'UriLocation',
      },
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

// HG008-T (CGIAB) copy-number session tracks reused across the sv_cgiab CNV
// figures: HiFiCNV's depth track, and B-allele frequency. Both hosted BigWigs on
// jbrowse.org/demos/cgiab (see the tutorial's "Add copy-number tracks" section /
// build_sv_visualization_cgiab.sh).
//
// BAF here is deliberately NOT HiFiCNV's own maf.bw. That track is folded to
// min(AF, 1-AF), so an LOH arm collapses onto one band near 0 and the reader
// loses the mirrored 0/1 split that makes a BAF plot instantly legible to
// anyone who reads cancer genomes. Unfolded BAF over germline het sites
// (bcftools mpileup on the tumor, baf_bcftools.sh) shows both bands: an LOH arm
// splits to 0 AND 1, a balanced arm sits as one band at 0.5.
//
// resolutionMultiplier is what makes those bands survive being drawn. BAF per
// bin is a distribution, not a signal with a meaningful mean, but a bigWig zoom
// level can only carry min/avg/max: every summary bin over an LOH arm comes back
// min 0, max 1, avg noise, and the default whiskers rendering paints that as a
// full-height wash. The bigWig's finest zoom level reduces at 2560 bp and bbi
// takes a zoom level when reductionLevel <= 2*basesPerSpan, so 0.001 keeps the
// fetch on raw per-site values out to ~1.28 Mbp/px. That covers every
// single-chromosome view the figures use (whole chr1 is ~190 kbp/px) and costs
// 1.4 MB on the widest of them. Whole-genome view still summarizes, which is
// what the per-haplotype segment track below is for.
export const HG008_DEPTH_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'hg008_depth',
  name: 'HG008-T HiFiCNV depth',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'BigWigAdapter',
    bigWigLocation: {
      uri: 'https://jbrowse.org/demos/cgiab/HG008-T.hificnv.depth.bw',
      locationType: 'UriLocation',
    },
  },
}
// The copy-number lane, and the answer to "the raw depths are hard to
// interpret" (reviewer). Depth is a per-bin read count: on a 1 Mb view it is a
// cloud a hundred points deep, and reading a copy-number step out of it means
// eyeballing where the cloud's centre moved. This is the same event already
// segmented — BIC-seq2's tumour-vs-normal log2 copy ratio, taken from the New
// York Genome Center's somatic pipeline run on this exact pair and published by
// C-GIAB, so the segmentation and the normalization are theirs and not ours
// (see [[feedback-visualizer-not-methods]]; scripts/build_sv_visualization_cgiab.sh
// carries the two-line derivation). 196 segments genome-wide, which is why it
// loads as a plain 6 KB bedGraph rather than a bigWig.
//
// The baseline is at +0.44, not 0: BIC-seq2 normalizes on total read counts and
// HG008-T is hypodiploid, so the balanced state sits above zero. Shown as
// published rather than re-centred; the STEPS are what the figures read, and
// each one lands where the benchmark says — chr3 p to q is -0.53 to +0.42
// (CN 1 to CN 2, log2(2/1) = 1.0 apart), chr18 flips the same distance over
// SMAD4, and KRAS's tandem duplication is +1.07 against the +0.45 beside it,
// which is log2(3/2).
export const HG008_BICSEQ2_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'hg008_bicseq2',
  name: 'HG008-T copy ratio, segmented (NYGC BIC-seq2, log2 T/N)',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'BedGraphAdapter',
    bedGraphLocation: {
      uri: 'https://jbrowse.org/demos/cgiab/HG008-T_bicseq2_log2ratio.bedgraph',
      locationType: 'UriLocation',
    },
  },
}

export const HG008_BAF_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'hg008_baf',
  name: 'HG008-T B-allele frequency (BAF)',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'BigWigAdapter',
    bigWigLocation: {
      uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bcftools.bw',
      locationType: 'UriLocation',
    },
    resolutionMultiplier: 0.001,
  },
}

// Wakhan's published per-haplotype copy number, read straight off the C-GIAB
// FTP. The file is long-format (one row per haplotype) and its last #-header
// line is tab-separated, so BedAdapter names the columns on its own:
// chr/start/end/copynumber_state/coverage/haplotype. Partitioning on haplotype
// paints one row per parental copy, which is the allelic state as segments
// rather than as a point cloud, so it reads the same at every zoom level.
export const HG008_WAKHAN_HAP_TRACK = {
  type: 'FeatureTrack',
  trackId: 'hg008_wakhan_haplotype',
  name: 'HG008-T Wakhan copy number per haplotype',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'BedAdapter',
    bedLocation: {
      uri: 'https://jbrowse.org/genomes/GRCh38/cgiab/HG008_HiFi_copynumbers_segments.bed',
      locationType: 'UriLocation',
    },
  },
  displays: [
    {
      type: 'LinearMultiRowFeatureDisplay',
      displayId: 'hg008_wakhan_haplotype-LinearMultiRowFeatureDisplay',
      partitionField: 'haplotype',
      // copynumber_state here is one parental copy, not the total, so 1 is the
      // expected state and 0 is the lost haplotype that makes an arm LOH. Three
      // buckets, not four: the published file tops out at 2 per haplotype, and a
      // legend row nothing paints is noise. It also carries fractional states
      // (0.51, 0.73), which fall in with one copy.
      color:
        "jexl:get(feature,'copynumber_state')<0.5?'#2166ac':get(feature,'copynumber_state')<1.5?'#bdbdbd':'#f4a582'",
      legend: [
        { label: 'Haplotype lost (0)', color: '#2166ac' },
        { label: 'One copy', color: '#bdbdbd' },
        { label: 'Two or more copies', color: '#f4a582' },
      ],
    },
  ],
}

// hpylori 26695 reference sequence adapter, shared by the GC-content and GC-skew
// session tracks (both wrap the same assembly sequence via an absolute fasta
// url, since session tracks don't inherit the config's baseUri). Referenced as a
// const so both GCContentAdapters encode byte-identically.
export const HPYLORI_26695_SEQ_ADAPTER = {
  type: 'IndexedFastaAdapter',
  fastaLocation: {
    uri: 'https://jbrowse.org/demos/hpylori/hpylori_26695.fa',
    locationType: 'UriLocation',
  },
  faiLocation: {
    uri: 'https://jbrowse.org/demos/hpylori/hpylori_26695.fa.fai',
    locationType: 'UriLocation',
  },
}

// HG008-T v3.2 T2T assembly vs GRCh38 synteny as a session track, shared by the
// sv_cgiab dotplot and synteny figures. Overriding with PairwiseIndexedPAFAdapter
// keeps the PIF q/t refName prefixes mapped. Referenced as a const so both
// figures encode byte-identically. Needs the v3.2 PIF uploaded to
// jbrowse.org/demos/cgiab and the HG008T_v3.2 assembly in the hosted config.
export const CGIAB_ASM_PIF_TRACK = {
  type: 'SyntenyTrack',
  trackId: 'HG008T_v3.2_pif',
  name: 'HG008T v3.2',
  assemblyNames: ['HG008T_v3.2', 'GRCh38_GIABv3'],
  adapter: {
    type: 'PairwiseIndexedPAFAdapter',
    assemblyNames: ['HG008T_v3.2', 'GRCh38_GIABv3'],
    pifGzLocation: {
      uri: 'https://jbrowse.org/demos/cgiab/HG008T_v3.2.pif.gz',
      locationType: 'UriLocation',
    },
    index: {
      indexType: 'TBI',
      location: {
        uri: 'https://jbrowse.org/demos/cgiab/HG008T_v3.2.pif.gz.tbi',
        locationType: 'UriLocation',
      },
    },
  },
}

// Wait for ONE display to be finished, by the testid it passes to DisplayChrome
// (`pileup-display`, `variant-matrix-display`, ...).
//
// MOST SPECS DO NOT NEED THIS. `settlePass` already runs `waitForDisplayPhases`
// then `waitForDisplaysDone` on every capture, so a bare
// `displayPainted(testid)` — the form nearly every spec here uses — is normally
// enough, and generate-screenshots.ts says so at `settlePass`.
//
// Reach for this only where the display's FETCH MAY START LATE. The global gate
// is "no element is at data-display-phase=loading", which is trivially true in
// the window before a display has entered `loading` at all — so a big remote
// track (HPRC release 2's 2.3 GB wave VCF is the worked example, and
// specs/graph.ts's hprc_graph_vs_callset is where it is read that way) can sail
// through it and be captured empty. Waiting on `data-display-phase=ready` on
// the display itself closes that window: the phase covers the whole fetch,
// where `data-display-drawn` is first paint, which an empty canvas reaches on
// its own.
//
// This used to accept two arrangements, because the two attributes were not
// always on the same element: alignments derived its chrome testid from
// `displayId` and hand-wrote `pileup-display-done` on an inner div, so there
// they had to be related with `:has()`. Each form matched nothing in the other's
// case, and the symptom was a capture that timed out rather than an error at
// authoring time. Every display now emits both from its one chrome element, so
// the plain conjunction is the whole selector — which is `displaySettled`, and
// this is the alias the specs read by.
export const displayReady = displaySettled

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

// Expand a menu drill-down into wait/hover actions: each non-terminal item is
// hovered to open its submenu; the terminal item is only waited for. The caller
// lists the whole path, so an intermediate level can't be skipped — the failure
// that left `modifications1` waiting on a submenu its parent never opened. Pair
// with `cascadeBoxes` to keep the callout boxes on the same path.
//
// Each level used to end in a fixed `delay` (500ms by default, hand-tuned to
// 300/600/800 at six call sites) because a popper is visible a frame or two
// before popper.js has finished positioning it, so the next hover could land on
// a menu still moving. `waitForText` now returns only once the item's rect has
// held still — the wait watches the thing that has to settle instead of guessing
// how long it takes — so the delay has nothing left to pay for.
export function menuCascade(path: string[]): ScreenshotAction[] {
  return path.flatMap((text, i) => {
    const parent = path[i - 1]
    return [
      ...(parent ? [{ type: 'hover' as const, text: parent }] : []),
      { type: 'waitForText' as const, text },
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

// Open the alignments "Read height" submenu and leave it open.
// CascadingSubmenu opens on click as well as hover (onClick -> onOpen), and a
// click is deterministic where a hover is timing-sensitive (the pileup keeps
// re-laying-out while reads stream, so the hovered row can move out from under
// the cursor). Target the submenu row by its data-testid prefix.
export const openFeatureHeightSubmenu = (): ScreenshotAction[] => [
  { type: 'waitForText', text: 'Read height' },
  {
    type: 'click',
    selector: '[data-testid^="cascading-submenu-read_height"]',
  },
  { type: 'waitForText', text: 'Super-compact' },
]

// Park the mouse somewhere that cannot react to it, so no overview-ruler
// position readout or feature hover is left hanging in the capture.
//
// The JBrowse wordmark in the app bar, by its own `aria-label`, rather than the
// `{ x: 950, y: 60 }` this idiom used to be written as. That point was described
// in every copy as "the inert app header" and is nothing of the sort: at
// viewportWidth 1000 it lands in the *view's* title bar a few px from the
// minimize button, so it was one toolbar tweak away from parking the cursor on a
// control and one narrower viewport away from parking it on the canvas. The
// wordmark is the only thing up there that is guaranteed inert — it is an svg
// with no handlers — and it moves with the layout instead of having to be
// re-measured when the layout moves.
//
// The swap is inert: of the 16 figures converted, every one whose spec changed
// in no other way came back byte-identical. The six that did move moved on app
// drift accumulated since they were last swept — `alignments_soft_clipped_menu`
// gained a `Launch view` item and lost `Set max layout height...`, which is 12%
// of its pixels and nothing to do with where the cursor sits. Those six were
// restored from the store rather than committed, so the sweep can pick the drift
// up on its own with nothing else in the diff.
export const PARK_CURSOR: ScreenshotAction = {
  type: 'hover',
  selector: '[aria-label="JBrowse"]',
}

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
  { type: 'waitForText', text: 'Read height', hidden: true },
  { type: 'delay', ms: 300 },
]

// ── Trio crossover callouts (analyze_trio.md) ──────────────────────────────
// The two tracks every callout below resolves against. Named once because a
// trackId that doesn't match is an anchor that resolves to nothing, which fails
// the spec rather than misplacing a box — but only if the two figures and the
// helper are spelling it the same way.
export const TRIO_PAINT_TRACK = 'HG02024_VN049_KHVTrio.chr1.hapibd'
export const TRIO_VCF_TRACK = 'HG02024_VN049_KHVTrio.chr1.vcf'

// The six VCF haplotype rows, top→bottom, sharing the hap-ibd painting's
// Father/Mother hapN names so the sidebar and the painting read consistently.
// `name`/`sampleName` keep the canonical "HG020xx HPn" identity; `label` is the
// friendly sidebar text. trioRowFrac(label) is that row's top as a fraction of
// the display's height.
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
// the VCF display auto-fits its `TRIO_VCF_DISPLAY_H` px body across the 6
// haplotype rows (LinearMultiSampleVariantDisplay has no line zone), so the true
// per-row pitch is height/rows ≈ 43.33 — NOT a round 44, which drifts the frames
// ~3px low by the bottom row (boxes don't exactly match the rows).
export const TRIO_VCF_DISPLAY_H = 260
export const TRIO_VCF_ROW_PITCH = TRIO_VCF_DISPLAY_H / TRIO_HAPLOTYPES.length
// That same pitch as a fraction of the display's own height, which is what an
// anchor takes. The arithmetic is unchanged; what goes is its ORIGIN — the
// callouts used to be measured down from the top of the page, so the painting
// track's height (and everything else above the variant display) was silently
// part of every one of them.
export const trioRowFrac = (label: string) =>
  TRIO_HAPLOTYPES.findIndex(h => h.label === label) / TRIO_HAPLOTYPES.length

export const TRIO_HL_FILL = 0.16 // translucent wash inside each highlight frame
// distinct palettes so the two figures aren't mistaken for each other
export const TRIO_MATERNAL_COLORS = { left: '#15a01a', right: '#ff6f00' } // green/orange
export const TRIO_PATERNAL_COLORS = { left: '#caa200', right: '#8e44ad' } // yellow/purple

// hap-ibd painting: the display is filtered to one parent's 2 haplotype rows,
// which render at the auto-fit 20px row height. A depth from the track's top
// edge rather than a fraction of it, because this display's height is auto — a
// fraction would need the height nobody wrote down.
export const TRIO_PAINT_ROW_H = 20

// The window either side of a crossover, as two loci. The frames' widths were
// `TRIO_XOVER_X - 3` and `1495 - TRIO_XOVER_X`, which is the crossover's pixel
// twice over; as loci they are just the two halves of the window the spec
// already declares, and no width is written down at all.
function crossoverHalves(loc: string, crossover: string) {
  const win = /^(.+):([\d,]+)-([\d,]+)$/.exec(loc)
  const cut = /^(.+):([\d,]+)$/.exec(crossover)
  if (!win || !cut) {
    throw new Error(`trio crossover: "${loc}" / "${crossover}" don't parse`)
  }
  if (win[1] !== cut[1]) {
    throw new Error(`trio crossover: ${cut[1]} is not on ${win[1]}`)
  }
  return {
    left: `${win[1]}:${win[2]}-${cut[2]}`,
    right: `${win[1]}:${cut[2]}-${win[3]}`,
  }
}

// Colour-code the two sides of a crossover: the left-colour frame wraps the
// parental copy matched left of the breakpoint plus the matching left half of
// the child row; the right-colour frame wraps the copy matched right of it plus
// the child's right half; each lightly tinted. A neutral box marks the painting
// step and an arrow drops from it to the crossover point on the child row.
//
// Every one of the sixteen callouts resolves against the two tracks at capture
// time: the x is the crossover (or a half-window either side of it) and the y is
// a haplotype row of the display it is drawn on. The one thing that has to be
// said in pixels is a box's HEIGHT, since a `fracY` anchor is a line through the
// track rather than a band, and a box given no height falls back to 2*pad.
export interface TrioCrossover {
  // the spec's own window, and the breakpoint at the middle of it
  loc: string
  crossover: string
  child: string
  leftSource: string
  rightSource: string
  palette: { left: string; right: string }
  paintingTopRow: number
  leftText: string
  rightText: string
}

export function crossoverHighlights(opts: TrioCrossover): Annotation[] {
  const { child, crossover, leftSource, rightSource, palette } = opts
  const half = crossoverHalves(opts.loc, crossover)
  const stepTop = opts.paintingTopRow * TRIO_PAINT_ROW_H
  const stepHeight = TRIO_PAINT_ROW_H * 2
  // the two painting rows the block steps between, boxed around the step: a
  // fixed 56px window on the crossover, since what it frames is the step itself
  const step = {
    type: 'box',
    color: '#333',
    anchor: {
      track: TRIO_PAINT_TRACK,
      locus: crossover,
      fracY: 0,
      dy: stepTop,
    },
    // `pad: 0` throughout: an anchored box is inset by `pad` on every side, and
    // these frames have to meet the rows and each other exactly
    pad: 0,
    dx: -28,
    width: 56,
    height: stepHeight,
  } satisfies Annotation
  const frame = (color: string, locus: string, row: string) =>
    ({
      type: 'box',
      color,
      fillOpacity: TRIO_HL_FILL,
      anchor: {
        track: TRIO_VCF_TRACK,
        locus,
        fracY: trioRowFrac(row),
      },
      pad: 0,
      height: TRIO_VCF_ROW_PITCH,
    }) satisfies Annotation
  // both captions sit below the variant track, on the bottom of the display
  // rather than 70px under a row whose y was itself measured from the page top
  const caption = (color: string, anchor: AnnotationAnchor, text: string) =>
    ({
      type: 'text',
      color,
      anchor: { track: TRIO_VCF_TRACK, fracY: 1, dy: 27, ...anchor },
      text,
      maxWidth: 600,
    }) satisfies Annotation
  return [
    step,
    {
      type: 'arrow',
      // thinner line -> smaller arrowhead (head was too big)
      strokeWidth: 2,
      // straight down the crossover, from the bottom of the painting step to the
      // top of the child's row in the display below
      fromAnchor: {
        track: TRIO_PAINT_TRACK,
        locus: crossover,
        fracY: 0,
        dy: stepTop + stepHeight,
      },
      anchor: {
        track: TRIO_VCF_TRACK,
        locus: crossover,
        fracY: trioRowFrac(child),
      },
    },
    frame(palette.left, half.left, leftSource),
    frame(palette.left, half.left, child),
    frame(palette.right, half.right, rightSource),
    frame(palette.right, half.right, child),
    // left caption from the track's left edge, right caption from the crossover
    // — each starts where the half it describes does
    caption(palette.left, { alignX: 'left', dx: 60 }, opts.leftText),
    caption(palette.right, { locus: crossover, dx: 50 }, opts.rightText),
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
// `geneColor` is the display's `color` slot, written on all three gene tracks at
// once: the "Color by attribute" dialog produces
// `jexl:randomColor(get(feature,'<attr>'))`, and in bacteria the `gene`
// attribute is the ortholog id, so the same symbol takes the same color in every
// panel. Omitted by default, which encodes byte-identically to the version
// without the parameter.
export function hpyloriSyntenyWithGenes({
  geneColor,
}: { geneColor?: string } = {}) {
  // showOnlyGenes collapses each locus to its gene glyph (no CDS/mRNA
  // sub-features), so the lane reads as a tidy row of genes rather than nested
  // boxes
  const geneTrack = (trackId: string) => ({
    trackId,
    // the hosted config can't be read at build time, so the figure recipe only
    // knows which display a `color` expression belongs to if the spec says
    type: 'LinearBasicDisplay',
    showOnlyGenes: true,
    ...(geneColor ? { color: geneColor } : {}),
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
    geneGlyphMode: 'longestCoding',
    // default featureHeight (10px) reads as a bare sliver at this zoom —
    // these loci have few, widely-spaced exons and no isoform stacking to
    // fill a row, so there's nothing else shrinking them (verified
    // autoHeight/height are not the cause: pinning both had no effect)
    featureHeight: 18,
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
    heightMode: 'grow',
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
    'https://jbrowse.org/genomes/hg19/clinGen/clinGenGeneDisease.bb',
    '--bigwig',
    'https://hgdownload.soe.ucsc.edu/goldenpath/hg19/phyloP100way/hg19.100way.phyloP100way.bw',
    '--cram',
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.cram',
    '--loc',
    '1:19,190,000-19,240,000',
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

  // Circular structural-variant chord plot: SKBR3 (breast-cancer cell line,
  // hg19) long-read Sniffles SV calls, where each inter-chromosomal chord is a
  // translocation — the classic dense rearranged-cancer-genome view. (The cgiab
  // HG008 somatic benchmark the reviewer pointed at draws an empty ring: its
  // PASS calls are intra-chromosomal DEL/DUP/CNV with no BND translocations, so
  // no chords.) --fasta only reads the .fai for chrom names/lengths; the circular
  // view fetches no sequence.
  cliSpec('circular_chords', [
    'circular',
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--vcfgz',
    'https://jbrowse.org/genomes/hg19/SKBR3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.filtered.vcf.gz',
    '--width',
    '800',
  ]),

  // Gene/feature track over the reference sequence: hosted hg38 NCBI RefSeq
  // (--hub, --track) with --refseq adding the DNA-base + six-frame-translation
  // sequence track below it. Zoomed to a TP53 intron/CDS boundary (not mid-exon)
  // at base level, so the gene track shows readable structure — the intron thins
  // to a line, the CDS exon begins as a solid block, and that block edge lines up
  // with a specific reference base and the translation frame (docs "Gene tracks
  // and the reference sequence"). showOnlyGenes keeps the RefSeq rows to gene
  // features; geneGlyphMode:longestCoding collapses TP53's isoform thicket to
  // its single longest coding transcript, so one clean structure reads instead
  // of a stack of near-identical rows. Supersedes the old standalone `sequence`
  // refseq spec.
  cliSpec('gene_track', [
    '--hub',
    'hg38',
    '--track',
    'hg38-ncbiRefSeqCurated',
    'height:60',
    '{"showOnlyGenes":true,"geneGlyphMode":"longestCoding"}',
    '--refseq',
    '--loc',
    'chr17:7,675,018-7,675,098',
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
  // center position, so every read carrying the ~1.8 kb somatic deletion
  // (chr10:122,835,345-122,837,143) pulls into one contiguous band. The window
  // is centered on the deletion midpoint so the sort pivot lands inside it (a
  // pivot outside the deletion doesn't group the deletion reads). The legacy
  // `alignments_readgroup` filename is kept for the doc image URL.
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
    'chr10:122,831,700-122,840,800',
    '--width',
    '1200',
  ]),

  // group:tag:HP splits the pileup into one sub-track per haplotype. HG002
  // ultralong ONT (hg19), the same rehosted slice HG002_NANOPORE_BAM names; the
  // het deletion sits in one haplotype only.
  cliSpec('alignments_haplotype', [
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--bam',
    HG002_NANOPORE_BAM,
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
    // Sliced to chr20:18,495,000-18,517,000 and re-hosted off ont-open-data.
    // BAM rather than CRAM because the source CRAM's UR points at the
    // producer's own filesystem, so decoding it needs an M5 reference lookup
    // that a viewer should not have to make; the --cram path is still covered
    // by the skbr3 spec above. The comment on cancer_sv's tumour track records
    // that streaming this CRAM "failed all four sweeps of figures.yml
    // deterministically" at a 120s timeout -- 3.4 MB does not.
    '--bam',
    'https://jbrowse.org/demos/ont/COLO829_tumor.ht.chr20_18.5Mb.bam',
    'color:methylation',
    // The key for that coloring. It is off by default in the app because the
    // reader can open the track menu, which is the one thing nobody looking at
    // a PNG can do -- so red and blue were two unexplained colors and the
    // caption had to carry them.
    'legend',
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
    'https://jbrowse.org/genomes/hg19/1000genomes/ALL.chr11.phase3_v5b.HBB_5.2-5.3Mb.vcf.gz',
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
  // coverage/sashimi band tall enough for the arcs to be legible;
  // featureHeight:super-compact packs the supporting reads into a thin band
  // below so the exon-by-exon read coverage that feeds the junctions is visible
  // without the pileup dominating the frame.
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
    // LOG, because junction depth here spans three orders of magnitude: the
    // last exon peaks near 4000 and the first two sit in the low hundreds, so a
    // linear axis drew them as a flat line and the band was one spike with the
    // arcs floating over nothing (reviewer). Log puts every exon on the plot,
    // which is what the arcs are meant to be read against.
    'scaletype:log',
    'featureHeight:super-compact',
    'height:420',
    '--loc',
    'B2M',
    '--width',
    '1400',
  ]),

  // SV read-connection arcs: arcs:down links the split-read breakpoints of a
  // structural variant in a band below the coverage (the current default arc
  // direction). HG00151 ONT long reads (1000G-ONT S3, the MINIMAP2_ALIGNED_BAMS
  // file that keeps the SA-tag split alignments) over a ~1.2 kb chr1 inversion —
  // the two breakpoints show as clipped-read columns with the connecting arcs
  // between them. (No color:pairOrientation: that's a paired-end concept,
  // meaningless on long reads; the arcs are the SV signal.)
  cliSpec('sv_read_arcs', [
    '--hub',
    'hg38',
    '--bam',
    HG00151_ONT_1000G_BAM,
    'arcs:down',
    // Chain each long read's split segments (as the inversion_long_read figure
    // does), so the reverse-strand core paints blue between the red forward
    // flanks — the inversion is legible in the pileup itself, not only in the
    // arcs.
    'linkedReads:normal',
    // Split the pileup on SA-tag presence, as inversion_long_read does
    // (reviewer): the reads that cross the two breakpoints get their own
    // labelled section under the arcs, and the flat background pileup goes
    // below it, so the section divider says which reads carry the SV rather
    // than leaving the reader to pick the colored ones out of a single stack.
    'group:splitRead',
    'coverageHeight:80',
    // grouping stacks two coverage lanes and truncates the "Not split" lane at
    // a row boundary, so the whole SV signal fits well under the 820 the
    // ungrouped stack needed — at 820 the bottom third was empty
    'height:560',
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
    'name:CATlas single-cell ATAC (accessibility by cell type)',
    // ~27px per row across the 16 cell types — tighter rows than the old 520 so
    // the stack reads compactly (reviewer)
    'height:440',
    // zoomed out to a ~300 kb window around GCG (not the bare gene body) so the
    // alpha-cell peak reads as a localized, cell-type-specific spike against
    // otherwise-quiet flanking chromatin, rather than an isolated close-up whose
    // significance is impossible to judge
    '--loc',
    'chr2:162,000,000-162,300,000',
    '--width',
    '1400',
  ]),

  // The README's "Remote files" example: everything streamed by URL, with
  // --aliases reconciling the 1 / chr1 / NC_000001.10 refname styles across the
  // four sources. Same idea as the headline above, at a locus where the ClinVar
  // variants over the RefSeq genes are the point.
  cliSpec('remote_files', [
    '--fasta',
    'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    '--aliases',
    'https://jbrowse.org/genomes/hg19/hg19_aliases.txt',
    '--bigbed',
    'https://hgdownload.soe.ucsc.edu/gbdb/hg19/bbi/clinvar/clinvarMain.bb',
    '--gffgz',
    'https://jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz',
    '--bigwig',
    'https://jbrowse.org/genomes/hg19/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.regions.bw',
    '--loc',
    '1:48,683,542-48,907,531',
    '--width',
    '1200',
  ]),

  // `--hub` + repeated `--track`: the whole assembly and its hosted trackIds
  // come from genomes.jbrowse.org, so the command names only what to show.
  // 20 kb rather than the 100 kb the README used to print: ClinVar's variant
  // density puts a 100 kb window over the track's own render limit, so half the
  // figure was the words "Region too large to render". `force:true` clears that
  // gate and was tried — it draws, but at 100 kb the variants are bare ticks,
  // where 20 kb labels each one with its base change. Narrowing says more.
  cliSpec('hub_tracks', [
    '--hub',
    'hg19',
    '--track',
    'hg19-ncbiRefSeqCurated',
    '--track',
    'hg19-clinvarMain',
    '--loc',
    'chr1:1,020,000-1,040,000',
    '--width',
    '1200',
  ]),

  // A gene name rather than a locstring: resolved through the hub's Trix index
  // (navToLocStringOrSearch), which is the only reason `--loc BRCA1` works.
  cliSpec('gene_name_search', [
    '--hub',
    'hg19',
    '--track',
    'ncbiRefSeqCurated',
    '--loc',
    'BRCA1',
    '--width',
    '1200',
  ]),

  // The three README examples that show how a config is supplied, each of which
  // renders something and so gets a figure rather than being read on faith.

  // `--config` + `--assembly` + `--loc`: the bundled volvox config, whose
  // adapters use localPath (resolved relative to the config file), so this also
  // demonstrates that a config full of local files needs no server. `--track`
  // is not optional here — a config supplies definitions, not an open track
  // list, so without it this renders a correct and completely empty ruler.
  cliSpec('volvox_config', [
    '--config',
    'data/volvox/config.json',
    '--assembly',
    'volvox',
    '--track',
    'volvox_sv',
    '--loc',
    'ctgA:1-50,000',
    '--width',
    '1200',
  ]),

  // `--session`: a saved session supplies the view and its tracks, `--config`
  // supplies the trackIds it names. data/skbr3/session.json is the `init` form,
  // so this is also the only figure covering that path end to end.
  cliSpec('skbr3_session', [
    '--config',
    'data/config.json',
    '--session',
    'data/skbr3/session.json',
    '--assembly',
    'hg19',
    '--width',
    '1400',
  ]),

  // `snpcov` collapses an alignments track to its coverage band alone — the
  // same data as `alignments_pileup` above with the pileup hidden, which is
  // what makes the pair worth showing together.
  cliSpec('snpcov', [
    '--fasta',
    'data/volvox/volvox.fa',
    '--bam',
    'data/volvox/volvox-sorted.bam',
    'snpcov',
    'height:200',
    '--loc',
    'ctgA:1-20000',
    '--width',
    '1200',
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
    '1900',
  ]),

  // ONE FIGURE, BOTH TRACKS, and the control is inside it rather than beside
  // it (review on sv_review_normal: "boring figure. consider deleting. if this
  // is just to show in contrast to the other, it needs to be side-by-side
  // figure"). It was two separate renders of the same three windows, tumour and
  // matched normal, and the somatic call is the DIFFERENCE between them -- a
  // difference nobody can measure across two pictures on two parts of a page.
  // Both tracks in every panel makes it one picture: the connecting curves are
  // drawn per track, so they appear on the tumour rows and nowhere else, which
  // is what somatic looks like.
  //
  // That also deletes the boring figure without deleting the control, which
  // `docs/tutorials/CLAUDE.md` asks every dataset for.
  //
  // THREE PANELS, AND THAT IS WHAT KILLED THE DOTTED LINES (review: "i dont
  // like the dotted lines, because that means 'incomplete story'. we need to fix
  // this, if needed with more multi-hop"). A dashed connector is exactly that,
  // and the plugin says so: `AlignmentConnections` sets `strokeDasharray` on a
  // pair whose `hiddenSegmentsBetween` is non-empty -- the read has a
  // supplementary alignment at a locus that is NOT in the view. Here that locus
  // is chr10. COLO829 chain 1 is a closed three-chromosome cycle
  // (agent-docs/reference/SV_MULTIHOP.md): chr3, then 199 bp of chr10 at
  // 58,717,463-58,717,662, then 183 bp of chr12 inverted, then chr3 again. With
  // only chr3 and chr12 on screen, every read that goes the long way round is
  // drawn dashed and correctly so. The third panel makes every connector solid.
  //
  // `featureHeight:super-compact` (review: "use supercompact"), which is 1 px
  // per read. What the figure is read for is the bundle of curves and the
  // absence of any in the normal lanes, and at the default 7 px the six pileups
  // were most of a very tall page. `--width 1400` with six lanes rather than
  // three needs the reads that small to stay one screen.
  //
  // `force:true` is not a taste call: the chr3 panel is 1.2 kb of 200x ONT and
  // the byte gate refuses it, so it drew "Region too large to render". Which is
  // also how this file found out that breakpoint mode DROPPED its --track
  // modifiers -- `height:240` had never applied either. Fixed in
  // products/jbrowse-img/src/breakpointInit.ts.
  //
  // The assembly name is no longer printed once per panel (review: "we also do
  // not need assembly name on each level necessarily"). That is a change in
  // SVGBreakpointSplitView rather than a flag here: a breakpoint stack is
  // usually one assembly at several loci, so it names the first row and any row
  // whose assembly differs from the one above it.
  cliSpec('sv_review_pair', [
    'breakpoint',
    '--config',
    'https://jbrowse.org/demos/cancer_sv/config.json',
    '--assembly',
    'hg38',
    '--track',
    'COLO829_tumor_ont',
    'height:130',
    'force:true',
    'featureHeight:super-compact',
    '--track',
    'COLO829BL_normal_ont',
    'height:90',
    'force:true',
    'featureHeight:super-compact',
    '--loc',
    'chr3:25,358,511-25,359,711',
    '--loc',
    'chr10:58,716,962-58,718,162',
    '--loc',
    'chr12:72,272,512-72,273,712',
    '--width',
    '1400',
  ]),
]
