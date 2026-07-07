import {
  DEMO_CONFIG,
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
    url: lgvSession('test_data/human_mito/config.json', {
      assembly: 'human_mito',
      loc: 'NC_012920.1:1-16,569',
      colorByCDS: true,
      tracks: ['ncbi_genes_human_mito'],
    }),
    readyText: 'NCBI genes',
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
    url: '?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"12:6533000-6536000","type":"LinearGenomeView","tracks":["ncbi_refseq_109_hg38_latest",{"trackId":"PAY22766-nanopore","displaySnapshot":{"type":"LinearAlignmentsDisplay","colorBy":{"type":"modifications"}}}]}]}',
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 560,
  },
  {
    mode: 'url',
    name: 'gallery/directrna_actb',
    // ACTB gene body — a short, highly expressed housekeeping gene, so the
    // pileup is deep but the whole gene fits on screen (BRCA1 was too long and
    // isoform-dense to read). colorBy modifications draws the per-base RNA
    // modification calls. userByteSizeLimit lifts the default alignments byte cap
    // so the reads auto-load instead of showing a "too much data" banner.
    url: '?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"7:5525000-5532500","type":"LinearGenomeView","tracks":[{"trackId":"NA12878-DirectRNA.pass.dedup.NoU.fastq.hg38.minimap2.sorted","displaySnapshot":{"type":"LinearAlignmentsDisplay","colorBy":{"type":"modifications"},"userByteSizeLimit":100000000}}]}]}',
    readyTimeout: 120000,
    settleMs: 35000,
    viewportHeight: 470,
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
    url: '?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"11:2130000-2200000","type":"LinearGenomeView","tracks":["catlas_scatac_celltypes_hg38"]}]}',
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 700,
  },
  {
    mode: 'url',
    name: 'gallery/nanopore_methylation',
    url: '?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"20:18,503,000-18,509,000","type":"LinearGenomeView","tracks":["cpgisland_ucsc_hg38",{"trackId":"human_chr20_mod_call_5mC_5hmC_CG_cram","displaySnapshot":{"type":"LinearAlignmentsDisplay","colorBy":{"type":"methylation"}}}]}]}',
    readyTimeout: 90000,
    settleMs: 15000,
    viewportHeight: 600,
  },
  {
    mode: 'url',
    name: 'gallery/1000g_trio',
    // absolute config url (matches the `multisv` spec): the screenshot server
    // has no /genomes/ path, and a root-relative config 404s against it.
    // readConnections:'arc' on each alignments track turns on the paired-end arc
    // band (routed to the config slot by showTrackGeneric at track-show time).
    url: '?config=https://jbrowse.org/genomes/GRCh38/1000genomes/config_1000genomes.json&session=spec-{"views":[{"assembly":"hg38","loc":"1:40484345-40515236","type":"LinearGenomeView","tracks":["1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf",{"trackId":"HG02031.final","displaySnapshot":{"type":"LinearAlignmentsDisplay","readConnections":"arc"}},{"trackId":"HG02030.final","displaySnapshot":{"type":"LinearAlignmentsDisplay","readConnections":"arc"}},{"trackId":"HG02032.final","displaySnapshot":{"type":"LinearAlignmentsDisplay","readConnections":"arc"}}]}]}',
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 1000,
  },
  {
    mode: 'url',
    name: 'gallery/encode_multibigwig',
    // ENCODE Broad-Histone H3K27ac for five cell lines, over the HBB locus where
    // erythroid K562 shows strong signal. Uses the UCSC-hosted encodeDCC bigWigs
    // (an inline MultiWiggleAdapter) because the original encodeproject.org URLs
    // now 403.
    // no per-source `color`: a `#` hex value would be read as a URL fragment and
    // truncate the session; the multiwiggle palette colors the rows instead
    url: '?config=test_data%2Fconfig_demo.json&session=spec-{"sessionTracks":[{"type":"MultiQuantitativeTrack","trackId":"encode_h3k27ac_multi","name":"ENCODE H3K27ac (5 cell lines)","assemblyNames":["hg19"],"adapter":{"type":"MultiWiggleAdapter","subadapters":[{"type":"BigWigAdapter","source":"GM12878","bigWigLocation":{"uri":"https://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHistone/wgEncodeBroadHistoneGm12878H3k27acStdSig.bigWig","locationType":"UriLocation"}},{"type":"BigWigAdapter","source":"K562","bigWigLocation":{"uri":"https://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHistone/wgEncodeBroadHistoneK562H3k27acStdSig.bigWig","locationType":"UriLocation"}},{"type":"BigWigAdapter","source":"H1-hESC","bigWigLocation":{"uri":"https://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHistone/wgEncodeBroadHistoneH1hescH3k27acStdSig.bigWig","locationType":"UriLocation"}},{"type":"BigWigAdapter","source":"NHLF","bigWigLocation":{"uri":"https://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHistone/wgEncodeBroadHistoneNhlfH3k27acStdSig.bigWig","locationType":"UriLocation"}},{"type":"BigWigAdapter","source":"HSMM","bigWigLocation":{"uri":"https://hgdownload.soe.ucsc.edu/goldenPath/hg19/encodeDCC/wgEncodeBroadHistone/wgEncodeBroadHistoneHsmmH3k27acStdSig.bigWig","locationType":"UriLocation"}}]}}],"views":[{"type":"LinearGenomeView","assembly":"hg19","loc":"11:5220000-5320000","tracks":[{"trackId":"encode_h3k27ac_multi","displaySnapshot":{"type":"MultiLinearWiggleDisplay","defaultRendering":"multirowxy","height":400}}]}]}',
    readyTimeout: 90000,
    settleMs: 12000,
    viewportHeight: 550,
  },
  {
    mode: 'url',
    name: 'gallery/celegans_26way',
    // no rowHeight: the slot defaults to 0 (fit-to-display-height), so all 26
    // species fit the viewport with no scroll. Long settle: the MAF coverage band
    // paints a canvas "Loading" placeholder the DOM-based waitForQuiescent can't
    // see, and the headless (swiftshader) build is slow to resolve it.
    url: '?config=https://jbrowse.org/demos/ce/config.json&session=spec-{"views":[{"assembly":"ce11","loc":"chrI:2998500-3001800","type":"LinearGenomeView","tracks":[{"trackId":"ce11.26way","displaySnapshot":{"type":"LinearMafDisplay","showConservation":true}}]}]}',
    readyTimeout: 240000,
    settleMs: 90000,
    viewportHeight: 500,
  },
  {
    mode: 'url',
    name: 'gallery/cactus_447way',
    // ~5kb: a 447-way MAF over the full BRCA1 gene trips the "too much data"
    // guard, so zoom to a slice that auto-loads. A fixed 500px display height
    // fits all 447 species into a compact fit-to-height band, so the whole
    // alignment reads as one conservation block rather than scrolling off-screen.
    url: '?config=https://jbrowse.org/ucsc/hg38/config.json&session=spec-{"views":[{"assembly":"hg38","loc":"chr17:43050000-43055000","type":"LinearGenomeView","tracks":[{"trackId":"hg38-cactus447way","displaySnapshot":{"type":"LinearMafDisplay","showConservation":true,"height":500}}]}]}',
    readyTimeout: 180000,
    settleMs: 15000,
    viewportHeight: 640,
  },
  // Bare-config gallery cards: each opens the config's own defaultSession (no
  // session spec), the same view the /gallery/ link opens.
  {
    mode: 'url',
    name: 'gallery/gwas_bmi_fto',
    url: '?config=test_data%2Fgwas%2Flocuszoom_ld.json',
    readyTimeout: 90000,
    settleMs: 10000,
    viewportHeight: 500,
  },
  {
    mode: 'url',
    name: 'gallery/hg19_vs_hg38',
    // config's DotplotView defaultSession has empty displayedRegions, so open an
    // explicit whole-genome dotplot over the liftOver chain. Both assemblies'
    // chrom.sizes + the chain load from UCSC (see the config).
    url: '?config=test_data%2Fhg19_vs_hg38%2Fconfig.json&session=spec-{"views":[{"type":"DotplotView","views":[{"assembly":"hg38"},{"assembly":"hg19"}],"tracks":["hg19ToHg38.over.chain.gz-1645073157673"],"autoDiagonalize":true,"showColorLegend":false}]}',
    readySelector: '[data-testid="dotplot_webgl_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 10000,
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
              loc: 'chr3:186,693,586-186,703,586',
              tracks: [
                {
                  trackId: 'pacbio_hg002_breakpoints',
                  displaySnapshot: {
                    type: 'LinearAlignmentsDisplay',
                    height: 150,
                  },
                },
                'pacbio_vcf',
              ],
            },
            {
              assembly: 'hg19',
              loc: 'chr6:56,751,088-56,761,088',
              tracks: [
                {
                  trackId: 'pacbio_hg002_breakpoints',
                  displaySnapshot: {
                    type: 'LinearAlignmentsDisplay',
                    height: 150,
                  },
                },
                'pacbio_vcf',
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
