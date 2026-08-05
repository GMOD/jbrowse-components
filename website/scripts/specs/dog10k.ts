import { lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the four Dog10K tutorials (local_ancestry.md, dog10k_svs.md,
// dog10k_lof.md, dog10k_selection.md). All read
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

// Sidebar rows for the marker figure, and the row order of the named-subset
// painting drawn above it. The VCF keeps the Dog10K sample IDs (they are the
// data's identity, and the build script writes this same order); `layout` only
// relabels the rows, two per sample since the matrix is drawn in phased mode.
//
// The order is not editorial: it is `named.tsv`, which
// scripts/build_dog10k_wolfdog_ancestry.sh writes sorted by descending chr1
// wolf fraction out of FLARE's own per-sample output. So the figure reads down
// the page as a ranking, and the eight breeds at the bottom of the sweep's
// wolf-fraction list are there because the sweep put them there rather than
// because they sound wolfish. Regenerate with:
//   cut -f2 dog10k_wolfdog_build/named.tsv
//
// The swatch marks which of the five groups a row belongs to. It deliberately
// does NOT encode the painting's per-haplotype call the way this figure's
// earlier version did: the window now spans block EDGES, so a haplotype is
// wolf-called over part of it and dog-called over the rest, and one letter per
// row would be a summary rather than the fact. The painting track directly
// above carries the call, at the same row order and the same row heights, so
// the two line up row for row.
const WOLF = '#E69F00'
const WOLFDOG = '#D55E00'
const LOOKALIKE = '#CC79A7'
const GSD = '#0072B2'
const SWEEP = '#999999'

const NAMED: [string, string, string][] = [
  ['CLUPPT000001', 'Gray wolf 7', WOLF],
  ['CLUPRU000003', 'Gray wolf 3', WOLF],
  ['CLUPPT000002', 'Gray wolf 8', WOLF],
  ['CLUPRU000001', 'Gray wolf 1', WOLF],
  ['CLUPRU000002', 'Gray wolf 2', WOLF],
  ['CLUPRU000004', 'Gray wolf 4', WOLF],
  ['CLUPSE000001', 'Gray wolf 5', WOLF],
  ['CLUPSE000002', 'Gray wolf 6', WOLF],
  ['SAAR000001', 'Saarloos 1', WOLFDOG],
  ['SAAR000003', 'Saarloos 3', WOLFDOG],
  ['SAAR000002', 'Saarloos 2', WOLFDOG],
  ['SAAR000004', 'Saarloos 4', WOLFDOG],
  ['CZEC000003', 'Czechoslovakian 3', WOLFDOG],
  ['SHIL000001', 'Shiloh Shepherd', LOOKALIKE],
  ['CZEC000001', 'Czechoslovakian 1', WOLFDOG],
  ['CZEC000004', 'Czechoslovakian 4', WOLFDOG],
  ['THAI000009', 'Thai Ridgeback', SWEEP],
  ['CHOW000004', 'Chow Chow', SWEEP],
  ['CAUC000004', 'Caucasian Ovcharka', SWEEP],
  ['GAFT000006', 'Great Anglo-French Tricolour Hound', SWEEP],
  ['KAIK000005', 'Kai Ken', SWEEP],
  ['ANAT000007', 'Anatolian Shepherd Dog', SWEEP],
  ['TMSK000001', 'Tamaskan', LOOKALIKE],
  ['SPEI000006', 'Chinese Shar-Pei', SWEEP],
  ['KARS000006', 'Kars', SWEEP],
  ['CZEC000002', 'Czechoslovakian 2', WOLFDOG],
  ['OLGS000001', 'Old German Shepherd 1', GSD],
  ['WSSD000003', 'White Swiss Shepherd 1', GSD],
  ['GRSD000002', 'German Shepherd', GSD],
  ['OLGS000002', 'Old German Shepherd 2', GSD],
  ['OLGS000003', 'Old German Shepherd 3', GSD],
  ['WSSD000004', 'White Swiss Shepherd 2', GSD],
]

// HP is 0-based on the wire (`<sample> HP0`/`HP1`, see makeHaplotypeSources);
// the labels count from 1 to match the painting track's row names
function haplotypeRows({
  sample,
  label,
  color,
}: {
  sample: string
  label: string
  color: string
}) {
  return [0, 1].map(hp => ({
    name: `${sample} HP${hp}`,
    sampleName: sample,
    HP: hp,
    label: `${label} hap${hp + 1}`,
    color,
  }))
}

const DOG_VCF_LAYOUT = NAMED.flatMap(([sample, label, color]) =>
  haplotypeRows({ sample, label, color }),
)

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
              // The 55-row multi-sample display, per review, rather than the
              // one-row positional display this used to carry. It draws each
              // record at its real coordinates the same way, so the geometry the
              // figure is about (a block edge on an intron boundary) survives the
              // swap, and every row now also says which breeds carry the record.
              // The cost is real and was the reason for the earlier choice: it
              // puts ~690 px between the two synteny bands, so the upper ribbon
              // and the lower one can no longer be taken in at once.
              {
                trackId: 'dog10k_fgf4_svs',
                type: 'LinearMultiSampleVariantDisplay',
                height: 690,
                colorBy: 'group',
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
  //
  // NOTHING IS MARKED ON IT. It used to carry the genotype window as an in-app
  // highlight plus a callout naming the block edges inside it, and a red box
  // over 1.2% of the frame reads as "something happens here" whatever the label
  // says, when what is inside it is an ordinary window picked for being
  // checkable (review: "if we are making up a story we should not do that ... i
  // just wanted to show ancestry painting"). The painting is the figure.
  //
  // STILL NOTHING MARKED ON IT after the next review, which was not a request
  // for a mark: "all dogs come from wolves so its just like, super recent in
  // this case? can add text that says this if it makes sense". That is right and
  // it is the one thing about this figure a reader cannot get from the pixels,
  // but it is a paragraph rather than a label, so it went into
  // local_ancestry.md under Reading the painting. The short version: FLARE
  // infers against the two panels it was handed, both of them modern, so
  // everything domestication carried into dogs is in BOTH panels, separates
  // nothing, and paints dog. Orange is only what still looks like a present-day
  // gray wolf and not like a breed dog, which after that much divergence means
  // recently acquired. The figure already carries both controls for that
  // reading: held-out wolves solid orange at the top, German Shepherd lineage
  // solid dog at the foot.
  //
  // "IF GENOME WIDE THERE ARE INTERESTING PATTERNS, WE CAN CONSIDER ZOOMING OUT
  // GENOME WIDE" (same review). Not available as a spec edit, and not because of
  // the display. scripts/build_dog10k_wolfdog_ancestry.sh takes ONE chromosome
  // (`CHROM="${1:-chr1}"`) and every step after it is per-chromosome: the panel
  // slice, the genetic map, the FLARE run, the BED. The hosted files are
  // dog10k_wolfdog_named.chr1.bed and dog10k_wolfdog_ancestry.chr1.bed. Genome
  // wide is 38 more FLARE runs over ~20x the sequence, then a re-upload of the
  // demo, so it is a build-and-host job to be asked for rather than a loc
  // change. Worth noting before anyone costs it out: chr1 is where the block
  // structure is legible at all, and the same rows at 1/20th the bp per pixel
  // would be flecks.
  {
    mode: 'url',
    name: 'dog10k-wolfdog-ancestry',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr1:1-123,556,469',
      tracks: [
        {
          trackId: 'dog10k_wolfdog_named',
          type: 'LinearMultiRowFeatureDisplay',
          // 64 rows. Above the 6px a row label needs, which is the whole reason
          // this figure exists next to the 486-row one below it.
          height: 700,
          // Rows are haplotypes, two per animal, and most of this painting is
          // one dog color running edge to edge — so without a line the row
          // count cannot be read off the image, and neither can which pair of
          // rows belongs to which name in the sidebar. The clustered figure
          // below is at ~2.3px a row and deliberately does NOT set this (below
          // MIN_SEPARATOR_ROW_PX the lines would be the figure).
          showRowSeparators: true,
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
    // all 64 haplotype rows plus the color legend, no page background below
    viewportHeight: 905,
  },

  // dog10k-wolfdog-ancestry-clustered was here and is DELETED (review: "you can
  // consider deleting"). It was the same FLARE painting over all 243 animals,
  // clustered, and 193 of the 219 breeds come in under 1% wolf on chr1 — so
  // roughly two thirds of a 2,610px capture was an unbroken dog-blue field whose
  // only content was that null result. The named-animals figure above it already
  // carries the spectrum with rows a reader can name, and the clustering
  // capability is shown in dog10k-igf1-haplotype. What the deleted figure knew
  // that nothing else did is now prose in local_ancestry.md: the clustering has
  // no access to the breed names and still separates the wolf carriers, and its
  // corner chip names the region the tree came from because clustering is
  // region-scoped.

  // dog10k-wolfdog-block-genotypes was here and is DELETED (review: "i dont
  // understand this figure. i'd just suggest deleting"). The previous pass had
  // already offered exactly this, and its argument for keeping it does not
  // survive a second reader not following the picture: three lanes at two
  // different row pitches, where reading it at all meant counting down from the
  // top of one lane to match a row in the other.
  //
  // THE WHOLE SECTION WENT WITH IT on the follow-up ("yes delete that section
  // too"), so local_ancestry.md no longer carries the block-edge check as a
  // section, the quoted count table, or the jexl marker filter. Note this
  // deliberately spends the tutorial convention that a page ends by checking its
  // inference against the raw data (website/docs/tutorials/CLAUDE.md): the check
  // now survives only as two sentences under Reproduce it end to end, pointing
  // at what the build script prints. Do not re-add a figure for it.
  //
  // The check still exists offline and is worth knowing before anyone re-derives
  // it: build_dog10k_wolfdog_ancestry.sh writes a genotype slice of
  // chr1:112,000,000-113,500,000 and prints, per painted block edge, how many
  // ancestry-informative markers a haplotype carries either side. Three of the
  // four wolfdog edges are exact (23/23 wolf alleles then 0/26 for both
  // haplotypes ending at 112,576,175, and 41/43 then 0/6 for Saarloos 1 hap1),
  // the five sweep-breed edges are not (13/23 for the Chow Chow and the Kai Ken,
  // and the Thai Ridgeback's block ends before the first marker), and Saarloos 2
  // hap2 at 3/5 then 6/44 is a real drop that is not a coordinate. The lane that
  // drew it needed AF_wolf >= 0.8 && AF_dog <= 0.15 as a jexl filter, over
  // frequencies the script wrote per site across the FULL panels rather than
  // across the 32 animals in the slice; unfiltered it is every common site in
  // 1.5 Mb and reads as salt-and-pepper.

  // Both Great Anglo-French hound breeds, five dogs each, from the second FLARE
  // run in scripts/build_dog10k_wolfdog_ancestry.sh.
  //
  // WHY THIS BREED. Lin et al. 2025 (PNAS 122:e2421768122) ran local ancestry
  // over the Dog10K genomes and found the Great Anglo-French Tricolour Hound has
  // the HIGHEST VARIANCE IN WOLF ANCESTRY of any breed analysed (0.03 to 5.47%),
  // two of its individuals carrying tracts long enough to date to ~17 and ~24
  // generations, and wrote that it is unclear where that ancestry came from. The
  // related White and Orange Hound is lower but also variable (0.004 to 1.8%).
  // That is a published claim about WITHIN-breed spread, and a one-dog-per-breed
  // sweep is structurally unable to show it: the sweep figure above draws a
  // single Tricolour Hound and the breed comes out as whatever that dog is.
  //
  // The row order is BREED ORDER, not the descending-wolf-fraction order the
  // sweep figures use, and that is the whole design: sorting by wolf fraction
  // would interleave the two breeds and destroy the comparison the figure is
  // for. Wolf on top and German Shepherd at the foot are the same two ends of
  // the scale the other figures carry, so the hound rows are read between a
  // known ceiling and a known floor rather than against each other alone.
  //
  // 26 rows in 560px is ~21px a row, well above the ~6px a row label needs, so
  // unlike the 486-row spectrum this figure names every animal — with only ten
  // hounds in it, WHICH dog carries the block is the result rather than a detail
  // spent on a label.
  //
  // THREE PANELS, AND NEITHER OF THE LOWER TWO IS DECORATION.
  //
  // Panel 1 is chr1 with the labels on, which is the only place the ten animals
  // are named.
  //
  // Panel 2 is the same chr1 view with `showRowLabels: false`. The labels draw
  // as an overlay ON the plot, each as wide as its own text, so over a 123.5 Mb
  // view they cover roughly the first 17 Mb of every row — and two of these ten
  // dogs carry their block inside that span (Tricolour 5 an 11.4 Mb terminal
  // block, Wh/Orange 3 a 4.3 Mb one at 6 Mb). Panel 1 alone therefore paints
  // both of them as cleaner than they are, which is the one error a figure about
  // which individual carries what cannot afford. This panel is the same data
  // with nothing on top of it. (It used to be a 25 Mb zoom; the `showRowLabels`
  // slot this bug produced is the better fix, since the zoom recovered the start
  // at the cost of showing only a fifth of the chromosome.)
  //
  // Panel 3 is chr38, same ten animals, same order, labels off. It is here
  // because panel 1 on its own is misleading in a second and worse way: it reads
  // as "Tricolour 1 and 2 are the wolf-carrying ones", and on chr38 those two
  // are the empty ones while Tricolour 3 and 5 carry a fifth of the chromosome.
  // Lin et al.'s claim is about GENOME-WIDE ancestry; per chromosome, which
  // individual looks wolfy is close to arbitrary, because a few percent of
  // genome scattered in blocks lands on some chromosomes and not others. Without
  // this panel the page invites exactly the over-reading its own caveat warns
  // about. Same 560px track height in all three so the rows keep one pitch and a
  // dog can be followed down the whole stack.
  {
    mode: 'url',
    name: 'dog10k-anglofrench-hounds-chromosome',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr1:1-123,556,469',
      tracks: [
        {
          trackId: 'dog10k_anglofrench',
          type: 'LinearMultiRowFeatureDisplay',
          height: 940,
          // ~14px a row, above both MIN_SEPARATOR_ROW_PX and the ~6px a label
          // needs; the rows come in pairs that read as one animal each
          showRowSeparators: true,
        },
      ],
    }),
    readyText: 'chr1',
    readySelector: '[data-testid="multirow-color-legend"]',
    readyTimeout: 60000,
    settleMs: 3000,
    viewportHeight: 1145,
  },

  {
    mode: 'url',
    name: 'dog10k-anglofrench-hounds-unlabelled',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr1:1-123,556,469',
      tracks: [
        {
          trackId: 'dog10k_anglofrench',
          type: 'LinearMultiRowFeatureDisplay',
          height: 940,
          // the whole reason this panel exists, see above
          showRowLabels: false,
          showRowSeparators: true,
        },
      ],
    }),
    readyText: 'chr1',
    // NOT the row-labels overlay, which is the usual doneness gate: it still
    // renders with the labels off (deliberately, so this flag can't disarm the
    // gate) but the legend is the signal that reads the same either way here
    readySelector: '[data-testid="multirow-color-legend"]',
    readyTimeout: 60000,
    settleMs: 3000,
    viewportHeight: 1145,
  },

  {
    mode: 'url',
    name: 'dog10k-anglofrench-hounds-chr38',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr38:1-24,803,098',
      tracks: [
        {
          trackId: 'dog10k_anglofrench_chr38',
          type: 'LinearMultiRowFeatureDisplay',
          height: 940,
          showRowLabels: false,
          showRowSeparators: true,
        },
      ],
    }),
    readyText: 'chr38',
    readySelector: '[data-testid="multirow-color-legend"]',
    readyTimeout: 60000,
    settleMs: 3000,
    viewportHeight: 1145,
  },

  {
    mode: 'compose',
    name: 'dog10k-anglofrench-hounds',
    parts: [
      'dog10k-anglofrench-hounds-chromosome',
      'dog10k-anglofrench-hounds-unlabelled',
      'dog10k-anglofrench-hounds-chr38',
    ],
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
        // OMIA's own record of this variant, from a source that is not the
        // callset ("if we have clinvar or omia dog variants would be
        // interesting", review). Its span is the check: OMIA published the CEA
        // deletion on CanFam3.1 as g.25698028_25705826del, and lifted to canFam4
        // that is chr37:25,574,007-25,581,807, which is the deletion the Dog10K
        // genotypes below are of (POS 25,574,005, the anchor base ahead of it).
        // Two independent sources, one bar. The description under the label is
        // the mode of inheritance, which is what makes the dark cells below
        // affected rather than merely homozygous.
        {
          trackId: 'omia_dog_variants',
          type: 'LinearBasicDisplay',
          height: 60,
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
    // gene track, the OMIA lane, all 36 sample rows and the genotype legend
    viewportHeight: 1003,
    // What the deletion does, beside the column that carries it. The legend can
    // say "homozygous alt" but not that homozygous is the affected state: CEA is
    // recessive (Parker et al. 2007; OMIA 000218-9615), so the dark cells are
    // affected animals and the light ones are unaffected carriers, which is the
    // difference between the two blues a reader cannot otherwise infer. It names
    // the disease rather than deferring to the OMIA lane for it (review): the
    // pill is what a reader looks at, and Collie eye anomaly is the thing they
    // will already know. The pill sits left of the column, over lane that paints
    // nothing (the filtered track has one record), so no cell is covered.
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
  // ONE FIGURE FOR THE PAGE, not two. There was a plain LGV figure of the gene
  // model over the 55 sample rows directly above this one; once this spec took
  // the same lane at the same window (per review), that figure was a strict
  // subset of this one's middle panel and was retired
  // (review: "largely duplicates dog10k-fgf4-retrogene-synteny now").
  //
  // POSITIONAL, not the matrix display, and that is the figure rather than a
  // preference: the claim is that the two blue blocks land in the two gaps of
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
  //
  // The callset is a caller's response to a retrocopy, never the retrocopy, and
  // the ribbons are what close that gap. Both dog FGF4 retrocopies were
  // Sanger-sequenced and deposited (MF040222, the CFA18 insertion of Parker et
  // al. 2009; MF040221, the CFA12 insertion of Brown et al. 2017), so each one
  // can be aligned back to the parent gene, and build_dog10k_fgf4_synteny.sh
  // asserts that its gaps against the reference are the annotated introns before
  // writing a PAF.
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
    // 3.8 kb, zoomed out per review from the 2.2 kb this used to draw, and the
    // right edge is not a round number: 48,872,890 is where the CFA18 alignment
    // ends, so the window holds that retrocopy end to end and the CFA12 ribbon
    // visibly runs on past it, which is the 3' difference between the two
    // records. Still not the 5 kb of the figure above, which put the whole
    // payload -- three exons, two gaps, two records -- in the left quarter of the
    // frame and gave the other three quarters to the flat 3' exon (measured: the
    // gaps plus exon 2 were 695 px of a 2,918 px data area).
    //
    // The retrocopy rows are the sub-range that covers this window, derived by
    // walking each PAF's CIGAR rather than scaled by eye. They have to be: a
    // retrocopy is 1,066 bp shorter than the reference span it covers, so a row
    // showing more would trail ribbon-free sequence and one showing less would cut
    // its own alignment.
    url: fgf4SyntenySession('chr18:48,869,100-48,872,900', {
      'FGF4retro-CFA18': 'FGF4retro-CFA18:1-2625',
      'FGF4retro-CFA12': 'FGF4retro-CFA12:2-2639',
    }),
    readyText: 'chr18',
    readyTimeout: 90000,
    settleMs: 6000,
    // an annotation lane per retrocopy, the gene lane and the 55-row sample block
    // between them, and the two synteny bands. Sized by the generator's
    // below-the-fold check.
    viewportHeight: 1410,
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
      // base-level around the stop codon: a SNV is one base wide however far
      // you zoom out, so this is the only scale at which a per-sample call
      // reads as a block rather than a tick
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
        // the same site as a plain variant lane, carrying the description a
        // reader gets from any other variant track. Same filter as the matrix
        // below, so the two lanes agree on which column is being described.
        {
          trackId: 'dog10k_cyp1a2_snvs_positional',
          type: 'LinearVariantDisplay',
          height: 60,
          // no `jexl:` prefix, unlike the matrix below: this is a canvas
          // display, whose jexlFilters slot takes bare expressions and adds the
          // prefix itself (ensureJexlPrefix). Written with one, it parses
          // `jexl:jexl:...` and the track errors.
          jexlFilters: ["get(feature,'start') == 38261634"],
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
    // 870 (pre-sequence-track) cut the last wolf row's block against the frame;
    // the per-position variant lane above the matrix adds its own 60.
    viewportHeight: 1010,
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
          // Directly above the paintings because it explains the widest hole in
          // them. Both lanes drop a window whose median across the collection is
          // not two, on the grounds that it is measuring the reference rather
          // than any dog, and a dropped window paints nothing -- so the white
          // stripe through every row at chr30:38,289,000-38,293,000 reads as a
          // rendering glitch until you can see the 1.4 kb CpG island sitting
          // under it (81% and 76% GC over its two central kilobases, which is
          // depth dropout in every canid). With the island on screen the hole is
          // legible as data. See the note beside MINUNIQUE in
          // scripts/build_dog10k_cyp1a2_cn.sh for why it is four blocks wide and
          // for the check that rules out the repeat mask.
          trackId: 'dog10k_cyp1a2_cpg',
          type: 'LinearBasicDisplay',
          // two rows: the labels collide before the islands do
          height: 62,
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
    // gene track, the CpG lane, the 380px panel and the 300px collection lane,
    // their headers, and the copy-number key
    viewportHeight: 1140,
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
  // 320 kb, which is the third window this figure has had, so here is the whole
  // sweep rather than only the answer. The separating sites (alt AF 0.82 in
  // toy/small against 0.21 in giant, 95 of 606) span 41,455,350-41,611,659, a
  // range the build script prints rather than one read off a picture. IGF1
  // itself is 41,495,479-41,567,874, so the haplotype runs 40 kb past the gene
  // upstream and 44 kb past it downstream and the frame is not the gene.
  //
  // It was 400 kb, narrowed to 220 kb on review ("i cant really tell what the
  // 'story' is here"), and is now 320 kb on the next one ("zoom out if it helps
  // show larger patterns"). Both moves are real and they pull opposite ways:
  //
  //   - The MATRIX wants the window tight. Equal-width columns are what make it
  //     legible and also what make a wide frame expensive, since an
  //     undifferentiated column is exactly as wide as a separating one.
  //   - The FST LANE wants the window wide. At 220 kb the run of differentiated
  //     sites filled the frame edge to edge, so the lane could not show that it
  //     IS a run: there was no background in view to see it rise out of.
  //
  // Rendered at 220, 320 and 450 kb and measured rather than eyeballed, since
  // "the clustering fell apart" is the thing a wider window would break. Counting
  // colour blocks down the size swatch (the row order's own summary: fewer, longer
  // blocks means the clustering recovered the size classes better) gives 19
  // blocks at 220 kb, 21 at 320 kb and 18 at 450 kb, with the two longest blocks
  // covering 63%, 52% and 52% of painted rows. So the row order is essentially
  // unaffected across the whole sweep, and the trade is only about how much of
  // the matrix is noise columns.
  //
  // 320 kb is where the Fst lane gains a visible baseline at both edges while
  // the toy/small block is still one run of 452 px. 450 kb buys no more Fst
  // context and dilutes the matrix further, so it is not the answer to "zoom
  // out" either.
  //
  // `runClustering` orders the rows by genotype similarity. The size swatch
  // comes from the samples TSV and is applied afterwards, so the row order and
  // the swatch are independent.
  //
  // STAYS CLUSTERED, whatever the window. A grouped-by-size variant was
  // rendered (groupBy: 'size', window narrowed to the differentiated core) and is
  // the wrong figure twice over: the page's result is that clustering on
  // genotypes RECOVERS the size classes, which grouping by size assumes rather
  // than shows, and it is no more legible at card size, because the toy/giant
  // contrast here is a frequency shift (|Δ| alt AF ≈ 0.5 over 41.44-41.58 Mb,
  // ≈ 0.05-0.2 outside) rather than a fixed difference. The Fst scan above states
  // the result in a shape, and is what the gallery card carries.
  {
    mode: 'url',
    name: 'dog10k-igf1-haplotype',
    url: lgvSession(DOG_CONFIG, {
      assembly: 'UU_Cfam_GSD_1.0',
      loc: 'chr15:41,375,000-41,695,000',
      tracks: [
        {
          trackId: 'canFam4_ncbi_refseq',
          type: 'LinearBasicDisplay',
          // the same glyph mode as dog10k-size-fst-scan-igf1, which is the
          // figure directly above this one on the page and frames part of the
          // same window: a reader moving between them should not have IGF1
          // drawn two ways
          geneGlyphMode: 'longestCoding',
          height: 80,
        },
        // What the matrix below is a picture of, as a number ("hard to say this
        // is meaningful in any way ... go for it, add fst if it makes a good
        // figure", review). The genome-wide scan two figures up is binned at
        // 200 kb, which is wider than this whole window, so it cannot say
        // anything inside it; this is the same Hudson estimator between the same
        // two panels computed one site at a time, over the very VCF the matrix
        // draws. Every point is therefore one column of the matrix, and the
        // block the clustering finds is the run of sites where the two panels
        // differ rather than a pattern the eye is asked to take on trust.
        {
          trackId: 'dog10k_igf1_fst',
          type: 'LinearManhattanDisplay',
          height: 150,
          scatterPointSize: 4,
          // the same 0-0.8 axis as the genome-wide scan on the page above, so a
          // reader moving between them is reading one scale
          ...FST_AXIS,
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
    // gene track, the Fst lane, the 760px matrix, their headers and the keys
    viewportHeight: 1263,
  },
]
