import { IUPAC_MOTIF_REGEX } from './iupac.ts'

export interface ParsedMotif {
  name: string
  // IUPAC sequence with any '^' stripped
  site: string
  // bp from the site's 5' end to the top-strand cut, when a '^' was given
  cutOffset?: number
}

export interface MotifParseError {
  line: number
  text: string
  message: string
}

export interface MotifListParse {
  motifs: ParsedMotif[]
  errors: MotifParseError[]
}

// Parses a pasted list of named motifs, one per line, in the notation REBASE
// already uses for restriction enzymes:
//
//   EcoRI  G^AATTC     name + site, '^' marks the top-strand cut
//   GGTNACC            bare site, name defaults to the site
//   # comment
//
// The '^' is the whole reason this format is worth honoring: it carries the cut
// position, so no per-enzyme table needs to be baked in — a user can paste any
// enzyme set (or any motif set at all) straight from their own source.
export function parseMotifList(text: string): MotifListParse {
  const motifs: ParsedMotif[] = []
  const errors: MotifParseError[] = []
  for (const [idx, rawLine] of text.split('\n').entries()) {
    const line = rawLine.trim()
    if (line && !line.startsWith('#')) {
      const tokens = line.split(/[\s,]+/)
      const fail = (message: string) => {
        errors.push({ line: idx + 1, text: line, message })
      }
      if (tokens.length > 2) {
        fail('Expected "<name> <site>" or "<site>"')
      } else {
        const rawSite = (
          tokens.length === 2 ? tokens[1]! : tokens[0]!
        ).toUpperCase()
        const name = tokens.length === 2 ? tokens[0]! : rawSite
        const caretIdx = rawSite.indexOf('^')
        const site = rawSite.replaceAll('^', '')
        if (caretIdx !== rawSite.lastIndexOf('^')) {
          fail('Use at most one ^ to mark the cut position')
        } else if (!site) {
          fail('Missing sequence')
        } else if (!IUPAC_MOTIF_REGEX.test(site)) {
          fail(`"${site}" contains non-IUPAC characters`)
        } else {
          motifs.push({
            name,
            site,
            ...(caretIdx === -1 ? {} : { cutOffset: caretIdx }),
          })
        }
      }
    }
  }
  return { motifs, errors }
}
