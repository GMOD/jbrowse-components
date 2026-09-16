// The alignment the fly take had to give up on, at a genome size where it fits
// in a turn: E. coli K-12 MG1655 against O157:H7 Sakai. minimap2 runs on
// camera in about four seconds, and the extra 857 kb Sakai carries turns out
// to be a dozen prophage islands, the Shiga toxin ones among them. See
// ecoli_synteny.md.
export const SHELL = true

export const SYSTEM =
  cwd => `You are driving JBrowse Desktop over its MCP tools and you also have a shell
with minimap2, jq, curl and the jbrowse CLI on PATH. Your working directory is
${cwd}, and every file you make goes there. k12.fa.gz is E. coli K-12 MG1655
GCF_000005845.2 and sakai.fa.gz is E. coli O157:H7 Sakai GCF_000008865.2. Both
assemblies have hosted JBrowse configs under jbrowse.org/hubs/genark/, so build
from those rather than declaring either assembly by hand, and build them into
the session rather than into a config file: jb.docs('recipes') has "Two genomes
and the alignment between them, in one spec", which takes each hosted config's
assembly and gene track as sessionAssemblies and sessionTracks. Whatever loads
the data opens the views in the same step — never leave the app sitting on an
empty session. The gene track to show is <assembly>-ncbiGene, whose labels are
gene symbols; -ncbiGff labels most genes with a locus tag and its uri is
relative to the hub. A gene track at whole-genome zoom draws only a "too many
features" bar, so turn gene tracks on when you are zoomed into a region and not
before. Leave the hosted text-search entries out, since this take navigates by
explicit coordinates and never by gene name.
Be direct: do what each message asks with as few tool calls as
possible, then answer in one plain-English sentence with the numbers behind it.
After every change to the app, screenshot and read the image, and fix anything
the settle report lists as not ready rather than describing it. A dotplot's two
axes scale independently, so the angle a diagonal draws at is the panel's shape
as much as the sequence lengths — read both axes' bpPerPx before you say
anything about slope. A display clips whatever its height does not reach, so a
feature you name has to be in the frame with its name legible: raise the
display's height, or tighten the window, until it is. Hide the track selector
once tracks are on, so the genomes fill the window.`

export const STEPS = [
  {
    prompt:
      'k12.fa.gz and sakai.fa.gz here are E. coli K-12 MG1655 and O157:H7 Sakai. There is no alignment between them, so make one, then open both genomes side by side with the alignment between them.',
    say: 'No alignment exists between these two strains. minimap2 makes one here, on camera, in about four seconds.',
  },
  {
    prompt: 'Add a dotplot underneath, chromosomes only.',
    say: 'Sakai carries two plasmids as well as its chromosome, so the axes have to name what to draw.',
  },
  {
    prompt:
      "Sakai's chromosome is 857 kb longer than K-12's. Where is that extra sequence? Answer from the alignment file, not the dotplot, with the numbers.",
    say: 'The answer is in the gaps between aligned blocks — the intervals of Sakai that K-12 has nothing to align to.',
  },
  {
    prompt:
      'Read the gene names off the Sakai gene track for the biggest few of those, and take me to the most interesting one, framed so I can read the gene names.',
    // Which island the agent ranks first is its call — take 1 answered Sp5 and
    // the 2026-09-10 attempt Stx1 — so the line says what the move is rather
    // than which island it lands on.
    say: "The islands are Sakai's own. The agent names them off its annotation, then takes the view to the one it ranks first.",
  },
]
