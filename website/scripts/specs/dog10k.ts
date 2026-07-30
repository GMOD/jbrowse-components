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

// Sidebar rows for the marker figure. The VCF keeps the Dog10K sample IDs (they
// are the data's identity, and the build script writes this same order);
// `layout` only relabels the rows, two per sample since the matrix is drawn in
// phased mode.
//
// The swatches are the painting's own Okabe-Ito pair, and they carry the whole
// figure: orange means "this haplotype is a wolf haplotype" and blue means "this
// one is a dog haplotype". For the two reference groups that is a fact about the
// animal. For the eleven painted animals it is *the painting's call in this
// window*, per haplotype, read off the committed BED — so a reader's rule is
// "orange swatch, filled row", and every row either follows it or is the
// disagreement worth looking at.
const WOLF_SWATCH = '#E69F00'
const DOG_SWATCH = '#0072B2'

const GREEK_WOLVES = Array.from(
  { length: 12 },
  (_, i) => `CLUPGR0000${String(i + 1).padStart(2, '0')}`,
)

const GSD_REFERENCE = [
  'GRSD000003',
  'OLGS000001',
  'OLGS000002',
  'OLGS000003',
  'OLGS000004',
  'OLGS000005',
  'OLGS000006',
]

// FLARE's per-haplotype call across chr1:107.9-108.1 Mb, from
// test_data/dog10k/dog10k_wolfdog_ancestry.chr1.bed.gz. Every one of these
// haplotypes has a single call spanning the whole window, so one letter per
// haplotype is the complete story rather than a summary:
//   tabix dog10k_wolfdog_ancestry.chr1.bed.gz chr1:107935000-108005000
const PAINTED = [
  { sample: 'SAAR000001', label: 'Saarloos 1', calls: 'WD' },
  { sample: 'SAAR000002', label: 'Saarloos 2', calls: 'WD' },
  { sample: 'SAAR000003', label: 'Saarloos 3', calls: 'DD' },
  { sample: 'SAAR000004', label: 'Saarloos 4', calls: 'DD' },
  { sample: 'CZEC000001', label: 'Czechoslovakian 1', calls: 'DD' },
  { sample: 'CZEC000002', label: 'Czechoslovakian 2', calls: 'DD' },
  { sample: 'CZEC000003', label: 'Czechoslovakian 3', calls: 'WW' },
  { sample: 'CZEC000004', label: 'Czechoslovakian 4', calls: 'WD' },
  { sample: 'GRSD000002', label: 'German Shepherd 1', calls: 'DD' },
  { sample: 'SHIL000001', label: 'Shiloh Shepherd 1', calls: 'DD' },
  { sample: 'TMSK000001', label: 'Tamaskan 1', calls: 'DD' },
]

// HP is 0-based on the wire (`<sample> HP0`/`HP1`, see makeHaplotypeSources);
// the labels count from 1 to match the painting track's row names
function haplotypeRows({
  sample,
  label,
  color,
  suffix = () => '',
}: {
  sample: string
  label: string
  color: (hp: number) => string
  suffix?: (hp: number) => string
}) {
  return [0, 1].map(hp => ({
    name: `${sample} HP${hp}`,
    sampleName: sample,
    HP: hp,
    label: `${label} hap${hp + 1}${suffix(hp)}`,
    color: color(hp),
  }))
}

const DOG_VCF_LAYOUT = [
  ...GREEK_WOLVES.flatMap((sample, i) =>
    haplotypeRows({
      sample,
      label: `Greek wolf ${i + 1}`,
      color: () => WOLF_SWATCH,
    }),
  ),
  // The call goes in the label as well as the swatch. An 8px swatch is a fine
  // grouping cue but too small to *check* a row against, and checking is the
  // whole job here — the two rows that disagree with their call have to be
  // findable without a callout painted over the figure.
  ...PAINTED.flatMap(({ sample, label, calls }) =>
    haplotypeRows({
      sample,
      label,
      color: hp => (calls[hp] === 'W' ? WOLF_SWATCH : DOG_SWATCH),
      suffix: hp => (calls[hp] === 'W' ? ': Wolf' : ': Dog'),
    }),
  ),
  ...GSD_REFERENCE.flatMap((sample, i) =>
    haplotypeRows({
      sample,
      label: i === 0 ? 'German Shepherd Dog' : `Old German Shepherd ${i}`,
      color: () => DOG_SWATCH,
    }),
  ),
]

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

// Every animal of every breed, in the order the build script writes them: for
// these two variants the distribution *within* a breed is the content, and a
// head-N panel had 24 of 25 dogs het or hom-alt. Eight Mastiff/Terrier-clade
// breeds (the four the paper names plus the four largest others of the clade),
// then Labrador Retrievers as the unrelated breed, then all twelve Greek gray
// wolves — enough wolves for the second SINE's wolf carriers to show, which is
// what separates it from the first.
const DENR_GROUPS = [
  {
    label: 'Boxer',
    color: '#0072B2',
    ids: ['BOXR000001', 'BOXR000002', 'BOXR000003', 'BOXR000004', 'BOXR000005'],
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
    // BULD000001 is a French Bulldog in the sample table despite the prefix; the
    // label follows the table, not the ID
    label: 'French Bulldog',
    color: '#0072B2',
    ids: [
      'BULD000001',
      'FBUL000001',
      'FBUL000002',
      'FBUL000003',
      'FBUL000004',
      'FBUL000005',
      'FBUL000006',
    ],
  },
  {
    label: 'Staffordshire Bull Terrier',
    color: '#0072B2',
    ids: [
      'STAF000001',
      'STAF000002',
      'STAF000003',
      'STAF000004',
      'STAF000005',
      'STAF000006',
    ],
  },
  {
    label: 'Dogue de Bordeaux',
    color: '#0072B2',
    ids: ['DDBX000001', 'DDBX000002', 'DDBX000003', 'DDBX000004', 'DDBX000005'],
  },
  {
    label: 'Neapolitan Mastiff',
    color: '#0072B2',
    ids: ['NEAP000001', 'NEAP000002', 'NEAP000003', 'NEAP000004', 'NEAP000005'],
  },
  {
    label: 'Labrador Retriever',
    color: '#999999',
    ids: [
      'LABR000001',
      'LABR000002',
      'LABR000003',
      'LABR000004',
      'LABR000005',
      'LABR000006',
    ],
  },
  {
    label: 'Greek wolf',
    color: '#E69F00',
    ids: Array.from(
      { length: 12 },
      (_, i) => `CLUPGR0000${String(i + 1).padStart(2, '0')}`,
    ),
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

  // Does the painting survive contact with the genotypes it was inferred from?
  // The check is the 21 markers in this window whose alt allele is common in the
  // wolf panel and rare in the dog panel (AF_wolf >= 0.8, AF_dog <= 0.15, both
  // written per site by the build script from the full panels). They sit in one
  // 11 kb LD block, so each row is effectively one haplotype read 21 times, and
  // a row is either filled or empty rather than speckled.
  //
  // The rows are the twelve Greek gray wolves (filled, by construction), the
  // eleven painted animals swatched by the painting's own per-haplotype call,
  // and the seven German Shepherd-lineage dogs as the dog background both
  // wolfdog breeds were crossed back to. No ancestry-painting track above it:
  // at 15 kb the painting is a stack of solid stripes, and the swatch column
  // already carries its calls.
  //
  // 34 of the 36 non-reference rows follow their call, and the two that don't —
  // Saarloos 2 hap2 and Saarloos 4 hap2, both called Dog, both filled — are the
  // figure's point rather than a defect in it. The markers average AF 0.86 in
  // wolves and 0.098 in dogs, so 11.4% of the collection's 3,138 breed-dog
  // haplotypes carry them; across 17 dog-called haplotypes that predicts ~1.9
  // carriers and there are 2. A block call at one locus is an estimate, and this
  // is what the estimate looks like where it is wrong.
  {
    mode: 'url',
    name: 'dog10k-wolfdog-block-genotypes',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // the markers span chr1:107,986,844-107,998,239; this frames them with a
      // little margin either side
      loc: 'chr1:107,985,000-108,000,000',
      tracks: [
        {
          trackId: 'dog10k_wolfdog_block_genotypes',
          type: 'LinearMultiSampleVariantMatrixDisplay',
          renderingMode: 'phased',
          height: 700,
          layout: DOG_VCF_LAYOUT,
          // Paint the alt cells in the painting's own wolf orange rather than
          // the default genotype blue. Two reasons: carrying these alleles *is*
          // the wolf signal, so the cell and the ancestry block above it end up
          // the same color; and the default blue is the same blue as the Dog
          // swatch, which made a dog-called row that carries the haplotype (the
          // two the figure is about) read as a swatch rather than as data.
          featureColor: WOLF_SWATCH,
          // Without this the lane draws every one of the window's ~150 sites,
          // nearly all of which are shared between wolves and dogs and say
          // nothing about ancestry — which is what made the old version of this
          // figure a wall of salt-and-pepper. `AF_wolf`/`AF_dog` are
          // `Number=A`, hence the [0].
          jexlFilters: [
            "jexl:get(feature,'INFO').AF_wolf[0] >= 0.8 && get(feature,'INFO').AF_dog[0] <= 0.15",
          ],
        },
      ],
    }),
    readyText: 'chr1',
    readySelector: '[data-testid="variant-matrix-display-done"]',
    readyTimeout: 90000,
    settleMs: 6000,
    // all 60 haplotype rows and the genotype legend, nothing below. 905 fit the
    // last row's label but cut its cell band against the frame.
    viewportHeight: 920,
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
      // The whole NHEJ1 gene (chr37:25,513,157-25,595,616 in canFam4 RefSeq) and
      // nothing past it, so the deletion is visibly inside an intron. The old
      // right edge at 25,600,000 reached into SLC23A3/LOC111094448, which added
      // a fourth packed row the 110px gene track could not fit -- so the capture
      // carried the track's overflow/resize widget and a half-cut gene label.
      loc: 'chr37:25,510,000-25,596,000',
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
    // What the deletion does, beside the column that carries it. The legend can
    // say "homozygous alt" but not that homozygous is the affected state: CEA is
    // recessive (Parker et al. 2007; OMIA 000218-9615), so the dark cells are
    // affected animals and the light ones are unaffected carriers, which is the
    // difference between the two blues a reader cannot otherwise infer. The pill
    // sits left of the column, over lane that paints nothing — the filtered lane
    // has one record, so no cell is covered.
    annotations: [
      {
        type: 'text',
        text: '7.8 kb intron deletion, recessive:\nhomozygotes have Collie eye anomaly',
        fontSize: 22,
        maxWidth: 460,
        anchor: {
          track: 'dog10k_nhej1_svs',
          locus: 'chr37:25,574,005-25,581,807',
          fracY: 0,
          dx: -704,
          dy: 170,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'dog10k_nhej1_svs',
          locus: 'chr37:25,574,005-25,581,807',
          fracY: 0,
          dx: -249,
          dy: 175,
        },
        anchor: {
          track: 'dog10k_nhej1_svs',
          locus: 'chr37:25,574,005-25,581,807',
          fracY: 0,
          dx: -100,
          dy: 175,
        },
      },
    ],
  },

  // The two SINEC2A1 deletions in DENR introns (Schall & Kidd 2025, Fig S6):
  // ~220 bp mobile-element dimorphisms, the opposite kind of variant to the rare
  // 7.8 kb deletion above. The SINEs are present in the German Shepherd
  // reference, so a "deletion" call means the SINE is absent, and homozygous
  // reference (grey) means the animal carries it on both chromosomes.
  //
  // Two columns, and the panel is sized so each of the three genotypes has real
  // weight in it rather than one animal (see DENR_GROUPS). Read left to right:
  // the Mastiff/Terrier clade carries both repeats, the Labradors have lost
  // both, and the twelve wolves have lost the first one entirely while a third
  // of them still carry the second. Two adjacent repeats in the same gene with
  // different histories, which four wolves could not show and which the earlier
  // version of this figure asserted the opposite of.
  // Built by scripts/build_dog10k_nhej1_sv.sh.
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
          // 56 rows. 700 divided to exactly 12.5px a row and cut the last one
          // against the track's own bottom border, which no viewportHeight can
          // fix -- the clipping is inside the track box, not below the fold.
          height: 730,
          layout: DENR_LAYOUT,
          // Draw reference alleles instead of filling the lane grey. The default
          // 'skip' paints the whole background REFERENCE_COLOR and omits
          // homozygous-reference cells, which is the right default when a cell
          // means "carries the variant" — but here the reference allele is the
          // SINE being present, so an omitted cell is the state the figure is
          // about and it was indistinguishable from empty lane.
          referenceDrawingMode: 'draw',
        },
      ],
    }),
    readyText: 'chr26',
    readyTimeout: 90000,
    settleMs: 6000,
    // gene track plus all 56 sample rows and the genotype legend
    viewportHeight: 1094,
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
    //
    // Second line is the phenotype, and it says *homozygotes* because that is
    // what the pharmacology shows: liver microsomes from T/T dogs carry no
    // CYP1A2 protein while C/T and C/C do, and every poor metabolizer typed in
    // Mise et al. 2004 / Tenmizu et al. 2004 was T/T. So the dark cells are the
    // affected animals and the light ones are carriers — a distinction the
    // legend can state but not interpret.
    annotations: [
      {
        type: 'text',
        text: 'CGA → TGA (Arg373 → stop)\nhomozygotes make no CYP1A2:\npoor drug metabolizers',
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
  // Sorted rather than clustered. Clustering answers "how many distinct profiles
  // are there", and that answer is a dendrogram -- which needs a reader able to
  // follow a row, and at a fraction of a pixel a row there is none. Sorting on
  // the copy number each animal carries over the gene answers "how is copy
  // number distributed" instead, which survives the scale: the integer calls
  // resolve into bands with sharp edges, and that the edges are sharp is itself
  // the finding (a genotype, not a continuous measurement).
  //
  // Named animals above the collection, the paper's own pairing for the
  // neighbouring SLC28A3 expansion (Fig 11): labelled rows thick enough to read,
  // then the distribution over every sample.
  //
  // The upper lane is whole groups -- every Golden Retriever, Labrador Retriever
  // and Boxer in the collection, plus the four Greek wolves the nonsense-allele
  // figure draws -- so "every animal of this group carries it" is a claim the
  // panel can make. `rowOrder` runs the groups high to low.
  //
  // It replaced a wild-versus-domestic split (67 wild canids against 1,920 dogs,
  // equal pixel heights), which was legible and showed nothing: half the dogs
  // carry three or more copies too, so both lanes came out mostly red. The
  // structure in this data is per-breed.
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
          // 21 rows over 380px, so each row is thick enough to carry its own
          // label and the element's extent in one animal is readable -- the
          // thing the collection lane below structurally cannot show.
          trackId: 'dog10k_cyp1a2_breed_cn',
          type: 'LinearMultiRowFeatureDisplay',
          height: 380,
        },
        {
          trackId: 'dog10k_cyp1a2_cohort_cn',
          type: 'LinearMultiRowFeatureDisplay',
          height: 300,
          // Sorted by the copy number each dog carries over the element rather
          // than clustered by its whole profile. Same one-shot declarative
          // trigger as the QTL painting: the display computes the order from the
          // loaded features. 38,262,000 is inside the window with the widest
          // spread and no copy-number-one dog, so the sort resolves into five
          // clean bands running high to low with no loss colors interleaved.
          sortRowsBy: { refName: 'chr30', pos: 38_262_000 },
        },
      ],
    }),
    readyText: 'chr30',
    // sources exist only once features are loaded and binned into rows, which is
    // also what the sort waits on
    readySelector: '[data-testid="multirow-row-labels"]',
    readyTimeout: 120000,
    settleMs: 8000,
    // gene track, the 380px panel and the 300px collection lane, their headers,
    // and the copy-number key
    viewportHeight: 1045,
  },

  // The same estimate at SLC28A3, which is Fig 11 of the same paper: a
  // duplication over a gemcitabine transporter that every Grand Basset Griffon
  // Vendeen carries and the basset hounds segregate for. Two lanes, as above.
  //
  // Where CYP1A2 is carried by most of the collection, this one is rare -- under
  // 5% of canids -- so the collection lane below is a grey field with a red band
  // at the top of the sort rather than a ramp, and the panel is what carries the
  // finding. That contrast is the reason both loci are drawn.
  {
    mode: 'url',
    name: 'dog10k-slc28a3-copy-number',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr1:75,540,000-75,760,000',
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 90,
        },
        {
          // 14 rows over 300px: every animal of the three breeds, each row thick
          // enough for its own label and for the element's edges in that animal.
          trackId: 'dog10k_slc28a3_breed_cn',
          type: 'LinearMultiRowFeatureDisplay',
          height: 300,
        },
        {
          trackId: 'dog10k_slc28a3_cohort_cn',
          type: 'LinearMultiRowFeatureDisplay',
          height: 300,
          // Inside the duplication and clear of both its edges, so the sort
          // separates carriers from the rest on one window rather than on where
          // an animal's element happens to start.
          sortRowsBy: { refName: 'chr1', pos: 75_660_000 },
        },
      ],
    }),
    readyText: 'chr1',
    readySelector: '[data-testid="multirow-row-labels"]',
    readyTimeout: 120000,
    settleMs: 8000,
    // gene track, two 300px lanes, their headers, and the copy-number key
    viewportHeight: 965,
  },
]
