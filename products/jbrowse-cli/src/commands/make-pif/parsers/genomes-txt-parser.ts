import { getReadline } from '../file-utils.ts'

export interface GenomeEntry {
  file: string
  name: string
  tags: Map<string, string>
}

export async function parseGenomesTxt(filename: string) {
  const rl = getReadline(filename)
  const entries: GenomeEntry[] = []

  for await (const line of rl) {
    if (line.startsWith('#') || line.trim() === '') {
      continue
    }

    const parts = line.split('\t')
    if (parts.length >= 2) {
      const file = parts[0]!.trim()
      const name = parts[1]!.trim()
      const tags = new Map<string, string>()

      if (parts[2]) {
        for (const tag of parts[2].split(/[,;]\s*|(?=\w+:)/)) {
          const trimmed = tag.trim()
          if (trimmed) {
            const colonIdx = trimmed.indexOf(':')
            if (colonIdx > 0) {
              tags.set(trimmed.slice(0, colonIdx), trimmed.slice(colonIdx + 1))
            }
          }
        }
      }

      entries.push({ file, name, tags })
    }
  }

  rl.close()
  return entries
}

export function extractAssemblyOrdering(entries: GenomeEntry[]) {
  return entries.map(e => e.name)
}
