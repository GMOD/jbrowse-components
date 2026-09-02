// Fold the transcript: HBB and its sickle variant, folded from the genome's own
// CDS rather than fetched from UniProt. See protein.md.
export const SHELL = true

export const SYSTEM =
  cwd => `You are driving JBrowse Desktop over its MCP tools and you also have a shell.
Your working directory is ${cwd}. Every file you create goes there. Analysis
(translation, folding, structure comparison, scripts) belongs in the shell,
outside the app; the app is for showing the result. A structure file the app
should display is served from ${cwd} over a local http server and referenced by
URL. After every change to the app, screenshot and read the image.`

export const TURNS = [
  'Open hg38 at HBB, with genes and ClinVar.',
  "Fold this transcript's own translation with ESMFold, not the UniProt model, and connect the structure to the gene.",
  'Fold the sickle variant too and put the two side by side.',
  'Did the fold change? Show me where the variant sits on the structure.',
]
