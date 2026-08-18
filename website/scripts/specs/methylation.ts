import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  DEMO_CONFIG,
  HG38_GENCODE_PROMOTER_TRACK,
  cascadeBoxes,
  lgvSession,
  menuCascade,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The hg38 gene lane the three COLO829 figures carry, collapsed to one longest
// coding transcript and compact so it costs ~90px beside the methylation lanes.
// Three copies of the same five keys, which is what a lane shared between
// figures on one page should be.
const HG38_GENE_LANE = {
  trackId: 'ncbi_refseq_109_hg38_latest',
  type: 'LinearBasicDisplay',
  geneGlyphMode: 'longestCoding',
  displayMode: 'compact',
  height: 90,
}

const ARABIDOPSIS_WGBS_CONFIG =
  'test_data/arabidopsis_methylation/config_emseq_bisulfite.json'

// three copies of the one WGBS CRAM, each colored by a different cytosine
// context, so the per-read pileup demonstrates the three MethylDackel contexts
// directly (not just the aggregate). Distinct trackIds share one adapter.
const WGBS_CRAM_ADAPTER = {
  type: 'CramAdapter',
  uri: 'https://jbrowse.org/demos/bisulfite/arabidopsis_wgbs_bisulfite.cram',
}
function wgbsContextTrack(
  context: 'CG' | 'CHG' | 'CHH',
  displayOverrides: Record<string, unknown> = {},
) {
  const label = context === 'CG' ? 'CpG' : context
  return {
    track: {
      type: 'AlignmentsTrack',
      trackId: `arabidopsis_wgbs_${context.toLowerCase()}`,
      name: `Per-read WGBS — ${label} context`,
      assemblyNames: ['arabidopsis'],
      adapter: WGBS_CRAM_ADAPTER,
    },
    display: {
      trackId: `arabidopsis_wgbs_${context.toLowerCase()}`,
      type: 'LinearAlignmentsDisplay',
      colorBy: {
        type: 'bisulfite',
        // methylated-only is the default, so the tri-context contrast reads as
        // presence/absence of red rather than a red/blue mix per read
        modifications: { cytosineContext: context },
      },
      // compact reads, coverage hidden: three stacked pileups stay legible and
      // the row's message is the read colors, not a per-copy histogram
      showCoverage: false,
      heightMode: 'fixed',
      featureHeight: 3,
      height: 90,
      ...displayOverrides,
    },
  }
}
const WGBS_CONTEXT_COPIES = (['CG', 'CHG', 'CHH'] as const).map(c =>
  wgbsContextTrack(c),
)

function snrpnModkitSubadapter(hp: 'hp1' | 'hp2', color: string) {
  const uri = `https://jbrowse.org/demos/methylation/HG002_SNRPN_${hp}.modkit.bed.gz`
  return {
    type: 'BedTabixAdapter',
    name: hp === 'hp1' ? 'HP1' : 'HP2',
    color,
    bedGzLocation: { uri, locationType: 'UriLocation' },
    index: {
      location: { uri: `${uri}.tbi`, locationType: 'UriLocation' },
      indexType: 'TBI',
    },
  }
}

// The two per-haplotype modkit bedMethyl files as ONE multi-wiggle track
// (reviewer: "consider making the modkit a multi-wiggle"). config_demo.json
// declares them as two separate MultiQuantitativeTracks, which is right for a
// track list but wrong for this figure: two lanes, two headers, two independent
// autoscales, and the comparison the figure exists to make happens across a
// track boundary. Merged, the two haplotypes are two rows of one lane on one
// pinned 0-100 axis.
//
// A MultiWiggleAdapter's subadapters do not have to be BigWigs — anything
// quantitative works, and each subadapter's `name` becomes the row's source
// label. That matters here because bedMethyl features carry a `source` of their
// own (the modification code, from generateBedMethylFeature), so the row
// identity has to come from the outer fan-out rather than from the file.
//
// The colours match the read lanes below: at this locus HP1 is the methylated
// haplotype and its reads are red, HP2 the unmethylated one and its reads are
// blue. That agreement is a property of this locus, not a rule — which is why
// the row labels, not the colours, are what says which is which.
const SNRPN_MODKIT_MULTI_TRACK = {
  type: 'MultiQuantitativeTrack',
  trackId: 'HG002_snrpn_modkit_multi',
  name: 'HG002 5mC by haplotype (modkit)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: [
      snrpnModkitSubadapter('hp1', '#d62728'),
      snrpnModkitSubadapter('hp2', '#1f77b4'),
    ],
  },
}

// Arabidopsis WGBS (Col-0 DRR029742, bwameth-aligned) over
// NC_003070.9:4,398,000-4,412,000, a window that pairs two methylation regimes:
// the expressed ARM-repeat gene AT1G12930 (~4.398-4.406 Mb) carries gene-body
// CpG methylation only, while the silenced element to its right (pseudogene
// AT1G12935 + a repeat, ~4.406-4.410 Mb) is methylated in all three plant
// contexts. The contexts figure below shows this at two levels: the aggregate
// MethylDackel fractions (one row per context) AND the same per-read pileup
// colored three ways (one copy per context), so the tri-context contrast reads
// both quantitatively and per-molecule. The per-read copies use one-color mode:
// methylated C = red, unmethylated sites left blank.
// The SNRPN reads panel, in the two states the section is about: the grouping is
// the only property that differs, so both come out of one builder rather than
// out of two hand-kept copies. videos/methylation.ts films the route between
// them and starts from the same `grouped: false` this pair's upper half shows.
const snrpnReadsPanel = ({ grouped = false } = {}) =>
  lgvSession(DEMO_CONFIG, {
    assembly: 'hg38',
    loc: 'chr15:24,948,000-24,962,000',
    tracks: [
      {
        trackId: 'cpgisland_ucsc_hg38',
        type: 'LinearBasicDisplay',
        height: 40,
      },
      HG38_GENE_LANE,
      {
        trackId: 'HG002_snrpn_5mC_reads',
        type: 'LinearAlignmentsDisplay',
        height: 320,
        forceLoad: true,
        ...(grouped ? { groupBy: { type: 'tag', tag: 'HP' } } : {}),
        colorBy: {
          type: 'modifications',
          modifications: { fillUnmarked: true },
        },
      },
    ],
  })

// What videos/methylation.ts films: the ungrouped panel, and the track whose
// menu the route starts from.
export const methylationVideoFixtures = {
  ungrouped: snrpnReadsPanel(),
  readsTrackId: 'HG002_snrpn_5mC_reads',
}

export const methylationSpecs: ScreenshotSpec[] = [
  // The three plant methylation contexts, shown at both levels so the "3 modes"
  // is unmistakable and consistent: the aggregate MethylDackel track (one 0-100%
  // row per context) over THREE copies of the same per-read WGBS pileup, each
  // colored by one context (CpG/CHG/CHH). Each per-read copy lines up 1:1 with
  // its aggregate row. CpG is methylated over both the gene body AND the element
  // (red left + right); CHG/CHH are methylated only over the silenced element
  // (red confined to the right).
  {
    mode: 'url',
    name: 'methylation/arabidopsis_wgbs_contexts',
    url: sessionSpec(ARABIDOPSIS_WGBS_CONFIG, {
      sessionTracks: WGBS_CONTEXT_COPIES.map(c => c.track),
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'arabidopsis',
          loc: 'NC_003070.9:4,398,000-4,412,000',
          tracks: [
            { trackId: 'arabidopsis_genes' },
            // THE TRANSPOSON, DRAWN RATHER THAN ASSERTED. The gene GFF above
            // carries only a pseudogene over the silenced half, so the label
            // below was the figure's only evidence for the word "transposon".
            // This lane is UCSC's GenArk RepeatMasker bigBed for TAIR10
            // (GCF_000001735.3), which needs no hosting of ours and is already
            // on this config's refNames — its chroms ARE NC_003070.9 and the
            // rest, so nothing has to be aliased. Over this window it returns
            // `META1_LTR#LTR/Copia` at 4,406,005-4,411,120, the same element
            // and family TAIR10_Transposable_Elements.txt calls AT1TE14315.
            //
            // Filtered by length rather than partitioned into rows by repeat
            // class. The class route USED to be blocked by a display defect and
            // is not any more; it was then tried here and rejected on the
            // picture, so don't re-walk either half.
            //
            // The defect, for the record, since two rounds went into it:
            // `LinearMultiRowFeatureDisplay.partitionField` documents
            // `jexl:split(split(feature.name,'#')[1],'/')[0]` for exactly this
            // file type, bigRmskBed carrying the class as a suffix on the name
            // (`META1_LTR#LTR/Copia`) rather than in a column. Two bugs stood in
            // front of it. `split` threw on an absent value, so a nested one
            // banner-ed the whole display; making it total turned that into a
            // silent ''. The cause under both was one level up — the model read
            // the slot with a resolving reader and no feature, so the expression
            // was evaluated on the MAIN THREAD against nothing and its answer
            // shipped to the worker as if it were the attribute name. Fixed in
            // `readConfObject` ("a callback read with no context is not an
            // evaluation"), pinned by `partitionFieldTransport.test.ts`.
            //
            // Rendered, the class partition is worse HERE, which only a picture
            // could say: it yields `LTR` / `Low_complexity` / `Simple_repeat`,
            // costs 40px more, leaves `Low_complexity` empty over this window,
            // and drops the per-feature label — so the lane stops naming
            // `META1_LTR#LTR/Copia` and the "LTR/Copia transposon" callout loses
            // the evidence it points at, keeping only `LTR`. The display is
            // built for many features per row (haplotype paintings, chromHMM);
            // this window holds five features, one of which matters. A single
            // self-labelling bar is the right shape for that, and the row
            // headers are the wrong tool rather than a broken one.
            //
            // The length filter is doing that job: the other four repeats here
            // are 30-80 bp simple repeats ((AATAA)n, (TTC)n), sub-pixel ticks
            // that would only add labels; 200 bp is far below the 5.1 kb element
            // and far above all four.
            {
              trackId: 'arabidopsis_rmsk',
              type: 'LinearBasicDisplay',
              jexlFiltersSetting: ['jexl:feature.end-feature.start>200'],
              height: 50,
            },
            // aggregate CpG/CHG/CHH fraction, one labeled row each (multirowxy)
            {
              trackId: 'arabidopsis_methyldackel',
              type: 'MultiLinearWiggleDisplay',
              defaultRendering: 'multirowxy',
              minScore: 0,
              maxScore: 100,
              height: 170,
            },
            ...WGBS_CONTEXT_COPIES.map(c => c.display),
          ],
        },
      ],
    }),
    readyText: 'MethylDackel',
    // remote CRAM (x3 copies, one adapter) + gene GFF + three bigWigs
    readyTimeout: 90000,
    settleMs: 20000,
    // genes + the repeat lane + aggregate(3 rows) + 3 compact pileups +
    // headers/ruler/overview
    viewportHeight: 995,
    // larger red pill labels naming each context row (reviewer: push them almost
    // to the far left edge of the data). The aggregate multiwiggle stacks
    // CpG/CHG/CHH in one 170px container (row centers ~28/85/142px, so each label
    // is nudged ±57px off the container center), and the three per-read pileups
    // each get the matching label anchored to their own track row. dx pulls the
    // pill hard toward the left edge of the ~1500px-wide data area (container
    // center ~750, so -690 lands the pill near x≈60).
    annotations: [
      // WHAT EACH HALF IS DOING, which the row labels never said (review: "can
      // potentially add 'chh silencing of transposon' ... and cpg enhancing of
      // gene body ... (if that is what it is doing)"). It is, and the right
      // half was worth checking rather than assuming: the gene GFF this figure
      // draws carries only a pseudogene there (AT1G12935, 4,406,318-4,406,746),
      // which is not the same claim.
      //
      // TAIR10's own transposable-element table is what settles it —
      // TAIR10_Transposable_Elements.txt from arabidopsis.org, one row per
      // element:
      //
      //   AT1TE14310  4,405,694-4,405,995  META1  LTR/Copia
      //   AT1TE14315  4,405,996-4,411,119  META1  LTR/Copia
      //
      // so the block that is red in all three contexts is a 5.1 kb LTR/Copia
      // retrotransposon, and CG+CHG+CHH together is the RdDM silencing
      // signature. Ensembl Plants' repeat endpoint returns the same interval
      // under the id `AT4TE22180`, which is a chr4 id on chr1 — take the
      // element's name from TAIR, not from there.
      //
      // The left label says "CpG only" and stops. Gene-body CpG methylation is
      // a real and well-known pattern, but what it DOES is contested, so
      // "enhancing" is more than the figure or the literature can carry; the
      // tutorial says it is associated with constitutive expression and leaves
      // it there.
      {
        type: 'text' as const,
        text: 'expressed gene body: CpG only',
        fontSize: 20,
        anchor: {
          track: 'arabidopsis_genes',
          // AT1G12930's own span, from the same GFF the lane draws
          locus: 'NC_003070.9:4,398,322-4,405,669',
          fracY: 1,
          dy: -16,
        },
      },
      {
        type: 'text' as const,
        text: 'LTR/Copia transposon, silenced: all three contexts',
        fontSize: 20,
        maxWidth: 300,
        anchor: {
          track: 'arabidopsis_genes',
          locus: 'NC_003070.9:4,405,996-4,411,119',
          fracY: 1,
          dy: -16,
        },
      },
      ...(['CpG', 'CHG', 'CHH'] as const).map((text, i) => ({
        type: 'text' as const,
        anchor: {
          selector:
            '[data-testid^="trackRenderingContainer-"][data-testid$="-arabidopsis_methyldackel"]',
        },
        dx: -690,
        dy: (i - 1) * 57,
        fontSize: 22,
        text,
      })),
      ...(
        [
          ['cg', 'CpG'],
          ['chg', 'CHG'],
          ['chh', 'CHH'],
        ] as const
      ).map(([ctx, text]) => ({
        type: 'text' as const,
        anchor: {
          selector: `[data-testid^="trackRenderingContainer-"][data-testid$="-arabidopsis_wgbs_${ctx}"]`,
        },
        dx: -690,
        fontSize: 22,
        text,
      })),
    ],
  },
  // ONT HG002 fiber-seq (6mA) at the GAPDH promoter, modifications mode. The
  // enzyme-treated sample (PAY22766, top) carries 6mA (A+a) calls that the
  // native no-enzyme control (PBA15131, bottom) lacks at the same locus. Data:
  // https://epi2me.nanoporetech.com/chromatin-acc-hg002/
  {
    mode: 'url',
    name: 'methylation/chromatin_accessibility_6ma',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG38_GENCODE_PROMOTER_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // wider than just the promoter (was 6,533,000-6,536,000) so the
          // gene body + flanking regions are visible too — the 6mA peak only
          // reads as significant in contrast with a flatter background either
          // side (reviewer: too tight, no context to judge significance)
          loc: 'chr12:6,528,000-6,543,000',
          tracks: [
            // NCBI RefSeq gene (not MANE, longest-coding transcript only) +
            // GENCODE promoter-window context so the 6mA accessibility signal
            // reads against the GAPDH promoter/TSS (reviewer: swap MANE for a
            // plain NCBI track, drop the CpG island — not relevant to
            // fiber-seq accessibility — add promoter windows instead). The
            // jbrowse.org/ucsc/hg38 hub gene track has unlabeled
            // pseudogene/silent_region entries upstream of GAPDH in this
            // window, so this uses the already-local, cleanly labeled RefSeq
            // track instead (same one gallery/fiberseq_gapdh uses at this
            // same locus).
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
            },
            'gencode_promoter_hg38_ucsc',
            {
              trackId: 'PAY22766-nanopore',
              type: 'LinearAlignmentsDisplay',
              // deep ONT over a 15kb window is past the BAM byte budget, so
              // both lanes banner "Requested too much data" rather than draw
              // (reviewer). forceLoad is the declarative FORCE LOAD button,
              // which nothing in a capture can click.
              forceLoad: true,
              // this is a 6mA chromatin-accessibility assay; the basecaller
              // also emits 5mC/5hmC calls on the same reads, but those
              // aren't what this figure is about (reviewer: 6mA only). An
              // allow-list (shownModifications: 6mA code 'a') keeps it
              // 6mA-only regardless of what else the caller emitted.
              colorBy: {
                type: 'modifications',
                modifications: { shownModifications: ['a'] },
              },
              // compact pileup: displayMode isn't a real slot on this
              // display (that's the shared canvas base schema) — fixed
              // heightMode + a small featureHeight is the actual compact-row
              // setting, and the gap that pairs with it is derived from the
              // height rather than set
              heightMode: 'fixed',
              featureHeight: 3,
              // reviewer: label the modification-type swatches (6mA calls)
              showLegend: true,
            },
            {
              trackId: 'PBA15131-nanopore',
              type: 'LinearAlignmentsDisplay',
              forceLoad: true,
              colorBy: {
                type: 'modifications',
                modifications: { shownModifications: ['a'] },
              },
              heightMode: 'fixed',
              featureHeight: 3,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    // was 20000 — the prior capture committed while alignments were still
    // downloading (progress bars baked into the PNG), so give it more room
    settleMs: 45000,
    // taller so both alignment tracks' full pileup (compact mode still stacks
    // many rows for this depth) fit below the gene + promoter context tracks.
    // 1000 clipped 24 css px off the bottom lane, per the run's own report
    viewportHeight: 1030,
    // WHICH SAMPLE IS WHICH, on the drawing (reviewer). The figure's whole
    // claim is a contrast between two pileups, and the only thing that said
    // which was which was two config track names in the header — `PAY22766`
    // and `PBA15131` are accession ids, so a reader had to know the dataset to
    // know which lane was the treatment.
    //
    // A pill per lane and NOTHING ELSE (reviewer: "dont need giant red boxes,
    // just the small ones showing the text"). Each lane used to also carry a
    // `box` around its whole rendering container, which at this height is a
    // 400px-tall red rectangle over a pileup whose own edges already say where
    // the lane starts and stops. The pill sits at a fracY over the left flank,
    // where the 6mA density is lowest, so it covers reads rather than the
    // promoter peak the figure is about. Text is two or three words; what 6mA
    // means and what Hia5 does are in the caption.
    annotations: [
      {
        type: 'text' as const,
        text: 'Hia5-treated',
        fontSize: 22,
        anchor: {
          track: 'PAY22766-nanopore',
          locus: 'chr12:6,530,200',
          fracY: 0.28,
        },
      },
      {
        type: 'text' as const,
        text: 'No-enzyme control',
        fontSize: 22,
        anchor: {
          track: 'PBA15131-nanopore',
          locus: 'chr12:6,530,200',
          fracY: 0.28,
        },
      },
    ],
  },

  // The two halves of Group by HP, composed into one before/after (reviewer:
  // "ungrouped and grouped would benefit from being in a two part screenshot").
  // Same locus, same tracks, same coloring in both, so the grouping is the only
  // difference between them and the reader is not asked to hold the first
  // picture in mind across a section break. Built from these two url specs
  // rather than by hand: each half is a real capture, and the compose below is
  // what the tutorial embeds.
  //
  // The reads lane is shorter here than in the combined figure below, because
  // this one pays for it twice.
  {
    mode: 'url',
    name: 'methylation/hg002_snrpn_ungrouped',
    url: snrpnReadsPanel(),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    settleMs: 15000,
    // cpg(40) + gene(90) + reads(320) + chrome
    viewportHeight: 730,
    // the track menu icon keeps its "Track settings" tooltip after the click,
    // and the cursor parks over the pileup, which raises the read tooltip
    hideSelectors: ['.MuiTooltip-popper'],
    hideTooltip: true,
    // The menu path that produces the lower half, open on the upper one
    // (reviewer: "the first screenshot may want to show the track menu for
    // group by->tag"). The ungrouped state is the honest place for it: the
    // radio is not yet set, so the item reads plain 'Tag...' and the picture is
    // "here is where you go", not "here is where it already is". Same shape as
    // sv.ts's split-read grouping figure.
    actions: [
      trackMenuIcon('HG002_snrpn_5mC_reads'),
      ...menuCascade(['Group by...', 'Tag...']),
    ],
    annotations: cascadeBoxes(['Group by...', 'Tag...']),
  },

  // The other half: identical to the spec above but for `groupBy` on the HP tag,
  // which is the whole claim the section makes.
  {
    mode: 'url',
    name: 'methylation/hg002_snrpn_grouped',
    url: snrpnReadsPanel({ grouped: true }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    settleMs: 15000,
    // cpg(40) + gene(90) + reads(320) + chrome
    viewportHeight: 730,
    // Three pills, one word each (review: "just use shorter labels of just HP1
    // (no added text about 'methylated across the island'"). The display writes
    // `HP: 1` / `HP: 2` / `HP: none` itself, but in small grey type a reader
    // scanning the figure does not stop on. What each haplotype SHOWS is the
    // picture's job -- red across the island against blue -- so the pill only
    // has to say which group is which.
    //
    // Anchored to those labels by text, so they follow the groups wherever the
    // layout puts them; `dx` clears the "Show all reads" control beside each.
    annotations: [
      {
        type: 'text',
        text: 'HP1',
        anchor: { text: 'HP: 1', alignX: 'right', dx: 90 },
      },
      {
        type: 'text',
        text: 'HP2',
        anchor: { text: 'HP: 2', alignX: 'right', dx: 90 },
      },
      {
        type: 'text',
        text: 'HP unknown',
        anchor: { text: 'HP: none', alignX: 'right', dx: 90 },
      },
    ],
  },

  {
    mode: 'compose',
    name: 'methylation/hg002_snrpn_group_by_hp',
    parts: [
      'methylation/hg002_snrpn_ungrouped',
      'methylation/hg002_snrpn_grouped',
    ],
  },

  // Allele-specific methylation at the SNRPN / PWS-IC imprinting center
  // (chr15:24.95Mb) from HG002 ONT data, in one view (reviewer: don't compose two
  // screenshots — add the bedMethyl track as another track in the single view).
  // Top-to-bottom: CpG island + SNRPN gene, the per-haplotype modkit 5mC
  // profiles in ONE multi-wiggle lane (aggregate summary), then the same HG002
  // ONT reads grouped by HP and colored by methylation (the read-level source).
  // One assembly, one locus, one x-scale — the aggregate profile and the reads
  // that produce it line up column-for-column down the figure.
  {
    mode: 'url',
    name: 'methylation/hg002_snrpn_combined',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [SNRPN_MODKIT_MULTI_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr15:24,948,000-24,962,000',
          tracks: [
            {
              trackId: 'cpgisland_ucsc_hg38',
              type: 'LinearBasicDisplay',
              height: 40,
            },
            HG38_GENE_LANE,
            {
              trackId: 'HG002_snrpn_modkit_multi',
              type: 'MultiLinearWiggleDisplay',
              defaultRendering: 'multirowxy',
              // one scale for both haplotypes, which is the point of merging
              // them: a per-track autoscale would put each haplotype's own
              // maximum at the top of its own lane
              minScore: 0,
              maxScore: 100,
              height: 170,
            },
            {
              trackId: 'HG002_snrpn_5mC_reads',
              type: 'LinearAlignmentsDisplay',
              height: 460,
              forceLoad: true,
              groupBy: { type: 'tag', tag: 'HP' },
              colorBy: {
                type: 'modifications',
                modifications: { fillUnmarked: true },
              },
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 90000,
    settleMs: 15000,
    // cpg(40) + gene(90) + the merged aggregate(170) + reads(460) + chrome
    viewportHeight: 1085,
    // THE THREE GROUPS, NAMED (reviewer: "Please label HP1, HP2, and HP
    // none/unknown with red annotation boxes similar to
    // methylation/hg002_snrpn_group_by_hp"). Same three pills, same anchors and
    // the same wording as that figure, so the two read the same way; the
    // display's own `HP: 1` / `HP: 2` / `HP: none` headers are small grey type
    // that names the group without saying what it shows.
    //
    // Anchored by text, so they follow the groups wherever the pack puts them.
    // Which haplotype is methylated is read off the render rather than assumed
    // -- the HP tags are arbitrary and a rebuild of the BAM could swap them.
    annotations: [
      {
        type: 'text',
        text: 'HP1',
        // dy only on this one: HP: 1 is the FIRST group, so its label sits
        // against the top of the track and a pill centred on it overhangs the
        // track header above. The other two have reads above them already.
        anchor: { text: 'HP: 1', alignX: 'right', dx: 90, dy: 18 },
      },
      {
        type: 'text',
        text: 'HP2',
        anchor: { text: 'HP: 2', alignX: 'right', dx: 90 },
      },
      {
        type: 'text',
        text: 'HP unknown',
        anchor: { text: 'HP: none', alignX: 'right', dx: 90 },
      },
    ],
  },
]
