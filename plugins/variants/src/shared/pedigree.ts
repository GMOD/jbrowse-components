import { pluralize, shorten2 } from '@jbrowse/core/util'

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

const MISSING_CODES = new Set(['', '0', '-9', 'na', 'unknown'])

function isMissingCode(code: string) {
  return MISSING_CODES.has(code.toLowerCase())
}

/**
 * A sample's sex as a pedigree or a samples table writes it: `1`, `m` or
 * `male` is male, `2`, `f` or `female` female, in any case; `0`, `-9`, `NA`,
 * `unknown` or nothing is no value, and any other code `other`.
 */
function pedigreeSexOf(code: string) {
  const lower = code.toLowerCase()
  return isMissingCode(code)
    ? undefined
    : lower === '1' || lower === 'm' || lower === 'male'
      ? 'male'
      : lower === '2' || lower === 'f' || lower === 'female'
        ? 'female'
        : 'other'
}

function phenotypeOf(code: string) {
  return isMissingCode(code)
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
    .map(line => line.trimEnd())
    .filter(Boolean)
    .map(line =>
      line.includes('\t')
        ? line.split('\t').map(cell => cell.trim())
        : line.trim().split(/\s+/),
    )
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
      const value = index === undefined ? undefined : cells[index]
      return value === '' ? undefined : value
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
        return id === undefined
          ? undefined
          : (vcfName(id) ?? (isMissingCode(id) ? undefined : id))
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
      `${selfParents.length} ${pluralize(selfParents.length, 'sample names itself', 'samples name themselves')} as a parent in the pedigree file ${fileLabel}, and that parent is left out: ${shorten2(selfParents.join(','))}`,
    )
  }
  if (attributes.size === 0 && names.length > 0) {
    const sampleColumn = columns.sample
    const example =
      sampleColumn === undefined
        ? undefined
        : bodyRows.map(cells => cells[sampleColumn]).find(Boolean)
    warnings.push(
      example === undefined
        ? `The pedigree file ${fileLabel} has no sample rows, so it adds nothing`
        : `No sample in the pedigree file ${fileLabel} matches the VCF, so it adds nothing: it names "${example}" where the VCF names "${names[0]}". Check for an added prefix or suffix, or for the sample IDs being in a different column.`,
    )
  }
  return { attributes, warnings }
}

function stringAttribute(source: object, key: string) {
  const value: unknown = Reflect.get(source, key)
  return typeof value === 'string' ? value : undefined
}

/**
 * The pedigree's attributes merged into each source, under the source's own
 * columns, so a samples table naming the same column wins, unless it writes
 * a missing code there, as `0` for a parent or `NA` for sex.
 */
export function withPedigree<T extends { name: string }>(
  sources: T[],
  attributes: ReadonlyMap<string, Record<string, string>>,
) {
  return sources.map(source => {
    const pedigree = attributes.get(source.name) ?? {}
    return {
      ...pedigree,
      ...source,
      ...Object.fromEntries(
        Object.entries(pedigree).filter(([column]) => {
          const value = stringAttribute(source, column)
          return value !== undefined && isMissingCode(value)
        }),
      ),
    }
  })
}

const CHILD_TERMS = { male: 'son', female: 'daughter', other: 'child' } as const

/**
 * Each source with a `relationship` attribute saying how it relates to the
 * other sources, read off their `father`, `mother` and `sex`: as a child of a
 * parent among them other than itself, `son`, `daughter` or `child` by its
 * sex; as a parent of a child among them, `father` or `mother` by the column
 * naming it, or `parent` where both do, as in a selfed line; both joined, as
 * `daughter, mother`. A source related to none, or carrying a `relationship`
 * of its own, as a samples table column, is left as it is.
 */
export function withRelationships<T extends { name: string }>(sources: T[]) {
  const names = new Set(sources.map(source => source.name))
  const parents = sources.map(source => {
    const parent = (column: 'father' | 'mother') => {
      const value = stringAttribute(source, column)
      return value !== undefined && value !== source.name && names.has(value)
        ? value
        : undefined
    }
    return { father: parent('father'), mother: parent('mother') }
  })
  const fathers = new Set(parents.map(p => p.father))
  const mothers = new Set(parents.map(p => p.mother))
  return sources.map((source, i) => {
    const { father, mother } = parents[i]!
    const sex = stringAttribute(source, 'sex')
    const asChild =
      father !== undefined || mother !== undefined
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
