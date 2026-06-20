import { generateCodonTable } from './seqUtils.ts'

// NCBI translation tables (genetic codes), parsed from NCBI's authoritative
// gc.prt (ftp.ncbi.nlm.nih.gov/entrez/misc/data/gc.prt). Each table is kept in
// NCBI's compact form: `ncbieaa` gives the amino acid for each of the 64 codons
// in a fixed base order, and `sncbieaa` marks valid start codons with 'M'.
// Storing the raw strings keeps them auditable against NCBI rather than
// hand-transcribed 64-entry maps. Table 1 is the standard code; 2 = vertebrate
// mitochondrial, 11 = bacterial/archaeal/plastid, etc.
export interface NcbiGeneticCode {
  id: number
  name: string
  ncbieaa: string
  sncbieaa: string
}

export const ncbiGeneticCodes: NcbiGeneticCode[] = [
  { id: 1, name: 'Standard', ncbieaa: 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '---M------**--*----M---------------M----------------------------' },
  { id: 2, name: 'Vertebrate Mitochondrial', ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSS**VVVVAAAADDEEGGGG', sncbieaa: '----------**--------------------MMMM----------**---M------------' },
  { id: 3, name: 'Yeast Mitochondrial', ncbieaa: 'FFLLSSSSYY**CCWWTTTTPPPPHHQQRRRRIIMMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '----------**----------------------MM---------------M------------' },
  { id: 4, name: 'Mold Mitochondrial; Protozoan Mitochondrial; Coelenterate Mitochondrial; Mycoplasma; Spiroplasma', ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '--MM------**-------M------------MMMM---------------M------------' },
  { id: 5, name: 'Invertebrate Mitochondrial', ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSSSSVVVVAAAADDEEGGGG', sncbieaa: '---M------**--------------------MMMM---------------M------------' },
  { id: 6, name: 'Ciliate Nuclear; Dasycladacean Nuclear; Hexamita Nuclear', ncbieaa: 'FFLLSSSSYYQQCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '--------------*--------------------M----------------------------' },
  { id: 9, name: 'Echinoderm Mitochondrial; Flatworm Mitochondrial', ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNNKSSSSVVVVAAAADDEEGGGG', sncbieaa: '----------**-----------------------M---------------M------------' },
  { id: 10, name: 'Euplotid Nuclear', ncbieaa: 'FFLLSSSSYY**CCCWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '----------**-----------------------M----------------------------' },
  { id: 11, name: 'Bacterial, Archaeal and Plant Plastid', ncbieaa: 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '---M------**--*----M------------MMMM---------------M------------' },
  { id: 12, name: 'Alternative Yeast Nuclear', ncbieaa: 'FFLLSSSSYY**CC*WLLLSPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '----------**--*----M---------------M----------------------------' },
  { id: 13, name: 'Ascidian Mitochondrial', ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSSGGVVVVAAAADDEEGGGG', sncbieaa: '---M------**----------------------MM---------------M------------' },
  { id: 14, name: 'Alternative Flatworm Mitochondrial', ncbieaa: 'FFLLSSSSYYY*CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNNKSSSSVVVVAAAADDEEGGGG', sncbieaa: '-----------*-----------------------M----------------------------' },
  { id: 15, name: 'Blepharisma Macronuclear', ncbieaa: 'FFLLSSSSYY*QCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '----------*---*--------------------M----------------------------' },
  { id: 16, name: 'Chlorophycean Mitochondrial', ncbieaa: 'FFLLSSSSYY*LCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '----------*---*--------------------M----------------------------' },
  { id: 21, name: 'Trematode Mitochondrial', ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNNKSSSSVVVVAAAADDEEGGGG', sncbieaa: '----------**-----------------------M---------------M------------' },
  { id: 22, name: 'Scenedesmus obliquus Mitochondrial', ncbieaa: 'FFLLSS*SYY*LCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '------*---*---*--------------------M----------------------------' },
  { id: 23, name: 'Thraustochytrium Mitochondrial', ncbieaa: 'FF*LSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '--*-------**--*-----------------M--M---------------M------------' },
  { id: 24, name: 'Rhabdopleuridae Mitochondrial', ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSSKVVVVAAAADDEEGGGG', sncbieaa: '---M------**-------M---------------M---------------M------------' },
  { id: 25, name: 'Candidate Division SR1 and Gracilibacteria', ncbieaa: 'FFLLSSSSYY**CCGWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '---M------**-----------------------M---------------M------------' },
  { id: 26, name: 'Pachysolen tannophilus Nuclear', ncbieaa: 'FFLLSSSSYY**CC*WLLLAPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '----------**--*----M---------------M----------------------------' },
  { id: 27, name: 'Karyorelict Nuclear', ncbieaa: 'FFLLSSSSYYQQCCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '--------------*--------------------M----------------------------' },
  { id: 28, name: 'Condylostoma Nuclear', ncbieaa: 'FFLLSSSSYYQQCCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '----------**--*--------------------M----------------------------' },
  { id: 29, name: 'Mesodinium Nuclear', ncbieaa: 'FFLLSSSSYYYYCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '--------------*--------------------M----------------------------' },
  { id: 30, name: 'Peritrich Nuclear', ncbieaa: 'FFLLSSSSYYEECC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '--------------*--------------------M----------------------------' },
  { id: 31, name: 'Blastocrithidia Nuclear', ncbieaa: 'FFLLSSSSYYEECCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '----------**-----------------------M----------------------------' },
  { id: 32, name: 'Balanophoraceae Plastid', ncbieaa: 'FFLLSSSSYY*WCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', sncbieaa: '---M------*---*----M------------MMMM---------------M------------' },
  { id: 33, name: 'Cephalodiscidae Mitochondrial', ncbieaa: 'FFLLSSSSYYY*CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSSKVVVVAAAADDEEGGGG', sncbieaa: '---M-------*-------M---------------M---------------M------------' },
]

// The codon order shared by every NCBI table — the Base1/Base2/Base3 comment
// rows in gc.prt. codon i = BASE1[i] + BASE2[i] + BASE3[i].
const BASE1 = 'TTTTTTTTTTTTTTTTCCCCCCCCCCCCCCCCAAAAAAAAAAAAAAAAGGGGGGGGGGGGGGGG'
const BASE2 = 'TTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGG'
const BASE3 = 'TCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAG'

export interface GeneticCode {
  id: number
  name: string
  // case-insensitive codon -> amino acid letter, '*' for a stop codon
  codonTable: Record<string, string>
  // valid start codons (uppercase). An alternative initiator such as GTG codes
  // its normal residue internally but translates as M at the start of a CDS.
  starts: string[]
}

// Parses a GFF/GenBank `transl_table` attribute value into an NCBI table id. The
// GFF adapter yields a string (or an array if the attribute repeated), so this
// normalizes both; returns undefined for a missing or non-positive-integer value
// so callers fall back to their default code.
export function parseTranslTable(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

const ncbiCodeById = new Map(ncbiGeneticCodes.map(t => [t.id, t]))

// Resolves the codon map + start set for an NCBI translation-table id, falling
// back to the standard code (1) for an unrecognized id. Pure; callers that
// translate many features should resolve each distinct id once rather than per
// feature, since this expands a 64-codon table on every call.
export function getGeneticCode(id = 1): GeneticCode {
  const def = ncbiCodeById.get(id)
  if (!def && id !== 1) {
    console.warn(`Unknown genetic code (transl_table=${id}); using standard code`)
  }
  const resolved = def ?? ncbiCodeById.get(1)!

  const table: Record<string, string> = {}
  const starts: string[] = []
  for (let i = 0; i < 64; i++) {
    const codon = BASE1[i]! + BASE2[i]! + BASE3[i]!
    table[codon] = resolved.ncbieaa[i]!
    if (resolved.sncbieaa[i] === 'M') {
      starts.push(codon)
    }
  }
  return {
    id: resolved.id,
    name: resolved.name,
    codonTable: generateCodonTable(table),
    starts,
  }
}
