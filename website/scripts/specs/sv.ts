import {
  DEMO_CONFIG,
  HG00151_ONT_1000G_ADAPTER,
  HG002_NANOPORE_ADAPTER,
  VOLVOX,
  cgiabUrl,
  kgUrl,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// hg19 main chromosomes (1..22, X, Y) in karyotype order. A plain whole-genome
// showAllRegionsInAssembly also appends the *_hap / *_random / Un contigs, whose
// far-right elided-block column reads as clutter in a genome-wide overview.
// Passed as the view's `displayedRegionNames` so the LGV init restricts to just
// these (resolved through the assembly aliases against hg19's own regions).
const HG19_MAIN_CHROMS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  'X',
  'Y',
]

export const svSpecs: ScreenshotSpec[] = [
  // Gallery page + sv_visualization.md screenshots (live sessions from jbrowse.org)

  {
    mode: 'url',
    name: 'sv_inspector_importform_loaded',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'hg19',
          uri: 'https://jbrowse.org/genomes/hg19/SKBR3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.filtered.vcf.gz',
        },
      ],
    }),
    readyText: 'CHROM',
    readyTimeout: 60000,
    settleMs: 15000,
  },

  // Same SKBR3 SV inspector as above, but with the spreadsheet quick-filter
  // applied. This SKBR3 sniffles set is all translocations, so the filter
  // subsets by chromosome: typing "X" narrows the table to the calls involving
  // chrX (matching the CHROM / INFO CHR2 columns — "X" doesn't appear in the
  // numeric POS/ID columns), and the circular overview redraws to only those
  // chords. Replaces a stale hand-curated capture of the old labeled "text
  // filter" UI (the app now uses the MUI DataGrid quick-filter).
  {
    mode: 'url',
    name: 'sv_inspector_importform_filtered',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'hg19',
          uri: 'https://jbrowse.org/genomes/hg19/SKBR3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.filtered.vcf.gz',
        },
      ],
    }),
    readyText: 'CHROM',
    readyTimeout: 60000,
    settleMs: 15000,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder^="Search"]',
        value: 'X',
        clear: true,
      },
      { type: 'delay', ms: 4000 },
    ],
  },

  // Before/after horizontal flip, stacked into one figure: top frame is the
  // normal orientation, bottom frame after the view-menu "Horizontally flip"
  // (reverse complement) — the gene arrows and overview triangles reverse
  // direction. Rebuilt from the old server-side share link as a self-contained
  // sessionSpec over the hg19 ACTB locus (single longest-coding transcript so the
  // strand arrow reads clearly).
  {
    mode: 'url',
    name: 'horizontally_flip',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:5,562,000-5,575,000',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            geneGlyphMode: 'longestCoding',
          },
        },
      ],
    }),
    readyText: 'ACTB',
    readyTimeout: 60000,
    settleMs: 8000,
    // trim the empty viewport below the single track
    crop: { x: 0, y: 0, width: 1500, height: 300 },
    stages: [
      {
        // top frame: normal orientation, with the view-menu icon ringed and a
        // callout telling the reader to select "Horizontally flip" from it
        actions: [{ type: 'delay', ms: 500 }],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="view_menu_icon"]' },
          },
          {
            type: 'text',
            text: 'Select "Horizontally flip"',
            anchor: { selector: '[data-testid="view_menu_icon"]' },
            dx: 40,
            dy: 0,
            background: 'rgba(0,0,0,0.78)',
            textColor: '#fff',
          },
        ],
      },
      {
        // bottom frame: after the view-menu "Horizontally flip" the gene arrows /
        // overview triangles reverse direction. The menu auto-closes on click so
        // it never appears in the result frame.
        actions: [
          { type: 'click', selector: '[data-testid="view_menu_icon"]' },
          { type: 'waitForText', text: 'Horizontally flip' },
          { type: 'click', text: 'Horizontally flip' },
          { type: 'delay', ms: 3000 },
        ],
      },
    ],
  },

  // Whole-genome CNV: COLO829 melanoma tumor vs matched normal coverage as a
  // single multi-quantitative bigWig track, shown at chromosome scale (no `loc`
  // → showAllRegionsInAssembly) with localsd ±3sd autoscale so copy-number
  // gains/losses stand out. The two sources use the default multiwiggle palette
  // (no explicit per-source colors). Rebuilt from the old server-side share link
  // as a self-contained sessionSpec/MultiWiggleAdapter over the two COLO829
  // coverage bigWigs in config_demo.json.
  {
    mode: 'url',
    name: 'cnv',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'colo829_cnv_coverage',
          name: 'COLO829 tumor/normal coverage',
          assemblyNames: ['hg19'],
          adapter: {
            type: 'MultiWiggleAdapter',
            subadapters: [
              {
                type: 'BigWigAdapter',
                source: 'COLO829 tumor',
                // explicit colors: the multiwig source color is now assigned by
                // post-filter index, which flipped tumor/normal vs origin/main
                // . Pin tumor=red, normal=blue (set1 palette).
                color: '#e41a1c',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/genomes/hg19/COLO829/colo_tumor.bw',
                  locationType: 'UriLocation',
                },
              },
              {
                type: 'BigWigAdapter',
                source: 'COLO829 normal',
                color: '#377eb8',
                bigWigLocation: {
                  uri: 'https://jbrowse.org/genomes/hg19/COLO829/colo_normal.bw',
                  locationType: 'UriLocation',
                },
              },
            ],
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          // main chromosomes only (see HG19_MAIN_CHROMS): a genome-wide CNV
          // overview without the trailing unplaced-contig blocks
          displayedRegionNames: HG19_MAIN_CHROMS,
          tracks: [
            {
              trackId: 'colo829_cnv_coverage',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                autoscale: 'localsd',
                numStdDev: 3,
                defaultRendering: 'multiscatter',
                // even finer binning (basesPerSpan = bpPerPx/resolution) so the
                // scatter resolves copy-number structure (even finer,
                // then bumped again for slightly higher resolution — the BigWig
                // zoom levels are discrete, so this has to cross a level to add
                // detail)
                resolution: 50,
                // shrink scatter points (default 2px) so the dense CNV cloud
                // reads as fine structure rather than blobs
                scatterPointSize: 1,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 15000,
    // the two-row track is short; crop off the empty viewport below it
    crop: { x: 0, y: 0, width: 1500, height: 390 },
  },

  // The 27bp heterozygous deletion in HG002 ONT reads at ~1:63,006,xxx (hg19),
  // used to drive a group-by-HP example. A single HG002 ultralong-ONT
  // track uses the display's groupBy:{type:'tag',tag:'HP'} option, which splits
  // the pileup into one subtrack per HP value at render time (the newer built-in
  // grouping — no manually-filtered duplicate session tracks). The heterozygous
  // deletion concentrates in a single haplotype, so it shows in one group and
  // not the other — a cleaner read than a colored+sorted single pileup. The HG002
  // GIAB consensus SV VCF (the DEL call) sits on top. userByteSizeLimit lifts the
  // force-load byte gate so the reads auto-load instead of sitting on "Loading";
  // readySelector waits for the pileup canvas to actually paint before capture.
  //
  // NOTE (color regression, reported separately): coloring HG002 reads by the HP
  // tag now uses the darker MUI-200 TAG_COLOR_PALETTE
  // (plugins/alignments/src/LinearAlignmentsDisplay/colorTagUtils.ts) instead of
  // origin/main's pale Paul-Tol palette, so the haplotypes read darker than the
  // old "nice pink and blue". That palette is a code constant, not a spec field,
  // so it is not fixed here.
  {
    mode: 'url',
    name: 'smalldel',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'hg002_nanopore_hp',
          name: 'HG002 ONT',
          assemblyNames: ['hg19'],
          adapter: HG002_NANOPORE_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: '1:63,005,675-63,007,432',
          tracks: [
            'variants_hg002',
            {
              trackId: 'hg002_nanopore_hp',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                height: 400,
                userByteSizeLimit: 200_000_000,
                groupBy: { type: 'tag', tag: 'HP' },
                colorBy: { type: 'tag', tag: 'HP' },
              },
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 1000,
    settleMs: 15000,
  },

  // Alignments-track doc screenshots, autogenerated from real-human data in
  // DEMO_CONFIG (SKBR3 illumina / HG002 multi-track / 1KGP) so the colored
  // clip+insertion indicators and short-vs-long-read comparison match the doc
  // captions.

  // Colored clip indicator ticks above the coverage band. Uses the volvox
  // long-read SV BAM zoomed onto an SV breakpoint, where the reads clip hard at
  // a single column — producing a tall, unmistakable clip-indicator stack
  // (blue = left-clip, red = right-clip). The earlier SKBR3 illumina view was a
  // wide 28kb window where the ticks were tiny and scattered.
  {
    mode: 'url',
    name: 'alignment_clipping_indicators',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:2,560-2,760',
      tracks: [
        {
          trackId: 'volvox-long-reads-sv-bam',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            // taller coverage band so the clip-indicator ticks above it are
            // large enough to read (default coverageHeight is 45)
            coverageHeight: 120,
          },
        },
      ],
    }),
    readyText: 'ctgA',
    readyTimeout: 60000,
    settleMs: 8000,
  },

  // Inverted duplication (CPX/INVdup HGSV_2721) on real 1000-genomes data: the
  // HG02768 CRAM with linkedReads (mates drawn connected on one row) plus arc
  // read-connections and pair-orientation coloring makes the overlapping
  // inversion / tandem-dup pairing pattern visible, alongside the 1KGP ensemble
  // VCF call.
  // loc shifted ~600bp right so HGSV_2721 (near right of original range) sits
  // centered in the panel-narrowed view after the feature sidebar opens.
  // Single view at the inverted-duplication locus: orientation-colored read pairs
  // with the connecting arcs pointing upwards and a tall coverage track, with the
  // HGSV_2721 variant feature details opened.
  {
    mode: 'url',
    name: 'inverted_duplication',
    url: kgUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:39,658,200-39,661,800',
          trackLabels: 'offset',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG02768.final',
              displaySnapshot: {
                linkedReads: 'normal',
                readConnections: 'arc',
                // arcs drawn below the coverage band (reviewer)
                readConnectionsDown: true,
                height: 1300,
                coverageHeight: 120,
                // taller reads so the minority green (same-orientation /
                // inverted) pairs are legible instead of 3px slivers
                featureHeight: 9,
                colorBy: { type: 'pairOrientation' },
                // legend is opt-in now; show the pair-orientation key so the
                // inversion color signature is readable
                showLegend: true,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    // taller window so the enlarged pileup + the feature-details sidebar fit,
    // plus headroom for the annotation callouts pushed down off the pileup
    viewportHeight: 1850,
    settleMs: 30000,
    // click the HGSV_2721 variant's floating feature label (stable per-feature
    // testid) to open its feature details
    actions: [
      {
        type: 'click',
        selector: '[data-testid="feature-name-HGSV_2721"]',
      },
      // wait for the feature-details widget's lazy chunk to load and populate
      // (a fixed delay races the Suspense fallback and captures an empty
      // "Loading" sidebar); CPX_TYPE is the INFO field the annotation anchors to
      { type: 'waitForText', text: 'CPX_TYPE' },
      { type: 'delay', ms: 1000 },
    ],
    // explain the read evidence, plus a single connector from the "INVdup" callout
    // directly to the CPX_TYPE INFO field in the feature-details sidebar so the
    // annotation and the data it describes are visibly linked
    annotations: [
      {
        // sits in the empty white pileup band (so it doesn't cover the arcs at the
        // top of the pileup — the key INVdup evidence) and at the same height as
        // the CPX_TYPE field, so the connector to it is short
        type: 'text',
        x: 640,
        y: 840,
        text: 'Annotated as "INVdup" (inverted duplication)',
        fontSize: 26,
        maxWidth: 360,
      },
      {
        // tail at the callout's right edge, head anchored on the CPX_TYPE field
        type: 'arrow',
        from: { x: 1015, y: 850 },
        anchor: { text: 'CPX_TYPE' },
      },
      {
        // inversion evidence
        type: 'text',
        x: 60,
        y: 520,
        text: 'Green (LL), navy (RR), and magenta split reads flag the inverted segment.',
        maxWidth: 470,
      },
      {
        // duplication evidence, stacked below with a gap
        type: 'text',
        x: 60,
        y: 690,
        text: 'Elevated coverage and arcs mark the duplicated copy.',
        maxWidth: 470,
      },
    ],
  },

  // Same INVdup locus as inverted_duplication, but with the linked-read *bezier*
  // connection mode (showBezierConnections) over an ordinary pileup instead of
  // coverage-band arcs. Each pair is drawn as a horizontal-tangent oval curve
  // spanning its two mates — the same curve shape BreakpointSplitView's
  // AlignmentConnections draws in a single linear view — so the green LL / blue
  // RR same-orientation pairs of the inverted segment stand out as bundled curves
  // across the locus. "View as pairs" (linkedReads: 'normal') is on,
  // so each mate pair collapses onto a single row joined by its bezier curve —
  // the abnormal same-orientation (LL/RR) pairs of the inverted duplication read
  // as a coherent stack of curves instead of scattered singleton pileup rows.
  {
    mode: 'url',
    name: 'inverted_duplication_bezier',
    url: kgUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:39,658,200-39,661,800',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG02768.final',
              displaySnapshot: {
                showBezierConnections: true,
                linkedReads: 'normal',
                // hide the normally-paired reads so only the abnormal
                // same-orientation (LL/RR) inverted-duplication pairs and their
                // bezier curves remain, decluttering the view (reviewer)
                drawProperPairs: false,
                // also draw the coverage-band arcs, below the coverage (reviewer)
                readConnections: 'arc',
                readConnectionsDown: true,
                // proper pairs hidden, so the abnormal-pair stack is short —
                // sized to it instead of the old 1300px full-depth band
                height: 650,
                coverageHeight: 120,
                featureHeight: 9,
                colorBy: { type: 'pairOrientation' },
                showLegend: true,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG02768',
    readyTimeout: 60000,
    viewportHeight: 1000,
    settleMs: 30000,
    annotations: [
      {
        type: 'text',
        x: 60,
        y: 470,
        text: 'View as pairs joins each pair with a bezier curve. Green (LL) and navy (RR) same-orientation pairs bundle across the locus; magenta marks split reads crossing the inversion.',
        maxWidth: 520,
      },
    ],
  },

  // Same inversion, short reads vs long reads, in ONE sample (HG00151). The
  // companion to inverted_duplication: that figure shows how short paired-end
  // reads only *infer* an inversion (from discordant pair orientation + a few
  // split reads at the breakpoints). Here a ~1.2 kb pure inversion (HGSV_10047,
  // chr1:197,787,660-197,788,855, called by the 1KGP Illumina ensemble AND by the
  // 1000G-ONT consortium's SV callers) is shown with HG00151 Oxford Nanopore
  // (long) reads: single reads span the whole inverted segment, so each crosses
  // both breakpoints and splits into a forward + a reverse-strand supplementary
  // alignment — the split junctions arc in magenta (the split-read inversion
  // color), directly reading out the inversion that short reads can only
  // triangulate. The ONT reads are the minimap2 alignment (supplementary/split
  // reads intact — see HG00151_ONT_1000G_ADAPTER).
  {
    mode: 'url',
    name: 'inversion_long_read',
    url: kgUrl({
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'HG00151_ONT_1000g',
          name: 'HG00151 Nanopore (1000G ONT, minimap2)',
          assemblyNames: ['hg38'],
          adapter: HG00151_ONT_1000G_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:197,785,500-197,791,000',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            {
              trackId: 'HG00151_ONT_1000g',
              displaySnapshot: {
                // link supplementary alignments: chains each long read's split
                // segments, so the reverse-strand piece of an inversion-spanning
                // read paints the flipped-strand color (and the junction arcs
                // magenta) instead of an uncolored plain pileup
                linkedReads: 'normal',
                readConnections: 'arc',
                height: 560,
                coverageHeight: 70,
                colorBy: { type: 'pairOrientation' },
                showLegend: true,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'HG00151 Nanopore',
    readyTimeout: 90000,
    viewportHeight: 800,
    settleMs: 40000,
    annotations: [
      {
        type: 'text',
        x: 60,
        y: 300,
        text: 'One read spans the inversion — reverse-strand core between forward flanks, magenta arcs at the split junctions.',
        maxWidth: 470,
      },
    ],
  },

  // C-GIAB live demo screenshots (load from jbrowse.org, not local test data)

  // Single-frame SV-inspector launch: the app "Add" menu with the "SV inspector"
  // item boxed (drop the second import-form stage — the import form
  // with the pasted VCF URL is its own figure, sv_inspector_importform_after).
  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_start',
    url: cgiabUrl({ views: [] }),
    readyText: 'Select a view to launch',
    readyTimeout: 60000,
    settleMs: 2000,
    // crop off the empty viewport below the menu
    crop: { x: 0, y: 0, width: 1500, height: 460 },
    actions: [
      { type: 'click', text: 'Add' },
      { type: 'waitForText', text: 'SV inspector' },
      { type: 'delay', ms: 500 },
    ],
    // box the "Add" menu button (the path's first click) plus the "SV inspector"
    // item it opens (circle Add too)
    annotations: [
      { type: 'box', anchor: { text: 'Add' } },
      { type: 'box', anchor: { text: 'SV inspector' } },
    ],
  },

  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_view',
    url: cgiabUrl({
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'GRCh38_GIABv3',
          uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.4-20250714/GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf.gz',
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 10000,
    // The SV_20 row (chr3:139,976,414 -> chr13:114,353,244, the same
    // translocation junction translocation_breakpoint_split drills into below)
    // is mounted in the DataGrid's virtualization buffer but scrolled below
    // the grid's own internal viewport, so its DOM rect is real but not
    // visible until scrolled into view — hover (which Puppeteer auto-scrolls
    // to) brings it on-screen before the anchor box is measured. The matching
    // chord in the circular plot (data-testid `chord-vcf-19`, confirmed by
    // walking the React fiber tree from the chord path to its `feature`
    // prop) is a 1px stroke among ~160 others with no reliable on-screen
    // anchor (hover can't land on it, and its rendered curve geometry doesn't
    // map cleanly through the circular view's screen transform), so the grid
    // row — which carries the same identity in readable text — is the
    // dependable anchor instead.
    actions: [{ type: 'hover', text: 'SV_20' }],
    annotations: [
      { type: 'box', anchor: { text: 'SV_20' } },
      {
        type: 'text',
        x: 60,
        y: 90,
        text: 'SV_20: the chr3↔chr13 translocation, drilled into below.',
        maxWidth: 420,
      },
    ],
  },

  // The chr3<->chr13 translocation that the chord in the SV inspector
  // points at — benchmark call SV_20 joins chr3:139,976,414 to chr13:114,353,244.
  // Built declaratively as a BreakpointSplitView (init.views resolves to the two
  // child LGVs after attach), each panel showing the 116x tumor PacBio HiFi reads
  // in Super-compact mode (featureHeight 1 / spacing 0, reviewer).
  // showIntraviewLinks draws the
  // black splines between reads that map partially to each side of the junction.
  // The PacBio BAM is the full 118 GB NCBI ftp-trace file (no rehosted slice
  // exists for this locus), so the ~26 MB BAI index downloads on every fresh-tab
  // capture — hence the long readyTimeout. userByteSizeLimit lifts the fetch-size
  // gate so the reads auto-load headless instead of sitting on a force-load
  // prompt.
  {
    mode: 'url',
    name: 'sv_cgiab/translocation_breakpoint_split',
    url: cgiabUrl({
      views: [
        {
          type: 'BreakpointSplitView',
          // LaunchView-BreakpointSplitView takes the two child panels as a
          // top-level `views` array (loc/assembly/tracks) — it wraps them into
          // the view's transient `init` itself. Same shape as DotplotView /
          // LinearSyntenyView session specs.
          views: [
            {
              loc: 'chr3:139,971,414-139,981,414',
              assembly: 'GRCh38_GIABv3',
              tracks: [
                {
                  trackId:
                    'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
                  displaySnapshot: {
                    featureHeight: 1,
                    featureSpacing: 0,
                    height: 250,
                    userByteSizeLimit: 500_000_000,
                  },
                },
              ],
            },
            {
              loc: 'chr13:114,348,244-114,358,244',
              assembly: 'GRCh38_GIABv3',
              tracks: [
                {
                  trackId:
                    'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
                  displaySnapshot: {
                    featureHeight: 1,
                    featureSpacing: 0,
                    height: 250,
                    userByteSizeLimit: 500_000_000,
                  },
                },
              ],
            },
          ],
        },
      ],
    }),
    readyText: 'HG008-T_PacBio',
    readyTimeout: 180000,
    viewportHeight: 900,
    settleMs: 25000,
  },

  {
    // The figure depicts the LGV import/start screen showing the "Show all
    // regions in assembly" button (per its caption). An LGV with an assembly
    // but no loc relies on afterAttach's showAllRegionsInAssembly, which races
    // the (slow, remote) assembly load and silently no-ops before regions are
    // ready — so instead launch an empty view and stop on the import form,
    // mirroring the lgv_assembly spec.
    mode: 'url',
    name: 'sv_cgiab/cnv_show_all_regions',
    url: cgiabUrl({ views: [] }),
    readyText: 'Select a view to launch',
    readyTimeout: 60000,
    settleMs: 2000,
    actions: [
      { type: 'click', text: 'Launch view' },
      { type: 'waitForText', text: 'Show all regions in assembly' },
      { type: 'delay', ms: 2000 },
    ],
    // crop off the empty viewport below; tall enough for the import form (stage
    // 1) and the resulting whole-genome ruler (stage 2)
    crop: { x: 0, y: 0, width: 1500, height: 250 },
    // two-stage: stage 1 boxes the "Show all regions in assembly"
    // button on the import form; stage 2 clicks it so the result — every
    // chromosome laid out across the view — shows next
    stages: [
      {
        annotations: [
          { type: 'box', anchor: { text: 'Show all regions in assembly' } },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Show all regions in assembly' },
          { type: 'delay', ms: 8000 },
        ],
      },
    ],
  },

  // The SV inspector after searching for SV_85: the spreadsheet quick-filter is
  // typed with "SV_85" so the table narrows to that one benchmark deletion call,
  // and a linear genome view below is already navigated to the SV_85 locus
  // (chr10, in the CUZD1 gene) showing the same VCF track — the end state of
  // clicking the filtered row. Replaces a hand-curated capture.
  {
    mode: 'url',
    name: 'sv_cgiab/deletion_sv_inspector_search',
    url: cgiabUrl({
      sessionTracks: [
        // hg38 NCBI RefSeq genes (chr-named, CSI-indexed) so the LGV below the
        // inspector shows CUZD1's gene model over the deletion
        {
          type: 'FeatureTrack',
          trackId: 'hg38_ncbiRefSeq_ucsc',
          name: 'NCBI RefSeq genes (hg38)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
                locationType: 'UriLocation',
              },
              indexType: 'CSI',
            },
          },
        },
      ],
      views: [
        {
          type: 'SvInspectorView',
          assembly: 'GRCh38_GIABv3',
          // shorter inspector so the LGV below gets more room (not so
          // tall)
          height: 420,
          uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.4-20250714/GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf.gz',
        },
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr10:122,823,828-122,852,611',
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            'GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf',
          ],
        },
      ],
    }),
    // 'chr1' shows in the inspector circular/table; the LGV location is an input
    // value (not matched as text), so wait on the inspector and let settle cover
    // the remote LGV navigation/VCF load
    readyText: 'chr1',
    readyTimeout: 60000,
    settleMs: 20000,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder^="Search"]',
        value: 'SV_85',
        clear: true,
      },
      { type: 'delay', ms: 4000 },
    ],
    // Pared down to the single core narrative (too many annotations):
    // search SV_85 -> one DEL row -> clicking its location link opens the region
    // below, where SVTYPE=DEL is drawn as the <DEL> ALT allele on the variant.
    annotations: [
      {
        type: 'text',
        text: 'Searching "SV_85" filters to one DEL (a het CUZD1 deletion)',
        x: 70,
        y: 180,
        fontSize: 18,
        maxWidth: 420,
      },
      { type: 'box', anchor: { text: 'chr10:122,835,344..122,837,142' } },
      { type: 'arrow', from: { x: 185, y: 268 }, to: { x: 620, y: 730 } },
      // box the actual SV_85 <DEL> feature glyph in the VCF track below (was
      // floating in the blank space above it — measured from the rendered
      // feature's bounding box, css y≈738-748)
      { type: 'box', x: 592, y: 722, width: 112, height: 40 },
      {
        type: 'text',
        text: 'The location link opens the region below, where SVTYPE=DEL draws as the <DEL> allele',
        x: 745,
        y: 738,
        fontSize: 18,
        maxWidth: 360,
      },
    ],
    // remote VCF over the NCBI ftp-trace server: render timing jitters the
    // circular overview slightly, so soften the content-stable diff gate
    diffThreshold: 0.02,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/deletion_linear_view',
    url: cgiabUrl({
      sessionTracks: [
        // hg38 NCBI RefSeq genes served from the jbrowse.org/ucsc hub (chr-named,
        // CSI-indexed) — matches the GRCh38_GIABv3 chr refnames directly, so no
        // rehosting needed.
        {
          type: 'FeatureTrack',
          trackId: 'hg38_ncbiRefSeq_ucsc',
          name: 'NCBI RefSeq genes (hg38)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
                locationType: 'UriLocation',
              },
              indexType: 'CSI',
            },
          },
        },
        // A small region-slice of the 116x tumor PacBio BAM (chr10:122.8-122.87Mb,
        // ~360 reads, 2.8MB) rehosted on jbrowse.org/demos/cgiab so the reads
        // auto-load fast instead of tripping the force-load guard the full 116x
        // BAM hits over this 28kb window (render the reads).
        {
          type: 'AlignmentsTrack',
          trackId: 'hg008t_pacbio_chr10_deletion_slice',
          name: 'HG008-T PacBio HiFi (116x, chr10 slice)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_chr10_CUZD1_deletion.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/cgiab/HG008-T_chr10_CUZD1_deletion.bam.bai',
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr10:122,822,042-122,850,825',
          // center line marks the sort column (the screen-center base the pileup
          // is sorted by — reviewer)
          showCenterLine: true,
          // The somatic SV VCF's SV_85 <DEL> call marks the deletion against the
          // NCBI RefSeq gene context (CUZD1), with the rehosted PacBio read slice
          // showing the supporting reads across the deletion.
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            'GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf',
            {
              trackId: 'hg008t_pacbio_chr10_deletion_slice',
              // compact pileup: the "Compact" feature-height preset
              // sets featureHeight=3, featureSpacing=0 (COMPACTNESS_PRESETS),
              // both flat config-override keys on LinearAlignmentsDisplay
              displaySnapshot: {
                height: 300,
                featureHeight: 3,
                featureSpacing: 0,
                // sort reads by the base at the screen-center column
                sortedBy: {
                  type: 'basePair',
                  pos: 122836434,
                  refName: 'chr10',
                  assemblyName: 'GRCh38_GIABv3',
                },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'chr10',
    readyTimeout: 60000,
    settleMs: 20000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/cnv_with_bed_track',
    // Whole chr5 with BOTH tumor and normal coverage in a single
    // MultiQuantitativeTrack above the somatic CNV benchmark bed
    // calls, so the coverage gains/losses can be compared against the called
    // intervals. Uses the normalized indexcov bigwigs (median≈1 → reads
    // directly as copy number).
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'hg008_cnv_indexcov_chr5',
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
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr5',
          // offset track labels so they overlay the tracks instead of taking a
          // dedicated row
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'hg008_cnv_indexcov_chr5',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                defaultRendering: 'multiscatter',
                autoscale: 'localsd',
                // finer binning (basesPerSpan = bpPerPx/resolution) so the
                // whole-chromosome scatter resolves more CNV detail
                resolution: 8,
                height: 200,
              },
            },
            'GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls',
          ],
        },
      ],
    }),
    readyText: 'chr5',
    readyTimeout: 60000,
    // wider viewport so the whole-chromosome CNV + bed track aren't cut off
    viewportWidth: 1800,
    settleMs: 15000,
  },

  // The normalized CNV signal built in the "Build CNV tracks" tutorial section:
  // a single log2(tumor/normal) coverage ratio bigWig across all chromosomes,
  // over the benchmark CNV BED. Unlike the two independently-median-normalized
  // indexcov tracks above, one log2-ratio track reads directly as copy number
  // (0 = the genome-wide median, + = gain, - = loss) so gains/losses line up
  // with the called intervals without eyeballing two bands. Domain capped to a
  // symmetric -2..2 so gains/losses read around the 0 line.
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_log2ratio_genome',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_log2ratio',
          name: 'HG008 log2(tumor/normal) coverage ratio',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008_log2ratio.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_baf',
          name: 'HG008-T B-allele frequency (BAF)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
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
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          trackLabels: 'offset',
          loc: 'chr1 chr2 chr3 chr4 chr5 chr6 chr7 chr8 chr9 chr10 chr11 chr12 chr13 chr14 chr15 chr16 chr17 chr18 chr19 chr20 chr21 chr22 chrX chrY',
          tracks: [
            {
              // raw normalized coverage (median≈1 → copy number) for both
              // samples in one band, the signal log2(tumor/normal) is built from
              trackId: 'hg008_cnv_indexcov',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                defaultRendering: 'multiscatter',
                resolution: 10,
                minScore: 0,
                maxScore: 2.5,
                height: 160,
              },
            },
            {
              trackId: 'hg008_log2ratio',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // scatter of the per-bin average (not the default filled/whisker
                // xyplot) reads copy-number gains/losses as a clean point band,
                // the conventional CNV depth-ratio plot. useBicolor:false keeps it
                // a single color: gains/losses read off the 0 line by position, so
                // red/blue stays free to mean tumor/normal on the indexcov track
                defaultRendering: 'scatter',
                useBicolor: false,
                summaryScoreMode: 'avg',
                scatterPointSize: 1,
                // request bigwig bins 10x finer than screen resolution so the
                // whole-genome scatter resolves the per-bin CNV signal
                resolution: 10,
                minScore: -2,
                maxScore: 2,
                height: 160,
                // horizontal gridlines behind the scatter so the log2=0 baseline
                // and the ±1 copy-number steps are readable (reviewer)
                displayCrossHatches: true,
              },
            },
            {
              trackId: 'hg008_baf',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // raw 0..1 BAF as a fine-resolution scatter preserving the
                // per-bin spread: LOH arms split into symmetric upper/lower
                // bands off the central 0.5 het line, balanced regions stay a
                // single 0.5 line. resolution:10 keeps bins small enough that
                // the split survives at genome scale.
                defaultRendering: 'scatter',
                scatterPointSize: 1,
                resolution: 10,
                minScore: 0,
                maxScore: 1,
                height: 120,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 90000,
    viewportWidth: 1500,
    viewportHeight: 860,
    settleMs: 25000,
  },

  // The conventional two-panel somatic-CNV view over chromosome 3: log2 ratio
  // (copy number) above the raw 0..1 B-allele frequency (allelic state), with the
  // benchmark CNV calls below. chr3 is a clean teaching example — the p-arm is a
  // single-copy loss WITH loss-of-heterozygosity (negative log2 AND the BAF het
  // SNPs splitting into upper/lower bands off 0.5), while the q-arm is balanced
  // (log2 back up, BAF a single 0.5 line).
  {
    mode: 'url',
    name: 'sv_cgiab/cnv_log2_baf',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_log2ratio',
          name: 'HG008 log2(tumor/normal) coverage ratio',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008_log2ratio.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_baf',
          name: 'HG008-T B-allele frequency (BAF)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bw',
              locationType: 'UriLocation',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr3',
          tracks: [
            {
              trackId: 'hg008_log2ratio',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // scatter of the per-bin average — the conventional CNV depth-
                // ratio plot (see cnv_log2ratio_genome). Single color
                // (useBicolor:false); gains/losses read off the 0 line
                defaultRendering: 'scatter',
                useBicolor: false,
                summaryScoreMode: 'avg',
                scatterPointSize: 1,
                minScore: -2,
                maxScore: 2,
                height: 140,
              },
            },
            {
              trackId: 'hg008_baf',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // raw 0..1 BAF scatter: the p-arm LOH splits het SNPs into an
                // upper and lower band off the 0.5 het line, while the balanced
                // q-arm stays a single 0.5 line. resolution:10 pulls finer
                // bigwig bins so the band-split survives at chromosome scale.
                defaultRendering: 'scatter',
                scatterPointSize: 1,
                resolution: 10,
                minScore: 0,
                maxScore: 1,
                height: 140,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 90000,
    viewportWidth: 1500,
    viewportHeight: 560,
    settleMs: 30000,
  },

  // CDKN2A focal homozygous deletion (chr9:21,952,497-21,972,343, benchmark
  // SV_75, total CN=0 / hap 0+0) — the canonical PDAC two-hit tumor-suppressor
  // loss. A homozygous deletion reads differently from a heterozygous (single-
  // copy) loss: depth drops to the floor (both parental copies gone), whereas
  // a het loss only halves depth. The deletion is punched into a larger
  // single-copy-loss arm (CN=1), so it shows as a deeper focal dip. True
  // per-base tumor coverage (mosdepth on a targeted BAM slice, not the 500bp-
  // binned log2 ratio) resolves the ~20kb event's boundaries almost exactly:
  // depth drops from ~65x to precisely 0 at chr9:21,952,497-21,972,343. Shown
  // over NCBI RefSeq genes (the config's hg38_ncbiRefSeq_ucsc, compact for
  // CDKN2A context), the raw HG008-T long-read pileup with supplementary
  // alignments linked (the deletion is a clean drop-out in the reads
  // themselves), and the CN-labeled benchmark CNV track (the config's
  // hg008_cnv_calls) whose label reads out the called copy number (CN 0). The
  // coarse log2 ratio was dropped (it duplicates the per-base
  // coverage without adding scale context at this zoom).
  {
    mode: 'url',
    name: 'sv_cgiab/driver_cdkn2a_deletion',
    url: cgiabUrl({
      sessionTracks: [
        {
          // true per-base depth from mosdepth on a targeted BAM slice around
          // CDKN2A (not genome-wide — see WAKHAN-PIPELINE.md step 5) — fine
          // enough to resolve the ~20kb deletion's boundaries, sharper than the
          // 500bp-binned log2 ratio below
          type: 'QuantitativeTrack',
          trackId: 'hg008_t_coverage_finescale',
          name: 'HG008-T fine-scale coverage (per-base)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_coverage_perbase.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          // Tumor PacBio-HiFi reads, re-declared inline so fetchSizeLimit can be
          // raised — the default 5 MB limit blocks the ~116x pileup at this scale
          type: 'AlignmentsTrack',
          trackId: 'hg008_t_reads_cdkn2a',
          name: 'HG008-T PacBio HiFi reads',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BamAdapter',
            fetchSizeLimit: 30_000_000,
            bamLocation: {
              uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam',
              locationType: 'UriLocation',
            },
            index: {
              indexType: 'BAI',
              location: {
                uri: 'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam.bai',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          // ~60kb around the deletion: tight enough that the ~116x read pileup
          // loads (vs the whole ±60kb overview) while still showing CDKN2A and
          // flanking single-copy-loss context
          loc: 'chr9:21,930,000-21,990,000',
          // offset track labels onto their own line so the long track names
          // (fine-scale coverage / PacBio HiFi reads) don't overlap the data
          trackLabels: 'offset',
          tracks: [
            {
              // genes compact so the RefSeq isoforms collapse to a thin band
              // rather than dominating the figure
              trackId: 'hg38_ncbiRefSeq_ucsc',
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                displayMode: 'compact',
              },
            },
            {
              trackId: 'hg008_t_coverage_finescale',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                minScore: 0,
                maxScore: 100,
                height: 200,
              },
            },
            {
              // raw long-read pileup: the homozygous deletion is a
              // clean read drop-out. linkedReads:'normal' chains each read's
              // supplementary/split alignments onto one row joined by a
              // connector ("add view as pairs / link supplementary
              // reads") so reads spanning the deletion breakpoints read as
              // coherent split alignments. (Reviewer also asked to sort the
              // split reads to the bottom of the pileup — no sort/group-by
              // option supports that while linkedReads chain mode is active,
              // since a chain's members must share one group key and
              // "is-part-of-a-chain" isn't a groupable dimension; skipped.)
              trackId: 'hg008_t_reads_cdkn2a',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                linkedReads: 'normal',
                // fit-to-display-height packs the ~116x pileup into the
                // fixed 320px height without the fixed featureHeight/spacing
                // clipping rows that don't fit
                heightMode: 'fit',
                height: 320,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr9',
    readyTimeout: 120000,
    viewportWidth: 1500,
    viewportHeight: 1040,
    settleMs: 30000,
  },

  // chr17 as the log2xBAF decision-table teacher. One chromosome shows two
  // distinct LOH mechanisms: 17p is a single-copy loss WITH LOH (CN=1, hap 1+0,
  // covering TP53) — negative log2 AND a BAF split; 17q is COPY-NEUTRAL LOH
  // (CN=2, hap 2+0, ~43Mb) — flat log2 at 0 but a full BAF split. The 17q event
  // is invisible to depth alone; only the BAF reveals it, which is the whole
  // argument for pairing the two tracks.
  {
    mode: 'url',
    name: 'sv_cgiab/driver_chr17_loh',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_log2ratio',
          name: 'HG008 log2(tumor/normal) coverage ratio',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008_log2ratio.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_baf',
          name: 'HG008-T B-allele frequency (BAF)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          // raw normal-vs-tumor coverage overlaid in one band (show
          // the multiwiggle of normal vs tumor coverage). indexcov is each
          // sample median-normalized to ~1, so a copy loss reads as the tumor
          // band dropping below the normal band.
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
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr17',
          // overlay the long track names on the tracks instead of a dedicated
          // label row (reviewer)
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'hg008_cnv_indexcov',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                defaultRendering: 'multiscatter',
                resolution: 10,
                minScore: 0,
                maxScore: 2.5,
                height: 140,
              },
            },
            {
              trackId: 'hg008_log2ratio',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                defaultRendering: 'scatter',
                useBicolor: false,
                summaryScoreMode: 'avg',
                scatterPointSize: 1,
                // finer bins so the many small CNVs on chr17 resolve at
                // whole-chromosome scale
                resolution: 10,
                minScore: -2,
                maxScore: 2,
                height: 140,
                // horizontal gridlines behind the scatter so the log2=0
                // baseline and the ±1 copy-number steps are readable (reviewer)
                displayCrossHatches: true,
              },
            },
            {
              trackId: 'hg008_baf',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                defaultRendering: 'scatter',
                scatterPointSize: 1,
                resolution: 10,
                minScore: 0,
                maxScore: 1,
                height: 140,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr17',
    readyTimeout: 90000,
    viewportWidth: 1500,
    // taller: gene/CNV context + three wiggle bands (indexcov, log2, BAF)
    viewportHeight: 820,
    settleMs: 30000,
  },

  // KRAS, the central PDAC oncogene: a low-level allelic gain (CN 3, 2+1) on
  // chr12 — positive log2 ratio with an imbalanced (but not fully split) BAF,
  // the fourth entry in the log2xBAF decision table (driver_chr17_loh). The raw
  // 0..1 BAF resolves the 2+1 imbalance: het SNPs split into an upper (~0.67) and
  // lower (~0.33) band rather than the single 0.5 line of a balanced region.
  // A compact NCBI RefSeq gene track (hg38_ncbiRefSeq_ucsc, from the cgiab
  // config) anchors KRAS in the gained arm, and the CN-labeled benchmark CNV
  // track (hg008_cnv_calls, also from the config) reads the opaque "SV_101" id
  // out as its copy number (the bare SV id doesn't clarify the
  // event). Zoomed out from 3.5Mb so the gain sits in flanking context.
  {
    mode: 'url',
    name: 'sv_cgiab/driver_kras_gain',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_log2ratio',
          name: 'HG008 log2(tumor/normal) coverage ratio',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008_log2ratio.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_baf',
          name: 'HG008-T B-allele frequency (BAF)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bw',
              locationType: 'UriLocation',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr12:23,000,000-27,500,000',
          // highlight band over the KRAS locus so the eye lands on the oncogene
          // within the ~4.5Mb gained arm even though the gene is tiny at this
          // scale ("can't see KRAS gene ... interesting if highlighted")
          highlight: ['chr12:25,205,246-25,250,936'],
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              displaySnapshot: {
                // normal (not compact) height so the KRAS gene row + label read
                // where they land under the highlight band (taller track)
                type: 'LinearBasicDisplay',
                height: 150,
              },
            },
            {
              trackId: 'hg008_log2ratio',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                defaultRendering: 'scatter',
                useBicolor: false,
                summaryScoreMode: 'avg',
                scatterPointSize: 3,
                minScore: -2,
                maxScore: 2,
                height: 140,
                // request bigwig bins 10x finer than screen resolution so the
                // 500bp-binned log2 signal resolves at this window rather than
                // being served as a coarse bigwig zoom level
                resolution: 10,
              },
            },
            {
              trackId: 'hg008_baf',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // raw 0..1 BAF scatter with default whisker summary preserving the
                // per-bin spread; resolution:10 makes it fine-grained so the 2+1
                // gain's band-split is legible
                defaultRendering: 'scatter',
                scatterPointSize: 2,
                resolution: 10,
                minScore: 0,
                maxScore: 1,
                height: 140,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr12',
    readyTimeout: 90000,
    viewportWidth: 1500,
    // tall enough for the gene track + both wiggles + the CN-labeled CNV calls
    // track to all fit (the gene track pushes the CNV calls down)
    viewportHeight: 880,
    settleMs: 20000,
  },

  // SMAD4 (DPC4), the mirror image of the TP53 event: 18q loss with LOH
  // (CN 1, 0+1) — negative log2 AND the BAF het SNPs splitting off the 0.5 line.
  // The CNV calls use the config's CN-labeled hg008_cnv_calls track so the 18q
  // event reads out as its copy number + haplotype split (the bare
  // draftbenchmark SV ids don't say what the call is).
  {
    mode: 'url',
    name: 'sv_cgiab/driver_smad4_loh',
    url: cgiabUrl({
      sessionTracks: [
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_log2ratio',
          name: 'HG008 log2(tumor/normal) coverage ratio',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008_log2ratio.bw',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'QuantitativeTrack',
          trackId: 'hg008_baf',
          name: 'HG008-T B-allele frequency (BAF)',
          assemblyNames: ['GRCh38_GIABv3'],
          adapter: {
            type: 'BigWigAdapter',
            bigWigLocation: {
              uri: 'https://jbrowse.org/demos/cgiab/HG008-T_baf.bw',
              locationType: 'UriLocation',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr18:1-80,373,285',
          // overlay the long track names on the tracks instead of a dedicated
          // label row (reviewer)
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'hg008_log2ratio',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                defaultRendering: 'scatter',
                useBicolor: false,
                summaryScoreMode: 'avg',
                scatterPointSize: 1,
                minScore: -2,
                maxScore: 2,
                height: 140,
                // pull finer bigwig bins than the default zoom level so the
                // 500bp-binned log2 signal shows across this whole-chr18 view
                resolution: 10,
              },
            },
            {
              trackId: 'hg008_baf',
              displaySnapshot: {
                type: 'LinearWiggleDisplay',
                // raw 0..1 BAF scatter: the 18q LOH splits het SNPs into upper
                // and lower bands off the 0.5 het line. resolution:10 keeps bins
                // fine enough that the split reads at chromosome scale.
                defaultRendering: 'scatter',
                scatterPointSize: 1,
                resolution: 10,
                minScore: 0,
                maxScore: 1,
                height: 140,
              },
            },
            'hg008_cnv_calls',
          ],
        },
      ],
    }),
    readyText: 'chr18',
    readyTimeout: 90000,
    viewportWidth: 1500,
    viewportHeight: 640,
    settleMs: 20000,
  },

  // SV inspector import form with a VCF URL pasted (sv_inspector_view.md) — the
  // SKBR3 Sniffles translocation calls typed into the URL field before opening.
  {
    mode: 'url',
    name: 'sv_inspector_importform_after',
    url: sessionSpec(DEMO_CONFIG, {
      views: [{ type: 'SvInspectorView' }],
    }),
    readyText: 'Open file from URL or local computer',
    settleMs: 3000,
    // smaller capture — the import form is compact and centered
    viewportWidth: 1150,
    viewportHeight: 380,
    actions: [
      { type: 'click', text: 'VCF' },
      {
        type: 'type',
        selector: '[data-testid="urlInput"]',
        value:
          'https://jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf',
      },
      { type: 'delay', ms: 1500 },
    ],
    // annotations removed: just the import form with the URL pasted
  },
]
