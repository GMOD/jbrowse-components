import {
  DEMO_CONFIG,
  HG38_GENCODE_PROMOTER_TRACK,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const gallerySpecs: ScreenshotSpec[] = [
  // Gallery card for the copy-number clustering figure: only the clustered
  // RESULT (the "second panel" of multiwig/cluster_dialog), captured standalone
  // — same session + region, run clustering, no dialog left open. The docs guide
  // keeps the stacked before/after multiwig/cluster_dialog; the gallery card just
  // wants the payoff frame.
  {
    mode: 'url',
    name: 'gallery/copynumber_clustered',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr3:162,275,163-163,360,944',
      tracks: [
        {
          trackId: 'pur_copynumber_1000g',
          displaySnapshot: {
            type: 'MultiLinearWiggleDisplay',
            height: 420,
            defaultRendering: 'multirowdensity',
            showTree: false,
          },
        },
      ],
    }),
    readyText: 'PUR',
    readySelector: '[data-testid="multi-wiggle-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 620,
    settleMs: 15000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      { type: 'waitForText', text: 'Clustering' },
      { type: 'hover', text: 'Clustering' },
      { type: 'waitForText', text: 'Cluster rows by score...' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Cluster rows by score...' },
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'delay', ms: 500 },
      { type: 'click', text: 'Run clustering' },
      { type: 'waitForText', text: 'Run clustering', hidden: true },
      { type: 'delay', ms: 7000 },
    ],
  },

  // Extra gallery cards (website/src/lib/gallery.ts): compact local-test-data
  // views promoted from link-only entries to screenshots. Local data so they
  // render deterministically in the generator.
  {
    mode: 'url',
    name: 'gallery/human_mito',
    // Zoomed to MT-ND3 rather than the whole-genome overview (reviewer:
    // uninteresting at full width) — ND3 is the shortest human mitochondrial
    // protein-coding gene and, like five other mt-genes, its stop codon is
    // just "T--" in the genome; polyadenylation of the mRNA completes it to
    // TAA (annotated as a `transl_except` on the CDS, in the Note field).
    url: lgvSession('test_data/human_mito/config.json', {
      assembly: 'human_mito',
      loc: 'NC_012920.1:9,950-10,550',
      colorByCDS: true,
      tracks: ['ncbi_genes_human_mito'],
    }),
    readyText: 'ND3',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportHeight: 420,
  },
  // Remaining gallery cards promoted from link-only /gallery/ entries. Each
  // `url` is the exact session that gallery.ts opened as a live link, so the
  // figure and the link stay identical; the loading-overlay + display-done
  // waits gate readiness, so no readyText is needed.
  {
    mode: 'url',
    name: 'gallery/sarscov2_polyprotein',
    url: '?config=test_data%2Fsars-cov2%2Fconfig.json&session=spec-{"views":[{"assembly":"Wuhan-Hu-1","loc":"NC_045512.2:266-21555","type":"LinearGenomeView","colorByCDS":true,"tracks":[{"trackId":"ncbi_genes_with_mature_peptides","displaySnapshot":{"type":"LinearBasicDisplay","subfeatureLabels":"below"}}]}]}',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportHeight: 600,
  },
  {
    mode: 'url',
    name: 'gallery/fiberseq_gapdh',
    // ONT HG002 fiber-seq (6mA), enzyme-treated flowcell PAY22766, over the
    // GAPDH promoter. Verified ~50 reads deep with a dense 6mA peak (~20% mean,
    // 100% max) at the TSS vs ~2% background. Data:
    // https://epi2me.nanoporetech.com/chromatin-acc-hg002/
    // Reviewer: add a promoter track, an orthogonal accessibility assay to
    // corroborate the 6mA nucleosome-depletion signal, compact mode on the
    // alignments (deep pileup), and a legend for the modification-type swatches.
    // catlas single-cell ATAC (16 cell types) gives that orthogonal signal —
    // GAPDH is a housekeeping gene, so its promoter should read open broadly
    // across cell types, unlike the cell-type-restricted INS example in
    // gallery/scatac_catlas.
    url: sessionSpec('test_data/config_demo.json', {
      sessionTracks: [HG38_GENCODE_PROMOTER_TRACK],
      views: [
        {
          assembly: 'hg38',
          // zoomed out a bit so the promoter/TSS peak reads in gene context
          loc: '12:6530000-6539000',
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                geneGlyphMode: 'longestCoding',
              },
            },
            {
              trackId: 'gencode_promoter_hg38_ucsc',
              // single-row promoter windows — a short lane is plenty
              displaySnapshot: { type: 'LinearBasicDisplay', height: 50 },
            },
            {
              trackId: 'catlas_scatac_celltypes_hg38',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                height: 150,
              },
            },
            {
              trackId: 'PAY22766-nanopore',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                // fiber-seq is a 6mA (code 'a') assay — hide the incidental 5mC
                // ('m') / 5hmC ('h') calls so the legend shows only 6mA
                colorBy: {
                  type: 'modifications',
                  modifications: { hiddenModifications: ['m', 'h'] },
                },
                displayMode: 'compact',
                showLegend: true,
              },
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 900,
  },
  {
    mode: 'url',
    name: 'gallery/directrna_actb',
    // ACTB gene body — a short, highly expressed housekeeping gene, so the
    // pileup is deep but the whole gene fits on screen (BRCA1 was too long and
    // isoform-dense to read). colorBy modifications draws the per-base RNA
    // modification calls. userByteSizeLimit lifts the default alignments byte cap
    // so the reads auto-load instead of showing a "too much data" banner.
    //
    // Reviewer: too many chaotic sashimi arcs, no gene track for context.
    // Added the NCBI RefSeq track above the pileup, dropped the arc clutter
    // with minSashimiScore (hides junctions with few supporting reads), and
    // switched to the "super-compact" featureHeight/featureSpacing preset so
    // more of the deep pileup fits before hitting the layout height cap.
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: '7:5525000-5532500',
      tracks: [
        'ncbi_refseq_109_hg38_latest',
        {
          trackId:
            'NA12878-DirectRNA.pass.dedup.NoU.fastq.hg38.minimap2.sorted',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            colorBy: { type: 'modifications' },
            userByteSizeLimit: 100000000,
            minSashimiScore: 5,
            featureHeight: 1,
            featureSpacing: 0,
          },
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 35000,
    viewportHeight: 520,
  },
  {
    mode: 'url',
    name: 'gallery/hg002_dipcall',
    // chr1:18.0Mb is mid-contig for both haplotype assemblies (one BAM record
    // each, so one row each — 16.9Mb sat on a hap2 contig boundary that split
    // the maternal haplotype into two rows). Here both rows carry mismatches:
    // homozygous calls differ from the reference on both haplotypes, and a few
    // het calls appear on one row only, showing where the two assemblies differ.
    // Short per-track height keeps the single-row tracks compact (coverage off).
    url: '?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"1:18000000-18020000","type":"LinearGenomeView","trackLabels":"offset","tracks":["hg002_dipcall_dip_vcf_t2t",{"trackId":"hg002_dipcall_hap1_t2t","displaySnapshot":{"type":"LinearAlignmentsDisplay","height":80}},{"trackId":"hg002_dipcall_hap2_t2t","displaySnapshot":{"type":"LinearAlignmentsDisplay","height":80}}]}]}',
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 500,
  },
  {
    mode: 'url',
    name: 'gallery/scatac_catlas',
    // INS (insulin) promoter — a beta-cell-restricted accessibility peak, with
    // Alpha (glucagon) and the other 14 cell types in this atlas subset showing
    // little to no signal at the same locus. Shorter display height (was the
    // 500px config default) so the 16 rows read as a compact panel.
    url: sessionSpec('test_data/config_demo.json', {
      views: [
        {
          assembly: 'hg38',
          loc: 'chr11:2,158,000-2,163,000',
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'catlas_scatac_celltypes_hg38',
              displaySnapshot: {
                type: 'MultiLinearWiggleDisplay',
                height: 320,
              },
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 500,
  },
  {
    mode: 'url',
    name: 'gallery/nanopore_methylation',
    url: '?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"20:18,503,000-18,509,000","type":"LinearGenomeView","tracks":["cpgisland_ucsc_hg38",{"trackId":"human_chr20_mod_call_5mC_5hmC_CG_cram","displaySnapshot":{"type":"LinearAlignmentsDisplay","colorBy":{"type":"methylation"}}}]}]}',
    readyTimeout: 90000,
    settleMs: 15000,
    viewportHeight: 600,
  },
  // Bare-config gallery cards: each opens the config's own defaultSession (no
  // session spec), the same view the /gallery/ link opens.
  {
    mode: 'url',
    name: 'gallery/gwas_bmi_fto',
    // taller crop so the FTO gene track below the Manhattan plot is visible (the
    // GWAS peak sits over an FTO intron — the point of the figure)
    url: '?config=test_data%2Fgwas%2Flocuszoom_ld.json',
    readyTimeout: 90000,
    settleMs: 10000,
    viewportHeight: 640,
  },
  {
    mode: 'url',
    name: 'gallery/hg19_vs_hg38',
    // config's DotplotView defaultSession has empty displayedRegions, so open an
    // explicit whole-genome dotplot over the liftOver chain. Both assemblies'
    // chrom.sizes + the chain load from UCSC (see the config).
    // No autoDiagonalize: hg19 and hg38 are the same species, so their
    // homologous chromosomes already line up 1:1 on the diagonal in natural
    // karyotype order (chr1..chr22, X, Y — the config's chrom.sizes are now
    // karyotype-ordered, main chromosomes only). Auto-diagonalizing only reorders
    // the axes into a confusing sequence (chr11 before chr10, chrX mid-list) for
    // no gain — it's meant for de-novo/fragmented assemblies with no canonical order.
    url: sessionSpec('test_data/hg19_vs_hg38/config.json', {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'hg38' }, { assembly: 'hg19' }],
          tracks: ['hg19ToHg38.over.chain.gz-1645073157673'],
          showColorLegend: false,
        },
      ],
    }),
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 10000,
    // the chain file carries liftOver entries for alt/random contigs that the
    // karyotype-subset assemblies omit, so the dotplot shows a (benign,
    // dismissable) render warning; clear it for a clean gallery card
    actions: [{ type: 'click', text: 'Dismiss' }, { type: 'delay', ms: 500 }],
  },
  {
    mode: 'url',
    name: 'gallery/breakpoint_multihop',
    // A single PacBio split read crossing more than two locations, shown as a
    // multi-panel BreakpointSplitView (chr3 <-> chr6). Declarative like the
    // SKBR3 breakpoint_split_view card.
    // Short alignments height on each panel so both panels + the connecting
    // curves fit; taller viewport so the whole split view is captured.
    url: sessionSpec('test_data/breakpoint/config.json', {
      views: [
        {
          type: 'BreakpointSplitView',
          views: [
            {
              assembly: 'hg19',
              // BND junction is chr3:186,700,648 — centered in a 10kb window
              // (previously the window put the junction at ~70% across,
              // crowding it toward the right edge)
              loc: 'chr3:186,695,648-186,705,648',
              tracks: [
                {
                  trackId: 'pacbio_hg002_breakpoints',
                  displaySnapshot: {
                    type: 'LinearAlignmentsDisplay',
                    height: 150,
                  },
                },
                {
                  trackId: 'pacbio_vcf',
                  // short variant lane — only the BND call sits here
                  displaySnapshot: { type: 'LinearVariantDisplay', height: 90 },
                },
              ],
            },
            {
              assembly: 'hg19',
              // BND junction is chr6:56,758,392 — centered the same way
              loc: 'chr6:56,753,392-56,763,392',
              tracks: [
                {
                  trackId: 'pacbio_hg002_breakpoints',
                  displaySnapshot: {
                    type: 'LinearAlignmentsDisplay',
                    height: 150,
                  },
                },
                {
                  trackId: 'pacbio_vcf',
                  // short variant lane — only the BND call sits here
                  displaySnapshot: { type: 'LinearVariantDisplay', height: 90 },
                },
              ],
            },
          ],
        },
      ],
    }),
    readyTimeout: 90000,
    settleMs: 12000,
    viewportHeight: 900,
  },
]
