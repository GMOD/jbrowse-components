import {
  DEMO_CONFIG,
  PROTEIN3D_CONFIG,
  PTEN_RNASEQ_ADAPTER,
  VOLVOX,
  cascadeBoxes,
  dismissMenus,
  lgvSession,
  menuCascade,
  openFeatureHeightSubmenu,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const featuresSpecs: ScreenshotSpec[] = [
  {
    // Single frame showing the session-wide feature-height default on alignments
    // tracks. featureHeight/featureSpacing are promotable slots (getConfResolved:
    // track value → session default → schema default). We set the first track to
    // Compact and enable "Use ... as the default for alignments tracks", which
    // promotes Compact to a session default; the second (un-pinned) track follows
    // via inherit. The "Set feature height" submenu is left open with the now-
    // checked default toggle boxed.
    mode: 'url',
    name: 'feature_height_default_pin',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1..8,000',
      tracks: [
        'volvox_alignments_pileup_coverage',
        'volvox_cram_alignments_ctga',
      ],
    }),
    readyText: 'ctgA',
    viewportWidth: 1100,
    viewportHeight: 700,
    // alignments pileups keep re-laying-out while reads stream in; wait long
    // enough that the menu geometry is stable before the hover/click sequence
    settleMs: 14000,
    hideTooltip: true,
    // set the first track to Compact, then enable "Use current height by default
    // on all alignments tracks" — the second (un-pinned) track follows via
    // inherit. Re-open the submenu so the now-checked default toggle (the item
    // actually clicked) is visible and boxed.
    actions: [
      trackMenuIcon('volvox_alignments_pileup_coverage'),
      ...openFeatureHeightSubmenu(),
      // exact-text match so "Compact" hits the radio, not a longer label
      {
        type: 'click',
        selector:
          '::-p-xpath(//li[@role="menuitem"][normalize-space(.)="Compact"])',
      },
      { type: 'delay', ms: 300 },
      ...dismissMenus(),
      trackMenuIcon('volvox_alignments_pileup_coverage'),
      ...openFeatureHeightSubmenu(),
      { type: 'click', text: 'as the default for alignments tracks' },
      { type: 'delay', ms: 600 },
      ...dismissMenus(),
      // re-open to display the checkbox now ticked, kept on screen for capture
      trackMenuIcon('volvox_alignments_pileup_coverage'),
      ...openFeatureHeightSubmenu(),
    ],
    annotations: [
      {
        type: 'box',
        anchor: { text: 'as the default for alignments tracks' },
        strokeWidth: 3,
        fillOpacity: 0.12,
      },
      {
        type: 'text',
        x: 620,
        y: 34,
        maxWidth: 440,
        fontSize: 15,
        text: '"Use ... as the default for alignments tracks" promotes the chosen height to a session default — every un-pinned track follows',
      },
    ],
  },

  // About track dialog (config + file header), opened from the track menu of a
  // CRAM track so the FILE INFO panel shows the full @SQ/@PG header.
  {
    mode: 'url',
    name: 'about_track',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_cram'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'About track' },
      { type: 'waitForText', text: 'AlignmentsTrack' },
      { type: 'delay', ms: 1500 },
    ],
  },

  // Color-by-CDS frame coloring on a gene track: human BRCA1 (hg19 NCBI RefSeq)
  // zoomed to base-pair resolution with the reference sequence track above
  // . Two stages mirror the how-to: stage 1 opens the view menu with
  // "Color by CDS and draw amino acids" boxed; stage 2 clicks it, so each CDS
  // codon is tinted by its reading frame with the amino acid drawn over it,
  // lined up to the reference codons above.
  {
    mode: 'url',
    name: 'gene_track_color_by_cds',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr17:41,244,000-41,244,120',
      // offset labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        'Pd8Wh30ei9R',
        {
          trackId: 'ncbi_gff_hg19',
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            geneGlyphMode: 'longestCoding',
          },
        },
      ],
    }),
    readyText: 'RefSeq',
    readyTimeout: 60000,
    viewportHeight: 600,
    stages: [
      {
        // top frame: the view (hamburger) menu open, the color-by-CDS toggle
        // ringed + boxed so the one click that enables it reads at a glance
        actions: [
          { type: 'click', selector: '[data-testid="view_menu_icon"]' },
          ...menuCascade(['Color by CDS and draw amino acids']),
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="view_menu_icon"]' },
          },
          ...cascadeBoxes(['Color by CDS and draw amino acids']),
        ],
      },
      {
        // bottom frame: after the click each codon is frame-tinted with its
        // amino acid drawn over it, aligned to the reference sequence above
        actions: [
          { type: 'click', text: 'Color by CDS and draw amino acids' },
          { type: 'delay', ms: 5000 },
        ],
      },
    ],
  },

  // Selenoprotein transl_except highlight: GPX1 (hg19 NCBI RefSeq, chr3, minus
  // strand) has one in-frame UGA recoded as selenocysteine via a downstream
  // SECIS element, written as
  // `transl_except=(pos:complement(49395565..49395567),aa:Sec)`. Zoomed to that
  // codon with peptide lettering on, the overridden residue is drawn as `U` on an
  // orange codon background (translExceptColor) instead of the stop it would
  // otherwise be. Exercises parseTranslExcept's handling of NCBI's
  // complement()/accession-prefixed pos syntax on real data.
  {
    mode: 'url',
    name: 'gene_track_selenocysteine',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr3:49,395,505-49,395,625',
      colorByCDS: true,
      trackLabels: 'offset',
      tracks: [
        'Pd8Wh30ei9R',
        {
          trackId: 'ncbi_gff_hg19',
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            geneGlyphMode: 'longestCoding',
          },
        },
      ],
    }),
    readyText: 'RefSeq',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportHeight: 500,
  },

  // Viral polyprotein: the enterovirus D ORF1 CDS is cleaved into mature
  // peptides (mature_protein_region_of_CDS). They render as stacked rows, each
  // colored from a distinct palette and individually hoverable; the labels.name
  // config in the track surfaces each region's GFF `product` (VP1, 2A, 3C, …).
  // subfeatureLabels:'overlay' draws each product name on its peptide bar (the
  // matureProteinRegion glyph now emits floating labels like the transcript
  // glyph does).
  {
    mode: 'url',
    name: 'gene_track_mature_peptides',
    url: lgvSession('test_data/enterovirus_d/config.json', {
      assembly: 'GCF_000861205.1',
      loc: 'NC_001430.1:727-7,311',
      // offset labels so they overlay the tracks
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'ncbi_genes_enterovirus_d',
          // tall enough for the gene row + all 12 stacked mature peptides
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            height: 220,
            subfeatureLabels: 'overlay',
          },
        },
      ],
    }),
    readyText: 'NCBI genes',
    readyTimeout: 30000,
    settleMs: 4000,
    viewportHeight: 360,
  },

  // Collapse introns + RNA-seq sashimi: PTEN (hg38) with the MANE transcript
  // and a direct-RNA nanopore track. Right-clicking the gene and choosing
  // "Collapse introns" reshapes the view to the exons placed side by side; the
  // sashimi arcs from the RNA-seq splice junctions then connect adjacent exons.
  {
    mode: 'url',
    name: 'gene_track_collapse_introns',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'pten_directrna',
          name: 'NA12878 direct-RNA (PTEN)',
          assemblyNames: ['hg38'],
          adapter: PTEN_RNASEQ_ADAPTER,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr10:87,863,113-87,971,930',
          // offset labels so they overlay the tracks
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              // one clean transcript per gene so the PTEN glyph + label is tidy.
              // The collapse-introns dialog's "Show only this feature" (on by
              // default) isolates the reshaped view to PTEN, dropping the
              // neighboring KLLN fragment — no jexl filter needed.
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                geneGlyphMode: 'longestCoding',
              },
            },
            {
              // PTEN-only sliced RNA-seq BAM (see PTEN_RNASEQ_ADAPTER): a tiny
              // deterministic download, so the sashimi arcs are reliably present
              // at capture. compact pileup so the reads pack tightly
              trackId: 'pten_directrna',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                featureHeight: 3,
                featureSpacing: 0,
              },
            },
          ],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    settleMs: 6000,
    viewportHeight: 600,
    hideTooltip: true,
    actions: [
      // `readyText: 'NCBI RefSeq'` matches the track *name*, which appears before
      // the remote GFF finishes loading — so wait for the PTEN label itself to
      // render before acting on it.
      { type: 'waitForText', text: 'PTEN' },
      // right-click the gene's floating-label DOM element (not a raw pixel) —
      // robust and exercises the label's real context-menu affordance
      { type: 'rightclick', text: 'PTEN' },
      { type: 'waitForText', text: 'Collapse introns' },
      { type: 'delay', ms: 600 },
      { type: 'click', text: 'Collapse introns' },
      { type: 'waitForText', text: 'Replace current view' },
      { type: 'delay', ms: 600 },
      { type: 'click', text: 'Replace current view' },
      { type: 'waitForText', text: 'Replace current view', hidden: true },
      // let the reshaped view kick off its refetch, then wait for the (now tiny,
      // sliced) RNA BAM to load so the sashimi arcs are present in the capture
      { type: 'delay', ms: 2000 },
      {
        type: 'waitForSelector',
        selector: '[data-testid="loading-overlay"]',
        hidden: true,
      },
      { type: 'delay', ms: 3000 },
    ],
  },
  // Gene feature-details sequence panel on a human gene (reviewer asked for a
  // human example over the volvox EDEN one + a demo of the transl_except
  // functionality, split below into feature_detail_protein). SELENOP
  // (selenoprotein P, chr5, minus strand) is used for both: here the type
  // selector is set to "Genomic w/ full introns +/-" so the panel shows the
  // upstream flank, exons/introns, UTR, and downstream flank color-coded.
  //
  // Uses config_demo's hg38 + ncbi_refseq_109_hg38_latest (labels by gene
  // symbol and exposes real CDS subfeatures, unlike the hg19 ncbi_gff / Gencode
  // tracks the earlier FAF1 attempt tried). geneGlyphMode 'longestCoding' draws a
  // single transcript so the coordinate click lands unambiguously on the MANE
  // mRNA row (canvas-drawn glyphs have no DOM label to target by text).
  {
    mode: 'url',
    name: 'feature_detail_sequence',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr5:42,799,000-42,812,500',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            geneGlyphMode: 'longestCoding',
            height: 200,
          },
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    settleMs: 8000,
    viewportHeight: 900,
    actions: [
      // Coordinate click on the single MANE transcript row (canvas glyph, no DOM
      // label) — lands on a CDS exon of the SELENOP transcript line, below the
      // CCDC152 neighbor gene above it.
      { type: 'click', from: { x: 637, y: 211 } },
      { type: 'waitForText', text: 'Show feature sequence' },
      { type: 'delay', ms: 1000 },
      { type: 'click', text: 'Show feature sequence' },
      { type: 'delay', ms: 2000 },
      { type: 'click', selector: '[aria-label="Sequence type"]' },
      { type: 'delay', ms: 1000 },
      // partial (collapsed) introns keep 10bp of each intron so the exon
      // structure reads without huge intronic runs dominating the sequence.
      // exact xpath so it doesn't also match the "+/- up+down stream" variant
      {
        type: 'click',
        selector: '[data-testid="sequence_type_gene_collapsed_intron"]',
      },
      { type: 'delay', ms: 3000 },
    ],
  },

  // Protein translation of SELENOP showing translation exceptions: the ten
  // in-frame UGA stop codons that NCBI RefSeq annotates as
  // `transl_except=(...,aa:Sec)` translate to selenocysteine (U), highlighted
  // amber in the peptide with a legend noting "10 selenocysteines (U) from
  // transl_except". Same setup/transcript click as feature_detail_sequence; only
  // the type selector differs (Protein).
  {
    mode: 'url',
    name: 'feature_detail_protein',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr5:42,799,000-42,812,500',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            geneGlyphMode: 'longestCoding',
            height: 200,
          },
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 90000,
    settleMs: 8000,
    viewportHeight: 900,
    actions: [
      { type: 'click', from: { x: 637, y: 211 } },
      { type: 'waitForText', text: 'Show feature sequence' },
      { type: 'delay', ms: 1000 },
      { type: 'click', text: 'Show feature sequence' },
      { type: 'delay', ms: 2000 },
      { type: 'click', selector: '[aria-label="Sequence type"]' },
      { type: 'delay', ms: 1000 },
      { type: 'click', text: 'Protein' },
      { type: 'delay', ms: 3000 },
    ],
  },

  // Customized feature details (customizing_feature_details.md) — volvox's
  // gff3tabix_genes track config carries a formatDetails JEXL callback that links
  // the name to a Google search, adds a custom "extrafield", and drops the type
  // field; clicking a gene shows the resulting panel.
  {
    mode: 'url',
    name: 'customized_feature_details',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:17200-23200',
      tracks: [
        { trackId: 'gff3tabix_genes', displaySnapshot: { height: 300 } },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    // shorter browser; the details panel scrolls so this only trims
    // empty space below the ringed hyperlink
    viewportHeight: 680,
    actions: [
      // canvas-drawn gene glyph: at this zoom the label is baked into the canvas
      // (no DOM text / overlay div to target), so a coordinate click is required
      { type: 'click', from: { x: 430, y: 314 } },
      { type: 'waitForText', text: 'extrafield' },
      { type: 'delay', ms: 2000 },
    ],
    // ring the formatDetails-generated hyperlink in the feature-details panel,
    // with the explanatory text above it. The previous arrow landed its head on
    // the link itself, covering the link text — the ring alone identifies it.
    annotations: [
      {
        type: 'circle',
        anchor: { selector: 'a[href^="https://google.com/?q="]' },
      },
      {
        type: 'text',
        x: 700,
        y: 150,
        text: 'The callback turns the name into a clickable link',
        // white-on-dark pill to match the other annotated figures
        background: 'rgba(0,0,0,0.78)',
        textColor: '#fff',
      },
    ],
  },

  // Feature-details upstream/downstream sequence panel (v1.1.0 blog post) — the
  // multi-exon volvox EDEN gene with "Show feature sequence" expanded into the
  // genomic-with-introns + up/down-stream mode so the colored upstream / exon /
  // intron / downstream sequence is shown.
  {
    mode: 'url',
    name: 'upstream_downstream_details',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:17200-23200',
      tracks: [
        { trackId: 'gff3tabix_genes', displaySnapshot: { height: 300 } },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    viewportHeight: 900,
    actions: [
      { type: 'click', from: { x: 430, y: 314 } },
      { type: 'waitForText', text: 'Show feature sequence' },
      { type: 'delay', ms: 1000 },
      { type: 'click', text: 'Show feature sequence' },
      { type: 'delay', ms: 2000 },
      { type: 'click', selector: '[aria-label="Sequence type"]' },
      { type: 'delay', ms: 1000 },
      {
        type: 'click',
        text: 'Genomic w/ full introns +/- 100bp up+down stream',
      },
      { type: 'delay', ms: 3000 },
    ],
  },

  // Cytoband ideogram in the overview scale bar (v1.5.1 blog post) — hg19 from
  // the demo config (which carries a cytobands adapter) zoomed to a chr1 region.
  {
    mode: 'url',
    name: 'cytobands',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:38,543,322-41,918,323',
      tracks: ['ncbi_gff_hg19'],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 12000,
  },

  // Connected genome + protein demo (TP53 / UniProt P04637). A single ProteinView
  // spec entry creates and connects its own LinearGenomeView via the plugin's
  // `connectedView` launch param, so the genome (NCBI RefSeq + ClinVar) and the
  // AlphaFold structure load linked. This uses the short-form declarative launch:
  // from just `uniprotId` + `transcriptId` the plugin derives the AlphaFold
  // structure URL, resolves the transcript feature from the hg38-ncbiRefSeq track
  // at `loc`, and translates its CDS to the protein sequence it aligns to the
  // structure. Loads protein3d pinned to a published jsDelivr version
  // (PROTEIN3D_CONFIG) against the local build, whose session has the
  // setPendingMove split API the side-by-side launch needs.
  {
    mode: 'url',
    name: 'protein/connected',
    url: `?config=${PROTEIN3D_CONFIG}&session=${encodeURIComponent(
      `spec-${JSON.stringify({
        views: [
          {
            type: 'ProteinView',
            uniprotId: 'P04637',
            transcriptId: 'NM_000546.6',
            height: 540,
            // place the protein view to the right of its connected genome view
            // (left genome | right protein) via the workspaces split layout
            sideBySide: true,
            // keep the connected genome at the gene-wide view when a domain is
            // clicked so the domain shows as a highlighted sub-region
            zoomToBaseLevel: false,
            connectedView: {
              assembly: 'hg38',
              loc: 'chr17:7,668,421-7,687,550',
              tracks: ['hg38-ncbiRefSeq', 'clinvar_ncbi_hg38'],
            },
          },
        ],
      })}`,
    )}`,
    // Waits for both the structure load and the genome↔structure pairwise
    // alignment to settle (this view has a connected transcript, so the test-id
    // only flips once the alignment is computed). settleMs is the molstar raster
    // paint beat at deviceScaleFactor 2, which can lag the model state a frame.
    readySelector: '[data-testid="protein-view-ready"]',
    readyTimeout: 90000,
    settleMs: 6000,
    // the molstar 3D structure canvas only rasterizes cleanly (cartoon detail +
    // the magenta motif selection highlight) under headless Firefox; headless
    // Chrome's swiftshader renders it as a featureless blob, which is needed on mac only
    // firefox: true,

    // Click the TP53 nuclear export signal (UniProt "Motif" 339-350) on the
    // protein feature track to drive the genome↔structure cross-highlight: the
    // motif residues select in the 3D structure (molstar) and a highlight band
    // is drawn over the connected LGV (NCBI RefSeq + ClinVar) at the mapped
    // genome region. The Motif track is used here rather than the Region track:
    // Region features (e.g. the 325-356 tetramerization region used previously)
    // are long and overlap each other, whereas the five UniProt motifs are
    // short and non-overlapping, so the clicked feature and its highlight read
    // cleanly. Feature bars expose data-testid (protein3d ≥ v0.4.14), but
    // "Motif" is shared by all five motifs, so data-feature-start disambiguates
    // this one (12 residues, well within the alignment track's 649px
    // horizontally-scrollable viewport). `scroll` centers the target in its
    // scrollable ancestor before the click, since the motif starts past residue
    // ~115, off the default-scrolled viewport.
    actions: [
      {
        type: 'waitForSelector',
        selector:
          '[data-testid="protein-feature-Motif"][data-feature-start="339"]',
      },
      {
        type: 'scroll',
        selector:
          '[data-testid="protein-feature-Motif"][data-feature-start="339"]',
      },
      {
        type: 'click',
        selector:
          '[data-testid="protein-feature-Motif"][data-feature-start="339"]',
      },
      { type: 'delay', ms: 6000 },
    ],
  },
]
