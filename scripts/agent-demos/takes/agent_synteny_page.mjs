// The take that goes with website/docs/tutorials/agent_synteny.md: the four
// sentences that page tells a reader to type, typed. Filmed with
// recordDemoMac.mjs, so the Claude Code TUI is in frame beside JBrowse and a
// viewer reads the real conversation rather than a caption about it.
//
// takes/synteny.mjs is the older three-turn version of the same analysis, shot
// through agentDemo.mjs, which filmed only the JBrowse window. The turns here
// track the page instead, and the page's steering sentences are part of the
// prompts because the page teaches them as the thing you have to say.
export const SHELL = true

export const SYSTEM =
  cwd => `You are driving JBrowse Desktop over its MCP tools and you also have a shell
with jq, curl and the jbrowse CLI on PATH. Your working directory is ${cwd}.
sim_vs_mau.paf there is a finished minimap2 asm10 alignment of D. simulans
GCF_016746395.2 (query) against D. mauritiana GCF_004382145.1 (target). Both
assemblies have hosted JBrowse configs under jbrowse.org/hubs/genark/, which
already describe the sequence, the chromAlias file and the gene track, so
merging those two is shorter than declaring either assembly by hand. Be direct:
do what each message asks with as few tool calls as possible, then answer in one
plain-English sentence with the numbers behind it. After every change to the
app, screenshot and read the image, and fix anything the settle report lists as
not ready rather than describing it. Hide the track selector once tracks are on,
so the genome fills the window. Navigate by explicit coordinates, never by gene
name. When asked where the genomes disagree, total the alignment file rather
than describing the plot, and say the numbers before you navigate.`

// Each step is the page's prompt plus the sentence a viewer needs to know why
// it is being asked. The page's section headings are the `say` lines.
export const STEPS = [
  // Turn 1 has to leave a session OPEN by the time it ends: the harness
  // verifies its own window layout after this turn by asking the app
  // window.innerWidth over the bridge, and that call needs one. The first take
  // said "align, then open", the agent correctly backgrounded the aligner and
  // ended the turn with nothing loaded, and the harness died on the check.
  //
  // Waiting for the aligner INSIDE turn one is what fixes that without showing
  // a half-built comparison: two genomes side by side with no alignment
  // between them look like the finished thing and are not. The encoder
  // collapses the wait, and the TUI in frame shows the polling.
  {
    prompt:
      'sim_vs_mau.paf here aligns D. simulans GCF_016746395.2 to D. mauritiana GCF_004382145.1. Index it and open both genomes side by side with the alignment between them.',
    say: 'One sentence: index the alignment, merge the two hosted configs, open the comparison.',
  },
  {
    prompt: 'Add a dotplot underneath, restricted to the six chromosome arms.',
    say: 'The axes have to name the arms, or a few hundred unplaced scaffolds interleave them.',
  },
  {
    prompt:
      'Where do the two genomes run in opposite directions? Answer from the alignment file, not the dotplot, with the numbers.',
    say: 'The answer comes out of the PAF. A dotplot cannot resolve a block this size.',
  },
  {
    prompt: 'Take me to the 2R region, coordinates first.',
    say: 'Numbers first, then the picture, so what is on screen is a claim you can check.',
  },
]
