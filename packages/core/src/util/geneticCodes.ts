import { generateCodonTable, revlist } from './seqUtils.ts'

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
  {
    id: 1,
    name: 'Standard',
    ncbieaa: 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '---M------**--*----M---------------M----------------------------',
  },
  {
    id: 2,
    name: 'Vertebrate Mitochondrial',
    ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSS**VVVVAAAADDEEGGGG',
    sncbieaa:
      '----------**--------------------MMMM----------**---M------------',
  },
  {
    id: 3,
    name: 'Yeast Mitochondrial',
    ncbieaa: 'FFLLSSSSYY**CCWWTTTTPPPPHHQQRRRRIIMMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '----------**----------------------MM---------------M------------',
  },
  {
    id: 4,
    name: 'Mold Mitochondrial; Protozoan Mitochondrial; Coelenterate Mitochondrial; Mycoplasma; Spiroplasma',
    ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '--MM------**-------M------------MMMM---------------M------------',
  },
  {
    id: 5,
    name: 'Invertebrate Mitochondrial',
    ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSSSSVVVVAAAADDEEGGGG',
    sncbieaa:
      '---M------**--------------------MMMM---------------M------------',
  },
  {
    id: 6,
    name: 'Ciliate Nuclear; Dasycladacean Nuclear; Hexamita Nuclear',
    ncbieaa: 'FFLLSSSSYYQQCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '--------------*--------------------M----------------------------',
  },
  {
    id: 9,
    name: 'Echinoderm Mitochondrial; Flatworm Mitochondrial',
    ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNNKSSSSVVVVAAAADDEEGGGG',
    sncbieaa:
      '----------**-----------------------M---------------M------------',
  },
  {
    id: 10,
    name: 'Euplotid Nuclear',
    ncbieaa: 'FFLLSSSSYY**CCCWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '----------**-----------------------M----------------------------',
  },
  {
    id: 11,
    name: 'Bacterial, Archaeal and Plant Plastid',
    ncbieaa: 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '---M------**--*----M------------MMMM---------------M------------',
  },
  {
    id: 12,
    name: 'Alternative Yeast Nuclear',
    ncbieaa: 'FFLLSSSSYY**CC*WLLLSPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '----------**--*----M---------------M----------------------------',
  },
  {
    id: 13,
    name: 'Ascidian Mitochondrial',
    ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSSGGVVVVAAAADDEEGGGG',
    sncbieaa:
      '---M------**----------------------MM---------------M------------',
  },
  {
    id: 14,
    name: 'Alternative Flatworm Mitochondrial',
    ncbieaa: 'FFLLSSSSYYY*CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNNKSSSSVVVVAAAADDEEGGGG',
    sncbieaa:
      '-----------*-----------------------M----------------------------',
  },
  {
    id: 15,
    name: 'Blepharisma Macronuclear',
    ncbieaa: 'FFLLSSSSYY*QCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '----------*---*--------------------M----------------------------',
  },
  {
    id: 16,
    name: 'Chlorophycean Mitochondrial',
    ncbieaa: 'FFLLSSSSYY*LCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '----------*---*--------------------M----------------------------',
  },
  {
    id: 21,
    name: 'Trematode Mitochondrial',
    ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNNKSSSSVVVVAAAADDEEGGGG',
    sncbieaa:
      '----------**-----------------------M---------------M------------',
  },
  {
    id: 22,
    name: 'Scenedesmus obliquus Mitochondrial',
    ncbieaa: 'FFLLSS*SYY*LCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '------*---*---*--------------------M----------------------------',
  },
  {
    id: 23,
    name: 'Thraustochytrium Mitochondrial',
    ncbieaa: 'FF*LSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '--*-------**--*-----------------M--M---------------M------------',
  },
  {
    id: 24,
    name: 'Rhabdopleuridae Mitochondrial',
    ncbieaa: 'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSSKVVVVAAAADDEEGGGG',
    sncbieaa:
      '---M------**-------M---------------M---------------M------------',
  },
  {
    id: 25,
    name: 'Candidate Division SR1 and Gracilibacteria',
    ncbieaa: 'FFLLSSSSYY**CCGWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '---M------**-----------------------M---------------M------------',
  },
  {
    id: 26,
    name: 'Pachysolen tannophilus Nuclear',
    ncbieaa: 'FFLLSSSSYY**CC*WLLLAPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '----------**--*----M---------------M----------------------------',
  },
  {
    id: 27,
    name: 'Karyorelict Nuclear',
    ncbieaa: 'FFLLSSSSYYQQCCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '--------------*--------------------M----------------------------',
  },
  {
    id: 28,
    name: 'Condylostoma Nuclear',
    ncbieaa: 'FFLLSSSSYYQQCCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '----------**--*--------------------M----------------------------',
  },
  {
    id: 29,
    name: 'Mesodinium Nuclear',
    ncbieaa: 'FFLLSSSSYYYYCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '--------------*--------------------M----------------------------',
  },
  {
    id: 30,
    name: 'Peritrich Nuclear',
    ncbieaa: 'FFLLSSSSYYEECC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '--------------*--------------------M----------------------------',
  },
  {
    id: 31,
    name: 'Blastocrithidia Nuclear',
    ncbieaa: 'FFLLSSSSYYEECCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '----------**-----------------------M----------------------------',
  },
  {
    id: 32,
    name: 'Balanophoraceae Plastid',
    ncbieaa: 'FFLLSSSSYY*WCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    sncbieaa:
      '---M------*---*----M------------MMMM---------------M------------',
  },
  {
    id: 33,
    name: 'Cephalodiscidae Mitochondrial',
    ncbieaa: 'FFLLSSSSYYY*CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSSKVVVVAAAADDEEGGGG',
    sncbieaa:
      '---M-------*-------M---------------M---------------M------------',
  },
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

// A single `transl_except` exception in 0-based half-open genomic coordinates.
// `aa` is the amino acid that overrides the normal codon translation at this
// position: '*' for a polyA-completed stop (TERM), 'U' for selenocysteine (Sec),
// 'O' for pyrrolysine (Pyl), or another IUPAC 1-letter code for other cases.
export interface TranslExcept {
  start: number
  end: number
  aa: string
}

// NCBI's readthrough names mapped to 1-letter codes; any other value passes
// through unchanged. TERM is a stop, Sec/Pyl are selenocysteine/pyrrolysine, and
// OTHER marks a codon translated as an unspecified residue (X), used e.g. when a
// genomic stop is thought to be erroneous in a model RefSeq.
const translExceptAa: Record<string, string> = {
  TERM: '*',
  Sec: 'U',
  Pyl: 'O',
  OTHER: 'X',
}

// Parses a GFF/GenBank `transl_except` attribute. The attribute value is one or
// more parenthesised entries of the form `(pos:<loc>,aa:X)`, where `<loc>` is a
// 1-based closed coordinate range. Besides the bare `N` / `N..M` form, NCBI's
// genomic GFF3 wraps the location in INSDC descriptors —`complement(...)` for
// minus-strand genes, `join(...)` for a codon split across an intron — and may
// prefix coordinates with a contig accession, e.g.
// `(pos:complement(NC_000003.11:49395565..49395567),aa:Sec)`. We take the first
// coordinate range and ignore the descriptors: strand is resolved elsewhere,
// contig identity comes from the feature, and every base of a codon stitches to
// the same codon index, so the first base of a split codon suffices. The
// accession is stripped before reading digits so its own digits (e.g. the
// `000003` in `NC_000003.11`) aren't mistaken for a coordinate. GFF3 URL-encoding
// is already decoded upstream (commas arrive plain, not %2C). Returns positions
// as 0-based half-open intervals.
export function parseTranslExcept(value: unknown): TranslExcept[] {
  const vals = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string'
      ? [value]
      : []
  return vals.flatMap(v =>
    [...v.matchAll(/\(pos:(.*?),aa:(\w+)\)/g)].flatMap(m => {
      const loc = m[1]!.replace(/[A-Za-z_][\w.]*:/g, '')
      const range = /(\d+)(?:\.\.(\d+))?/.exec(loc)
      const rawAa = m[2]!
      return range
        ? [
            {
              start: Number(range[1]) - 1,
              end: range[2] === undefined ? Number(range[1]) : Number(range[2]),
              aa: translExceptAa[rawAa] ?? rawAa,
            },
          ]
        : []
    }),
  )
}

// Converts a raw GFF `transl_except` attribute into the coordinate system
// `convertCodingSequenceToPeptides` expects: feature-relative, and reversed for
// minus-strand features so positions line up with the revcom'd CDS sequence.
// Shared by the protein detail view and the in-track peptide overlay so their
// coordinate handling can't drift.
export function relativizeTranslExcept({
  raw,
  featureStart,
  featureLength,
  strand,
}: {
  raw: unknown
  featureStart: number
  featureLength: number
  strand?: number
}): TranslExcept[] {
  const relative = parseTranslExcept(raw).map(e => ({
    ...e,
    start: e.start - featureStart,
    end: e.end - featureStart,
  }))
  return strand === -1 ? revlist(relative, featureLength) : relative
}

// codon i = BASE1[i] + BASE2[i] + BASE3[i]
const CODONS = Array.from(
  { length: 64 },
  (_, i) => BASE1[i]! + BASE2[i]! + BASE3[i]!,
)

const ncbiCodeById = new Map(ncbiGeneticCodes.map(t => [t.id, t]))

function buildGeneticCode(id: number): GeneticCode {
  const def = ncbiCodeById.get(id)
  if (!def && id !== 1) {
    console.warn(
      `Unknown genetic code (transl_table=${id}); using standard code`,
    )
  }
  const {
    id: resolvedId,
    name,
    ncbieaa,
    sncbieaa,
  } = def ?? ncbiCodeById.get(1)!
  const table: Record<string, string> = {}
  const starts: string[] = []
  for (const [i, codon] of CODONS.entries()) {
    table[codon] = ncbieaa[i]!
    if (sncbieaa[i] === 'M') {
      starts.push(codon)
    }
  }
  return { id: resolvedId, name, codonTable: generateCodonTable(table), starts }
}

const geneticCodeCache = new Map<number, GeneticCode>()

// Resolves the codon map + start set for an NCBI translation-table id, falling
// back to the standard code (1) for an unrecognized id. Memoized: the result is
// immutable and there are only ~27 tables, so hot callers (the per-frame
// sequence-translation paint) reuse one expanded 64-codon table instead of
// rebuilding it.
export function getGeneticCode(id = 1): GeneticCode {
  let code = geneticCodeCache.get(id)
  if (!code) {
    code = buildGeneticCode(id)
    geneticCodeCache.set(id, code)
  }
  return code
}
