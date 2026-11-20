import { shorten2 } from '@jbrowse/core/util'

export const pedigreeAdapterConfigSchemaFields = {
  /**
   * #slot
   */
  pedigreeLocation: {
    type: 'maybeFileLocation',
    description:
      "optional pedigree of the VCF's samples, whitespace-separated: a PLINK `.fam` or `.ped` with no header (FID, IID, PAT, MAT, SEX, PHENO; a `.ped`'s genotypes after them are not read), or a table whose header row names its columns `SampleID` or `IID`, `FatherID` or `PAT`, `MotherID` or `MAT`, `FamilyID` or `FID`, `Sex` and `Phenotype` or `PHENO`, in any case and order, as 1000 Genomes' `20130606_g1k_3202_samples_ped_population.txt` does. Each sample gains the attributes `family`, `father`, `mother`, `sex` (`male`, `female` or `other`) and `phenotype` (`affected` or `unaffected`), which the variant display groups, sorts, colors and tooltips rows by. A parent of `0`, a sex of `0`, `-9` or `unknown` and a phenotype of `0` or `-9` are no value, and the Mendelian check reads a samples table's `sex` column by the same codes. An IID naming no VCF sample is tried as `FID_IID`, the sample name PLINK's `--recode vcf` writes. A `samplesTsvLocation` column of the same name wins over the pedigree's. The pedigree never narrows the samples: its rows naming no VCF sample are skipped, and a pedigree matching none of them adds nothing, with a warning",
  },
} as const

type PedigreeColumn =
  | 'sample'
  | 'father'
  | 'mother'
  | 'family'
  | 'sex'
  | 'phenotype'

const HEADER_NAMES: Record<PedigreeColumn, readonly string[]> = {
  sample: ['sampleid', 'iid'],
  father: ['fatherid', 'pat'],
  mother: ['motherid', 'mat'],
  family: ['familyid', 'fid'],
  sex: ['sex'],
  phenotype: ['phenotype', 'pheno'],
}

const PLINK_COLUMNS: Record<PedigreeColumn, number> = {
  family: 0,
  sample: 1,
  father: 2,
  mother: 3,
  sex: 4,
  phenotype: 5,
}

const MISSING_CODES = new Set(['0', '-9', 'na'])

const MISSING_SEX_CODES = new Set([...MISSING_CODES, '', 'unknown'])

/**
 * A sample's sex as a pedigree or a samples table writes it: `1`, `m` or
 * `male` is male, `2`, `f` or `female` female, in any case; `0`, `-9`, `NA`,
 * `unknown` or nothing is no value, and any other code `other`.
 */
export function pedigreeSexOf(code: string) {
  const lower = code.toLowerCase()
  return MISSING_SEX_CODES.has(lower)
    ? undefined
    : lower === '1' || lower === 'm' || lower === 'male'
      ? 'male'
      : lower === '2' || lower === 'f' || lower === 'female'
        ? 'female'
        : 'other'
}

function phenotypeOf(code: string) {
  return MISSING_CODES.has(code.toLowerCase())
    ? undefined
    : code === '1'
      ? 'unaffected'
      : code === '2'
        ? 'affected'
        : code
}

function headerColumns(cells: string[]) {
  const names = cells.map(cell => cell.replace(/^#/, '').toLowerCase())
  return names.some(name => HEADER_NAMES.sample.includes(name))
    ? Object.fromEntries(
        Object.entries(HEADER_NAMES).flatMap(([column, aliases]) => {
          const index = names.findIndex(name => aliases.includes(name))
          return index === -1 ? [] : [[column, index] as const]
        }),
      )
    : undefined
}

/**
 * A pedigree file's attributes for the samples of `names` it lists, keyed by
 * the sample's VCF name, plus warnings for the rows it refuses and for a file
 * matching no sample. The columns are found from the first row: a row naming
 * a sample header is a header, and anything else is headerless PLINK.
 */
export function parsePedigree(
  txt: string,
  names: readonly string[],
  fileLabel: string,
) {
  const rows = txt
    .split(/\r\n|\r|\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(/\s+/))
  const header = rows[0] ? headerColumns(rows[0]) : undefined
  const columns: Partial<Record<PedigreeColumn, number>> =
    header ?? PLINK_COLUMNS
  const nameSet = new Set(names)
  const attributes = new Map<string, Record<string, string>>()
  const selfParents: string[] = []
  const bodyRows = header ? rows.slice(1) : rows
  for (const cells of bodyRows) {
    const cell = (column: PedigreeColumn) => {
      const index = columns[column]
      return index === undefined ? undefined : cells[index]
    }
    const family = cell('family')
    const vcfName = (id: string) =>
      nameSet.has(id)
        ? id
        : family !== undefined && nameSet.has(`${family}_${id}`)
          ? `${family}_${id}`
          : undefined
    const iid = cell('sample')
    const name = iid === undefined ? undefined : vcfName(iid)
    if (name !== undefined && !attributes.has(name)) {
      const parentOf = (column: 'father' | 'mother') => {
        const id = cell(column)
        return id === undefined || id === '0' ? undefined : (vcfName(id) ?? id)
      }
      const named = { father: parentOf('father'), mother: parentOf('mother') }
      if (named.father === name || named.mother === name) {
        selfParents.push(name)
      }
      const father = named.father === name ? undefined : named.father
      const mother = named.mother === name ? undefined : named.mother
      const sexCode = cell('sex')
      const phenotypeCode = cell('phenotype')
      const sex = sexCode === undefined ? undefined : pedigreeSexOf(sexCode)
      const phenotype =
        phenotypeCode === undefined ? undefined : phenotypeOf(phenotypeCode)
      attributes.set(
        name,
        Object.fromEntries(
          Object.entries({ family, father, mother, sex, phenotype }).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
      )
    }
  }
  const warnings: string[] = []
  if (selfParents.length) {
    warnings.push(
      `${selfParents.length} samples name themselves as a parent in the pedigree file ${fileLabel}, and that parent is left out: ${shorten2(selfParents.join(','))}`,
    )
  }
  if (attributes.size === 0 && names.length > 0) {
    const sampleColumn = columns.sample
    const example =
      sampleColumn === undefined ? undefined : bodyRows[0]?.[sampleColumn]
    warnings.push(
      example === undefined
        ? `The pedigree file ${fileLabel} has no sample rows, so it adds nothing`
        : `No sample in the pedigree file ${fileLabel} matches the VCF, so it adds nothing: it names "${example}" where the VCF names "${names[0]}". Check for an added prefix or suffix, or for the sample IDs being in a different column.`,
    )
  }
  return { attributes, warnings }
}

/**
 * The pedigree's attributes merged into each source, under the source's own
 * columns, so a samples table naming the same column wins.
 */
export function withPedigree<T extends { name: string }>(
  sources: T[],
  attributes: ReadonlyMap<string, Record<string, string>>,
) {
  return sources.map(source => ({ ...attributes.get(source.name), ...source }))
}

const CHILD_TERMS = { male: 'son', female: 'daughter', other: 'child' } as const

function stringAttribute(source: object, key: string) {
  const value: unknown = Reflect.get(source, key)
  return typeof value === 'string' ? value : undefined
}

/**
 * Each source with a `relationship` attribute saying how it relates to the
 * other sources, read off their `father`, `mother` and `sex`: as a child of a
 * parent among them, `son`, `daughter` or `child` by its sex; as a parent of a
 * child among them, `father` or `mother` by the column naming it, or `parent`
 * where both do, as in a selfed line; both joined, as `daughter, mother`. A
 * source related to none, or carrying a `relationship` of its own, as a
 * samples table column, is left as it is.
 */
export function withRelationships<T extends { name: string }>(sources: T[]) {
  const names = new Set(sources.map(source => source.name))
  const namedParent = (source: T, column: 'father' | 'mother') => {
    const parent = stringAttribute(source, column)
    return parent !== undefined && parent !== source.name && names.has(parent)
      ? [parent]
      : []
  }
  const fathers = new Set(
    sources.flatMap(source => namedParent(source, 'father')),
  )
  const mothers = new Set(
    sources.flatMap(source => namedParent(source, 'mother')),
  )
  return sources.map(source => {
    const sex = stringAttribute(source, 'sex')
    const asChild =
      namedParent(source, 'father').length +
        namedParent(source, 'mother').length >
      0
        ? CHILD_TERMS[
            (sex === undefined ? undefined : pedigreeSexOf(sex)) ?? 'other'
          ]
        : undefined
    const asParent = fathers.has(source.name)
      ? mothers.has(source.name)
        ? 'parent'
        : 'father'
      : mothers.has(source.name)
        ? 'mother'
        : undefined
    const relationship = [asChild, asParent].filter(Boolean).join(', ')
    return relationship && !Object.hasOwn(source, 'relationship')
      ? { ...source, relationship }
      : source
  })
}
