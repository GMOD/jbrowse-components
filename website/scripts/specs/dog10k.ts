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
    // gene track plus all 25 sample rows and the genotype legend
    viewportHeight: 775,
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
      // the stop-gained codon, marked in-app rather than painted on
      highlight: ['chr30:38,261,634-38,261,638'],
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 90,
        },
        {
          trackId: 'dog10k_cyp1a2_snvs',
          type: 'LinearMultiSampleVariantDisplay',
          height: 500,
          layout: CYP_LAYOUT,
        },
      ],
    }),
    readyText: 'chr30',
    readyTimeout: 90000,
    settleMs: 6000,
    // gene track plus all 39 sample rows and the genotype legend
    viewportHeight: 870,
  },

  // Copy number over the same gene (Meadows et al. 2023, Fig 10a), from read
  // depth over the 15 CRAMs the Dog10K share publishes. Painted the way the
  // paper and QuicK-mer2 itself draw copy number: each 5 kb window rounded to
  // an integer and colored by it (2 black, 3 dark blue, 4 blue, 5 cyan), which
  // is the same BED9 painting the wolfdog ancestry figure above uses. A wiggle
  // per dog was the alternative and it renders each window's 7-10% spread as
  // wobble that reads like structure; rounding states the call instead. Built
  // by scripts/build_dog10k_cyp1a2_cn.sh.
  {
    mode: 'url',
    name: 'dog10k-cyp1a2-copy-number',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // the copy-number element plus ~30 kb of copy-number-two sequence either
      // side, which is the comparison the figure rests on
      loc: 'chr30:38,235,000-38,295,000',
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 90,
        },
        {
          trackId: 'dog10k_cyp1a2_cn',
          type: 'LinearMultiRowFeatureDisplay',
          height: 400,
        },
      ],
    }),
    readyText: 'chr30',
    // gate on the data-driven color key rather than a settle, same reason as
    // the ancestry painting: canvasDrawn can flip on an empty first paint
    readySelector: '[data-testid="multirow-color-legend"]',
    readyTimeout: 90000,
    settleMs: 6000,
    // gene track plus all 15 dog rows and the copy-number key
    viewportHeight: 730,
  },

  // The same estimate over the whole collection. The 15 CRAMs are all the share
  // publishes, but the SNV callset carries a per-sample DP at every site for all
  // 1,987 canids, and the same ratio of element depth to that dog's own flank
  // depth reproduces the CRAM answer (r = 0.97 per window, no bias) — so this
  // paints every dog in the collection rather than the fifteen with reads.
  // Rows take the display's default sorted order, which for Dog10K IDs means
  // grouped by breed (`BOPD*`, `CHIH*`, `VILL*` village dogs, `CLUP*` wolves) —
  // so whole breeds fixed for the expansion read as solid bands, which is the
  // paper's "variable in all major clades" claim. Built by
  // scripts/build_dog10k_cyp1a2_cn.sh.
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
          // auto-fit bottoms out at 1px a row, so 1,987 rows set the height
          // rather than take it; this is what they come to
          height: 2000,
        },
      ],
    }),
    readyText: 'chr30',
    readySelector: '[data-testid="multirow-color-legend"]',
    readyTimeout: 90000,
    settleMs: 6000,
    // gene track plus the full 1,987-row stack and the copy-number key
    viewportHeight: 2320,
  },
]
