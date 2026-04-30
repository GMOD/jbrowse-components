export interface GfaSegment {
  id: string
  seq: string
  length: number
}

export interface GfaEdge {
  fromId: string
  fromOrient: '+' | '-'
  toId: string
  toOrient: '+' | '-'
  overlap: string
}

export interface GfaPathStep {
  id: string
  orient: '+' | '-'
}

export interface GfaPath {
  name: string
  steps: GfaPathStep[]
  kind: 'P' | 'W'
  raw: string
}

export interface ParsedGfa {
  header: string[]
  segments: GfaSegment[]
  edges: GfaEdge[]
  paths: GfaPath[]
}

function parseOrient(c: string): '+' | '-' {
  if (c !== '+' && c !== '-') {
    throw new Error(`Bad orientation char: ${c}`)
  }
  return c
}

function parsePLineSteps(stepsStr: string): GfaPathStep[] {
  const steps: GfaPathStep[] = []
  for (const tok of stepsStr.split(',')) {
    if (tok.length < 2) {
      continue
    }
    const orient = tok[tok.length - 1]!
    steps.push({
      id: tok.slice(0, -1),
      orient: parseOrient(orient),
    })
  }
  return steps
}

function parseWalkSteps(walkStr: string): GfaPathStep[] {
  const steps: GfaPathStep[] = []
  let i = 0
  while (i < walkStr.length) {
    const ch = walkStr[i]!
    if (ch !== '<' && ch !== '>') {
      throw new Error(
        `Walk parse error at ${i}: expected </> got ${ch} in ${walkStr}`,
      )
    }
    const orient = ch === '>' ? '+' : '-'
    let j = i + 1
    while (j < walkStr.length && walkStr[j] !== '<' && walkStr[j] !== '>') {
      j++
    }
    steps.push({ id: walkStr.slice(i + 1, j), orient })
    i = j
  }
  return steps
}

export function parseGfa(text: string): ParsedGfa {
  const header: string[] = []
  const segments: GfaSegment[] = []
  const edges: GfaEdge[] = []
  const paths: GfaPath[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (line.length === 0) {
      continue
    }
    const cols = line.split('\t')
    const tag = cols[0]
    if (tag === 'H') {
      header.push(line)
    } else if (tag === 'S') {
      const id = cols[1]!
      const seq = cols[2] ?? '*'
      let length = seq === '*' ? 0 : seq.length
      for (let i = 3; i < cols.length; i++) {
        const c = cols[i]!
        if (c.startsWith('LN:i:')) {
          length = +c.slice(5)
        }
      }
      segments.push({ id, seq, length })
    } else if (tag === 'L') {
      edges.push({
        fromId: cols[1]!,
        fromOrient: parseOrient(cols[2]!),
        toId: cols[3]!,
        toOrient: parseOrient(cols[4]!),
        overlap: cols[5] ?? '*',
      })
    } else if (tag === 'P') {
      const name = cols[1]!
      const steps = parsePLineSteps(cols[2] ?? '')
      paths.push({ name, steps, kind: 'P', raw: line })
    } else if (tag === 'W') {
      const sample = cols[1]!
      const hap = cols[2]!
      const contig = cols[3]!
      const start = cols[4] ?? '0'
      const walk = cols[6] ?? ''
      const name = `${sample}#${hap}#${contig}:${start}`
      const steps = parseWalkSteps(walk)
      paths.push({ name, steps, kind: 'W', raw: line })
    }
  }

  return { header, segments, edges, paths }
}
