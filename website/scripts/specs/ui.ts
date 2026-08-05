import { SPLIT_VIEW_LINK_LABEL } from '../../../plugins/variants/src/VariantFeatureWidget/LaunchBreakendPanel/labels.ts'
import {
  DEMO_CONFIG,
  HG38_RMSK_TRACK,
  VOLVOX,
  cascadeBoxes,
  dismissMenus,
  kgUrl,
  lgvSession,
  menuCascade,
  openFeatureHeightSubmenu,
  sessionSpec,
  trackMenuIcon,
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
      { type: 'click', text: 'Cite this JBrowse session' },
      { type: 'waitForText', text: 'Diesh, Colin' },
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
  // Get sequence / Copy range / Launch / Bookmark region" menu — the volvox
  // cram track puts Consensus sequence under that Launch group.
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

  // Multi-sample variant display on the 1000 Genomes phase-3 SV ensemble
  // callset (3202 samples) across chr19:42.7-47.8Mb, sorted by genotype at the
  // ~1.12Mb inversion HGSV_73318 (chr19:46,275,880-47,396,219, AF=0.238).
  // Because this display draws variants at their genomic position, an
  // inversion that size is a band a third of the window wide, and after the
  // sort the carriers collect at the top so the band has a clean edge.
  //
  // This window is the display's scale case and nothing more: the sibling RHD
  // figures below are the ones the SV-multisamples tutorial reads reads
  // against, because chr19's large inversions are segmental-duplication
  // mediated and short reads cannot resolve their breakpoints (measured: 10
  // same-strand pairs in a carrier against 8 in a non-carrier). What this frame
  // shows -- a megabase-scale call drawn at its real span across 3202 rows --
  // is true independently of that, and it is what the display looks like at a
  // scale no other figure in the set reaches.
  //
  // The right-click lands at x~1130 (genomic ~46.55Mb), an inversion-only gap
  // where no other SV overlaps, so the sort reliably targets the inversion.
  // forceLoad lifts the 1MB tabix fetch gate so the 5Mb window auto-loads
  // headless instead of showing a force-load prompt. Remote 1000genomes data,
  // so allow a long ready/settle.
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
              height: 400,
            },
            // showLabels:'on' forces gene names on (the default 'auto' hides
            // them at this 5Mb zoom past maxLabelFeatureDensity); showOnlyGenes
            // drops the per-transcript subfeatures so only gene-level glyphs
            // render. heightMode 'fit' puts the whole stack inside the lane: at
            // 5Mb the fit ladder lands on its `bodies` rung, i.e. no names, and
            // a labeled stack fits no lane height this figure can afford
            // (measured -- 220px still dropped the names and added 90px of
            // whitespace). The lane's job here is which part of the window
            // carries genes.
            {
              trackId: 'ncbi_refseq_109_hg38',
              type: 'LinearBasicDisplay',
              height: 140,
              showLabels: 'on',
              showDescriptions: false,
              showOnlyGenes: true,
              heightMode: 'fit',
            },
          ],
        },
      ],
    }),
    readyText: '1KGP',
    readyTimeout: 90000,
    viewportHeight: 800,
    settleMs: 35000,
    hideTooltip: true,
    actions: [
      // y=450 lands in the multi-sample matrix (proven coordinate); the dense
      // 5Mb gene track never fully clears "Loading" headless, so don't gate on it
      { type: 'rightclick', from: { x: 1130, y: 450 } },
      { type: 'waitForText', text: 'Sort by genotype' },
      { type: 'click', text: 'Sort by genotype' },
      { type: 'delay', ms: 6000 },
      // move the pointer off the matrix so the mouseover crosshair doesn't bake
      // into the capture
      { type: 'hover', from: { x: 6, y: 6 } },
      { type: 'delay', ms: 800 },
    ],
  },

  // The same chr19 inversion window with the display colored by SV type
  // (`featureColor: 'svType'`): every alt-carrying cell takes its variant's
  // structural-variant class color and the legend names each class present,
  // including the callset's complex (CPX) events. Sorted the same way, so the
  // inversion band is the same band as in `multisv` and only the palette
  // differs.
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
              heightMode: 'fit',
            },
          ],
        },
      ],
    }),
    readyText: '1KGP',
    readyTimeout: 90000,
    // clears the 400px matrix plus the 140px gene track: at 720 the RefSeq
    // lane was sliced off mid-labels, cutting the genes the SV calls line up
    // against
    viewportHeight: 800,
    settleMs: 35000,
    hideTooltip: true,
    actions: [
      { type: 'rightclick', from: { x: 1130, y: 450 } },
      { type: 'waitForText', text: 'Sort by genotype' },
      { type: 'click', text: 'Sort by genotype' },
      { type: 'delay', ms: 6000 },
      { type: 'hover', from: { x: 6, y: 6 } },
      { type: 'delay', ms: 800 },
    ],
  },

  // The RHD locus, chr1:25.2-25.4Mb, and the figure the SV-multisamples
  // tutorial reads its reads against. The anchor is HGSV_1821, the 70kb
  // deletion that removes the whole of RHD (chr1:25,265,081-25,335,163, PASS,
  // AF=0.182, 2233 hom-ref / 771 het / 198 hom-alt); deleting RHD is the most
  // common cause of the RhD-negative blood type, so the three bands the sort
  // produces are the three dosages of a gene rather than an anonymous interval.
  //
  // The window is 200kb: the deletion is then a third of the frame with RHD
  // under it and RHCE (the 97%-identical paralog the read figures turn on) at
  // the right-hand edge.
  //
  // ONE VIEW, TWO DISPLAY TYPES OF THE SAME CALLSET, which is what the review
  // asked for ("change this to one figure where the regular
  // linearvariantdisplay and the multisamplevariantdisplay of same data was
  // visible, then user can see which sv is which"). It was two captures
  // composed -- the same matrix coloured by genotype and then by SV class --
  // and the second was doing the "which SV is which" job badly: a matrix cell
  // says a sample carries SOMETHING here, and with 26 overlapping records in
  // this window a colour change is only visible where two calls differ in their
  // carriers. The ordinary display separates them by construction, one row per
  // non-overlapping set, and labels each with its id and size (HGSV_1821 <DEL>
  // 70.1Kbp), so a column in the matrix reads off a named record.
  //
  // The SV-type CELL colouring the second half used to carry is not lost: it is
  // multisv_svtype in the multi-variant user guide, on a window whose classes
  // are the subject rather than a second copy of this one.
  //
  // Lane order is matrix, records, genes, so the records sit between the two
  // things they explain -- the cells above and the genes below.
  //
  // A second display of the same TRACK is not possible (showTrack resolves by
  // trackId and returns the open one), so the record lane is a sessionTrack
  // pointing at the same VCF under its own id. Two multi-sample displays in one
  // view is separately impossible: the second one's presence makes the first
  // stop answering `onContextMenu`, so "Sort by genotype" never appears. One
  // matrix plus one ordinary display does not hit that.
  //
  // The right-click lands at x~750, the deletion's midpoint in this window
  // (fraction 0.50 of a 1500px capture), which is inside the deletion and clear
  // of the smaller calls around it, so the sort reliably targets HGSV_1821.
  // forceLoad lifts the 1MB tabix fetch gate. Remote 1000genomes data, so allow
  // a long ready/settle.
  {
    mode: 'url',
    name: 'multisv_rhd',
    url: kgUrl({
      sessionTracks: [
        {
          type: 'VariantTrack',
          trackId: 'kgp_sv_records',
          name: '1KGP ensemble SV calls',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: 'https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20210124.SV_Illumina_Integration/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz',
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:25,200,000-25,400,000',
          tracks: [
            {
              trackId: '1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf',
              type: 'LinearMultiSampleVariantDisplay',
              forceLoad: true,
              height: 400,
            },
            {
              trackId: 'kgp_sv_records',
              type: 'LinearVariantDisplay',
              forceLoad: true,
              // enough for the four rows the 26 records pack into plus their
              // name/type labels; at 130 the last row was under the lane's fold
              height: 170,
              // the same `svTypeColor` jexl the SV-type cell preset is built on
              // (SV_TYPE_COLOR_JEXL in plugins/variants/src/shared/
              // variantSvType.ts -- written out rather than imported, since that
              // module pulls the core util barrel and specs are read under
              // plain node), so a record's colour and the legend agree with the
              // multi-variant guide's SV-type figure
              color: 'jexl:svTypeColor(feature)',
            },
            // showLabels:'on' forces gene names on at this zoom; showOnlyGenes
            // drops the per-transcript subfeatures so RHD/RHCE read as single
            // labelled glyphs under the matrix
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
    viewportHeight: 980,
    settleMs: 35000,
    hideTooltip: true,
    // The record lane's SV-type key floats at its own top-right, on top of the
    // last two records' labels (HGSV_1832 and HGSV_1835 came out as `HGS… <DU…`
    // and a clipped `<DEL> 18.2Kb`). It is also the one key here that names
    // nothing new: every record is drawn with its class IN its label (`<DEL>`,
    // `<CNV>`, `<INS:ME:ALU>`), where a matrix cell carries no text at all and
    // the genotype key above it is the only thing naming those fills. So the
    // record lane's key goes and the matrix's stays.
    //
    // Scoped through the record track's own rendering container: both tracks
    // portal a `Hide legend` box into their own TrackContainer overlay (a
    // sibling of that container inside the track Paper — see
    // TrackOverlayPortal), so a bare `[title="Hide legend"]` would take the
    // genotype key instead, being first in the DOM.
    hideSelectors: [
      '[data-testid$="-kgp_sv_records"] ~ div div:has(> button[title="Hide legend"])',
    ],
    actions: [
      { type: 'rightclick', from: { x: 750, y: 450 } },
      { type: 'waitForText', text: 'Sort by genotype' },
      { type: 'click', text: 'Sort by genotype' },
      { type: 'delay', ms: 6000 },
      // move the pointer off the matrix so the mouseover crosshair doesn't bake
      // into the capture
      { type: 'hover', from: { x: 6, y: 6 } },
      { type: 'delay', ms: 800 },
    ],
  },

  // The read-level check the SV-multisamples tutorial's genotypes are read
  // against: three 1000 Genomes high-coverage Illumina CRAMs over the RHD
  // deletion, one per genotype at HGSV_1821, stacked in one view under the gene
  // track. Verified read counts over a 10kb window inside RHD against a 10kb
  // flank outside the deletion (samtools, required_fields=0x9FF):
  //
  //   HG00113  1/1   flank 2440   inside  149   6%
  //   HG00096  0/1   flank 2556   inside 1421  56%
  //   HG00097  0/0   flank 2800   inside 2759  99%
  //
  // so the dosage reads straight off the coverage band: gone, halved, flat.
  //
  // Two settings carry the figure. `showPileup: false` drops the stacked-read
  // band, because at 100kb a 30x pileup is a solid mass and the coverage curve
  // is the whole subject here. And minScore/maxScore PIN all three rows to one
  // 0-70 axis: left to autoscale each row fits its own maximum, which drew the
  // three genotypes at almost the same height and destroyed the comparison the
  // figure exists to make. A few spikes clip at 70; the ~35x baseline sitting at
  // half height is what matters.
  {
    mode: 'url',
    name: 'multisv_rhd_dosage',
    url: kgUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '1:25,250,000-25,350,000',
          // RHD's own span, from the RefSeq annotation the gene lane draws
          // (chr1:25,272,393-25,330,445), taken from the annotation rather than
          // measured. It bands the coverage hole in all three read tracks at
          // once, which no per-track glyph can do.
          highlight: [
            {
              refName: '1',
              start: 25272393,
              end: 25330445,
              color: 'rgba(214,137,16,0.13)',
            },
          ],
          tracks: [
            {
              trackId: 'ncbi_refseq_109_hg38',
              type: 'LinearBasicDisplay',
              // RHD -- the subject of the figure -- used to sit below this
              // lane's 110px fold, and the reviewer reasonably reported not
              // seeing it. Two settings fix that together: `longestCoding`
              // draws one glyph per gene (`showOnlyGenes` alone still stacked a
              // dozen RHD transcript rows at this zoom, which grew the lane to
              // 470px and pushed the coverage tracks off instead), and
              // heightMode 'grow' sizes the lane to whatever rows that leaves,
              // so the gene cannot be clipped out of its own figure by a number
              // in this file.
              heightMode: 'grow',
              geneGlyphMode: 'longestCoding',
              showLabels: 'on',
              showDescriptions: false,
              showOnlyGenes: true,
            },
            ...['HG00113', 'HG00096', 'HG00097'].map(s => ({
              trackId: `${s}.final`,
              type: 'LinearAlignmentsDisplay',
              forceLoad: true,
              showPileup: false,
              height: 160,
              coverageHeight: 150,
              minScore: 0,
              maxScore: 70,
            })),
          ],
        },
      ],
    }),
    readyText: 'HG00097.final',
    readyTimeout: 240000,
    viewportHeight: 875,
    settleMs: 60000,
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

  // sv_visualization.md: the TRA feature-details panel with its
  // "Open breakpoints in split view" link. Zoomed onto a single SKBR3
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
      { type: 'waitForText', text: SPLIT_VIEW_LINK_LABEL },
      { type: 'delay', ms: 1500 },
    ],
    annotations: [
      { type: 'box', anchor: { text: SPLIT_VIEW_LINK_LABEL } },
      // arrow + explanatory callout pointing at the boxed split-view link
      {
        type: 'arrow',
        from: { x: 760, y: 300 },
        anchor: { text: SPLIT_VIEW_LINK_LABEL },
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
    // 800px viewport, so give it extra room. Sized to the content: 950 left
    // ~136px of page background under the launched view.
    viewportHeight: 820,
    actions: [
      { type: 'rightclick', from: { x: 622, y: 249 } },
      { type: 'waitForText', text: 'Open feature details' },
      { type: 'hover', text: 'Launch view' },
      { type: 'waitForText', text: 'Linear read vs ref' },
      { type: 'click', text: 'Linear read vs ref' },
      { type: 'waitForText', text: 'Set window size' },
      // "Open in new view", not "Replace current view": this figure wants the
      // read-vs-ref panel UNDER the pileup it was launched from, since the
      // insertion the reader is being pointed at is visible in both
      { type: 'click', text: 'Open in new view' },
      { type: 'waitForText', text: 'Reference sequence' },
      { type: 'delay', ms: 1000 },
      { type: 'click', selector: '[aria-label="View options"]' },
      { type: 'waitForText', text: 'Show...' },
      { type: 'hover', text: 'Show...' },
      { type: 'waitForText', text: 'Show curved lines' },
      { type: 'click', text: 'Show curved lines' },
      // a checkbox row leaves the menu up (CascadingMenu keeps settings rows
      // open), so dismiss both levels before the capture — the hidden waits
      // fail the spec rather than baking an open menu into the figure
      { type: 'press', key: 'Escape' },
      { type: 'press', key: 'Escape' },
      { type: 'waitForText', text: 'Show curved lines', hidden: true },
      { type: 'waitForText', text: 'Show...', hidden: true },
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
    // sized to the content: the rest of the viewport was page background
    viewportHeight: 499,
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
      // open the add-track drawer
      { type: 'click', text: 'Open track...' },
      { type: 'waitForText', text: 'Enter track data' },
      // reopen the File menu so the menu path and the open form show together
      { type: 'click', text: 'File' },
      { type: 'waitForText', text: 'Open track...' },
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
          // open the add-track FAB menu (show the menu the FAB
          // launches, not just a ring around the button)
          {
            type: 'click',
            selector: '[data-testid="hierarchical-add-track-fab"]',
          },
          { type: 'waitForText', text: 'Add track' },
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
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
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
    // sized to the content: the rest of the viewport was page background
    viewportHeight: 518,
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
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
    ],
    stages: [
      {
        actions: [
          // click the MoreVert to open the position menu
          { type: 'click', selector: '[data-testid="drawer-position-button"]' },
          { type: 'waitForText', text: 'left' },
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
      { type: 'click', text: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      // filter the (virtualized) list so the target row is rendered
      { type: 'type', text: 'Filter tracks', value: 'volvox-sorted' },
      { type: 'delay', ms: 800 },
      // open the track's per-track menu (showing "Add to favorites")
      {
        type: 'click',
        selector: '[data-testid="htsTrackEntryMenu-Tracks,volvox_bam"]',
      },
      { type: 'waitForText', text: 'Add to favorites' },
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
      // open the widget (this closes the Tools menu)
      { type: 'click', text: 'Plugin store' },
      { type: 'waitForText', text: 'Installed plugins' },
      { type: 'delay', ms: 1500 },
      // reopen the Tools menu so the menu path and the open widget show together
      { type: 'click', text: 'Tools' },
      { type: 'waitForText', text: 'Plugin store' },
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
    viewportHeight: 231,
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
      { type: 'click', selector: '[data-testid="track-selector-hamburger"]' },
      ...menuCascade(['Collapse...', 'Collapse subcategories'], 300),
      { type: 'click', text: 'Collapse subcategories' },
      { type: 'delay', ms: 1000 },
    ],
  },

  // The track-selector badge a session-wide default raises, and the dialog it
  // opens (display_defaults.md). A promoted default lives in this browser's
  // preferences, never in a session spec, so the state has to be driven through
  // the UI: pin Compact in the alignments "Read height" submenu, then open the
  // track selector. The track holds no height of its own, so the badge reads
  // "Affected by a session-wide default" (data-testid track_session_default_badge)
  // rather than the "Edited" pencil, and the dialog names the default as its
  // source with a "Clear session default" action. One open following track means
  // no track differs from the new default, so the snackbar carries no "Apply to
  // N open tracks" action here — wait on its title instead.
  {
    mode: 'url',
    name: 'display_type_default_badge',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1..8,000',
      tracks: ['volvox_alignments_pileup_coverage'],
    }),
    readyText: 'ctgA',
    viewportWidth: 1100,
    // enough for the tracklist and the dialog; the compacted pileup leaves the
    // rest of the track band empty, so a taller frame is just whitespace
    viewportHeight: 560,
    // the pileup keeps re-laying-out while reads stream in; let the menu
    // geometry settle before the click sequence
    settleMs: 8000,
    hideTooltip: true,
    // the pin raises a "Set as the default" snackbar that outlives the click
    // sequence; it is the action being documented, not part of either frame
    hideSelectors: ['.MuiTooltip-popper', '.MuiSnackbar-root'],
    stages: [
      {
        // top frame: the badge in the track selector, circled
        actions: [
          trackMenuIcon('volvox_alignments_pileup_coverage'),
          ...openFeatureHeightSubmenu(),
          {
            type: 'click',
            selector: '[aria-label="make Compact the default for all tracks"]',
          },
          { type: 'waitForText', text: 'Set as the default' },
          ...dismissMenus(),
          {
            type: 'click',
            selector: 'button[title="Open track selector"]',
          },
          {
            type: 'waitForSelector',
            selector: '[data-testid="hierarchical_track_selector"]',
          },
          // the tracklist is virtualized, so filter it down until the open
          // track's row (and its badge) is actually rendered
          { type: 'type', text: 'Filter tracks', value: 'volvox-sorted.bam' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="track_session_default_badge"]',
          },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: {
              selector: '[data-testid="track_session_default_badge"]',
            },
          },
        ],
      },
      {
        // bottom frame: the dialog it opens, listing the setting the default
        // imposed and offering to clear it
        actions: [
          {
            type: 'click',
            selector: '[data-testid="track_session_default_badge"]',
          },
          { type: 'waitForText', text: 'Session-wide default' },
          { type: 'delay', ms: 500 },
        ],
      },
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
      { type: 'click', text: 'Assembly manager' },
      { type: 'waitForText', text: 'Add new assembly' },
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
      { type: 'click', text: 'Assembly manager' },
      { type: 'waitForText', text: 'Add new assembly' },
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
        ],
        annotations: [{ type: 'box', anchor: { text: 'Admin' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Set default session' },
          { type: 'waitForText', text: 'Clear default session' },
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
    viewportHeight: 154,
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
    // heatmap, on the SAME HOXA window as chromhmm_hoxa_9celltype below so the
    // two figures differ only in row count. The window it used to be shot on
    // (chr11:5.87-6.78Mb) had no structure the extra rows revealed: it read as
    // one green transcribed block against grey, so 127 rows looked like nine
    // rows with more noise, which is the opposite of the point.
    //
    // HOXA separates the epigenomes into blocks, because the anterior half of
    // the cluster is active only in lineages with a matching positional
    // identity, and it is the same column boundary in every one of them.
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      // 500 kb rather than the cluster's own 180 kb. Inside the cluster every
      // row is fine structure and the picture has no background to read it
      // against, which is what made 127 rows of it look like noise. Out here
      // the two boxes are saturated rectangles standing in ~300 kb of the
      // pseudogene desert either side (RPL7AP38, HMGB3P20, NHP2P2, TPM3P4 to
      // the left; RPL35P4 past EVX1 to the right), which is quiescent and pale
      // in every row — so the domain has an edge. Wider than this and the
      // clustering starts separating the rows on the flanks instead.
      loc: 'chr7:26,950,000-27,450,000',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          // descriptions add noise on the context gene track; names suffice here
          type: 'LinearBasicDisplay',
          showDescriptions: false,
          height: 120,
        },
        {
          trackId: 'roadmap_chromhmm_multirow_hg19',
          type: 'LinearMultiRowFeatureDisplay',
          // clustered, not in `rowOrder`: at 127 rows a pixel-high row carries
          // no label, so the only thing that can group the epigenomes is where
          // the display puts them. Unclustered the same window is 127 rows of
          // scattered red with no block in it.
          runClustering: true,
          // 480, not the config's 700: 127 rows fill whatever height they are
          // given, so the extra 220px bought no detail, only more area of the
          // same painting to take in at once.
          height: 480,
        },
      ],
    }),
    // the same two domains boxed on the same coordinates as the nine-row figure,
    // so the boundary a reader learned there is the one they find again here
    annotations: [
      {
        type: 'box',
        anchor: {
          track: 'roadmap_chromhmm_multirow_hg19',
          locus: 'chr7:27,132,613-27,196,294',
        },
        pad: 2,
      },
      {
        type: 'box',
        anchor: {
          track: 'roadmap_chromhmm_multirow_hg19',
          locus: 'chr7:27,202,056-27,246,878',
        },
        pad: 2,
        color: '#1565c0',
      },
    ],
    // clustering 127 rows is real WASM compute, and a settle long enough to
    // cover it on a slow runner is one that is wrong on a fast one — a 15s
    // settle shot the run mid-cluster, chip and all. So wait on the run's own
    // progress chip clearing, which the autorun's `finally` does. The short
    // delay ahead of it is only to let the `delay: 500` autorun fire, not a
    // guess at how long the cluster takes: waiting for `hidden` on a chip that
    // has not gone up yet passes instantly.
    actions: [
      { type: 'delay', ms: 2000 },
      {
        type: 'waitForSelector',
        selector: '[data-testid="progress-chip"]',
        hidden: true,
        timeout: 180000,
      },
    ],
    readyText: 'ChromHMM',
    readyTimeout: 120000,
    settleMs: 6000,
    viewportHeight: 840,
  },

  // The nine-cell-type Broad ENCODE track at the HOXA cluster, which is the
  // build scripts/build_chromhmm_multirow.sh actually produces and the window it
  // opens on. The tutorial's only figure used to be the 127-epigenome Roadmap
  // track above, so the path a reader follows end to end was the one path the
  // page never showed.
  //
  // HOXA rather than a single promoter: at nine rows each state block is thick
  // enough to read as a color, and the cluster separates the cell types by what
  // they are rather than by how deeply they were sequenced.
  //
  // The two boxes are the figure's whole point, and without them the picture is
  // a wall of color a reader has no entry into. A HOX cluster is transcribed
  // colinearly, so a cell type opens the part of it matching its own positional
  // identity and leaves the rest under Polycomb; the break falls between HOXA7
  // and HOXA9 in every row that has one, which is what makes it a column in the
  // painting rather than nine unrelated patterns. Boxing the two domains says
  // where to look; the caption says what the split means. The three row labels
  // below name the rows that are the exceptions to it.
  //
  // Both are anchored to the track and a locus, so they stay on the genes when
  // the window, the track height or the viewport width moves.
  {
    mode: 'url',
    name: 'chromhmm_hoxa_9celltype',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr7:27,050,000-27,300,000',
      tracks: [
        {
          trackId: 'ncbi_gff_hg19',
          type: 'LinearBasicDisplay',
          showDescriptions: false,
          // the HOXA genes stack three deep here, and at 100 the third row's
          // labels were cut in half by the lane's own bottom edge
          height: 140,
        },
        {
          trackId: 'broad_chromhmm_multirow_hg19',
          type: 'LinearMultiRowFeatureDisplay',
          // 9 rows: 40px each, thick enough that a state block is a color
          // rather than a line, and the row labels sit inside their own row
          height: 360,
        },
      ],
    }),
    annotations: [
      // HOXA1 txStart to HOXA7 txEnd, hg19 refGene
      {
        type: 'box',
        anchor: {
          track: 'broad_chromhmm_multirow_hg19',
          locus: 'chr7:27,132,613-27,196,294',
        },
        pad: 2,
      },
      // HOXA9 txStart to HOTTIP txEnd, hg19 refGene
      {
        type: 'box',
        anchor: {
          track: 'broad_chromhmm_multirow_hg19',
          locus: 'chr7:27,202,056-27,246,878',
        },
        pad: 2,
        color: '#1565c0',
      },
      {
        type: 'text',
        text: 'anterior HOXA1-A7',
        fontSize: 20,
        anchor: {
          track: 'broad_chromhmm_multirow_hg19',
          locus: 'chr7:27,132,613-27,196,294',
          fracY: 0,
        },
        dy: 20,
      },
      {
        type: 'text',
        text: 'posterior HOXA9-A13',
        fontSize: 20,
        color: '#1565c0',
        anchor: {
          track: 'broad_chromhmm_multirow_hg19',
          locus: 'chr7:27,202,056-27,246,878',
          fracY: 0,
        },
        dy: 20,
      },
      // Three row labels, because the reviewer's question was what the NINE
      // CELL TYPES mean and the boxes above only say where to look. Each sits
      // at its own row's centre (row i of 9 -> (i+0.5)/9) so it reads as a label
      // ON that row, and each is pushed into the flank beside the box it is
      // about rather than over the painting.
      //
      // Measured off the file itself, per cell type over each box's span:
      //   anterior  H1-hESC 55% Repressed + 30% Poised_Promoter, K562 73%
      //             Repressed, GM12878 58% Heterochrom; the five differentiated
      //             lines run 69-92% enhancer/promoter/transcription
      //   posterior everything is Repressed EXCEPT HUVEC (37% Strong_Enhancer,
      //             20% Active_Promoter) and HSMM (50% Active_Promoter)
      //
      // H1-hESC: the pluripotent line is the one that is neither on nor off.
      // Its magenta is 3_Poised_Promoter over both halves, which is what a
      // bivalent HOX cluster looks like before a lineage has an address. Left of
      // the anterior box, because it is about the whole row.
      {
        type: 'text',
        text: 'H1-hESC: poised, not shut',
        fontSize: 16,
        textAlign: 'end',
        anchor: {
          track: 'broad_chromhmm_multirow_hg19',
          locus: 'chr7:27,132,613',
          alignX: 'left',
          fracY: 1.5 / 9,
        },
        dx: -6,
      },
      // HUVEC and HSMM: endothelium and skeletal muscle, the two mesoderm lines
      // and the only two that open the posterior half as well. RIGHT of the
      // posterior box — in the left flank the same label sat next to the
      // anterior one and read as pointing at it. The right flank is uniform
      // 12_Repressed grey in all nine rows, so nothing is hidden by covering it.
      ...([4, 6] as const).map(row => ({
        type: 'text' as const,
        text: 'posterior half open',
        fontSize: 16,
        textAlign: 'start' as const,
        color: '#1565c0',
        anchor: {
          track: 'broad_chromhmm_multirow_hg19',
          locus: 'chr7:27,246,878',
          alignX: 'right' as const,
          fracY: (row + 0.5) / 9,
        },
        dx: 6,
      })),
    ],
    readyText: 'ChromHMM',
    readyTimeout: 60000,
    settleMs: 8000,
    // 740 put the viewport's own bottom edge on the boxes' bottom stroke, which
    // read as the painting continuing past the frame
    viewportHeight: 764,
  },

  // The "Display types" submenu, with the multi-row display boxed: the
  // multi-row user guide's answer to "where do I turn this on". Deliberately
  // shot on a track still in its DEFAULT display, so the figure shows the
  // switch being available rather than already made.
  //
  // Shot on UCSC RepeatMasker rather than a gene track, because the menu item
  // has to be one a reader would plausibly pick. A gene track has nothing to
  // partition on — every feature is a gene, so multi-row gives one row per gene
  // name — whereas rmsk carries `repClass`, and one row per repeat class is the
  // thing this display exists for. Same 17q21 window as cookbook_color_by_type,
  // dense enough that rows read behind the menu.
  {
    mode: 'url',
    name: 'multirow/display_types_menu',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG38_RMSK_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:45,700,000-45,750,000',
          tracks: ['rmsk_hg38_ucsc'],
        },
      ],
    }),
    readyText: 'RepeatMasker',
    readyTimeout: 60000,
    viewportWidth: 1000,
    viewportHeight: 560,
    settleMs: 6000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Display types', 'Multi-row feature display (painting)']),
    ],
    annotations: cascadeBoxes([
      'Display types',
      'Multi-row feature display (painting)',
    ]),
  },
]
