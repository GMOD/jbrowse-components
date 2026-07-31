import { lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the five Dog10K tutorials (local_ancestry.md, dog10k_svs.md,
// dog10k_lof.md, dog10k_selection.md, dog10k_retrogene.md). All read
// test_data/dog10k/config.json, whose data is built by the scripts/build_dog10k_*
// scripts: _wolfdog_ancestry, _nhej1_sv, _cyp1a2, _cyp1a2_cn, _slc28a3_cn,
// _igf1, _size_fst, _fgf4_retrogene and _fgf4_synteny.

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

// One score domain for both halves of dog10k-size-fst-scan, so the peak the
// zoom draws is the same height as the point it comes from. 0.8 is what the
// whole-genome half gets from autoscale anyway (build_dog10k_size_fst.sh prints
// the top windows; the highest is chr10's), and writing it down is what keeps
// the two axes from parting company when only one of them is autoscaled.
const FST_AXIS = { minScore: 0, maxScore: 0.8 }

// The IGF1 peak window, which the zoom half marks and the tutorial's next
// figure slices. One 200 kb bin of the scan.
const IGF1_PEAK_WINDOW = 'chr15:41,400,000-41,600,000'

// What a retrocopy row carries: the submitters' own annotation of the deposited
// record, which is the figure's claim restated in the form a reader already knows
// how to read -- the parent's CDS is three boxes and this is one. It is GenBank's
// feature table, not a prediction of ours; build_dog10k_fgf4_synteny.sh fails if
// either CDS is a `join(...)`, the shape a processed retrocopy cannot have.
//
// A sequence track under it was the first version, from when the annotation did
// not exist and the row needed anything at all to stay off the "No tracks active"
// empty state. Dropped once the annotation landed: at 1 bp/px it was base-colored
// stripes, the most saturated thing in the frame and the least informative, and it
// sat directly against the synteny bands competing with the ribbons. Bases are a
// zoom away in the live link.
const RETRO_TRACKS = (genesTrackId: string) => [
  {
    trackId: genesTrackId,
    type: 'LinearBasicDisplay',
    height: 55,
  },
]

// The retrocopy-vs-parent synteny session. `parent` is the chr18 window and
// `retro` the corresponding sub-range of each retrocopy, which have to be derived
// together: a retrocopy is 1,066 bp shorter than the reference span it covers, so
// the two rows can never share a scale, and a row showing more or less than its
// alignment covers would put ribbon-free sequence in the frame.
function fgf4SyntenySession(parent: string, retro: Record<string, string>) {
  return sessionSpec(DOG_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        // straight quadrilaterals, not drawCurves: a bezier bows away from its
        // own endpoints, and the whole figure is where four block edges sit
        // against two intron boundaries
        drawCurves: false,
        // 'matches', so each intron is an unpainted gap in the ribbon rather
        // than a colored wedge. NOT a cosmetic choice: 'full' names each indel
        // op, and the perspective-flip swaps D<->I, so the SAME 532 bp gap came
        // out as a yellow deletion above the parent row and a blue insertion
        // below it -- one event in two colors, decided by stacking order.
        // Unpainted is symmetric, and "the retrocopy has nothing here" is the
        // claim anyway. It also drops the slivers the 1-6 bp indels drew.
        cigarMode: 'matches',
        alpha: 0.45,
        // 2-D form, one entry per adjacent pair: level 0 is retro-CFA18 against
        // the parent, level 1 the parent against retro-CFA12
        tracks: [['dog10k_fgf4_retro_cfa18'], ['dog10k_fgf4_retro_cfa12']],
        views: [
          {
            assembly: 'FGF4retro-CFA18',
            loc: retro['FGF4retro-CFA18']!,
            tracks: RETRO_TRACKS('dog10k_fgf4_retro_cfa18_genes'),
          },
          {
            assembly: 'UU_Cfam_GSD_1.0',
            loc: parent,
            tracks: [
              {
                trackId: 'canFam4_ncbi_refseq',
                type: 'LinearBasicDisplay',
                height: 60,
              },
              // The positional display, one row of two features, NOT the 55-row
              // multi-sample display the figure above uses. Per-breed carriage is
              // that figure's job and it is directly above this one; here the
              // records are a coordinate to compare the gaps against, and 55 rows
              // between the two synteny bands would put 690 px between the things
              // being compared.
              {
                trackId: 'dog10k_fgf4_svs',
                type: 'LinearVariantDisplay',
                // one row, once `showLabels`/`showDescriptions` are off on the
                // track (the two records don't overlap -- it was record 1's name
                // and its `<DEL:SVSIZE=532:AGGREGATED>` description that pushed
                // record 2 onto a second row)
                height: 34,
              },
            ],
          },
          {
            assembly: 'FGF4retro-CFA12',
            loc: retro['FGF4retro-CFA12']!,
            tracks: RETRO_TRACKS('dog10k_fgf4_retro_cfa12_genes'),
          },
        ],
      },
    ],
  })
}

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
          // A run of alt cells is one solid orange band, so at the 20px schema
          // default nothing in the frame said how many markers it was made of
          // and the lane read as two painted blocks. The connector band ties each
          // column back to its position in the 11 kb block, which is what makes
          // it visibly a 21-marker panel.
          lineZoneHeight: 55,
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
  //
  // THE MATRIX DISPLAY, not the positional one, and that is the whole of what
  // review asked for: "it just doesn't seem to be telling a strong story by
  // itself. visually it is like 'ok two verticalstripes'". Both SINEs are ~220 bp
  // in a 6.5 kb window, so drawn at their true span they were two 35 px stripes
  // in a frame that was otherwise blank, and the genotype of any one animal was a
  // few pixels of colour. The matrix spaces one column per record instead, so each
  // repeat is half the width of the panel and a row's two cells are readable side
  // by side; the connector zone under the gene track is what maps each column
  // back to the intron it sits in.
  // Built by scripts/build_dog10k_nhej1_sv.sh.
  {
    mode: 'url',
    name: 'dog10k-denr-sine-deletions',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // All of DENR (chr26:6,929,118-6,943,861 in canFam4 RefSeq) plus flanks,
      // per review ("need to zoom out more"). The old 6.5 kb window cut the gene
      // at both edges, so the transcript rows ran off both sides and the
      // connector zone pointed into a gene the reader could not see the shape
      // of. Zooming out costs nothing here: the track holds exactly the two SINE
      // records the build script selected, so the matrix still has two columns
      // however wide the window is.
      loc: 'chr26:6,927,500-6,945,500',
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 100,
        },
        {
          trackId: 'dog10k_denr_svs',
          type: 'LinearMultiSampleVariantMatrixDisplay',
          // 56 rows. 700 divided to exactly 12.5px a row and cut the last one
          // against the track's own bottom border, which no viewportHeight can
          // fix -- the clipping is inside the track box, not below the fold.
          height: 730,
          // The two columns are laid out by feature index, so the only thing
          // saying which repeat is which is the band of lines tying each column
          // back to its position in the gene above. At the 20px default that
          // band is a sliver; over a whole-gene window it has to carry a real
          // diagonal, which is what makes the left column the first intron's
          // repeat rather than just the left half of a panel.
          lineZoneHeight: 60,
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

  // The body-size selection scan, whole genome: the top half of
  // dog10k-size-fst-scan. Hudson Fst per 200 kb window between the toy/small
  // and giant animals the IGF1 figure below already panels, computed by
  // build_dog10k_size_fst.sh off the Dog10K phased panel and loaded as a
  // GWASTrack — the score column is Fst rather than -log10(p), which is what
  // `scoreColumn`/`scoreTransform: 'none'` on GWASAdapter are for.
  //
  // No `loc`, so afterAttach's showAllRegionsInAssembly lays out all 38
  // autosomes. The assembly's chrom.sizes is local to the config, so there is no
  // remote fetch for that call to race.
  {
    mode: 'url',
    name: 'dog10k-size-fst-scan-genome',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // No `loc`, so the view lays out whole regions; `displayedRegionNames`
      // restricts it to the 38 autosomes in order. The scan is autosomal (the
      // panel BCF is AutoAndXPAR), so drawing chrX would be an empty lane.
      displayedRegionNames: Array.from({ length: 38 }, (_, i) => `chr${i + 1}`),
      tracks: [
        {
          trackId: 'dog10k_size_fst',
          type: 'LinearManhattanDisplay',
          height: 380,
          scatterPointSize: 4,
          ...FST_AXIS,
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 120000,
    settleMs: 10000,
    viewportHeight: 600,
    // Three known body-size loci among the top windows, named. A reader cannot
    // get a gene out of a scatter point, and a Manhattan whose peaks are
    // anonymous is only a shape.
    //
    // Not "the three tallest": chr10 takes thirteen of the top fourteen windows,
    // as one broad block running from about 2 to 10 Mb, so ranking by score
    // alone names that block three times. Each label sits on the highest window
    // overlapping its gene (HMGA2 rank 1, IGF1 rank 4, IGF2BP2 rank 14), which
    // build_dog10k_size_fst.sh prints so the ranks can be re-derived.
    //
    // The locus is each gene's own coordinate resolved through the live model,
    // so a re-render cannot leave a label pointing at the wrong chromosome. The
    // pill is then pushed off that position and an arrow drawn back to it,
    // because a pill centered on its own peak covers the one point it names,
    // and a pill nudged clear of the peak with nothing joining them names any
    // of the lanes it happens to sit over — both of which the first pass did.
    //
    // Only `dy` is hand-set, since `fracY` cannot say "at this score": the
    // y-axis runs 0 to 0.8 over 461 px, so a window's point sits `381 - 461*fst`
    // px below the track's top edge. Each head's `dy` is that value less about
    // 15 px, deliberately: a head placed exactly on the point covers it, which
    // the arrowhead is wide enough to do at this point size. The pills sit
    // further up again, clear of both.
    annotations: [
      {
        type: 'text',
        text: 'HMGA2',
        fontSize: 20,
        anchor: {
          track: 'dog10k_size_fst',
          locus: 'chr10:8,600,000-8,800,000',
          fracY: 0,
          dx: 150,
          dy: 18,
        },
      },
      {
        type: 'arrow',
        anchor: {
          track: 'dog10k_size_fst',
          locus: 'chr10:8,600,000-8,800,000',
          fracY: 0,
          dx: 12,
          dy: 34,
        },
        fromAnchor: {
          track: 'dog10k_size_fst',
          locus: 'chr10:8,600,000-8,800,000',
          fracY: 0,
          dx: 92,
          dy: 26,
        },
      },
      {
        type: 'text',
        text: 'IGF1',
        fontSize: 20,
        anchor: {
          track: 'dog10k_size_fst',
          locus: IGF1_PEAK_WINDOW,
          fracY: 0,
          dx: 128,
          dy: 152,
        },
      },
      {
        type: 'arrow',
        anchor: {
          track: 'dog10k_size_fst',
          locus: IGF1_PEAK_WINDOW,
          fracY: 0,
          dx: 8,
          dy: 204,
        },
        fromAnchor: {
          track: 'dog10k_size_fst',
          locus: IGF1_PEAK_WINDOW,
          fracY: 0,
          dx: 88,
          dy: 168,
        },
      },
      {
        // chr34 sits against the right edge of the view, so this one is labelled
        // from the left; the other two have room on the right.
        type: 'text',
        text: 'IGF2BP2',
        fontSize: 20,
        anchor: {
          track: 'dog10k_size_fst',
          locus: 'chr34:18,600,000-18,800,000',
          fracY: 0,
          dx: -150,
          dy: 186,
        },
      },
      {
        type: 'arrow',
        anchor: {
          track: 'dog10k_size_fst',
          locus: 'chr34:18,600,000-18,800,000',
          fracY: 0,
          dx: -14,
          dy: 234,
        },
        fromAnchor: {
          track: 'dog10k_size_fst',
          locus: 'chr34:18,600,000-18,800,000',
          fracY: 0,
          dx: -88,
          dy: 202,
        },
      },
    ],
  },

  // The zoom half of dog10k-size-fst-scan (review: "if possible create a two
  // part figure with a zoom in also"). Two megabases of chr15 around the IGF1
  // peak, the same track and the same axis as the whole-genome half above it, so
  // the labelled point up there becomes a window with neighbours to be higher
  // than and a gene track saying what it sits on. The window the tutorial slices
  // next is inside this one, which is what makes the pair a path rather than two
  // pictures.
  //
  // `highlight` rather than a callout: it is the peak window's own coordinates
  // drawn by the view, so the marked band cannot drift off the point it marks,
  // and it is in the figure's live link.
  {
    mode: 'url',
    name: 'dog10k-size-fst-scan-igf1',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr15:40,600,000-42,600,000',
      highlight: [IGF1_PEAK_WINDOW],
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
          displayMode: 'compact',
          height: 90,
        },
        {
          trackId: 'dog10k_size_fst',
          type: 'LinearManhattanDisplay',
          height: 380,
          // ten windows across this view against twelve thousand across the
          // genome, so the points carry the figure at a size the whole-genome
          // half could not use
          scatterPointSize: 9,
          ...FST_AXIS,
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 120000,
    settleMs: 6000,
    // the gene lane, all 380 px of the score lane, and its bottom border: at 700
    // the lowest windows sat on the frame edge
    viewportHeight: 716,
  },

  {
    mode: 'compose',
    name: 'dog10k-size-fst-scan',
    parts: ['dog10k-size-fst-scan-genome', 'dog10k-size-fst-scan-igf1'],
  },

  // The FGF4 retrogene (Parker et al. 2009). A processed retrocopy has no
  // introns, so reads from it pile onto the parent gene's exons and stop at each
  // splice site; a short-read SV caller reading that pileup calls a deletion of
  // each intron. The Dog10K Manta callset carries exactly two such records over
  // FGF4, and build_dog10k_fgf4_retrogene.sh asserts each one's span against the
  // RefSeq intron it claims before writing anything.
  //
  // POSITIONAL, not the matrix display, and here that is the figure rather than
  // a preference: the claim is that the two blue blocks land in the two gaps of
  // the gene model above them. A matrix spaces one column per record and throws
  // that geometry away.
  //
  // No `layout` array. The row labels and the swatch groups come from
  // `samplesTsvLocation` on the adapter (`dog10k_fgf4_samples.tsv`, written by
  // the build script off the Dog10K sample table), so the sample-to-breed
  // mapping lives beside the data instead of being restated here. The TSV's own
  // order is the row order.
  //
  // The swatch says what a breed *looks like*, never what it carries: the two
  // spaniel groups are standard-proportioned and carry a retrocopy anyway, which
  // is the second insertion (Brown et al. 2017, disc disease rather than short
  // legs). One record cannot tell the two apart, and a swatch keyed on the
  // genotype would have hidden that.
  {
    mode: 'url',
    name: 'dog10k-fgf4-retrogene',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      // FGF4 is chr18:48,869,443-48,873,311; this frames the whole gene with
      // just enough flank that the reader can see the records stop at the gene.
      // Wider and the two 532/534 bp blocks shrink to slivers, which is the one
      // thing this figure cannot afford.
      loc: 'chr18:48,868,900-48,873,900',
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 60,
        },
        {
          trackId: 'dog10k_fgf4_svs',
          type: 'LinearMultiSampleVariantDisplay',
          height: 690,
          colorBy: 'group',
        },
      ],
    }),
    readyText: 'chr18',
    readyTimeout: 90000,
    settleMs: 6000,
    // gene track plus all 55 sample rows and both legends
    viewportHeight: 1020,
  },

  // The same claim as sequence rather than as inference, which is what the figure
  // above cannot do: it draws a caller's response to a retrocopy, never the
  // retrocopy. Both dog FGF4 retrocopies were Sanger-sequenced and deposited
  // (MF040222, the CFA18 insertion of Parker et al. 2009; MF040221, the CFA12
  // insertion of Brown et al. 2017), so each one can be aligned back to the
  // parent gene, and build_dog10k_fgf4_synteny.sh asserts that its gaps against
  // the reference are the annotated introns before writing a PAF.
  //
  // THREE LEVELS, parent gene in the middle. Both retrocopies align to the same
  // three exons, so as two regions of one row their ribbons would cross through
  // each other; on either side of the parent they instead close on it from above
  // and below, and the two deletion wedges land at the same coordinates twice.
  // The retrocopy rows are the whole contig, which is the point -- a retrocopy is
  // continuous sequence exactly where the reference has an intron.
  {
    mode: 'url',
    name: 'dog10k-fgf4-retrogene-synteny',
    // NOT the window the figure above draws, which was the first version of this.
    // Sharing it put the whole payload -- three exons, two gaps, two records -- in
    // the left quarter of the frame, with the other three quarters the flat 3'
    // exon: measured, the gaps plus exon 2 were 695 px of a 2,918 px data area.
    // This is 2.2 kb instead of 5, so they fill it. What the wide window showed
    // and this does not is that each retrocopy spans the whole transcript, and
    // that the two differ in 3' extent; both are in the script output the guide
    // quotes, and neither was legible in the frame anyway.
    //
    // The retrocopy rows are the sub-range that covers this window, derived by
    // walking each PAF's CIGAR rather than scaled by eye. They have to be: a
    // retrocopy is 1,066 bp shorter than the reference span it covers, so a row
    // showing more would trail ribbon-free sequence and one showing less would cut
    // its own alignment.
    url: fgf4SyntenySession('chr18:48,869,100-48,871,300', {
      'FGF4retro-CFA18': 'FGF4retro-CFA18:1-1036',
      'FGF4retro-CFA12': 'FGF4retro-CFA12:2-1033',
    }),
    readyText: 'chr18',
    readyTimeout: 90000,
    settleMs: 6000,
    // an annotation lane per retrocopy plus the gene and SV lanes between them,
    // and the two synteny bands. Sized by the generator's below-the-fold check.
    viewportHeight: 750,
  },

  // There is deliberately NO whole-collection figure beside the panel above,
  // though `dog10k_fgf4_cohort_svs` is in the config so a reader can add the
  // lane. 1,879 rows in 520 px is a third of a pixel each: rows alias, so the
  // apparent stripe density is not the real carrier rate (the same trap the TCGA
  // cohort lane documents), and the result it was drawn for — no wolf carries
  // the record — is a 55-row band that reads as more of the surrounding
  // whitespace. The wolves are already in the panel figure as twelve labelled
  // rows, and the collection-wide count is printed by the build script, which is
  // a number the tutorial can quote and a reader can re-derive. Neither needs an
  // unreadable lane.

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
  // depth reproduces the CRAM answer (r = 0.92 per window, no bias). Painted as
  // BED9, each window rounded to an integer and colored by it, same as the
  // wolfdog ancestry figure above. A wiggle per dog was the alternative and it
  // renders each window's spread as wobble that reads like structure; rounding
  // states the call instead.
  //
  // The window is 5 kb of depth stepped by 1 kb, per review ("i also wish the
  // windows were smaller than 5kb"). 5 kb is what the counting noise sets, and
  // that was measured rather than kept: over the collection's own flanks, where
  // the answer is two by construction, 3.8% of 5 kb windows round off two
  // against 12.1% at 2.5 kb, 13.7% at 2 kb and 21.4% at 1 kb, so a narrower
  // window buys resolution by speckling a lane whose whole content is a flat
  // baseline. Sliding the same width instead paints the middle kilobase of each
  // window, which puts an element's edge within a kilobase of where it is
  // without touching the noise -- and it is what makes the zoomed-out frame
  // (185 kb, up from 60) readable rather than a row of 5 kb blocks.
  //
  // Clustered, not sorted on one window. Sorting answers "how is copy number
  // distributed at THIS position", which needed a position picked by hand and
  // which the 5 kb grid made arbitrary at the element's edges. Clustering groups
  // rows by their whole profile across the window, so the bands that come out
  // are extents rather than one column's values: animals carrying the same
  // element, at the same edges, land together. That only became worth doing when
  // the windows got finer -- at 5 kb steps most of the profile was the element
  // and there was nothing else to group on.
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
      loc: 'chr30:38,210,000-38,395,000',
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
          // One-shot declarative trigger, same shape as the QTL painting's sort:
          // the display runs MultiRowClusterFeatures over the loaded features
          // and reorders its rows from the result, then clears the flag.
          runClustering: true,
          // NO breed swatch stripe, and this is a measurement rather than a
          // preference. Review asked for one ("if it helps, add breed label
          // sidebar colors too"), and a previous pass deferred it on the belief
          // that a sub-pixel row could not carry a mark. That belief is now
          // wrong -- SvgRowLabels floors its swatch to a whole pixel and
          // `rowGroups` (LinearMultiRowFeatureDisplay/configSchema) is the slot
          // for exactly this -- so it was built and measured here: the four
          // groups the panel above names (CLUP wolves, GOLD, LABR, BOXR) are
          // ~250 of 1,987 rows, which is 10 CSS px of a 300px lane, and
          // `rowGroups` also pulls them out of the copy-number sort into blocks
          // at the top of the lane. 10px of stripe cannot attribute a copy
          // number to a breed, and it costs the sorted banding that is what this
          // lane is for. The breed attribution is the named-animals lane above,
          // which is the same four groups at a readable row height.
        },
      ],
    }),
    readyText: 'chr30',
    // the dendrogram exists only once the clustering RPC has returned, which is
    // the last thing to land: waiting on the row labels instead caught the frame
    // with "Computing distance matrix 0%" still in the corner and the rows in
    // file order
    readySelector:
      'body:has([data-testid="tree_sidebar_dendrogram"]) [data-testid="multirow-row-labels"]',
    readyTimeout: 180000,
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
    // The white stripe, named. It is one 5 kb window, chr1:75,575,000-75,580,000,
    // and it is unpainted on purpose: build_dog10k_slc28a3_cn.sh drops any window
    // whose median across the whole collection sits below two copies, because a
    // window every canid reads low is measuring the reference rather than any
    // dog (the same rule suppresses four blue stripes that would otherwise run
    // down the collection lane at the weight of the duplication). This one is
    // where the duplication's left breakpoint falls (ELEMENT_START 75,578,115),
    // which is why it reads low. Review has now read the gap as a rendering
    // glitch twice, once here and once on the CYP1A2 figure, and a caption did
    // not stop it — so the frame says it.
    annotations: [
      {
        type: 'text',
        anchor: {
          track: 'canFam4_ncbi_refseq',
          locus: 'chr1:75,553,000',
          fracY: 0.45,
        },
        text: 'no call: every canid reads low here',
        fontSize: 17,
        maxWidth: 300,
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'canFam4_ncbi_refseq',
          locus: 'chr1:75,563,000',
          fracY: 0.7,
        },
        anchor: {
          track: 'dog10k_slc28a3_breed_cn',
          locus: 'chr1:75,577,500',
          fracY: 0,
          dy: 40,
        },
      },
    ],
  },

  // The IGF1 body-size haplotype, drawn as a clustered genotype matrix over 167
  // canids: every animal of fourteen toy/small breeds, eleven giant breeds, and
  // the twelve Greek gray wolves. Built by scripts/build_dog10k_igf1.sh.
  //
  // THE MATRIX DISPLAY, per review ("consider using the 'matrix' mode for this.
  // hard to see the overarching pattern from snps"). In position space the
  // records sit where they are, which over 400 kb means most of the panel is the
  // gaps between them and the shared haplotype reads as speckle rather than as a
  // block. One column per record instead gives every SNV the same width, so a
  // set of animals carrying the same alleles is a solid band. The cost is that a
  // boundary now lands at a column rather than at a coordinate, which is what
  // the connector band above the rows is for. Only a little above its 20px
  // default: with hundreds of records no single line can be followed, and a tall
  // band is just a grey wedge over the rows the figure is about.
  //
  // `runClustering` orders the rows by genotype similarity. The size swatch
  // comes from the samples TSV and is applied afterwards, so the row order and
  // the swatch are independent.
  {
    mode: 'url',
    name: 'dog10k-igf1-haplotype',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr15:41,350,000-41,750,000',
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          height: 80,
        },
        {
          trackId: 'dog10k_igf1_haplotype',
          type: 'LinearMultiSampleVariantMatrixDisplay',
          height: 760,
          lineZoneHeight: 34,
          runClustering: true,
          colorBy: 'size',
        },
      ],
    }),
    readyText: 'chr15',
    // the dendrogram only renders once the clustering RPC lands, so this waits
    // on real completion rather than on a duration guess
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    readyTimeout: 120000,
    settleMs: 5000,
    // gene track, the 760px matrix, their headers, and the two keys
    viewportHeight: 1080,
  },
]
