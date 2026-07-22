import {
  DEMO_CONFIG,
  VOLVOX,
  cascadeBoxes,
  kgUrl,
  lgvSession,
  menuCascade,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const uiSpecs: ScreenshotSpec[] = [
  // The top-level "Add" menu (Circular / Dotplot / Linear genome / Linear
  // synteny / Tabular data / SV inspector), cropped to the menu for the
  // developer "menus" guide. Replaces a stale capture where Add was nested
  // under File.
  {
    mode: 'url',
    name: 'top_level_menus',
    url: `?config=${VOLVOX}&sessionName=Screenshot`,
    readyText: 'ctgA',
    settleMs: 2500,
    actions: [
      { type: 'click', text: 'Add' },
      { type: 'waitForText', text: 'Linear genome view' },
      { type: 'delay', ms: 500 },
    ],
  },

  // The no-build plugin tutorial's result. The "Complete example" plugin
  // (test_data/no_build_plugin/esmplugin.js, loaded via esmLoc) adds a
  // "Citations" top-level menu whose item opens a custom "Cite this JBrowse
  // session" widget. Driving that menu route regenerates the figure from the
  // hosted plugin instead of a hand capture — keep the plugin in sync with the
  // code block in developer_guides/no_build_plugin.md. readyText 'Citations'
  // waits for the (async) plugin to finish configuring before the click.
  {
    mode: 'url',
    name: 'no_build_final',
    url: '?config=test_data/no_build_plugin/config.json&sessionName=Screenshot',
    readyText: 'Citations',
    settleMs: 3000,
    viewportWidth: 1200,
    // short capture: the launcher and the widget's citation both sit near the
    // top, so a tall viewport would just be empty white below them
    viewportHeight: 300,
    actions: [
      { type: 'click', text: 'Citations' },
      { type: 'waitForText', text: 'Cite this JBrowse session' },
      { type: 'delay', ms: 400 },
      { type: 'click', text: 'Cite this JBrowse session' },
      { type: 'waitForText', text: 'Diesh, Colin' },
      { type: 'delay', ms: 600 },
    ],
  },

  // Location-search autocomplete: typing a gene name into the search box surfaces
  // matching features from the assembly's text-search index. Uses config_demo's
  // hg19 (whose trix index covers RefSeq/Gencode names) searching "brca".
  {
    mode: 'url',
    name: 'searching_lgv',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:1-100,000',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 8000,
    // smaller capture window in both dimensions
    viewportWidth: 1150,
    viewportHeight: 560,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder="Search for location"]',
        value: 'brca',
        clear: true,
      },
      { type: 'waitForText', text: 'BRCA1' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // Selecting a gene from the search dropdown navigates to it AND boxes the
  // specific matched feature (not just the region). Types "EDEN" into the search
  // box, clicks the EDEN gene option, then waits for the highlight overlay
  // (data-testid="feature-highlight") the canvas display draws once the searched
  // feature resolves against the rendered features.
  {
    mode: 'url',
    name: 'search_feature_highlight',
    // start away from EDEN (1050..9000) so its on-canvas floating label isn't in
    // the DOM — otherwise `click text:'EDEN'` would hit that label instead of the
    // search dropdown option. The capture only shows the post-navigation state.
    // A searched feature auto-pins to a top layout row (layoutPinnedFeatureIdSet),
    // so EDEN sits at the top of the otherwise-dense ctgA:1..10,000 stack.
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:30,000..40,000',
      tracks: [
        {
          trackId: 'gff3tabix_genes',
          type: 'LinearBasicDisplay',
          // collapse to gene glyphs so the pinned+highlighted EDEN gene reads
          // cleanly against the stack (reviewer)
          showOnlyGenes: true,
        },
      ],
    }),
    readyText: 'ctgA',
    viewportWidth: 1100,
    viewportHeight: 400,
    settleMs: 4000,
    actions: [
      {
        type: 'type',
        selector: 'input[placeholder="Search for location"]',
        value: 'EDEN',
        clear: true,
      },
      { type: 'waitForText', text: 'EDEN' },
      { type: 'delay', ms: 800 },
      // keyboard-select the first option (the EDEN gene): MUI's autocomplete
      // ignores synthetic option clicks, so ArrowDown highlights it and Enter
      // fires navigation + the search-result-selected extension point
      { type: 'press', key: 'ArrowDown' },
      { type: 'press', key: 'Enter' },
      // wait for navigation to settle and the highlight overlay to resolve
      {
        type: 'waitForSelector',
        selector: '[data-testid="feature-highlight"]',
      },
      { type: 'delay', ms: 1200 },
    ],
  },

  // Rubberband selection on the main scalebar, which pops the "Zoom to region /
  // Get sequence / Copy range / Bookmark region" menu.
  {
    mode: 'url',
    name: 'rubberband',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram'],
    }),
    viewportWidth: 1000,
    viewportHeight: 550,
    readyText: 'ctgA',
    settleMs: 5000,
    actions: [
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Zoom to region' },
      { type: 'delay', ms: 1000 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'Zoom to region' } }],
  },

  // display_settings.md: render the tutorial's own URL session-spec example so
  // the reader sees what those inline display settings produce. Matches the
  // doc's JSON (volvox_sv_cram at ctgA:1-10000, height 250, softclipping on,
  // viewed as pairs — which links each read to its mate and colors by insert
  // size + orientation).
  {
    mode: 'url',
    name: 'display_settings_url_snapshot',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-10000',
      tracks: [
        {
          trackId: 'volvox_sv_cram',
          height: 250,
          showSoftClipping: true,
          linkedReads: 'normal',
          colorBy: { type: 'insertSizeAndOrientation' },
        },
      ],
    }),
    readyText: 'volvox-sv (cram)',
    settleMs: 5000,
    viewportHeight: 540,
    crop: { x: 0, y: 0, width: 1500, height: 445 },
  },

  // The nssv15767046 insertion at ~1:55,705,920 (hg19) shown across HG002
  // nanopore (top), PacBio (middle), and Illumina (bottom) read tracks under the
  // HG002 dbVar variant call. Reconstructed from DEMO_CONFIG (was a share-link
  // that opened with the track selector covering the panel) so the sessionSpec
  // form opens with the selector closed. The high-depth PacBio Sequel track is
  // capped to a fixed height and the window is taller, so its deep coverage no
  // longer pushes the Illumina reads out of frame.
  {
    mode: 'url',
    name: 'insertion',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        // A region-slice of the HG002 PacBio Sequel 15kb BAM (1:55.70-55.71Mb,
        // 70 reads, 650KB) rehosted on jbrowse.org/demos/hg002 so the PacBio reads
        // load reliably — the full remote NCBI BAM intermittently errored here.
        {
          type: 'AlignmentsTrack',
          trackId: 'hg002_pacbio_chr1_insertion_slice',
          name: 'HG002 PacBio Sequel 15kb (chr1 slice)',
          assemblyNames: ['hg19'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/hg002/HG002.Sequel.15kb.chr1_insertion.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/hg002/HG002.Sequel.15kb.chr1_insertion.bam.bai',
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
          assembly: 'hg19',
          loc: '1:55,705,770-55,706,090',
          tracks: [
            // single <INS> call — a short lane is plenty (reviewer: the default
            // height left a tall empty variant band above the reads)
            { trackId: 'nstd175.GRCh37.variant_call.vcf', height: 60 },
            { trackId: 'hg002_nanopore', height: 260 },
            {
              trackId: 'hg002_pacbio_chr1_insertion_slice',
              height: 260,
            },
            {
              trackId: 'illumina_hg002',
              // show soft clipping so the clipped bases flanking the insertion
              // are visible on the Illumina reads
              height: 320,
              showSoftClipping: true,
            },
          ],
        },
      ],
    }),
    readyText: 'HG002',
    readyTimeout: 60000,
    viewportHeight: 1200,
    settleMs: 20000,
  },

  // Multi-sample variant display on the 1000 Genomes phase-3 SV ensemble callset
  // (3202 samples) across chr19:42.7-47.8Mb, sorted by genotype at the large
  // ~1.12Mb inversion HGSV_73318 (chr19:46,275,880-47,396,219, AF=0.238). Because
  // this display draws variants at genomic position, the inversion renders as a
  // wide band; after the sort, carrier samples cluster to the top so the band
  // splits cleanly. Rebuilt from a share link as a declarative sessionSpec. The
  // right-click lands at x~1130 (genomic ~46.55Mb), an inversion-only gap where no
  // other SV overlaps, so the sort reliably targets the inversion. forceLoad
  // lifts the 1MB tabix fetch gate so the 5Mb window auto-loads headless instead of
  // showing a force-load prompt. Remote 1000genomes data, so allow a long ready/settle.
  {
    mode: 'url',
    name: 'multisv',
    url: kgUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '19:42,749,096-47,802,386',
          tracks: [
            {
              trackId: '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
              type: 'LinearMultiSampleVariantDisplay',
              forceLoad: true,
              // shorter multi-sample display (~400px)
              height: 400,
            },
            // NCBI RefSeq gene track below the variant display.
            // showLabels:'on' forces gene names on (the default 'auto' hides
            // them at this 5Mb zoom past maxLabelFeatureDensity); showOnlyGenes
            // drops the per-transcript/mRNA subfeatures so only the gene-level
            // glyphs (and their labels) render; showDescriptions:false keeps the
            // track compact (gene symbols only, no description line — reviewer).
            {
              trackId: 'ncbi_refseq_109_hg38',
              type: 'LinearBasicDisplay',
              height: 140,
              showLabels: 'on',
              showDescriptions: false,
              showOnlyGenes: true,
            },
          ],
        },
      ],
    }),
    readyText: '1KGP',
    readyTimeout: 90000,
    viewportHeight: 720,
    settleMs: 35000,
    hideTooltip: true,
    actions: [
      // y=450 lands in the multi-sample matrix (proven coordinate); the dense
      // 5Mb gene track never fully clears "Loading" headless, so don't gate on it
      { type: 'rightclick', from: { x: 1130, y: 450 } },
      { type: 'waitForText', text: 'Sort by genotype' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'Sort by genotype' },
      { type: 'delay', ms: 6000 },
      // move the pointer off the matrix so the mouseover crosshair doesn't bake
      // into the capture (remove the crosshairs)
      { type: 'hover', from: { x: 6, y: 6 } },
      { type: 'delay', ms: 800 },
    ],
  },

  // Same chr19 inversion window as `multisv`, but with the multi-sample display
  // colored by SV type (`featureColor: 'svType'`): every alt-carrying cell takes
  // its variant's structural-variant class color (the ~1.12Mb HGSV_73318
  // inversion band paints the inversion color), and the legend names each SV
  // class present. Demonstrates the SV-type coloring preset on real data.
  {
    mode: 'url',
    name: 'multisv_svtype',
    url: kgUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '19:42,749,096-47,802,386',
          tracks: [
            {
              trackId: '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
              type: 'LinearMultiSampleVariantDisplay',
              forceLoad: true,
              height: 400,
              featureColor: 'svType',
            },
            {
              trackId: 'ncbi_refseq_109_hg38',
              type: 'LinearBasicDisplay',
              height: 140,
              showLabels: 'on',
              showDescriptions: false,
              showOnlyGenes: true,
            },
          ],
        },
      ],
    }),
    readyText: '1KGP',
    readyTimeout: 90000,
    viewportHeight: 720,
    settleMs: 35000,
    hideTooltip: true,
    actions: [
      { type: 'rightclick', from: { x: 1130, y: 450 } },
      { type: 'waitForText', text: 'Sort by genotype' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'Sort by genotype' },
      { type: 'delay', ms: 6000 },
      { type: 'hover', from: { x: 6, y: 6 } },
      { type: 'delay', ms: 800 },
    ],
  },

  // Trio SV: the Kinh-Vietnamese trio (HG02030 child / HG02031 mother / HG02032
  // father) Illumina reads stacked over the 1000 Genomes Illumina ensemble SV
  // callset, at a ~43kb SV locus. The full NCBI 1000genomes CRAMs 503'd
  // intermittently (reviewer saw an error), so each is sliced to this locus
  // (chr1:40,476,000-40,530,000, ~12-14k reads, <1MB BAM) and rehosted on
  // jbrowse.org/demos/kgp-trio so the reads auto-load fast and reliably.
  // Per-track heights sized so all four tracks fit one viewport with enough of
  // each pileup showing to read the SV signal (reviewer: increase the height).
  {
    mode: 'url',
    name: 'multi-sv-trio',
    url: kgUrl({
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'HG02030_trio_slice',
          name: 'HG02030 (child)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/kgp-trio/HG02030_trio_slice.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/kgp-trio/HG02030_trio_slice.bam.bai',
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
        {
          type: 'AlignmentsTrack',
          trackId: 'HG02031_trio_slice',
          name: 'HG02031 (mother)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/kgp-trio/HG02031_trio_slice.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/kgp-trio/HG02031_trio_slice.bam.bai',
                locationType: 'UriLocation',
              },
              indexType: 'BAI',
            },
          },
        },
        {
          type: 'AlignmentsTrack',
          trackId: 'HG02032_trio_slice',
          name: 'HG02032 (father)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/kgp-trio/HG02032_trio_slice.bam',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/kgp-trio/HG02032_trio_slice.bam.bai',
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
          assembly: 'hg38',
          loc: '1:40,481,472-40,524,349',
          tracks: [
            '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
            // read-connection arcs on each trio member: discordant /
            // split pairs arc across the SV breakpoints, so the SV signal that is
            // present (or absent) in child vs parents reads at a glance
            {
              trackId: 'HG02030_trio_slice',
              height: 280,
              readConnections: 'arc',
            },
            {
              trackId: 'HG02031_trio_slice',
              height: 280,
              readConnections: 'arc',
            },
            {
              trackId: 'HG02032_trio_slice',
              height: 280,
              readConnections: 'arc',
            },
          ],
        },
      ],
    }),
    readyText: 'HG02030',
    readyTimeout: 90000,
    viewportHeight: 1200,
    settleMs: 25000,
  },

  // sv_visualization.md: the TRA feature-details panel with its "Launch split
  // views with breakend source and target" link. Zoomed onto a single SKBR3
  // Sniffles translocation breakend (14:84871468 // 17:74803924) so clicking
  // the lone variant opens the details drawer; the BREAKENDS link is annotated.
  {
    mode: 'url',
    name: 'link_to_split_view',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '14:84,871,462-84,871,480',
      tracks: ['breast_cancer_sniffles_hg19_traonly_tabix'],
    }),
    readyText: '84,871',
    settleMs: 5000,
    // tall viewport so the full-height feature-details panel shows the
    // LaunchBreakendPanel link below the long TRA INFO table
    viewportHeight: 1100,
    actions: [
      // click the TRA variant's floating feature label (stable per-feature
      // testid) to open the feature-details drawer; the translocation's
      // INFO.CHR2/END drive the LaunchBreakendPanel split-view link
      { type: 'click', selector: '[data-testid="feature-name-89844_3"]' },
      { type: 'waitForText', text: 'breakpoint split view' },
      { type: 'delay', ms: 1500 },
    ],
    annotations: [
      { type: 'box', anchor: { text: 'breakpoint split view' } },
      // arrow + explanatory callout pointing at the boxed split-view link
      {
        type: 'arrow',
        from: { x: 760, y: 300 },
        anchor: { text: 'breakpoint split view' },
      },
      {
        type: 'text',
        x: 60,
        y: 270,
        text: 'Launches a breakpoint split view for the TRA — also in paired-end and long-read feature details.',
      },
    ],
  },

  {
    mode: 'url',
    name: 'breakpoint_split_view',
    // Declarative reconstruction of the old share session (share-ITpNXoz07O):
    // SKBR3 ngmlr split-read CRAM + Sniffles VCF over the chr1<->chr5
    // interchromosomal translocation. Each panel is a loc window centered on
    // its breakpoint (chr1:229,354,402 // chr5:137,884,948). The alignments
    // display height is shortened to 140 (was ~250) so the pileups aren't tall
    // ; the intra-view links are toggled off via the view menu below
    // so only the cross-panel junction splines draw.
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'BreakpointSplitView',
          showIntraviewLinks: false,
          views: [
            {
              assembly: 'hg19',
              loc: '1:229,347,000-229,362,000',
              tracks: [
                {
                  trackId: 'ngmlr_splitters_cram',
                  height: 140,
                },
                {
                  trackId: 'breast_cancer_sniffles_hg19',
                  // drop the megabase-scale inversion calls that span the whole
                  // window so only the junction breakends show
                  type: 'LinearVariantDisplay',
                  // only a handful of junction breakends survive the filter, so
                  // keep the variant lane short
                  height: 90,
                  jexlFiltersSetting: [
                    "jexl:get(feature,'end')-get(feature,'start') < 100000",
                  ],
                },
              ],
            },
            {
              assembly: 'hg19',
              loc: '5:137,877,000-137,892,000',
              // bottom panel mirrors the top: variants above reads (so the two
              // pileups sit adjacent across the junction) — reviewer
              tracks: [
                {
                  trackId: 'breast_cancer_sniffles_hg19',
                  type: 'LinearVariantDisplay',
                  height: 90,
                  jexlFiltersSetting: [
                    "jexl:get(feature,'end')-get(feature,'start') < 100000",
                  ],
                },
                {
                  trackId: 'ngmlr_splitters_cram',
                  height: 140,
                },
              ],
            },
          ],
        },
      ],
    }),
    readyText: 'SKBR3',
    // taller viewport so both panels, the shortened variant lanes, and the
    // connecting splines are fully captured
    viewportHeight: 1000,
    readyTimeout: 60000,
    settleMs: 15000,
  },

  // Read-vs-reference of a SKBR3 PacBio read spanning a ~634bp insertion
  // (purple box labeled "634" in the pileup, row 1 of the ngmlr track at this
  // locus) — checked against the other reads piled up at this same site and
  // 634bp is already effectively the largest consistently-supported insertion
  // there (up to 636bp on a couple of reads, within noise). Driven live via
  // rightclick -> Launch view -> Linear read vs ref (buildReadVsRefSpec.ts)
  // instead of a frozen share-link session, so the inline-config fix actually
  // gets exercised. Read glyphs are canvas-drawn; the rightclick coordinate
  // was located by probing this same session. "Show curved lines" is then
  // turned on via the synteny view's "View options" menu.
  {
    mode: 'url',
    name: 'read_vs_ref_insertion',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:85,618,922-85,621,742',
      tracks: ['ngmlr'],
    }),
    readyText: 'SKBR3',
    readyTimeout: 60000,
    settleMs: 8000,
    hideTooltip: true,
    // the synteny read-vs-ref panel below the pileup gets clipped at the default
    // 800px viewport, so give it extra room
    viewportHeight: 950,
    actions: [
      { type: 'rightclick', from: { x: 622, y: 249 } },
      { type: 'waitForText', text: 'Open feature details' },
      { type: 'hover', text: 'Launch view' },
      { type: 'waitForText', text: 'Linear read vs ref' },
      { type: 'click', text: 'Linear read vs ref' },
      { type: 'waitForText', text: 'Set window size' },
      { type: 'click', text: 'Submit' },
      { type: 'waitForText', text: 'Reference sequence' },
      { type: 'delay', ms: 1000 },
      { type: 'click', selector: '[aria-label="View options"]' },
      { type: 'waitForText', text: 'Show...' },
      { type: 'hover', text: 'Show...' },
      { type: 'waitForText', text: 'Show curved lines' },
      { type: 'click', text: 'Show curved lines' },
      { type: 'delay', ms: 2000 },
    ],
  },
  // ────────────────────────────────────────────────────────────────────────
  // Basic UI guides
  // ────────────────────────────────────────────────────────────────────────

  // LGV usage guide: text-label callouts anchored to the live toolbar controls
  // (so positions track the UI, no hand-tuned coords), each on a dark pill so
  // the reader doesn't have to cross-reference a numbered legend. Labels are
  // staggered vertically so same-row controls don't overlap.
  {
    mode: 'url',
    name: 'lgv_usage_guide',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
    // Each label sits in the clear band immediately next to the control it names,
    // with a SHORT arrow into it (minimize arrow length, place text next
    // to its target, don't pile every pill at the top). Two tiers track the
    // two real control rows: the clear strip just above the navigation toolbar
    // (track selector / scroll-zoom toggle / pan / search / zoom, controls at
    // y~122), and the ruler strip just above the track header (drag handle + track
    // menu, controls at y~178). Arrow heads are anchored so they track the real
    // element; pill/tail coords are absolute viewport CSS px (1500x800 capture)
    // tuned to the live control positions. The "Add view" app-bar callout was
    // dropped (reviewer) in favor of pointing out the scroll-zoom toggle here too
    // — scroll_zoom_toggle (just above this in the docs) is still the dedicated
    // close-up figure for that control.
    annotations: [
      // toolbar tier: labels in the clear strip at y~62, short arrows down into
      // the navigation controls at y~122
      {
        type: 'text',
        text: 'Open track selector',
        x: 22,
        y: 62,
        fontSize: 16,
      },
      {
        type: 'arrow',
        from: { x: 40, y: 70 },
        anchor: { selector: 'button[title="Open track selector"]' },
      },
      {
        type: 'text',
        text: 'Toggle scroll-zoom',
        x: 200,
        y: 62,
        fontSize: 16,
      },
      {
        type: 'arrow',
        from: { x: 220, y: 70 },
        anchor: {
          selector: 'button[title="Toggle scroll zoom on WebGL tracks"]',
        },
      },
      { type: 'text', text: 'Pan', x: 545, y: 62, fontSize: 16 },
      {
        type: 'arrow',
        from: { x: 560, y: 70 },
        anchor: { selector: 'button[aria-label="Pan left"]' },
      },
      { type: 'text', text: 'Search box', x: 690, y: 62, fontSize: 16 },
      {
        type: 'arrow',
        from: { x: 730, y: 70 },
        anchor: { selector: 'input[placeholder="Search for location"]' },
      },
      { type: 'text', text: 'Zoom', x: 968, y: 62, fontSize: 16 },
      {
        type: 'arrow',
        from: { x: 990, y: 70 },
        anchor: { selector: '[data-testid="zoom_in"]' },
      },

      // ruler tier: label in the strip at y~152, short arrow down into the
      // track-menu control at y~178
      { type: 'text', text: 'Track menu', x: 360, y: 152, fontSize: 16 },
      {
        type: 'arrow',
        from: { x: 360, y: 160 },
        anchor: { selector: '[data-testid="track_menu_icon"]' },
      },
    ],
  },

  // Scroll-to-zoom toggle: a single frame ringing the toggle button with a
  // callout explaining the click (the old second "enabled" frame was redundant
  // per reviewer). Narrow/short viewport keeps the figure cropped to the LGV
  // header.
  {
    mode: 'url',
    name: 'scroll_zoom_toggle',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    viewportWidth: 1000,
    viewportHeight: 220,
    annotations: [
      {
        type: 'circle',
        anchor: {
          selector: 'button[title="Toggle scroll zoom on WebGL tracks"]',
        },
      },
      {
        type: 'text',
        text: 'Click to enable scroll-to-zoom',
        anchor: {
          selector: 'button[title="Toggle scroll zoom on WebGL tracks"]',
        },
        dx: 70,
      },
    ],
  },

  // Add track: single frame. The "Open track..." File-menu item and
  // the AddTrackWidget drawer it opens are shown together — open the drawer, then
  // reopen the File menu (clicking the item closes it) so both the menu path and
  // the resulting form are visible, with an arrow from the boxed menu item across
  // to the boxed add-track panel.
  {
    mode: 'url',
    name: 'add_track_form',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr1:1,000,000-1,100,000',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    // reviewer: the 1000x560 capture read too small — a bit larger so the File
    // menu path and the (now denser) add-track form are legible
    viewportWidth: 1200,
    viewportHeight: 620,
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'File' },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'delay', ms: 300 },
      // open the add-track drawer
      { type: 'click', text: 'Open track...' },
      { type: 'waitForText', text: 'Enter track data' },
      { type: 'delay', ms: 1000 },
      // reopen the File menu so the menu path and the open form show together
      { type: 'click', text: 'File' },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'delay', ms: 400 },
    ],
    annotations: [
      { type: 'box', anchor: { text: 'Open track...' } },
      // box just the add-track workflow form (not the whole full-height drawer,
      // whose box ran off the bottom of the capture)
      { type: 'box', anchor: { selector: '[data-testid="addTrackWorkflow"]' } },
      // arrow from the "Open track..." menu item to the "Enter track data"
      // heading of the panel it opens; head nudged left so it stops short of
      // the field instead of pointing into the middle of the widget
      {
        type: 'arrow',
        from: { x: 222, y: 262 },
        anchor: { text: 'Enter track data' },
        dx: -30,
      },
    ],
  },

  // Track selector open with the add-track FAB clicked; its menu now opens above
  // the FAB (HierarchicalFab anchorOrigin) so the FAB stays visible (reviewer:
  // the popover used to cover the FAB).
  {
    mode: 'url',
    name: 'add_track_tracklist',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    // smaller browser in both stages (reduce figure width/height)
    viewportWidth: 1000,
    viewportHeight: 600,
    readyText: 'ctgA',
    settleMs: 3000,
    // two-stage: the top frame circles the track-selector icon in the LGV header
    // (circle the header "tracklist" icon, not the view menu); the
    // bottom frame opens that selector, rings the add-track FAB, and boxes the
    // menu it launches
    stages: [
      {
        actions: [{ type: 'delay', ms: 300 }],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: 'button[value="track_select"]' },
          },
        ],
      },
      {
        actions: [
          { type: 'click', selector: 'button[value="track_select"]' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="hierarchical_track_selector"]',
          },
          { type: 'delay', ms: 500 },
          // open the add-track FAB menu (show the menu the FAB
          // launches, not just a ring around the button)
          {
            type: 'click',
            selector: '[data-testid="hierarchical-add-track-fab"]',
          },
          { type: 'waitForText', text: 'Add track' },
          { type: 'delay', ms: 600 },
        ],
        annotations: [
          // a snug ring on the FAB (no arrow — the previous arrow cut
          // across the "Add track" box; the ring alone is clear enough)
          {
            type: 'circle',
            anchor: { selector: '[data-testid="hierarchical-add-track-fab"]' },
          },
          { type: 'box', anchor: { text: 'Add track' } },
        ],
      },
    ],
  },

  // Track menu: two-stage figure. Top frame opens the track selector and rings
  // both track-menu icons — the one on the LGV track label and the one on the
  // track-list entry. Bottom frame opens the track menu (from the LGV label)
  // with a box around it.
  {
    mode: 'url',
    name: 'track_menu',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_sv_test'],
    }),
    viewportWidth: 1200,
    // taller + wider browser so the opened track menu isn't clipped (reviewer)
    viewportHeight: 680,
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      // open the track selector so the track-list entry menu icon is visible
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Open track selector' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      // filter the (virtualized) list so the target row is rendered
      { type: 'type', text: 'Filter tracks', value: 'structural variant' },
      { type: 'delay', ms: 800 },
    ],
    stages: [
      {
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="track_menu_icon"]' },
          },
          {
            type: 'circle',
            anchor: {
              selector:
                '[data-testid="htsTrackEntryMenu-Tracks,volvox_sv_test"]',
            },
          },
          // the two rings alone mark the menu icons; the arrows from the empty
          // band below read as ambiguous, so they were dropped (reviewer)
        ],
      },
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          { type: 'waitForText', text: 'About track' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [{ type: 'box', anchor: { selector: 'ul[role="menu"]' } }],
      },
    ],
  },

  // Track label positioning submenu in the view menu, over volvox tracks. Uses
  // the light local volvox BAM; local data settles quickly so the
  // MUI cascade stays open through capture. The view menu (hamburger) icon is
  // ringed so the reader can see where the menu was opened from; the expanded
  // submenu is boxed.
  {
    mode: 'url',
    name: 'tracklabels',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      ...menuCascade(['Track labels', 'Overlapping']),
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { selector: '[data-testid="view_menu_icon"]' },
      },
      // box the Track labels parent item (its submenu expands to the right)
      { type: 'box', anchor: { text: 'Track labels' } },
    ],
  },

  // Track settings: two-stage figure — top frame opens the track menu's "Track
  // actions" → "Settings" path (boxed); bottom frame clicks it so the Settings
  // sidebar (ConfigurationEditor) is open. Uses volvox-bam instead of
  // the gff3 track. Any track's settings can now be edited directly
  // (a non-admin's edits are saved as a session override).
  {
    mode: 'url',
    name: 'edit_track_settings',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    // shorter browser in each stage
    viewportHeight: 640,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Track actions', 'Settings']),
        ],
        // box the "Track actions" parent submenu and the "Settings" item
        annotations: cascadeBoxes(['Track actions', 'Settings']),
      },
      {
        // click Settings so the ConfigurationEditor sidebar opens
        actions: [
          { type: 'click', text: 'Settings' },
          { type: 'waitForText', text: 'Filter options' },
          { type: 'delay', ms: 1000 },
        ],
        // box the settings widget (ConfigurationEditor drawer) that just opened
        annotations: [
          {
            type: 'box',
            anchor: { selector: '[data-testid="drawer-widget"]' },
          },
        ],
      },
    ],
  },

  // Drawer widget position, two-stage figure. Top frame opens the drawer's
  // position menu (MoreVert in the drawer header) with the menu trigger ringed
  // and the "left" option boxed; bottom frame clicks "left" so the drawer moves
  // to the left side of the screen.
  {
    mode: 'url',
    name: 'drawer_widget_toggle',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    readyText: 'ctgA',
    // smaller capture window in both dimensions
    viewportWidth: 1150,
    viewportHeight: 470,
    settleMs: 3000,
    actions: [
      // open the track selector to get a widget in the drawer
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Open track selector' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
    ],
    stages: [
      {
        actions: [
          // click the MoreVert to open the position menu
          { type: 'click', selector: '[data-testid="drawer-position-button"]' },
          { type: 'waitForText', text: 'left' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="drawer-position-button"]' },
          },
          { type: 'box', anchor: { text: 'left' } },
          // arrow drawing the eye from the ringed position button down to the
          // boxed "left" option. Head is nudged left of the word so it points at
          // the item without covering the "left" label text.
          {
            type: 'arrow',
            from: { x: 560, y: 230 },
            anchor: { text: 'left' },
            dx: -55,
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'left' },
          { type: 'delay', ms: 1500 },
        ],
        // ring the track selector now docked on the left so the reader sees
        // where the drawer moved to
        annotations: [
          {
            type: 'box',
            anchor: { selector: '[data-testid="drawer-widget"]' },
          },
        ],
      },
    ],
  },

  // Share session dialog, opened from the Share button in the app header.
  {
    mode: 'url',
    name: 'share_button',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram_alignments'],
    }),
    viewportWidth: 1000,
    viewportHeight: 550,
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="share-button"]' },
      { type: 'waitForText', text: 'Copy the URL below' },
      { type: 'waitForText', text: 'Generating', hidden: true },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Bookmark widget screenshots
  // ────────────────────────────────────────────────────────────────────────

  // Bookmark create, two-stage figure: top frame is the rubberband context menu
  // with "Bookmark region" boxed; bottom frame clicks it so the bookmarked
  // region appears as a colored highlight across the view. Uses config_demo hg19
  // over the PTEN gene with a shorter viewport.
  {
    mode: 'url',
    name: 'bookmark_widget_create',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr10:89,613,000-89,740,000',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    // shorter viewport so both stacked panels stay tight
    viewportHeight: 440,
    settleMs: 10000,
    actions: [
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Bookmark region' },
      { type: 'delay', ms: 500 },
    ],
    stages: [
      {
        annotations: [{ type: 'box', anchor: { text: 'Bookmark region' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Bookmark region' },
          { type: 'delay', ms: 1500 },
        ],
      },
    ],
  },

  // Bookmark widget with a bookmark label showing a highlight on the LGV, over
  // config_demo's hg19. Shorter viewport keeps the figure tight.
  {
    mode: 'url',
    name: 'bookmark_widget_edit_label',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr1:1-20,000',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 10000,
    viewportHeight: 520,
    actions: [
      // create a bookmark via rubberband
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Bookmark region' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Bookmark region' },
      { type: 'delay', ms: 500 },
      // open the bookmark widget
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      ...menuCascade(['Bookmarks/highlights', 'Open bookmark widget'], 300),
      { type: 'click', text: 'Open bookmark widget' },
      { type: 'waitForText', text: 'Add label...' },
      { type: 'delay', ms: 1000 },
      // single-click the "Add label..." cell to enter edit mode, then type
      { type: 'type', text: 'Add label...', value: 'my region' },
      { type: 'delay', ms: 1500 },
    ],
    // anchor to the "Label" column header in the bookmark widget (the edited
    // value lives in an <input>, which has no textContent to anchor to, so the
    // old anchor fell back to the top-left corner). The callout text is
    // left-aligned, so it's pulled well left of the right-side widget header and
    // width-clamped to keep it from running off the right edge
    // moved down + right and given an arrow pointing up at the "my region"
    // label input
    annotations: [
      {
        type: 'text',
        text: 'Single-click the label to edit it',
        anchor: { text: 'Bookmark link' },
        dx: -190,
        dy: 170,
        maxWidth: 230,
      },
      { type: 'arrow', from: { x: 1230, y: 275 }, to: { x: 1385, y: 168 } },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Track selector interactions
  // ────────────────────────────────────────────────────────────────────────

  // Track selector hamburger menu showing settings options.
  {
    mode: 'url',
    name: 'hierarchical/hierarchical_user_menu-fs8',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      // no track opened — the figure is about the track-selector hamburger
      // menu, and an open gene track in the LGV behind it was distracting
      tracks: [],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      // open the track selector directly via the header button so the LGV view
      // menu never opens (the view menu was left open in the capture)
      { type: 'click', selector: 'button[title="Open track selector"]' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      // open the hamburger menu, then open the Collapse... submenu so its
      // options are visible alongside the main menu
      { type: 'click', selector: '[data-testid="track-selector-hamburger"]' },
      ...menuCascade(['Collapse...', 'Collapse top-level categories']),
    ],
    annotations: [
      { type: 'box', anchor: { text: 'Collapse top-level categories' } },
      { type: 'box', anchor: { text: 'Collapse subcategories' } },
    ],
  },

  // Recently used tracks: two-stage figure. The session starts with no tracks
  // open; the shared actions open a track *through the track-selector UI* (click
  // its checkbox), which is what actually populates the recently-used list
  // (pre-opening tracks via the session does not). Top frame rings the
  // recently-used (clock) button; bottom frame opens its dropdown showing the
  // just-opened track.
  {
    mode: 'url',
    name: 'recent_tracks',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:1-100,000',
    }),
    // hg19 displays the refname as "1" (no chr prefix); wait for the menubar
    // instead of a chr label since this view starts with no tracks
    readyText: 'Open track selector',
    readyTimeout: 60000,
    // smaller window keeps the focus on the track-list + recently-used dropdown
    viewportWidth: 1100,
    viewportHeight: 600,
    settleMs: 8000,
    // single frame: open a track so it lands in "recently used", then open the
    // recently-used dropdown and highlight both the trigger icon and the popover
    // together (one stage with both the icon and the popover ringed)
    actions: [
      // open the track selector directly via the header button — with no tracks
      // active the view body also renders an "Open track selector" button, so a
      // text-based click is ambiguous; the header button's title is unique
      { type: 'click', selector: 'button[title="Open track selector"]' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      // filter the (virtualized) list so the target row is rendered, then open
      // it through the UI (by name) so it lands in "recently used"
      { type: 'type', text: 'Filter tracks', value: 'NCBI RefSeq' },
      { type: 'delay', ms: 800 },
      { type: 'click', text: 'NCBI RefSeq w/ top-level feature details' },
      { type: 'delay', ms: 1500 },
      // clear the filter (target the actual input, not the floating label, so
      // select-all + Backspace empties it) so the tracklist behind the dropdown
      // isn't showing distracting search text
      {
        type: 'type',
        selector: '[data-testid="hierarchical_track_selector"] input',
        value: '',
        clear: true,
      },
      { type: 'delay', ms: 800 },
      // open the recently-used dropdown so the popover is visible in-frame
      {
        type: 'click',
        selector: '[data-testid="recently-used-tracks-button"]',
      },
      { type: 'waitForText', text: 'NCBI RefSeq w/ top-level feature details' },
      { type: 'delay', ms: 500 },
    ],
    annotations: [
      // ring just the recently-used trigger icon; the popover box was removed
      {
        type: 'circle',
        anchor: { selector: '[data-testid="recently-used-tracks-button"]' },
      },
    ],
  },

  // Favorite tracks: two-stage figure. Top frame boxes the per-track menu's
  // "Add to favorites" item; bottom frame opens the resulting Favorites dropdown
  // with a ring around the Favorites (star) button.
  {
    mode: 'url',
    name: 'favorite_tracks',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_bam'],
    }),
    readyText: 'ctgA',
    viewportHeight: 560,
    settleMs: 4000,
    actions: [
      // open track selector
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      { type: 'waitForText', text: 'Open track selector' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      // filter the (virtualized) list so the target row is rendered
      { type: 'type', text: 'Filter tracks', value: 'volvox-sorted' },
      { type: 'delay', ms: 800 },
      // open the track's per-track menu (showing "Add to favorites")
      {
        type: 'click',
        selector: '[data-testid="htsTrackEntryMenu-Tracks,volvox_bam"]',
      },
      { type: 'waitForText', text: 'Add to favorites' },
      { type: 'delay', ms: 300 },
    ],
    stages: [
      {
        // ring the per-track moreVert menu trigger that was clicked, plus box
        // the "Add to favorites" item it opened
        annotations: [
          {
            type: 'circle',
            anchor: {
              selector: '[data-testid="htsTrackEntryMenu-Tracks,volvox_bam"]',
            },
          },
          { type: 'box', anchor: { text: 'Add to favorites' } },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Add to favorites' },
          { type: 'delay', ms: 500 },
          { type: 'click', selector: '[data-testid="favorite-tracks-button"]' },
          { type: 'waitForText', text: 'volvox-sorted.bam' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="favorite-tracks-button"]' },
          },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Plugin store
  // ────────────────────────────────────────────────────────────────────────

  // Plugin store, single frame: the plugin-store drawer widget open on the right
  // AND the Tools menu reopened over the view, with the "Plugin store" menu item
  // ringed and an arrow pointing across to the open widget sidebar (reviewer:
  // collapse the old two-stage figure into one that shows the menu path and the
  // result together). The ring anchors to the menu item (smaller text area than
  // the widget's h5 heading, so the smallest-area anchor heuristic picks it).
  {
    mode: 'url',
    name: 'plugin_store',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Plugin store' },
      { type: 'delay', ms: 400 },
      // open the widget (this closes the Tools menu)
      { type: 'click', text: 'Plugin store' },
      { type: 'waitForText', text: 'Installed plugins' },
      { type: 'delay', ms: 1500 },
      // reopen the Tools menu so the menu path and the open widget show together
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Plugin store' },
      { type: 'delay', ms: 600 },
    ],
    // ring the "Tools" top-level menu, box the "Plugin store" menu item, and box
    // the opened Plugin store widget itself (anchored to its "Installed plugins"
    // heading) — reviewer asked to also highlight Tools + the widget
    annotations: [
      // tight round ring nudged down so it isn't clipped at the top edge into an
      // oval (make the Tools ring more square/round)
      { type: 'circle', anchor: { text: 'Tools' }, radius: 24, dy: 8 },
      { type: 'box', anchor: { text: 'Plugin store' } },
      { type: 'box', anchor: { text: 'Installed plugins' } },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Previously hand-captured UI-guide figures, now autogenerated
  // ────────────────────────────────────────────────────────────────────────

  // LGV assembly/sequence import form (quickstart_web.md) — a linear genome view
  // with an assembly but no region opens on the assembly + sequence selectors.
  {
    mode: 'url',
    name: 'lgv_assembly',
    url: sessionSpec(VOLVOX, { views: [] }),
    readyText: 'Select a view to launch',
    // smaller window keeps the focus on the compact import form
    viewportWidth: 900,
    viewportHeight: 560,
    settleMs: 2000,
    actions: [
      { type: 'click', text: 'Launch view' },
      { type: 'waitForText', text: 'Select assembly to view' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // Assembly manager dialog (quickstart_adminserver.md) opened from the Tools
  // menu over config_demo, whose hg19/hg38/hs1 human assemblies populate the
  // table. The Assembly manager menu item is not admin-gated, so this is
  // reproducible headless without an admin server.
  {
    mode: 'url',
    name: 'add_hg38_assembly',
    url: sessionSpec(DEMO_CONFIG, { views: [] }),
    readyText: 'Select a view to launch',
    settleMs: 2000,
    actions: [
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Assembly manager' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Assembly manager' },
      { type: 'waitForText', text: 'Add new assembly' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // Sample-configuration start state (quickstart_web.md) — volvox loaded with the
  // track selector open so the available tracks are visible.
  {
    mode: 'url',
    name: 'sample_config',
    url: sessionSpec(VOLVOX, {
      views: [
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-50000' },
      ],
    }),
    viewportWidth: 1000,
    viewportHeight: 600,
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Track selector with all top-level categories collapsed (track_selector.md) —
  // driven through the hamburger menu's "Collapse..." submenu instead of a
  // config so it stays on plain volvox.
  {
    mode: 'url',
    name: 'hierarchical/collapse_toplevelcategories-fs8',
    url: sessionSpec(VOLVOX, {
      views: [
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-50000' },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      { type: 'click', selector: '[data-testid="track-selector-hamburger"]' },
      ...menuCascade(['Collapse...', 'Collapse top-level categories'], 300),
      { type: 'click', text: 'Collapse top-level categories' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Track selector with all sub-categories collapsed (track_selector.md) — the
  // top-level categories stay open but their nested subcategory headers collapse.
  {
    mode: 'url',
    name: 'hierarchical/collapse_subcategories-fs8',
    url: sessionSpec(VOLVOX, {
      views: [
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-50000' },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    actions: [
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 500 },
      { type: 'click', selector: '[data-testid="track-selector-hamburger"]' },
      ...menuCascade(['Collapse...', 'Collapse subcategories'], 300),
      { type: 'click', text: 'Collapse subcategories' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Default UI theme (theme.md) — a small volvox config with the track selector
  // open so the default primary/secondary/tertiary/quaternary palette is shown.
  {
    mode: 'url',
    name: 'default_theme',
    url: sessionSpec('test_data/volvox/config_theme_default.json', {
      views: [
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-50000' },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    // shorter browser: the palette + track selector fit comfortably
    viewportHeight: 520,
    actions: [
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 1000 },
    ],
  },

  // Customized UI theme (theme.md) — same config carrying the documented custom
  // palette (#311b92 / #0097a7 / #f57c00 / #d50000) via configuration.theme.
  {
    mode: 'url',
    name: 'customized_theme',
    url: sessionSpec('test_data/volvox/config_theme_custom.json', {
      views: [
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-50000' },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    // shorter browser: the palette + track selector fit comfortably
    viewportHeight: 520,
    actions: [
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      { type: 'delay', ms: 1000 },
    ],
  },
  // ────────────────────────────────────────────────────────────────────────
  // Admin-mode screenshots (quickstart_adminserver.md). Admin mode is enabled
  // purely by the &adminKey= URL param (adminMode = !!adminKey, client-side), so
  // these reproduce the admin-server's UI without a running admin-server backend
  // — the dialogs render the same; only persisting writes needs the real server.
  // ────────────────────────────────────────────────────────────────────────

  // Empty assembly manager: a fresh install (empty.json has no assemblies) in
  // admin mode, Tools -> Assembly manager opened to its empty table. sessionSpec
  // gives a static sessionName so the title bar carries no live timestamp.
  {
    mode: 'url',
    name: 'assembly_manager',
    url: `${sessionSpec('test_data/empty.json', { views: [] })}&adminKey=admin1234`,
    readyText: 'Tools',
    viewportWidth: 1000,
    viewportHeight: 540,
    settleMs: 2000,
    hideTooltip: true,
    actions: [
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Assembly manager' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Assembly manager' },
      { type: 'waitForText', text: 'Add new assembly' },
      { type: 'delay', ms: 500 },
    ],
  },

  // Assembly manager with one assembly present: a config carrying only hg38 in
  // admin mode, so the manager table lists the hg38 row (the state after adding
  // an assembly in the tutorial).
  {
    mode: 'url',
    name: 'hg38_assembly_table',
    url: `${sessionSpec('test_data/hg38_only.json', { views: [] })}&adminKey=admin1234`,
    readyText: 'Tools',
    viewportWidth: 1000,
    viewportHeight: 540,
    settleMs: 2000,
    hideTooltip: true,
    actions: [
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Assembly manager' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Assembly manager' },
      { type: 'waitForText', text: 'Add new assembly' },
      { type: 'delay', ms: 500 },
    ],
  },

  // Set-default-session dialog: admin mode, Admin -> Set default session. The
  // dialog is a simple confirm ("Set current session as default" / "Clear
  // default session"); persisting the choice needs the real admin-server.
  // Two-stage figure (show what to click to open it): stage 1 boxes the
  // "Admin" menu button that reveals the option (the menu only appears in
  // admin mode); stage 2 is the resulting dialog.
  {
    mode: 'url',
    name: 'default_session_form',
    url: `${sessionSpec('test_data/empty.json', { views: [] })}&adminKey=admin1234`,
    readyText: 'Tools',
    viewportWidth: 1000,
    viewportHeight: 480,
    settleMs: 2000,
    hideTooltip: true,
    stages: [
      {
        actions: [
          { type: 'click', text: 'Admin' },
          { type: 'waitForText', text: 'Set default session' },
          { type: 'delay', ms: 300 },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Admin' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Set default session' },
          { type: 'waitForText', text: 'Clear default session' },
          { type: 'delay', ms: 500 },
        ],
      },
    ],
  },

  // Fresh-install landing: with no config and the default config.json missing,
  // jbrowse-web shows the "It worked! JBrowse 2 is installed" banner plus a list
  // of sample configs — what a user sees right after `jbrowse create` + serve.
  {
    mode: 'url',
    name: 'config_not_found',
    url: '',
    readyText: 'It worked!',
    viewportWidth: 1200,
    viewportHeight: 720,
    settleMs: 1500,
    // subject IS the missing-config landing page: the absent config.json 404s
    expectedConsole: [
      'HTTP 404 fetching config.json',
      'Failed to load resource',
    ],
    // subject IS the missing-config landing page
    allowUnsettled: true,
  },

  {
    mode: 'url',
    name: 'chromhmm',
    // Roadmap 127-epigenome ChromHMM chromatin states as a multi-row feature
    // heatmap over a ~900kb window on chr11, with the RefSeq gene track above
    // for context. Rebuilt from the old server-side share link as a
    // self-contained sessionSpec so the figure and its gallery live link come
    // from this one spec.
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr11:5,875,140-6,784,158',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          // descriptions add noise on the context gene track; names suffice here
          type: 'LinearBasicDisplay',
          showDescriptions: false,
        },
        {
          trackId: 'roadmap_chromhmm_multirow_hg19',
          type: 'LinearMultiRowFeatureDisplay',
          height: 480,
        },
      ],
    }),
    readyText: 'ChromHMM',
    readyTimeout: 60000,
    settleMs: 8000,
    viewportHeight: 700,
  },
]
