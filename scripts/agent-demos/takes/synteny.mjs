// Two assemblies, no chain file: Drosophila simulans against D. mauritiana,
// aligned on camera. See synteny.md.
export const SHELL = true

export const SYSTEM =
  cwd => `You are driving JBrowse Desktop over its MCP tools and you also have a shell
with minimap2, samtools, jq and the jbrowse CLI on PATH. Your working directory
is ${cwd}. Every file you create goes there, and the alignment runs in the shell,
outside the app. The two genome FASTAs are already in ${cwd} as sim.fa.gz
(D. simulans GCF_016746395.2) and mau.fa.gz (D. mauritiana GCF_004382145.1);
their hosted JBrowse configs are at jbrowse.org under hubs/genark. After every
change to the app, screenshot and read the image.`

export const TURNS = [
  'Open Drosophila simulans and D. mauritiana side by side. There is no alignment between them, so make one.',
  'Now a dotplot of the whole genome, under the synteny view.',
  'Which chromosome arm carries the largest inversion? Take me there.',
]
