---
id: quickstart_cli
title: Config editing quick start — command-line interface
toplevel: true
---

import Figure from './figure'

In order to display your data, JBrowse 2 needs to know about the reference
genome for your organism of interest and needs to have tracks created that
reference your data sources. This guide will show you how to set those up using
the JBrowse CLI.

:::note

You can also do this configuration with graphical configuration editing
interface built into JBrowse 2. See that guide [here](../quickstart_gui).

:::

## Pre-requisites

- [JBrowse CLI](../quickstart_web#installing-the-cli-tools)

- [JBrowse 2 web application](../quickstart_web#using-jbrowse-create-to-download-jbrowse-2)

## Adding a genome assembly

:::info

For this step we configure JBrowse to use files being hosted at a URL. For an
example of how to use files located on your computer, see the
[adding a track](#adding-a-track) step.

:::

First we will configure an assembly, or reference genome, for for JBrowse 2.
This usually means providing a file that describes the reference sequence for
the organism, such as a FASTA or 2BIT file.

You will want to use your own data for your organism, but for this example we
provide a small example reference sequence for a simulated organism, _volvox
mythicus_, that you can use.

```sh-session
# Make sure you are in the directory where you have downloaded JBrowse 2
jbrowse add-assembly http://jbrowse.org.s3.amazonaws.com/genomes/volvox/volvox.fa
```

:::caution

A FASTA must have an index to work in JBrowse 2. This command assumes that the
index file is the same as the FASTA but with `.fai` appended to the file name.

:::

This command will generate a config file if one does not exist yet and add an
assembly called "volvox" to the config file with the URLs of the FASTA and FASTA
index files. The name of the assembly was guessed from the file name, but you
can customize that and many other things with various flags passed to the
command. You can run `jbrowse add-assembly --help` to get a list of all the
options.

JBrowse 2 also supports other assembly file formats, such as bgzip-compressed
indexed FASTA (e.g. `.fa.gz`, `.fa.gz.fai`, and `.fa.gz.gzi` files) and 2BIT
files. See [configuring assemblies](../config_guide#assembly-config) for more info
on formats supported for the sequence file.

:::note

If your FASTA is not indexed, you can use the `samtools` tool to index it.

```sh-session
samtools faidx volvox.fa
# generates volvox.fa.fai
```

Or if you want to compress your FASTA, you can use `bgzip` as well.

```sh-session
bgzip volvox.fa
samtools faidx volvox.fa.gz
# compresses volvox.fa to volvox.fa.gz and generates volvox.fa.gz.fai and volvox.fa.gz.gzi
```

For more info about `bgzip` and `samtools`, see https://www.htslib.org/.

:::

If you have your JBrowse 2
[running as described](../quickstart_web#running-jbrowse-2) in the JBrowse web
quickstart, you can refresh the page and an add a linear genome view. You will
now see your config in the Assembly dropdown.

<Figure caption="JBrowse 2 linear genome view setup with volvox in assembly dropdown" src="/img/lgv_assembly.png"/>

## Adding a track

Now we will show you how to add an alignments track and a variant track to
JBrowse 2.

:::info

For this step we configure JBrowse to use files located on your computer. For an
example of how to use files hosted at a URL, see the
[adding a genome assembly](#adding-a-genome-assembly) step.

:::

### Adding an alignments track

For this example we will use a BAM file to add an alignments track. Again, for
this example we provide a small example BAM, but for your data you will replace
the file name with the names of your data files.

For this track we will assume the data is on your computer at the locations
`/data/volvox.bam` and `/data/volvox.bam.bai`. You can download these file here
if you want to run this example:
[BAM](https://jbrowse.org.s3.amazonaws.com/genomes/volvox/volvox.bam) and
[BAM index](https://jbrowse.org.s3.amazonaws.com/genomes/volvox/volvox.bam.bai).

To add the track, run

```sh-session
# Replace with the location of your BAM file
jbrowse add-track /data/volvox.bam --load copy
```

This will copy the BAM and BAM index into the JBrowse 2 directory and add a
track pointing at those files to the config file. To see more options adding the
track, such as specifying a name, run `jbrowse add-track --help`.

If you don't want to copy your BAM file, you can use `--move` to move the file
into the JBrowse 2 directory or `--symlink` to add a symlink to the file to the
JBrowse 2 directory. If you want more control over the location, you can use
`inPlace` to point the track at the file where it is, but be careful with this
option because on a traditional server you will need to ensure that the file is
in a place where the web server is serving it.

:::note

If your BAM is not indexed, you can use the `samtools` tool to index it.

```sh-session
samtools index volvox.bam
# generates volvox.bam.bai
```

For more info about `samtools`, see https://www.htslib.org/.

:::

If you have your JBrowse 2
[running as described](../quickstart_web#running-jbrowse-2) in the JBrowse web
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

```sh-session
jbrowse add-track /data/volvox.vcf.gz --load copy
```

:::note

If your VCF is not indexed, you can use the `bgzip` and `tabix` tools to
compress index it.

```sh-session
bgzip yourfile.vcf
tabix yourfile.vcf.gz
```

Alternatively, you can do the same thing with the `bcftools` tool.

```sh-session
bcftools view volvox.vcf --output-type z > volvox.vcf.gz
rm volvox.vcf
bcftools index --tbi volvox.vcf.gz
```

Note if you get errors about your VCF file not being sorted when using tabix,
you can use bcftools to sort your VCF.

```sh-session
bcftools sort file.vcf > file.sorted.vcf
bgzip file.sorted.vcf
tabix file.sorted.vcf.gz
```

For more info about `bgzip`, `tabix`, and `bcftools`, see
https://www.htslib.org/.

:::

If you have your JBrowse 2
[running as described](../quickstart_web#running-jbrowse-2) in the JBrowse web
quickstart, you can refresh the page and an add a linear genome view of the
volvox assembly. Then open track selector, and you will see the variant track.

<Figure caption="JBrowse 2 linear genome view with variant track" src="/img/volvox_variants.png"/>

### Adding a BigWig/BigBed track

Probably one of the most simple track types to load is a BigWig/BigBed file
since it does not have any external index file, it is just a single file

An example file is here https://jbrowse.org.s3.amazonaws.com/genomes/volvox/volvox-sorted.bam.coverage.bw

```sh-session
## Download bigwig or bigbed file
jbrowse add-track volvox-sorted.bam.coverage.bw --load copy
```

### Adding a GFF3 file with GFF3Tabix

To load a GFF3 file, we can sort and index it with tabix

Sorting a GFF3 can be done with [GenomeTools](http://genometools.org/) (to
install can use `sudo apt install genometools`)

```sh-session
gt gff3 -sortlines -tidy -retainids yourfile.gff > yourfile.sorted.gff
bgzip yourfile.sorted.gff
tabix yourfile.sorted.gff.gz
jbrowse add-track yourfile.sorted.gff.gz --load copy
```

## Indexing feature names for searching

The final step of loading you jbrowse instance may include adding a "search
index" so that you can search by genes or other features by their name or ID

To do this we can use the `jbrowse text-index` command

```sh-session
jbrowse text-index
```

This will index relevant track types e.g. any track with Gff3TabixAdapter (gene
names and IDs) or VcfTabixAdapter (e.g. variant IDs). The command will print
out a progress bar for each track that it is indexing.

This will also update your config.json so after it completes, you can type a
gene name into the "search box" in the linear genome view or other views and
quickly navigate to genes by gene name.

See the [text-index](../cli#jbrowse-text-index) command docs for more info. Also
see the [FAQ entries for text searching](../faq#text-searching)

## Conclusion

Now that you have JBrowse configured with an assembly and a couple of tracks,
you can start customizing it further. Check out the rest of the docs for more
information, especially the [JBrowse CLI](../cli) docs for more details on some of
the steps shown here.
