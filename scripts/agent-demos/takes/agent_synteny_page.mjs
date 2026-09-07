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
with minimap2, jq and the jbrowse CLI on PATH. Your working directory is ${cwd}.
Every file you create goes there, and the alignment runs in the shell, outside
the app. The two genome FASTAs are already in ${cwd} as sim.fa.gz (D. simulans
GCF_016746395.2) and mau.fa.gz (D. mauritiana GCF_004382145.1); their hosted
JBrowse configs are at jbrowse.org under hubs/genark, and merging those two is
shorter than declaring either assembly by hand. Be direct: do what each message
asks with as few tool calls as possible, then answer in one plain-English
sentence with the numbers behind it. After every change to the app, screenshot
and read the image, and fix anything the settle report lists as not ready rather
than describing it. Navigate by explicit coordinates, never by gene name.`

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
      'Align D. simulans GCF_016746395.2 against D. mauritiana GCF_004382145.1 with minimap2: sim.fa.gz and mau.fa.gz are already here. Run it in the background and poll it, and when it is done index it and open both genomes in JBrowse side by side, with their gene tracks and the alignment between them.',
    say: 'One sentence for the whole pipeline. The aligner runs in the background so the tool call does not time out.',
  },
  {
    prompt:
      'Add a dotplot of the same two assemblies underneath. Restrict both axes to chr2L, chr2R, chr3L, chr3R, chr4 and chrX, and tell me how much that drops.',
    say: 'The axes have to name the arms, or a few hundred unplaced scaffolds interleave them.',
  },
  {
    prompt:
      'Where do the two genomes run in opposite directions? Answer from the alignment file, not from the dotplot, and show me the numbers: aligned bases per arm split by strand.',
    say: 'The answer comes out of the PAF. A dotplot cannot resolve a block this size.',
  },
  {
    prompt:
      'Take the synteny view to the 2R region, with the gene tracks on. Say the coordinates before you navigate.',
    say: 'Numbers first, then the picture, so what is on screen is a claim you can check.',
  },
]
