import { lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Strain (row) order for the chromosome painting: grouped by each strain's B/D
// haplotype at the Tyrp1 QTL peak (chr4:~80.97 Mb), so the painting resolves
// into a contiguous B block over a D block right where the coat-color QTL peaks
// — the recombinant mosaic then reads as the genotype split that DRIVES the
// Manhattan signal above, instead of an arbitrary alphabetical jumble.
// Precomputed once from bxd_painting.bed.gz (B strains, then D, then the few
// heterozygous/F1 rows last); `rowOrder` names not present just fall through.
const BXD_ROW_ORDER_BY_TYRP1 = [
  'BXD2', 'BXD5', 'BXD6', 'BXD8', 'BXD11', 'BXD12', 'BXD012xBXD002F1',
  'BXD14', 'BXD16', 'BXD18', 'BXD19', 'BXD20', 'BXD020xBXD012F1', 'BXD22',
  'BXD23', 'BXD29', 'BXD31', 'BXD32', 'BXD032xBXD005F1', 'BXD33', 'BXD34',
  'BXD35', 'BXD38', 'BXD39', 'BXD40', 'BXD42', 'BXD43', 'BXD48', 'BXD48a',
  'BXD49', 'BXD50', 'BXD51', 'BXD56', 'BXD76', 'BXD79', 'BXD86', 'BXD87',
  'BXD087xBXD100F1', 'BXD94', 'BXD100', 'BXD101', 'BXD105', 'BXD109',
  'BXD110', 'BXD116', 'BXD117', 'BXD119', 'BXD120', 'BXD121', 'BXD122',
  'BXD123', 'BXD124', 'BXD125', 'BXD127', 'BXD128', 'BXD128a', 'BXD130',
  'BXD131', 'BXD133', 'BXD135', 'BXD136', 'BXD139', 'BXD141', 'BXD142',
  'BXD144', 'BXD146', 'BXD147', 'BXD148', 'BXD149', 'BXD151', 'BXD152',
  'BXD153', 'BXD154', 'BXD155', 'BXD156', 'BXD157', 'BXD162', 'BXD168',
  'BXD169', 'BXD171', 'BXD172', 'BXD173', 'BXD174', 'BXD175', 'BXD176',
  'BXD178', 'BXD180', 'BXD181', 'BXD184', 'BXD186', 'BXD190', 'BXD191',
  'BXD194', 'BXD198', 'BXD199', 'BXD202', 'BXD204', 'BXD205', 'BXD214',
  'BXD215', 'BXD217', 'BXD218', 'BXD219', 'BXD1', 'BXD001xBXD065aF1',
  'BXD9', 'BXD009xBXD170F1', 'BXD13', 'BXD15', 'BXD21', 'BXD24', 'BXD24a',
  'BXD25', 'BXD27', 'BXD28', 'BXD30', 'BXD36', 'BXD37', 'BXD41', 'BXD44',
  'BXD45', 'BXD52', 'BXD53', 'BXD54', 'BXD55', 'BXD055xBXD65bF1',
  'BXD055xBXD074F1', 'BXD59', 'BXD60', 'BXD61', 'BXD061xBXD071F1', 'BXD62',
  'BXD062xBXD077F1', 'BXD63', 'BXD64', 'BXD65', 'BXD65a', 'BXD65b',
  'BXD065bxBXD055F1', 'BXD065xBXD077F1', 'BXD66', 'BXD67', 'BXD68',
  'BXD69', 'BXD069xBXD090F1', 'BXD70', 'BXD71', 'BXD071xBXD061F1', 'BXD72',
  'BXD73', 'BXD73a', 'BXD73b', 'BXD073bxBXD065F1', 'BXD073bxBXD077F1',
  'BXD073xBXD065F1', 'BXD073xBXD077F1', 'BXD74', 'BXD074xBXD055F1',
  'BXD75', 'BXD77', 'BXD077xBXD062F1', 'BXD78', 'BXD81', 'BXD83',
  'BXD083xBXD045F1', 'BXD84', 'BXD85', 'BXD88', 'BXD89', 'BXD90', 'BXD91',
  'BXD93', 'BXD95', 'BXD98', 'BXD99', 'BXD102', 'BXD102xBXD077F1',
  'BXD102xBXD73bF1', 'BXD104', 'BXD106', 'BXD107', 'BXD108', 'BXD111',
  'BXD112', 'BXD113', 'BXD114', 'BXD115', 'BXD126', 'BXD132', 'BXD134',
  'BXD137', 'BXD138', 'BXD150', 'BXD160', 'BXD161', 'BXD165', 'BXD170',
  'BXD177', 'BXD183', 'BXD187', 'BXD188', 'BXD189', 'BXD192', 'BXD195',
  'BXD196', 'BXD197', 'BXD197xBXD009F1', 'BXD197xBXD170F1', 'BXD200',
  'BXD201', 'BXD203', 'BXD206', 'BXD209', 'BXD211', 'BXD213', 'BXD216',
  'BXD220', 'BXD009xBXD172F1', 'BXD012xBXD021F1', 'BXD021xBXD002F1',
  'BXD024xBXD034F1', 'BXD032xBXD028F1', 'BXD032xBXD65bF1',
  'BXD034xBXD024F1', 'BXD034xBXD073F1', 'BXD073xBXD034F1', 'BXD145',
  'BXD170xBXD172F1', 'BXD172xBXD197F1', 'BXD193', 'BXD207', 'BXD208',
  'BXD210', 'BXD212', 'C57BL/6JxBXD037F1',
]

// ──────────────────────────────────────────────────────────────────────────
// QTL / systems genetics — real GeneNetwork BXD mouse data (mm10). One track
// set demonstrates both plugins/gwas (Manhattan) and plugins/canvas
// (LinearMultiRowFeatureDisplay chromosome painting): a single-marker QTL scan
// of a real BXD phenotype stacked over the B/D haplotype mosaic of 198 strains.
// Data + config: test_data/config_bxd.json (hosted at jbrowse.org/demos/bxd/).
// ──────────────────────────────────────────────────────────────────────────
export const qtlSpecs: ScreenshotSpec[] = [
  // Whole-chr4 overview: the coat-color QTL Manhattan peaks over Tyrp1 (~80Mb)
  // above the 198-strain BXD chromosome painting, showing how a phenotype scan
  // and the underlying recombinant-inbred haplotype mosaic line up.
  {
    mode: 'url',
    name: 'qtl/bxd_overview',
    url: lgvSession('test_data/config_bxd.json', {
      assembly: 'mm10',
      loc: 'chr4',
      tracks: [
        {
          trackId: 'bxd_gwas_coatcolor_mm10',
          displaySnapshot: { type: 'LinearManhattanDisplay', height: 220 },
        },
        {
          trackId: 'bxd_chromosome_painting_mm10',
          displaySnapshot: {
            type: 'LinearMultiRowFeatureDisplay',
            height: 500,
            rowOrder: BXD_ROW_ORDER_BY_TYRP1,
          },
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 820,
    settleMs: 16000,
  },

  // Zoomed to the Tyrp1 locus: the QTL peak apex sits directly over the Tyrp1
  // gene (the classic brown coat-color locus), with the strain-by-strain
  // recombination breakpoints visible in the painting below.
  {
    mode: 'url',
    name: 'qtl/bxd_tyrp1_locus',
    url: lgvSession('test_data/config_bxd.json', {
      assembly: 'mm10',
      loc: 'chr4:76,500,000-85,500,000',
      tracks: [
        {
          trackId: 'bxd_gwas_coatcolor_mm10',
          displaySnapshot: { type: 'LinearManhattanDisplay', height: 200 },
        },
        {
          trackId: 'mm10_ncbi_refseq',
          displaySnapshot: { type: 'LinearBasicDisplay', height: 120 },
        },
        {
          trackId: 'bxd_chromosome_painting_mm10',
          displaySnapshot: {
            type: 'LinearMultiRowFeatureDisplay',
            height: 460,
            rowOrder: BXD_ROW_ORDER_BY_TYRP1,
          },
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 860,
    settleMs: 16000,
  },
]
