---
id: config_cli
title: Configure JBrowse using the CLI
toplevel: true
---

import Figure from '../figure'

In order to display your data, JBrowse 2 needs to know about the reference
genome for your organism of interest and needs to have tracks created that
reference your data sources. This guide will show you how to set those up using
the JBrowse CLI.

:::note
You can also do this configuration with graphical configuration editing
interface built into JBrowse 2. See that guide [here](../config_gui).
:::

:::info For admins
If you are an administrator configuring JBrowse on a webserver, you must add the
`--out` command followed by your target directory, e.g. `--out /var/www/html/jbrowse2`
to write each JBrowse CLI configuration command to the `config.json` in that target
directory for your webserver to read from.

See the FAQ for "[what web server do I need](../../faq#what-web-server-do-i-need-to-run-jbrowse-2)" for more information.
:::

## Pre-requisites

- Installed and created your JBrowse environment using the [quickstart CLI guide](../../quickstart_cli)
- Some bioinformatics tools:
  - [Samtools](http://www.htslib.org/) installed e.g. `sudo apt install samtools` or `brew install samtools`, used for creating FASTA index and BAM/CRAM processing
  - [Genometools](http://genometools.org/) installed e.g. `sudo apt install genometools` or `brew install genometools`, (further, `brew install brewsci` and `brew install bio`) used for sorting GFF3 for creating tabix GFF
  - [tabix](http://www.htslib.org/doc/tabix.html) installed e.g. `sudo apt intall tabix` and `brew install htslib`, used for creating tabix indexes for BED/VCF/GFF files

## Adding a genome assembly

First we will configure an assembly, or reference genome, for for JBrowse 2.
This usually means providing a file that describes the reference sequence for
the organism, such as a FASTA or 2BIT file.

You can add a reference to a remote file as follows,
this example uses an assembly for a simulated organism
_volvox mythicus_:

```bash
## Make sure you are in the directory where you have downloaded JBrowse 2
jbrowse add-assembly http://jbrowse.org.s3.amazonaws.com/genomes/volvox/volvox.fa
```

`add-assembly` will automatically create a `config.json` file in the present directory (if `--out` is not specified) and populate it with the assembly, in this example, "volvox".

### Loading a local FASTA file

To use your own local data (in the following, replace "genome.fa" with your FASTA file), you'll have to first create an index with samtools, then add it to the `config.json` using a local reference:

```bash
## Create an indexed (.fai) FASTA file using samtools
samtools faidx genome.fa
## Then, load it using the add-assembly command
## and add your genome assembly to the config
jbrowse add-assembly genome.fa --load copy
```

:::info Note
Using `add-assembly` with a FASTA file assumes its index file is `.fai`. If you have an index file with a difference extension, you can manually specify it using the `--index` flag.

You can run `jbrowse add-assembly --help` to get a list of all the options.
:::

JBrowse 2 also supports other assembly file formats, such as bgzip-compressed
indexed FASTA (e.g. `.fa.gz`, `.fa.gz.fai`, and `.fa.gz.gzi` files) and 2BIT
files. See [configuring assemblies](../../config_guide#assembly-config) for more info
on formats supported for the sequence file.

If you have your JBrowse 2
[running as described](../../quickstart_cli/#running-jbrowse-2) in the JBrowse web
quickstart, you can refresh the page and an add a linear genome view. You will
now see your config in the Assembly dropdown.

<Figure caption="JBrowse 2 linear genome view setup with volvox in assembly dropdown" src="/img/lgv_assembly.png"/>

## Adding a track

Now we will show you how to add an alignments track and a variant track to JBrowse 2.

### Adding an alignments track

For this example we will use a BAM file to add an alignments track.

As with assemblies, you can add a track using local files or remote locations of your files.

This example uses the following [BAM](https://jbrowse.org.s3.amazonaws.com/genomes/volvox/volvox.bam) and
[BAM index](https://jbrowse.org.s3.amazonaws.com/genomes/volvox/volvox.bam.bai) files downloaded locally as `/data/volvox.bam` and `/data/volvox.bam.bai` respectively:

```bash
## Replace with the location of your BAM file
jbrowse add-track /data/volvox.bam --load copy
```

:::note
If you're using your own local BAM file and need to generate an index, use samtools as follows:

```bash
## Create an indexed BAM file using samtools
samtools index file.bam
## Add the BAM and BAI files to the JBrowse config
jbrowse add-track file.bam --load copy
```

:::

This will copy the BAM and BAM index into the JBrowse 2 directory and add a
track pointing at those files to the config file. To see more options adding the
track, such as specifying a name, run `jbrowse add-track --help`.

If you don't want to copy your BAM file, you can use `--move` to move the file
into the JBrowse 2 directory or `--symlink` to add a symlink to the file to the
JBrowse 2 directory. If you want more control over the location, you can use
`inPlace` to point the track at the file where it is, but be careful with this
option because on a traditional server you will need to ensure that the file is
in a place where the web server is serving it.

If you have your JBrowse 2
[running as described](../../quickstart_cli/#running-jbrowse-2) in the JBrowse web
quickstart, you can refresh the page and an add a linear genome view of the
volvox assembly. Then open track selector, and you will see the alignments
track.

<Figure caption="JBrowse 2 linear genome view with alignments track" src="/img/volvox_alignments.png"/>

### Adding a variant track

Adding a variant track is similar to adding an alignments track. For this
example, we will use a VCF file for the track. JBrowse 2 expects VCFs to be
compressed with `bgzip` and indexed. Similar to the above example, we will
assume the files are at `/data/volvox.vcf.gz` and `/data/volvox.vcf.gz.tbi`. You
can download these file here:
[VCF](https://jbrowse.org.s3.amazonaws.com/genomes/volvox/volvox.vcf.gz) and
[VCF index](https://jbrowse.org.s3.amazonaws.com/genomes/volvox/volvox.vcf.gz.tbi).

To add the track, run

```bash
jbrowse add-track /data/volvox.vcf.gz --load copy
```

:::note

If your VCF is not indexed, you can use the `bgzip` and `tabix` tools to
compress index it.

```bash
bgzip yourfile.vcf
tabix yourfile.vcf.gz
```

Alternatively, you can do the same thing with the `bcftools` tool.

```bash
bcftools view volvox.vcf --output-type z > volvox.vcf.gz
rm volvox.vcf
bcftools index --tbi volvox.vcf.gz
```

Note if you get errors about your VCF file not being sorted when using tabix,
you can use bcftools to sort your VCF.

```bash
bcftools sort file.vcf > file.sorted.vcf
bgzip file.sorted.vcf
tabix file.sorted.vcf.gz
```

For more info about `bgzip`, `tabix`, and `bcftools`, see
https://www.htslib.org/.

:::

If you have your JBrowse 2
[running as described](../../quickstart_cli/#running-jbrowse-2) in the JBrowse web
quickstart, you can refresh the page and an add a linear genome view of the
volvox assembly. Then open track selector, and you will see the variant track.

<Figure caption="JBrowse 2 linear genome view with variant track" src="/img/volvox_variants.png"/>

### Adding a BigWig/BigBed track

Probably one of the most simple track types to load is a BigWig/BigBed file
since it does not have any external index file, it is just a single file.

Make use of this [example file](https://jbrowse.org.s3.amazonaws.com/genomes/volvox/volvox-sorted.bam.coverage.bw) if you do not currently have your own data to add.

```bash
## Download bigwig or bigbed file
jbrowse add-track volvox-sorted.bam.coverage.bw --load copy
```

### Adding a GFF3 file with GFF3Tabix

To load a GFF3 file, we can sort and index it with tabix, make sure you have [GenomeTools](http://genometools.org/) (to
install can use `sudo apt install genometools`).

```bash
gt gff3 -sortlines -tidy -retainids yourfile.gff > yourfile.sorted.gff
bgzip yourfile.sorted.gff
tabix yourfile.sorted.gff.gz
jbrowse add-track yourfile.sorted.gff.gz --load copy
```

As an alternative to `gt gff3 -sortlines`, use `awk` and GNU `sort`, as follows:

```bash
awk '$1 ~ /^#/ {print $0;next} {print $0 | "sort -t\"\t\" -k1,1 -k4,4n"}' file.gff > file.sorted.gff
bgzip file.sorted.gff
tabix file.sorted.gff.gz
```

The `awk` command is inspired by the method in the [tabix documentation](http://www.htslib.org/doc/tabix.html), but avoids subshells and properly sets the
tab delimiter for GNU sort in case there are spaces in the GFF.

### Adding a synteny track

Loading synteny data makes use of all the previous functions we've used so far in this guide.

Here, we make use of the [grape](https://s3.amazonaws.com/jbrowse.org/genomes/grape/Vvinifera_145_Genoscope.12X.fa.gz) and [peach](https://s3.amazonaws.com/jbrowse.org/genomes/peach/Ppersica_298_v2.0.fa.gz) genome assemblies, but replace with your own data if applicable.

Use [minimap2](https://github.com/lh3/minimap2) to create a PAF file from FASTA files:

```bash
## Use minimap2 to create a PAF from your assemblies
minimap2 grape.fa.gz peach.fa.gz > peach_vs_grape.paf
## add each assembly to jbrowse config
## the -n flag names the assemblies explicitly
jbrowse add-assembly grape.fa.gz --load copy -n grape
jbrowse add-assembly peach.fa.gz --load copy -n peach
```

As we did [previously](#adding-a-gff3-file-with-gff3tabix) with GFF3 files:

```bash
## -a establishes an alias for an assembly
jbrowse add-track grape.sorted.gff.gz -a grape --load copy
jbrowse add-track peach.sorted.gff.gz -a peach --load copy
```

Next, we'll load the synteny "track" from the PAF file.

**Order matters here for the `--assemblyNames` parameter:**

If minimap2 is run as `minimap2 grape.fa peach.fa`, then you need to load as `--assemblyNames peach,grape`.

The order is reversed between the `minimap2` and `jbrowse` tools.

```bash
jbrowse add-track peach_vs_grape.paf --assemblyNames peach,grape --load copy
```

## Indexing feature names for searching

The final step of loading your JBrowse instance may include adding a "search
index" so that you can search by genes or other features by their name or ID.

To do this we can use the `jbrowse text-index` command:

```bash
jbrowse text-index
```

This will index relevant track types e.g. any track with Gff3TabixAdapter (gene
names and IDs) or VcfTabixAdapter (e.g. variant IDs). The command will print
out a progress bar for each track that it is indexing.

This will also update your `config.json` so that after it completes, you can type a
gene name into the "search box" in the linear genome view or other views and
quickly navigate to genes by gene name.

See the [text-index](../../cli#jbrowse-text-index) command docs for more info. Also
see the [FAQ entries for text searching](../../faq#text-searching)

## Conclusion

Now that you have JBrowse configured with an assembly and a couple of tracks,
you can start customizing it further. Check out the rest of the docs for more
information, especially the [JBrowse CLI](../../cli) docs for more details on some of
the steps shown here.

## Miscellaneous tips

You can use `--subDir` to organize your data directory:

```bash
mkdir my_bams
## Copies .bam and .bai files to my_bams folder
jbrowse add-track myfile.bam --subDir my_bams --load copy
```

If you are in a directory without a `config.json` file, you can add the `--out` paramter, and the
track or assembly will load into that `config.json` file, as follows:

```bash
jbrowse add-track /path/to/my/file.bam --out /path/to/my/jbrowse2 --load copy
```

Make sure to upgrade your JBrowse release often:

```bash
jbrowse upgrade
```

If you have or desire multiple configs files, you can specify which one you'd like to add configuration options to:

```bash
## The following adds an assembly to the alt_config.json file specified
## To run JBrowse using this alt_config.json, navigate to http://localhost/jbrowse2/?config=alt_config.json
jbrowse add-assembly mygenome.fa --out /path/to/my/jbrowse2/alt_config.json --load copy
```
