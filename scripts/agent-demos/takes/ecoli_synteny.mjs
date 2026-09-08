// The alignment the fly take had to give up on, at a genome size where it fits
// in a turn: E. coli K-12 MG1655 against O157:H7 Sakai. minimap2 runs on
// camera in about four seconds, and the extra 857 kb Sakai carries turns out
// to be the two Shiga toxin prophages and the LEE island. See ecoli_synteny.md.
export const SHELL = true

export const SYSTEM =
  cwd => `You are driving JBrowse Desktop over its MCP tools and you also have a shell
with minimap2, jq, curl and the jbrowse CLI on PATH. Your working directory is
${cwd}, and every file you make goes there. k12.fa.gz is E. coli K-12 MG1655
GCF_000005845.2 and sakai.fa.gz is E. coli O157:H7 Sakai GCF_000008865.2. Both
assemblies have hosted JBrowse configs under jbrowse.org/hubs/genark/ that
already describe the sequence and the NCBI gene track, so merging those two is
shorter than declaring either assembly by hand; leave their text-search entries
out of the merge, since this take navigates by explicit coordinates and never by
gene name. A gene track at whole-genome zoom draws only a "too many features"
bar, so turn gene tracks on when you are zoomed into a region and not before.
Be direct: do what each message asks with as few tool calls as
possible, then answer in one plain-English sentence with the numbers behind it.
After every change to the app, screenshot and read the image, and fix anything
the settle report lists as not ready rather than describing it. Hide the track
selector once tracks are on, so the genomes fill the window.`

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
      'Read the gene names off the Sakai gene track for the biggest few of those, and take me to the most interesting one.',
    say: 'Named off the track in the app, the islands are the two Shiga toxin prophages and the LEE type III secretion island.',
  },
]
