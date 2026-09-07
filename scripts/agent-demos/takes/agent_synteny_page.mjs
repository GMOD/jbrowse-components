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
with minimap2, jq, curl and the jbrowse CLI on PATH. Your working directory is
${cwd}; every file you create goes there, and the alignment runs in the shell,
outside the app. Both genomes are on the UCSC GenArk hub, whose files and hosted
JBrowse config for an accession live under
hgdownload.soe.ucsc.edu/hubs/<GCF|GCA>/<3>/<3>/<3>/<acc>/ and
jbrowse.org/hubs/genark/... respectively. The hub's <acc>.2bit is the same
sequence the browser reads; ./twoBitToFa in your working directory converts it
to FASTA for the aligner. The hosted configs already describe
the sequence, the chromAlias file and the gene track, so merging the two is
shorter than declaring either assembly by hand. Align with minimap2 -x asm10, which is the preset for the divergence
between these two species; asm5 is for closer genomes and takes far longer.
A shell command that takes minutes must run in the background so a tool call
does not time out over it, but keep polling it within the same turn until it
finishes: never end a turn with work still running. Open nothing in JBrowse
until the alignment is indexed, and make sure the comparison is on screen
before you answer. Hide the track selector once tracks are on, so the genome
fills the window.
When asked where the genomes disagree, total the alignment file rather than
describing the plot, and say the numbers before you navigate. Be direct: do what
each message asks with as few tool calls as possible, then answer in one plain-English
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
      'Get D. simulans GCF_016746395.2 and D. mauritiana GCF_004382145.1 from the GenArk hub, align them, and open both side by side with the alignment between them.',
    say: 'One sentence for the whole pipeline. The aligner runs in the background so the tool call does not time out.',
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
