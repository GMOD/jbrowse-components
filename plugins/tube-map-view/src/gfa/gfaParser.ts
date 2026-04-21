function parseTag(tag: string, tags: Record<string, string | number>) {
  const [name, type, val] = tag.split(':')
  if (type === 'i') {
    tags[name!] = +val!
  } else if (type === 'Z') {
    tags[name!] = val!
  }
}

export interface GFANode {
  id: string
  length: number
  sequence: string
  tags: Record<string, string | number>
}

export interface GFALink {
  source: string
  target: string
  strand1?: string
  strand2?: string
  cigar: string
  tags: Record<string, string | number>
}

export interface GFAPath {
  name: string
  path: string
  rest: string[]
}

export interface GFAWalkSegment {
  id: string
  strand: string
}

export interface GFAWalk {
  sample: string
  haplotype: number
  contig: string
  start: number
  end: number
  segments: GFAWalkSegment[]
  tags: Record<string, string | number>
}

function parseWalkBody(body: string) {
  const segments: GFAWalkSegment[] = []
  let current = ''
  let currentStrand = '+'
  for (const ch of body) {
    if (ch === '>' || ch === '<') {
      if (current) {
        segments.push({ id: current, strand: currentStrand })
      }
      current = ''
      currentStrand = ch === '>' ? '+' : '-'
    } else {
      current += ch
    }
  }
  if (current) {
    segments.push({ id: current, strand: currentStrand })
  }
  return segments
}

export interface GFAGraph {
  nodes: GFANode[]
  links: GFALink[]
  paths: GFAPath[]
  walks: GFAWalk[]
  header: Record<string, string | number>[]
  id: string
}

export function parseGFA(file: string) {
  const graph: GFAGraph = {
    nodes: [],
    links: [],
    paths: [],
    walks: [],
    header: [],
    id: '',
  }

  for (const line of file.split('\n')) {
    if (line.startsWith('H')) {
      const headerLine: Record<string, string | number> = {}
      const [, ...rest] = line.split('\t')
      for (const tag of rest) {
        parseTag(tag, headerLine)
      }
      graph.header.push(headerLine)
    } else if (line.startsWith('S')) {
      const [, name, ...rest] = line.split('\t')
      let len: number
      let seq: string
      let tagfields: string[]
      let gfa1 = false
      if (+rest[0]!) {
        len = +rest[0]!
        seq = rest[1]!
        tagfields = rest.slice(2)
      } else {
        gfa1 = true
        seq = rest[0]!
        len = seq.length
        tagfields = rest.slice(1)
      }
      const tags: Record<string, string | number> = {}
      for (const tagfield of tagfields) {
        parseTag(tagfield, tags)
      }
      if (gfa1 && tags.LN) {
        len = +tags.LN
      }
      graph.nodes.push({ id: name!, length: len, sequence: seq, tags })
    } else if (line.startsWith('E')) {
      const [, , source, target, , , , , cigar, ...rest] = line.split('\t')
      const source1 = source!.slice(0, -1)
      const target1 = target!.slice(0, -1)
      const strand1 = source!.at(-1)
      const strand2 = target!.at(-1)
      const tags: Record<string, string | number> = {}
      for (const element of rest) {
        parseTag(element, tags)
      }

      graph.links.push({
        source: source1,
        target: target1,
        strand1,
        strand2,
        cigar: cigar!,
        tags,
      })
    } else if (line.startsWith('L')) {
      const [, source, strand1, target, strand2, cigar, ...rest] =
        line.split('\t')
      const tags: Record<string, string | number> = {}
      for (const element of rest) {
        parseTag(element, tags)
      }
      graph.links.push({
        source: source!,
        target: target!,
        strand1,
        strand2,
        cigar: cigar!,
        tags,
      })
    } else if (line.startsWith('W')) {
      const [, sample, hap, contig, start, end, body, ...rest] =
        line.split('\t')
      const tags: Record<string, string | number> = {}
      for (const element of rest) {
        parseTag(element, tags)
      }
      graph.walks.push({
        sample: sample!,
        haplotype: +hap!,
        contig: contig!,
        start: start === '*' ? -1 : +start!,
        end: end === '*' ? -1 : +end!,
        segments: parseWalkBody(body!),
        tags,
      })
    } else if (line.startsWith('P')) {
      const [, name, path, ...rest] = line.split('\t')

      graph.paths.push({ name: name!, path: path!, rest })
    }
  }
  return graph
}
