// Live MCP only: stream four GEO bigWigs into the app, derive a ratio track
// from them, then make the agent defend the result. No shell — every fetch and
// every number happens inside run_javascript, against the open session.
//
// Turn three names the production recipe on purpose. A 25 bp log2 ratio taken
// off raw coverage with a small pseudocount is what an agent reaches for
// unprompted, and it slams between the scale bounds bin to bin because the
// denominator keeps approaching zero — high density, no signal. CPM
// normalization, a pseudocount of 1 on the normalized values and a smoothing
// window several bins wide is what deepTools bigwigCompare does, and it keeps
// the fine bins while making them mean something.
//
// The pseudocount has to come from the data. deepTools defaults to 1 because it
// expects counts-scale input; CPM-normalized ATAC coverage sits well below 1,
// so a fixed 1 dominates every ratio and compresses log2 to about ±0.01. An
// agent told to use 1 will do it and then correctly report that the effect
// vanished.
export const SHELL = false

export const SYSTEM = () =>
  [
    'You are driving JBrowse Desktop over its MCP tools for a screen recording.',
    'Be direct: do what each message asks with as few tool calls as possible, then answer in one plain-English sentence a non-expert understands, with the numbers that back it.',
    'Do NOT inspect, modify, or remove plugins or configuration.',
    'Hide the track selector once tracks are on, so the genome fills the window.',
    'Navigate with explicit coordinates, not gene names: a name goes through the text index, which opens a results picker over the app when it has more than one hit and launches whichever track answered, adding a gene track nobody asked for.',
    'The window is about 990x930: keep everything on screen. More than one locus goes side by side — session.setUseWorkspaces(true) first, since applyLayoutSpec does nothing while workspaces are off, then session.applyLayoutSpec({ direction: "horizontal", children: [...] }) whose leaves name their views under "views". Never stacked down the page, and bring track heights down to fit.',
    'After each change call jb.waitReady, and if a track reports notReady, fix it before answering rather than describing it.',
  ].join(' ')

export const TURNS = [
  'Open hg38 at CDKN1A, with genes and vertebrate conservation.',
  'Add the human ATAC-seq from GEO series GSE217032 that compares nutlin against a vehicle control, as one stacked track.',
  'Show me log2 nutlin over vehicle across this view, as its own track — but do it the way deepTools bigwigCompare would: depth-normalize each sample to CPM first, keep the bins fine, smooth over a window several bins wide so the estimate is stable without throwing away resolution, and pick the pseudocount from the data itself — something like the median non-zero bin value — since a fixed 1 would swamp CPM-scale coverage and flatten the ratio. Fixed symmetric scale with a zero line, and tell me which direction is more open.',
  'That could still be a normalization artifact. Put the same ratio over GAPDH and over a gene desert beside this one — side by side in a horizontal workspace layout, not stacked down the page, with track heights small enough that all three fit on screen at once. Then tell me what this does and does not establish.',
]
