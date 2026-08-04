import { IUPAC_MOTIF_REGEX } from './iupac.ts'

export interface ParsedMotif {
  name: string
  // IUPAC sequence with any cut notation stripped
  site: string
  // the source line, so one motif can be handed to an adapter on its own
  // without re-serializing the notation it came from
  line: string
  // bp from the site's 5' end to the top-strand cut, when the line pinned one
  cutOffset?: number
  // bp from the site's 5' end to the bottom-strand cut, when the line pinned it
  // outright. A '^' does not: it marks the top cut only, and the bottom one is
  // the mirror image for a palindrome and unknown otherwise.
  cutOffsetBottom?: number
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

// REBASE writes an enzyme that cuts OUTSIDE its recognition site as
// `GGTCTC(1/5)`: the two numbers are the top- and bottom-strand cuts counted
// from the site's 3' end (negative counts back into the site). Every type IIS
// enzyme — BsaI, BsmBI, BbsI, SapI, AarI, the whole Golden Gate set — is written
// this way, so a pasted REBASE list is largely unusable without it.
const CUT_OFFSET_NOTATION = /\((-?\d+)\/(-?\d+)\)$/

// Parses a pasted list of named motifs, one per line, in the notation REBASE
// already uses for restriction enzymes:
//
//   EcoRI  G^AATTC     name + site, '^' marks the top-strand cut
//   BsaI   GGTCTC(1/5) cuts downstream of the site, top/bottom
//   GGTNACC            bare site, name defaults to the site
//   # comment
//
// The cut notation is the whole reason this format is worth honoring: it carries
// the cut positions, so no per-enzyme table needs to be baked in — a user can
// paste any enzyme set (or any motif set at all) straight from their own source.
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
        const offsets = CUT_OFFSET_NOTATION.exec(rawSite)
        const marked = offsets ? rawSite.slice(0, offsets.index) : rawSite
        const caretIdx = marked.indexOf('^')
        const site = marked.replaceAll('^', '')
        const name = tokens.length === 2 ? tokens[0]! : site
        if (offsets && caretIdx !== -1) {
          fail('Use either ^ or (n/m) to mark the cut, not both')
        } else if (caretIdx !== marked.lastIndexOf('^')) {
          fail('Use at most one ^ to mark the cut position')
        } else if (!site) {
          fail('Missing sequence')
        } else if (!IUPAC_MOTIF_REGEX.test(site)) {
          fail(`"${site}" contains non-IUPAC characters`)
        } else {
          motifs.push({
            name,
            site,
            line,
            ...(caretIdx === -1 ? {} : { cutOffset: caretIdx }),
            ...(offsets
              ? {
                  cutOffset: site.length + Number(offsets[1]),
                  cutOffsetBottom: site.length + Number(offsets[2]),
                }
              : {}),
          })
        }
      }
    }
  }
  return { motifs, errors }
}
