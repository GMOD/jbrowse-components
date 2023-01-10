Our grape vs peach dotplot demo has been useful for demonstrating our synteny
capabilities

### Pre-requisites

- Install node.js (don't recommend installing from apt directly, try
  nodesource's apt repository
  https://github.com/nodesource/distributions#installation-instructions)
- Install the JBrowse CLI tools `npm install -g @jbrowse/cli`, this should give
  a command named `jbrowse` automatically in your PATH
- Install minimap2 (`sudo apt install minimap2` or similar)
- Install samtools (`sudo apt install samtools` or similar)

## Run minimap2 to perform a whole genome alignment

### Preparation for running minimap2

Download the grape and peach genome assembly (FASTA) files from e.g. Phytozome
(requires login)

https://data.jgi.doe.gov/refine-download/phytozome?genome_id=457&expanded=Phytozome-457
https://data.jgi.doe.gov/refine-download/phytozome?genome_id=298&expanded=Phytozome-298

You can substitute your own FASTA files as needed for the purposes of the
tutorial also

### Run minimap2 to perform a whole genome alignment

```bash
minimap2 -c grape.fa peach.fa > peach_vs_grape.paf
```

The -c flag tells it to compute per-base alignment and output CIGAR strings to
the PAF file. JBrowse will be fine if you don't specify -c, but the
visualization will not show insertions and deletions within the alignment. Note
that using -c will take longer to run also.

The grape genome will be the "target" peach will by the "query"

See also Footnote 1

## Create FASTA indexes for the assemblies

```bash
samtools faidx grape.fa
samtools faidx peach.fa
```

## Load the files into JBrowse

Load the assemblies, this outputs to a folder in your "web directory" and says
to copy the assemblies

```bash
jbrowse add-assembly grape.fa --load copy --name grape --out /var/www/html/jbrowse/
jbrowse add-assembly peach.fa --load copy --name peach --out /var/www/html/jbrowse/
```

## Load the minimap2 synteny track

```bash
jbrowse add-track peach_vs_grape.paf --assemblyNames peach,grape --load copy --out /var/www/html/jbrowse
```

Note: Order matters here for the `--assemblyNames` parameter!

If minimap2 is run as `minimap2 grape.fa peach.fa`, then you need to load as
`--assemblyNames peach,grape`.

The order is reversed between the `minimap2` and `jbrowse` tools. You can think
of JBrowse as loading the "left column" of the PAF as the first in the
--assemblyNames list, and the "right column" as the second name in the
--assemblyNames list (the left column is query, and right is target)

## Calculate synteny using MCScan (python version)

### Intro

The minimap2 method above does a whole-genome alignment. Configuring a whole
genome alignment can be tricky and involved. Another method for computing
synteny is to perform "all-vs-all BLASTP" e.g. aligning all protein sequences
against each other to find homologous genes. The MCScan toolkit can perform this

https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)

### Preparation for running MCScan

Download the grape and peach whole genome assembly FASTA files, e.g. from
Phytozome (requires login)

https://data.jgi.doe.gov/refine-download/phytozome?genome_id=457&expanded=Phytozome-457
https://data.jgi.doe.gov/refine-download/phytozome?genome_id=298&expanded=Phytozome-298

### Running MCScan

```
# Covert GFFs to bed files
python -m jcvi.formats.gff bed --type=mRNA --key=Name Vvinifera_145_Genoscope.12X.gene.gff3.gz -o grape.bed
python -m jcvi.formats.gff bed --type=mRNA --key=Name Ppersica_298_v2.1.gene.gff3.gz -o peach.bed
```

```
# Format CDS sequences
python -m jcvi.formats.fasta format Vvinifera_145_Genoscope.12X.cds.fa.gz grape.cds
python -m jcvi.formats.fasta format Ppersica_298_v2.1.cds.fa.gz peach.cds

```

```
# Run synteny calculations
python -m jcvi.compara.catalog ortholog grape peach --no_strip_names
```

This final command will output .anchors (individual gene pairs) and
.anchors.simple files (chained sets of genes forming a "syntenic block").
JBrowse can load both these files as different tracks

## Using JBrowse to visualize the dotplot

After running the above steps, the configuration file will have the two
assemblies and the SyntenyTrack(s) loaded. Open your web browser and navigate to
http://yourhost/jbrowse/

Select `Add->Dotplot view` from the main header bar

Then select the "Grape" assembly for the first selector and "Peach" for the
second from the "Import form". This will make Grape the X axis of the dotplot,
and Peach the Y. You can also switch it if you want.

Then, also select "Existing track" and which will give you a small select box
asking what dataset/synteny track that you want to load into the Dotplot

Then click Open, and the dotplot will be launched

### Footnote 1 - whole genome alignment may require tweaking paramters

Note properly performing a whole-genome alignment may require tweaking
paramters, make sure to read the manual of e.g. minimap2 for more details

### Footnote 2 - loading data from other tools

Note that JBrowse 2 also supports loading data from other tools including MUMmer
(.delta files), MashMap (.out files, similar to PAF but a little different), and
UCSC liftover (.chain files). You can use these in place of the minimap2 step
