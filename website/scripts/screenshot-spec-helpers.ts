import { displaySettled, encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type {
  Annotation,
  AnnotationAnchor,
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

// The matched pair, as one track: goleft indexcov coverage for the tumour and
// for its own normal. indexcov normalizes each sample to that sample's own
// median, which is the only reason two rows drawn on one axis can be read
// against each other -- the normal sits flat at 1.0 and every level the tumour
// holds is a ratio against it.
//
// Shared rather than inlined per figure, because a second copy of the two URIs
// is a second chance for one figure's normal to be a different file from
// another's. Both the chr5 CNV walkthrough and the chr18/SMAD4 driver figure
// mount it.
export const HG008_INDEXCOV_TRACK = {
  type: 'MultiQuantitativeTrack',
  trackId: 'hg008_cnv_indexcov',
  name: 'HG008 normal vs tumor coverage (indexcov)',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: [
      {
        name: 'HG008-N (normal)',
        type: 'BigWigAdapter',
        bigWigLocation: {
          uri: 'https://jbrowse.org/demos/cgiab/HG008-N_indexcov.bw',
          locationType: 'UriLocation',
        },
      },
      {
        name: 'HG008-T (tumor)',
        type: 'BigWigAdapter',
        bigWigLocation: {
          uri: 'https://jbrowse.org/demos/cgiab/HG008-T_indexcov.bw',
          locationType: 'UriLocation',
        },
      },
    ],
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

// `renderer=webgl` is a pin, and the figure corpus needs one. Every capture runs
// headless, headless Chrome is SwiftShader, and the ladder now steps over a
// software rasterizer (createHal.ts) — so without this the next regen would
// silently redraw every figure on Canvas2D. That is a real visual change across
// the whole corpus arriving as a side effect of a rendering decision, which is
// the sort of thing a before/after comparison is supposed to catch rather than
// cause. Moving the corpus to another backend should be a deliberate edit here.
export function sessionSpec(config: string, session: object) {
  return `?config=${config}&session=${encodeSessionSpec(session)}&sessionName=Screenshot&renderer=webgl`
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
  // NORMAL FEATURE HEIGHT, and the lane sized to what it draws. This used to
  // pin `featureHeight: 18` against an earlier "reads as a bare sliver" note,
  // and at these loci that is a gene reduced to one transcript with a handful of
  // exons 15-30 px wide — so an 18 px body draws each exon as a SQUARE, next to
  // a RepeatMasker lane whose elements are ordinary flat bars (review: "the
  // canvasfeatures are oddly 'tall'"). The two lanes are the same renderer and
  // there is no reason for the gene one to be at a different scale.
  //
  // `heightMode: 'grow'` for the same reason the repeat lanes have it, and it is
  // worth saying that it buys no pixels HERE: probed on the live model, both
  // gene lanes come out at 50, which is the grow floor rather than the content's
  // own height, and is what the fixed slot already gave them. It is here so the
  // lane follows its content if the locus ever holds more than one collapsed
  // transcript — the empty strip under one row is the floor, not a setting.
  const genes = (id: string) => ({
    trackId: id,
    geneGlyphMode: 'longestCoding',
    heightMode: 'grow',
  })
  // RepeatMasker: 'grow' height mode — the track auto-sizes to exactly the few
  // rows of repeats at these TE loci, so it stays compact without crowding the
  // gene track, while every element keeps its NORMAL feature height (no fit-mode
  // scaling that inflates the boxes) and every name is drawn (no fit-ladder label
  // decimation). Reviewer: repeats should be normal-height and compact but still
  // labeled (SVA_F, L1HS, AluY… at the insertions) — not the tall, label-dropping
  // 'fit' band.
  //
  // `displayMode: 'compact'` on top of that (review on both TE figures: "try to
  // improve y-screen real estate using compact renderings"). These lanes are
  // what the frames spend their height on -- every element gets a row of its
  // own because its label widens its footprint, so each RepeatMasker band packs
  // five or six rows. Compact is a 0.6x body with proportionally smaller label
  // text and tighter row padding (HEIGHT_MULTIPLIERS / ROW_PADDING in
  // glyphUtils), which is the one compactness step that keeps the names: only
  // `collapsed` forces labels off, and the names are the point here.
  const rmsk = (id: string) => ({
    trackId: id,
    heightMode: 'grow',
    displayMode: 'compact',
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
