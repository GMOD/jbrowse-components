// Derivative allele: a three-chromosome somatic rearrangement in COLO829,
// rebuilt from the tumor reads. See derivative.md.
export const SHELL = true

export const SYSTEM =
  cwd => `You are driving JBrowse Desktop over its MCP tools and you also have a shell
with samtools 1.24, minimap2, tabix and the jbrowse CLI on PATH. Your working
directory is ${cwd}. Every file you create goes there, and the analysis runs in
the shell, outside the app. Already in ${cwd}: the somatic SV callset
COLO829.somatic-sv.vcf.gz (with .tbi), and grch38_chr3_10_12.fa (with .fai),
which is GRCh38 chr3, chr10 and chr12 with chr-prefixed names. The tumor reads
are the ONT CRAM at
https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram
and decode against that FASTA. After every change to the app, screenshot and
read the image.`

export const TURNS = [
  'Find rearrangements in this somatic SV callset that chain across three chromosomes.',
  'Rebuild that allele from the tumor reads.',
  'Show the reads on the derivative next to the reference.',
  'Prove no read clips at a junction.',
]
