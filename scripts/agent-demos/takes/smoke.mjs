// One short turn, asked the way a person would ask it, so it proves the whole
// recording loop (readiness, typing, turn detection, the layout check, encode)
// in about a minute before a take that costs ten.
//
// Deliberately NOT pre-resolved: "hg38" rather than a config URL is what
// `docs topic:"hosted-data"` exists to answer, and a gene name rather than
// coordinates is what a viewer would type. The coordinates rule in
// ../CLAUDE.md is about the HARNESS's own navigation, not about the prompt.
export const SHELL = false

export const SYSTEM = () =>
  `You are driving JBrowse Desktop over its MCP tools. Be direct: do what the
message asks with as few tool calls as possible, then answer in one sentence.
Screenshot and read the image once the view is up. Turn on exactly the tracks
that were asked for and no others; if navigating by name adds a track of its
own, hide the duplicate.`

export const STEPS = [
  {
    prompt: 'Open hg38 and take me to BRCA1, with the RefSeq genes on.',
    say: 'Smoke test: one genome, one gene, asked in plain English.',
  },
]
