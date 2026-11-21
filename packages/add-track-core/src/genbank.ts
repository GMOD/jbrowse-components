export interface GenbankRecord {
  refName: string
  length: number
  circular: boolean
  featureLines: string[]
  sequenceLines: string[]
}

interface ParsedRecord extends GenbankRecord {
  /** the LOCUS name token when it ran into the length, else undefined */
  runTogether?: string
}

function readLocus(line: string): ParsedRecord {
  const tokens = line.trim().split(/\s+/)
  const unit = tokens.findIndex(t => /^(bp|aa)$/i.test(t))
  const name = tokens[1] ?? ''
  return {
    refName: name,
    length: unit > 2 ? Number(tokens[unit - 1]) : 0,
    circular: tokens.some(t => t.toLowerCase() === 'circular'),
    featureLines: [],
    sequenceLines: [],
    runTogether: unit === 2 ? name : undefined,
  }
}

function sourceLength(featureLines: string[]) {
  const source = featureLines
    .map(line => /^ {5}source\s+1\.\.(\d+)\s*$/.exec(line)?.[1])
    .find(Boolean)
  return source ? Number(source) : 0
}

function sequenceLength(sequenceLines: string[]) {
  return sequenceLines.reduce(
    (sum, line) => sum + line.replaceAll(/[^A-Za-z]/g, '').length,
    0,
  )
}

/**
 * Prokka writes a contig name too long for the LOCUS name column straight into
 * the length, `NODE_3_length_3306_cov_210.9876543306 bp`, so the record's own
 * bases, else its `source` span, say which trailing digits are the length.
 */
function splitRunTogether({ runTogether, ...record }: ParsedRecord) {
  const length =
    runTogether === undefined
      ? record.length
      : sequenceLength(record.sequenceLines) ||
        sourceLength(record.featureLines)
  const digits = String(length)
  return {
    ...record,
    length,
    refName:
      runTogether === record.refName &&
      length > 0 &&
      runTogether.length > digits.length &&
      runTogether.endsWith(digits)
        ? runTogether.slice(0, -digits.length)
        : record.refName,
  }
}

function uniquelyNamed(records: GenbankRecord[]) {
  const taken = new Set<string>()
  for (const record of records) {
    let name = record.refName
    for (let n = 2; taken.has(name); n++) {
      name = `${record.refName}_${n}`
    }
    taken.add(name)
    record.refName = name
  }
  return records
}

/**
 * One record per `LOCUS` line, named by its `VERSION` accession, else its
 * `LOCUS` name; a repeated name takes `_2`, `_3` in file order.
 */
export function parseRecords(text: string) {
  const records: ParsedRecord[] = []
  let record: ParsedRecord | undefined
  let section: 'header' | 'features' | 'origin' = 'header'
  for (const line of text.split(/\r?\n/).filter(l => l.trim() !== '')) {
    if (line.startsWith('LOCUS')) {
      record = readLocus(line)
      records.push(record)
      section = 'header'
    } else if (record) {
      if (line.startsWith('//')) {
        record = undefined
      } else if (line.startsWith('FEATURES')) {
        section = 'features'
      } else if (line.startsWith('ORIGIN')) {
        section = 'origin'
      } else if (section === 'origin') {
        record.sequenceLines.push(line)
      } else if (section === 'features' && line.startsWith(' ')) {
        record.featureLines.push(line)
      } else if (line.startsWith('VERSION')) {
        const version = line.split(/\s+/)[1]
        if (version && version !== '.') {
          record.refName = version
        }
      } else {
        section = 'header'
      }
    }
  }
  return uniquelyNamed(records.map(splitRunTogether))
}

export function recordSequence(record: GenbankRecord) {
  const sequence = record.sequenceLines
    .join('')
    .replaceAll(/[^A-Za-z]/g, '')
    .toUpperCase()
  if (!sequence) {
    throw new Error(
      `GenBank record "${record.refName}" has no ORIGIN sequence. A record that lists CONTIG pieces in its place needs downloading with its sequence: NCBI's "GenBank (full)" format, rettype=gbwithparts`,
    )
  }
  return sequence
}

export interface FeatureEntry {
  key: string
  location: string
  qualifiers: Map<string, string[]>
}

interface Qualifier {
  name: string
  raw: string
}

const FEATURE_START = /^ {5}(\S+)\s+(\S.*)$/

function isOpenQuote(raw: string) {
  return raw.startsWith('"') && raw.split('"').length % 2 === 0
}

function qualifierValue(raw: string) {
  return raw.startsWith('"')
    ? raw
        .slice(1, raw.length > 1 && raw.endsWith('"') ? -1 : undefined)
        .replaceAll('""', '"')
    : raw
}

function collect(key: string, location: string, qualifiers: Qualifier[]) {
  const map = new Map<string, string[]>()
  for (const { name, raw } of qualifiers) {
    const values = map.get(name) ?? []
    values.push(raw === '' ? 'true' : qualifierValue(raw))
    map.set(name, values)
  }
  return { key, location, qualifiers: map }
}

/**
 * A FEATURES table's entries. Wrapped values join with a space, `/translation`
 * with none.
 */
export function parseFeatureTable(lines: string[]) {
  const entries: FeatureEntry[] = []
  let current:
    | { key: string; location: string; qualifiers: Qualifier[] }
    | undefined
  const flush = () => {
    if (current) {
      entries.push(collect(current.key, current.location, current.qualifiers))
    }
  }
  for (const line of lines) {
    const start = line[5] === ' ' ? undefined : FEATURE_START.exec(line)
    if (start) {
      flush()
      const [, key = '', location = ''] = start
      current = { key, location: location.trim(), qualifiers: [] }
    } else if (current) {
      const body = line.trim()
      const last = current.qualifiers.at(-1)
      if (body.startsWith('/') && !(last && isOpenQuote(last.raw))) {
        const eq = body.indexOf('=')
        current.qualifiers.push(
          eq === -1
            ? { name: body.slice(1), raw: '' }
            : { name: body.slice(1, eq), raw: body.slice(eq + 1) },
        )
      } else if (last) {
        last.raw += last.name === 'translation' ? body : ` ${body}`
      } else {
        current.location += body
      }
    }
  }
  flush()
  return entries
}
