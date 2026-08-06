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
          type: 'MultiLinearWiggleDisplay',
          height: 420,
          defaultRendering: 'multirowdensity',
          // copy number: most cells sit at the diploid baseline (~2), so the
          // default localpercentile autoscale pins the max near the 99th
          // percentile (~2.2) and clamps the amplifications that are the point
          // of the figure. `local` uses the true region max so gains render at
          // full contrast and nothing is clipped.
          autoscale: 'local',
          showTree: false,
        },
      ],
    }),
    readyText: 'PUR',
    readySelector: '[data-testid="multi-wiggle-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 720,
    settleMs: 15000,
    actions: [
      // scope to the copy-number track's menu (the gene track added above also
      // has a track_menu_icon, so target by trackid)
      {
        type: 'click',
        selector:
          '[data-testid="track_menu_icon"][data-trackid="pur_copynumber_1000g"]',
      },
      { type: 'waitForText', text: 'Clustering' },
      { type: 'hover', text: 'Clustering' },
      { type: 'waitForText', text: 'Cluster rows by score...' },
      { type: 'click', text: 'Cluster rows by score...' },
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'click', text: 'Run clustering' },
      { type: 'waitForText', text: 'Run clustering', hidden: true },
      { type: 'delay', ms: 7000 },
    ],
  },

  // Extra gallery cards (website/src/lib/gallery.ts): compact local-test-data
  // views promoted from link-only entries to screenshots. Local data so they
  // render deterministically in the generator.
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
    viewportHeight: 705,
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
    // across cell types.
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
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
            },
            {
              trackId: 'gencode_promoter_hg38_ucsc',
              // single-row promoter windows — a short lane is plenty
              type: 'LinearBasicDisplay',
              height: 50,
            },
            {
              trackId: 'catlas_scatac_celltypes_hg38',
              type: 'MultiLinearWiggleDisplay',
              height: 150,
            },
            {
              trackId: 'PAY22766-nanopore',
              type: 'LinearAlignmentsDisplay',
              // taller than the 250 default so the deep fiber-seq pileup reads
              height: 450,
              // fiber-seq is a 6mA (code 'a') assay — allow-list only 6mA so
              // the incidental 5mC/5hmC calls the caller also emits are never
              // drawn and the legend shows only 6mA
              colorBy: {
                type: 'modifications',
                modifications: { shownModifications: ['a'] },
              },
              // The reviewer's "compact mode on the alignments" was written as
              // `displayMode: 'compact'`, which this display has no slot for —
              // that is the canvas base schema's, and the key was dropped in
              // silence. It is left off rather than translated to the pair that
              // would work here (heightMode 'fixed' + featureHeight 3), because
              // the `height` above already answers what compact was for: ~50
              // reads at the default 8px pitch is 400px inside a 450px track,
              // so compacting them to 3px would spend 300px of it on blank.
              showLegend: true,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 1150,
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
    // sessionName pins the title bar; without it the capture bakes in a live
    // timestamp and the figure differs on every render.
    url: '?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"1:18000000-18020000","type":"LinearGenomeView","trackLabels":"offset","tracks":["hg002_dipcall_dip_vcf_t2t",{"trackId":"hg002_dipcall_hap1_t2t","displaySnapshot":{"type":"LinearAlignmentsDisplay","height":80}},{"trackId":"hg002_dipcall_hap2_t2t","displaySnapshot":{"type":"LinearAlignmentsDisplay","height":80}}]}]}&sessionName=Screenshot',
    // generous because the fetch is big, not because the server is slow: a
    // dipcall record is a whole chromosome arm, so drawing a 20kb window still
    // pulls and decodes one ~57MB record per track (the adapters raise
    // fetchSizeLimit to 300MB to permit it). That is the rehosted chr1 slice —
    // the NCBI originals were 1GB per haplotype, which is what heavyNetwork was
    // for; 57MB is an ordinary remote-data spec, so it renders in a normal run.
    readyTimeout: 600000,
    settleMs: 15000,
    viewportHeight: 535,
  },
  {
    mode: 'url',
    name: 'gallery/nanopore_methylation',
    url: '?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"20:18,503,000-18,509,000","type":"LinearGenomeView","tracks":["cpgisland_ucsc_hg38",{"trackId":"human_chr20_mod_call_5mC_5hmC_CG_cram","displaySnapshot":{"type":"LinearAlignmentsDisplay","colorBy":{"type":"methylation"}}}]}]}',
    // the remote CRAM's first fetch takes long enough that settleMs alone once
    // committed a loading screen; wait on the pileup canvas actually drawing
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    settleMs: 15000,
    viewportHeight: 600,
  },
  // Bare-config gallery cards: each opens the config's own defaultSession (no
  // session spec), the same view the /gallery/ link opens.
  //
  // gallery/gwas_bmi_fto was retired here. It opened the LD config's own
  // defaultSession over GIANT BMI at FTO, and the card now takes
  // gwas/locuszoom_ld instead: a bare-config capture carries the config's
  // timestamped session name in its title bar, and the SLE/STAT4 window is the
  // stronger picture anyway (a dense signal with a red high-r² cluster over
  // labelled genes, against a sparse cloud over an unlabelled gene lane).
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
    actions: [
      { type: 'click', text: 'Dismiss' },
      { type: 'delay', ms: 500 },
    ],
  },
]
