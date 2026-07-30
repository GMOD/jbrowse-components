import { lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the three Dog10K tutorials (local_ancestry.md, dog10k_svs.md,
// dog10k_lof.md). All read test_data/dog10k/config.json, whose data is built by
// scripts/build_dog10k_wolfdog_ancestry.sh, scripts/build_dog10k_nhej1_sv.sh,
// scripts/build_dog10k_cyp1a2.sh and scripts/build_dog10k_cyp1a2_cn.sh.

const DOG_CONFIG = 'test_data/dog10k/config.json'

// Row labels for the NHEJ1 SV figure, grouped so the Collie-clade breeds that
// carry the deletion sit together above the breeds and wolves that do not. IDs
// are the VCF's own, in its own order (the build script writes them); the swatch
// marks the group and only the label is cosmetic.
const CEA_GROUPS = [
  {
    label: 'Collie',
    color: '#0072B2',
    ids: Array.from(
      { length: 13 },
      (_, i) => `COLL0000${String(i + 1).padStart(2, '0')}`,
    ),
  },
  {
    label: 'Shetland Sheepdog',
    color: '#0072B2',
    ids: ['SSHP000001', 'SSHP000002', 'SSHP000003', 'SSHP000004'],
  },
  {
    label: 'Lancashire Heeler',
    color: '#0072B2',
    ids: ['LANC000001', 'LANC000002', 'LANC000003', 'LANC000004'],
  },
  {
    label: 'Silken Windhound',
    color: '#0072B2',
    ids: ['SKWH000001', 'SKWH000002'],
  },
  {
    label: 'Australian Shepherd',
    color: '#999999',
    ids: ['AUSS000001', 'AUSS000002', 'AUSS000003'],
  },
  {
    label: 'German Shepherd',
    color: '#999999',
    ids: ['GRSD000002', 'GRSD000003'],
  },
  {
    label: 'Labrador Retriever',
    color: '#999999',
    ids: ['LABR000001', 'LABR000002', 'LABR000003', 'LABR000004'],
  },
  {
    label: 'Wolf',
    color: '#E69F00',
    ids: ['CLUPGR000001', 'CLUPGR000002', 'CLUPGR000003', 'CLUPGR000004'],
  },
]

// Sidebar labels for the wolf-block genotype figure. The VCF keeps the Dog10K
// sample IDs (they are the data's identity, and the build script writes this
// same order); `layout` only relabels the rows, two per sample since the matrix
// is drawn in phased mode.
// The swatch colors are the painting's own Okabe-Ito pair (wolf orange, dog
// blue), so a reference row's swatch and an ancestry block of the same color
// mean the same thing across both figures; the two targets take a neutral
// swatch, since which panel they match is the question rather than a given.
const WOLF_SWATCH = '#E69F00'
const DOG_SWATCH = '#0072B2'
const TARGET_SWATCH = '#555555'
const DOG_VCF_LAYOUT = [
  ...[
    'CLUPEA000001',
    'CLUPEU000002',
    'CLUPGR000001',
    'CLUPGR000002',
    'CLUPGR000003',
    'CLUPGR000004',
    'CLUPGR000005',
    'CLUPGR000006',
  ].map((sample, i) => ({
    sample,
    label: `Wolf ${i + 1}`,
    color: WOLF_SWATCH,
  })),
  { sample: 'SAAR000001', label: 'Saarloos 1', color: TARGET_SWATCH },
  { sample: 'GRSD000002', label: 'German Shepherd 1', color: TARGET_SWATCH },
  ...[
    'AFFN000001',
    'AFGH000001',
    'AIRT000001',
    'AKBH000001',
    'AMAL000001',
    'ALDB000001',
    'AKIT000001',
    'AMBD000001',
  ].map((sample, i) => ({
    sample,
    label: `Dog ${i + 1}`,
    color: DOG_SWATCH,
  })),
].flatMap(({ sample, label, color }) =>
  // HP is 0-based on the wire (`<sample> HP0`/`HP1`, see makeHaplotypeSources);
  // the labels count from 1 to match the painting track's row names
  [0, 1].map(hp => ({
    name: `${sample} HP${hp}`,
    sampleName: sample,
    HP: hp,
    label: `${label} hap${hp + 1}`,
    color,
  })),
)

// Row labels for the DENR figure. The Mastiff-clade breeds the paper names
// (Boxer, Bull Terrier, Miniature Bull Terrier, English Bulldog) take one
// swatch, the two comparison breeds another, and the wolves the third.
// Row labels for the CYP1A2 figure. Breeds carrying the nonsense allele first,
// then two that do not, then the wolves — which is where the control lives: no
// wolf or coyote in the whole collection carries it.
const CYP_GROUPS = [
  { label: 'German Hound', color: '#0072B2', n: 6, prefix: 'GHND' },
  { label: 'Bohemian Shepherd', color: '#0072B2', n: 6, prefix: 'BHSP' },
  { label: 'Shetland Sheepdog', color: '#0072B2', n: 4, prefix: 'SSHP' },
  { label: 'Black Russian Terrier', color: '#0072B2', n: 5, prefix: 'BRTR' },
  { label: 'Keeshond', color: '#0072B2', n: 5, prefix: 'KEES', from: 2 },
  { label: 'Labrador Retriever', color: '#999999', n: 5, prefix: 'LABR' },
  { label: 'Boxer', color: '#999999', n: 4, prefix: 'BOXR' },
  { label: 'Wolf', color: '#E69F00', n: 4, prefix: 'CLUPGR' },
]

const CYP_LAYOUT = CYP_GROUPS.flatMap(({ label, color, n, prefix, from = 1 }) =>
  Array.from({ length: n }, (_, i) => ({
    name: `${prefix}${String(from + i).padStart(6, '0')}`,
    label: `${label} ${i + 1}`,
    color,
  })),
)

const DENR_GROUPS = [
  {
    label: 'Boxer',
    color: '#0072B2',
    ids: ['BOXR000001', 'BOXR000002', 'BOXR000003', 'BOXR000004'],
  },
  {
    label: 'Bull Terrier',
    color: '#0072B2',
    ids: ['BULT000001', 'BULT000002', 'BULT000003', 'BULT000004'],
  },
  {
    label: 'Mini Bull Terrier',
    color: '#0072B2',
    ids: ['MBLT000001', 'MBLT000002', 'MBLT000003', 'MBLT000004'],
  },
  {
    label: 'English Bulldog',
    color: '#0072B2',
    ids: ['BULD000002', 'BULD000003'],
  },
  {
    label: 'Labrador Retriever',
    color: '#999999',
    ids: ['LABR000001', 'LABR000002', 'LABR000003', 'LABR000004'],
  },
  {
    label: 'Collie',
    color: '#999999',
    ids: ['COLL000001', 'COLL000002', 'COLL000003'],
  },
  {
    label: 'Wolf',
    color: '#E69F00',
    ids: ['CLUPGR000001', 'CLUPGR000002', 'CLUPGR000003', 'CLUPGR000004'],
  },
]

const DENR_LAYOUT = DENR_GROUPS.flatMap(({ label, color, ids }) =>
  ids.map((name, i) => ({
    name,
    label: ids.length > 1 ? `${label} ${i + 1}` : label,
    color,
  })),
)

const CEA_LAYOUT = CEA_GROUPS.flatMap(({ label, color, ids }) =>
  ids.map((name, i) => ({
    name,
    label: ids.length > 1 ? `${label} ${i + 1}` : label,
    color,
  })),
)

export const dog10kSpecs: ScreenshotSpec[] = [
  // Dog10K wolfdog local ancestry, chr1: 22 haplotype rows painted by FLARE
  // against European gray wolf and breed-dog reference panels. Four Saarloos and
  // four Czechoslovakian Wolfdogs (both 20th-century German Shepherd x captive
  // wolf crosses) carry wolf blocks; the German Shepherd is the control, and the
  // Shiloh Shepherd and Tamaskan are the two breeds the Dog10K paper's allele
  // sharing / lookalike discussion raises. Built by
  // scripts/build_dog10k_wolfdog_ancestry.sh.
  {
    mode: 'url',
    name: 'dog10k-wolfdog-ancestry',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr1:1-123,556,469',
      // the 7.9 Mb wolf block on Saarloos 1 hap1 that the genotype figure
      // dissects, marked in-app so the two figures are visibly the same place
      highlight: ['chr1:105,310,984-113,248,953'],
      tracks: [
        {
          trackId: 'dog10k_wolfdog_ancestry',
          type: 'LinearMultiRowFeatureDisplay',
          height: 460,
        },
      ],
    }),
    readyText: 'chr1',
    // gate capture on the data-driven color legend (renders only once features
    // have loaded + been binned), not just canvasDrawn/settle: canvasDrawn can
    // flip on an empty first paint, so under a slow first-fetch a fixed settle
    // could capture the track before the painting appears
    readySelector: '[data-testid="multirow-color-legend"]',
    readyTimeout: 60000,
    settleMs: 3000,
    // all 22 haplotype rows plus the color legend, no page background below
    viewportHeight: 665,
  },

  // The genotypes under one wolf block. Saarloos 1 is painted Wolf on hap1 and
  // Dog on hap2 across chr1:105.3-113.2 Mb, so in a window inside that block its
  // two haplotype rows should track different reference groups: the phased
  // matrix puts eight gray wolves above it and eight breed dogs below, and the
  // wolf-assigned row matches the block of wolf rows while the dog-assigned row
  // matches the dogs. The German Shepherd sits between them as the control.
  // Sample IDs stay the data's own; `layout` only relabels the sidebar.
  {
    mode: 'url',
    name: 'dog10k-wolfdog-block-genotypes',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr1:107,980,000-108,020,000',
      tracks: [
        {
          trackId: 'dog10k_wolfdog_ancestry',
          type: 'LinearMultiRowFeatureDisplay',
          // every row again, so the two Saarloos 1 rows the matrix below
          // explains are read in the company of the other animals
          height: 264,
        },
        {
          trackId: 'dog10k_wolfdog_block_genotypes',
          type: 'LinearMultiSampleVariantMatrixDisplay',
          renderingMode: 'phased',
          height: 380,
          layout: DOG_VCF_LAYOUT,
        },
      ],
    }),
    readyText: 'chr1',
    readySelector: '[data-testid="variant-matrix-display-done"]',
    readyTimeout: 90000,
    settleMs: 6000,
    // painting + all 36 genotype rows, nothing below
    viewportHeight: 884,
  },

  // The Collie eye anomaly deletion (Schall & Kidd 2025, Fig 9): a 7.8 kb
  // deletion inside an NHEJ1 intron, genotyped across breeds from the Dog10K
  // SV callset. The Collie-clade breeds carry it, including homozygotes; the
  // other breeds and the wolves do not. Gene track above so the deletion is
  // visibly intronic. Built by scripts/build_dog10k_nhej1_sv.sh.
  {
    mode: 'url',
    name: 'dog10k-nhej1-cea-deletion',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // the whole NHEJ1 gene, so the deletion is visibly inside an intron
      loc: 'chr37:25,508,000-25,600,000',
      // No view highlight over the deletion: it is the only record the lane
      // draws, so nothing needs pointing at, and the tint would wash the het/hom
      // blues into teal and olive against an untinted legend.
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 110,
        },
        {
          trackId: 'dog10k_nhej1_svs',
          type: 'LinearMultiSampleVariantDisplay',
          height: 560,
          layout: CEA_LAYOUT,
          // The window holds nine SV records, and unfiltered they defeat the
          // figure: the 3,432 bp deletion 4 kb downstream is no-call in exactly
          // the four Collies homozygous for this one (its region is gone, so it
          // cannot be genotyped), so it paints a yellow stripe hard against the
          // darkest blue and the pair reads as one striped block rather than as
          // one deletion. `start` is POS-1.
          jexlFilters: ["jexl:get(feature,'start') == 25574004"],
        },
      ],
    }),
    readyText: 'chr37',
    readyTimeout: 90000,
    settleMs: 6000,
    // gene track plus all 36 sample rows and the genotype legend
    viewportHeight: 915,
  },

  // The two SINEC2A1 deletions in DENR introns (Schall & Kidd 2025, Fig S6):
  // ~220 bp mobile-element dimorphisms, the opposite kind of variant to the
  // rare 7.8 kb deletion above. The SINEs are present in the German Shepherd
  // reference, so "deletion" means the SINE is absent — which is the state of
  // every wolf here and of the Collies and Labradors, while the Mastiff-clade
  // breeds still carry them. Built by scripts/build_dog10k_nhej1_sv.sh.
  {
    mode: 'url',
    name: 'dog10k-denr-sine-deletions',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr26:6,929,500-6,936,000',
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 100,
        },
        {
          trackId: 'dog10k_denr_svs',
          type: 'LinearMultiSampleVariantDisplay',
          height: 430,
          layout: DENR_LAYOUT,
        },
      ],
    }),
    readyText: 'chr26',
    readyTimeout: 90000,
    settleMs: 6000,
    // gene track plus all 25 sample rows and the genotype legend. 775 cut the
    // last wolf row's blocks against the frame.
    viewportHeight: 805,
  },

  // The CYP1A2 nonsense variant (Meadows et al. 2023, Fig 10): chr30:38,261,635
  // C>T turns codon 373's CGA into TGA, truncating a drug-metabolizing P450.
  // Position derived by translating the reference CDS rather than looked up, so
  // it can be re-checked. Carried by many breeds, homozygous in several, and
  // absent from all 63 wolves and 4 coyotes in the collection — the four wolf
  // rows here stand in for that. Built by scripts/build_dog10k_cyp1a2.sh.
  {
    mode: 'url',
    name: 'dog10k-cyp1a2-nonsense',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // base-level around the stop codon: a SNV is one base wide however far you
      // zoom out, so this is the only scale at which a per-sample call reads as
      // a block rather than a tick
      loc: 'chr30:38,261,590-38,261,690',
      // No view highlight on the codon, deliberately. It tints every track it
      // crosses, and over the genotype lane that washes the het/hom blues into
      // teal and olive -- the one column the figure is about stops matching the
      // legend beside it. The anchored arrow below marks the codon instead, off
      // the same coordinate, so nothing drifts and the colors stay true.
      tracks: [
        // CYP1A2 is on the + strand, so codon 373 reads directly off the
        // forward sequence: the translation row is what makes CGA -> TGA a
        // visible fact rather than a claim in the caption. Reverse strand off,
        // it says nothing here and costs a row.
        {
          trackId: 'UU_Cfam_GSD_1.0-ReferenceSequenceTrack',
          type: 'LinearReferenceSequenceDisplay',
          showForward: true,
          showReverse: false,
          showTranslation: true,
          height: 80,
        },
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 60,
        },
        {
          trackId: 'dog10k_cyp1a2_snvs',
          type: 'LinearMultiSampleVariantDisplay',
          height: 500,
          layout: CYP_LAYOUT,
          // Only the stop-gained site. Two neighbours are in frame otherwise --
          // 38,261,636 (the same codon's second base) and 38,261,650, which a
          // wolf carries -- and with three anonymous columns the wolf row reads
          // as a counterexample to the very claim the figure makes. `start` is
          // POS-1.
          jexlFilters: ["jexl:get(feature,'start') == 38261634"],
        },
      ],
    }),
    readyText: 'chr30',
    readyTimeout: 90000,
    settleMs: 6000,
    // sequence + gene track plus all 39 sample rows and the genotype legend.
    // 870 (pre-sequence-track) cut the last wolf row's block against the frame.
    viewportHeight: 930,
    // The sequence track puts CGA and its Arg on screen, but three forward
    // frames are drawn and nothing says which is the coding one -- the CDS frame
    // is the bottom row (codons begin at positions == 1 mod 3 here, from the
    // exon's phase-2 start at 38,261,549), and the other two carry an unrelated
    // red stop 30 bp left of the site. One label names the consequence so the
    // reader doesn't have to pick a frame.
    annotations: [
      {
        type: 'text',
        text: 'CGA → TGA (Arg373 → stop)',
        fontSize: 22,
        anchor: {
          track: 'dog10k_cyp1a2_snvs',
          locus: 'chr30:38,261,637',
          fracY: 0,
          // right of the genotype column, over empty homozygous-reference grey
          dx: 24,
          dy: 26,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'dog10k_cyp1a2_snvs',
          locus: 'chr30:38,261,637',
          fracY: 0,
          dx: 24,
          dy: 14,
        },
        anchor: {
          track: 'UU_Cfam_GSD_1.0-ReferenceSequenceTrack',
          locus: 'chr30:38,261,636',
          fracY: 1,
        },
      },
    ],
  },

  // No figure for the 15-CRAM read-depth painting (`dog10k_cyp1a2_cn`, still in
  // the config so a reader can add it). The CRAMs are an arbitrary fifteen dogs
  // -- whichever ones the share happens to publish -- so the picture invited
  // "why these breeds", and the cohort painting below covers the same locus over
  // every canid in the collection. The BED remains as what the cohort estimate
  // is validated against, not as something to look at.

  // Copy number over the gene (Meadows et al. 2023, Fig 10a) across the whole
  // collection. The SNV callset carries a per-sample DP at every site for all
  // 1,987 canids, and the same ratio of element depth to that dog's own flank
  // depth reproduces the CRAM answer (r = 0.97 per window, no bias). Painted as
  // BED9, each 5 kb window rounded to an integer and colored by it, same as the
  // wolfdog ancestry figure above. A wiggle per dog was the alternative and it
  // renders each window's 7-10% spread as wobble that reads like structure;
  // rounding states the call instead.
  //
  // Clustered rather than left in sample order: 1,987 rows is far past the point
  // where a reader can follow one, so the question stops being "which dog is
  // this" and becomes "how many distinct copy-number profiles are there". The
  // dendrogram answers that, and clustering is also what makes the sub-pixel
  // rows honest -- at 0.35px a row neighbours overpaint each other, so whichever
  // wins a pixel has to stand for the ones it covers.
  {
    mode: 'url',
    name: 'dog10k-cyp1a2-cohort-copy-number',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr30:38,235,000-38,295,000',
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 90,
        },
        {
          trackId: 'dog10k_cyp1a2_cohort_cn',
          type: 'LinearMultiRowFeatureDisplay',
          // all 1,987 rows inside a readable track: auto-fit is no longer
          // floored at a pixel a row, so this is the height it takes rather
          // than the height it grows past
          height: 640,
          // one-shot declarative trigger, cleared once the RPC lands
          runClustering: true,
          showTree: true,
        },
      ],
    }),
    readyText: 'chr30',
    // the dendrogram only exists once the clustering RPC has landed
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    readyTimeout: 300000,
    settleMs: 8000,
    // gene track plus the 640px stack and the copy-number key
    viewportHeight: 970,
  },
]
