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
interface built into JBrowse 2. See that guide [here](/docs/config_gui).
:::

:::info
If you are an administrator configuring JBrowse on a webserver, you can add
the `--out` command followed by your target directory, e.g. `--out /var/www/html/jbrowse2` to write each JBrowse CLI configuration command to the
`config.json` in that target directory for your webserver to read from.

:::

## Pre-requisites

- Installed and created your JBrowse environment using the [quickstart CLI
  guide](/docs/quickstart_cli)
- [Samtools](http://www.htslib.org/) installed e.g. `sudo apt install samtools`
  or `brew install samtools`, used for creating FASTA index and BAM/CRAM
  processing
- [Genometools](http://genometools.org/) installed e.g. `sudo apt install genometools` or `brew install brewsci/bio/genometools` used for sorting GFF3
  for creating tabix GFF
- [tabix](http://www.htslib.org/doc/tabix.html) installed e.g. `sudo apt install tabix` and `brew install htslib`, used for creating tabix indexes for
  BED/VCF/GFF files

### Adding a genome assembly in FASTA format

The first step to creating a jbrowse config is to load a genome assembly. This
is normally in FASTA format, and we will start by creating a "FASTA index" with
`samtools`:

```bash
samtools faidx genome.fa
jbrowse add-assembly genome.fa --load copy --out /var/www/html/jbrowse/
```

This will output a configuration snippet to a file named
/var/www/html/jbrowse/config.json if it does not already exist, or append a new
assembly to that config file if it does exist. It will also copy genome.fa and
genome.fa.fai to the /var/www/html/jbrowse/ folder because we used --load copy.
If you wanted to symlink instead, can use --load symlink

JBrowse 2 also supports other assembly file formats, including bgzip-compressed
indexed FASTA, and 2bit files.

If you have your JBrowse 2 [running as
described](/docs/quickstart_cli/#running-jbrowse-2) in the JBrowse web
quickstart, you can refresh the page and an add a linear genome view. You will
now see your config in the Assembly dropdown.

<Figure caption="JBrowse 2 linear genome view setup with volvox in assembly dropdown" src="/img/lgv_assembly.png"/>

### Adding a BAM or CRAM track

For this example we will use a BAM file to add an alignments track. As with
assemblies, you can add a track using local files or remote locations of your
files.

```bash
samtools index file.bam
jbrowse add-track file.bam --load copy --out /var/www/html/jbrowse
samtools index file.cram
jbrowse add-track file.cram --load copy --out /var/www/html/jbrowse
```

This will add a track configuration entry to /var/www/html/jbrowse/config.json
and copy the files into the folder as well. If you use --load symlink, it can
symlink the files instead. To see more options adding the track, such as
specifying a name, run `jbrowse add-track --help`.

If you have JBrowse 2 [running as
described](/docs/quickstart_cli/#running-jbrowse-2) in the JBrowse web
quickstart, you can refresh the page and an add a linear genome view of the
volvox assembly. Then open track selector, and you will see the alignments
track.

<Figure caption="JBrowse 2 linear genome view with alignments track" src="/img/volvox_alignments.png"/>

### Adding a VCF track

Adding a variant track is similar to adding an alignments track. For this
example, we will use a VCF file for the track. JBrowse 2 expects VCFs to be
compressed with `bgzip` and `tabix` indexed.

To add the track, run

```bash
bgzip file.vcf
tabix file.vcf.gz
jbrowse add-track file.vcf.gz --load copy --out /var/www/html/jbrowse
```

:::note

Note if you get errors about your VCF file not being sorted when using tabix,
you can use bcftools to sort your VCF.

```bash
bcftools sort file.vcf > file.sorted.vcf
bgzip file.sorted.vcf
tabix file.sorted.vcf.gz
```

You can also bgzip and index with the `bcftools` tool.

```bash
bcftools view volvox.vcf --output-type z > volvox.vcf.gz
rm volvox.vcf
bcftools index --tbi volvox.vcf.gz
```

For more info about `bgzip`, `tabix`, and `bcftools`, see
https://www.htslib.org/.

:::

<Figure caption="JBrowse 2 linear genome view with variant track" src="/img/volvox_variants.png"/>

### Adding a BigWig/BigBed track

Probably one of the most simple track types to load is a BigWig/BigBed file
since it does not have any external index file, it is just a single file.

```bash
jbrowse add-track file.bw --load copy --out /var/www/html/jbrowse
```

### Adding a GFF3 file with GFF3Tabix

To load a GFF3 file, we can sort and index it with tabix, make sure you have
[GenomeTools](http://genometools.org/) (to install can use `sudo apt install genometools`).

```bash
gt gff3 -sortlines -tidy -retainids yourfile.gff > yourfile.sorted.gff
bgzip yourfile.sorted.gff
tabix yourfile.sorted.gff.gz
jbrowse add-track yourfile.sorted.gff.gz --load copy
```

As an alternative to `gt gff3 -sortlines`, use `awk` and GNU `sort`, as
follows:

```bash
awk '$1 ~ /^#/ {print $0;next} {print $0 | "sort -t\"\t\" -k1,1 -k4,4n"}' file.gff > file.sorted.gff
bgzip file.sorted.gff
tabix file.sorted.gff.gz
```

The `awk` command is inspired by the method in the [tabix
documentation](http://www.htslib.org/doc/tabix.html), but avoids subshells and
properly sets the tab delimiter for GNU sort in case there are spaces in the
GFF.

### Adding a synteny track from a PAF file

Loading synteny data makes use of all the previous functions we've used so far
in this guide.

Here, we make use of the
[grape](https://s3.amazonaws.com/jbrowse.org/genomes/grape/Vvinifera_145_Genoscope.12X.fa.gz)
and
[peach](https://s3.amazonaws.com/jbrowse.org/genomes/peach/Ppersica_298_v2.0.fa.gz)
genome assemblies, but replace with your own data if applicable.

Use [minimap2](https://github.com/lh3/minimap2) to create a PAF file from FASTA
files:

```bash
## Use minimap2 to create a PAF from your assemblies
minimap2 grape.fa peach.fa > peach_vs_grape.paf

## add each assembly to jbrowse config
## the -n flag names the assemblies explicitly
jbrowse add-assembly grape.fa --load copy -n grape --out /var/www/html/jbrowse
jbrowse add-assembly peach.fa --load copy -n peach --out /var/www/html/jbrowse
```

Next, we'll load the synteny "track" from the PAF file.

**Order matters here for the `--assemblyNames` parameter:**

If minimap2 is run as `minimap2 grape.fa peach.fa`, then you need to load as
`--assemblyNames peach,grape`.

The order is reversed between the `minimap2` and `jbrowse` tools.

```bash
jbrowse add-track peach_vs_grape.paf --assemblyNames peach,grape --load copy --out /var/www/html/jbrowse
```

## Indexing feature names for searching

The final step of loading your JBrowse instance may include adding a "search
index" so that you can search by genes or other features by their name or ID.

To do this we can use the `jbrowse text-index` command:

```bash
jbrowse text-index --out /var/www/html/jbrowse
```

This will index relevant track types e.g. any track with Gff3TabixAdapter (gene
names and IDs) or VcfTabixAdapter (e.g. variant IDs). The command will print
out a progress bar for each track that it is indexing.

This will also update your `config.json` so that after it completes, you can
type a gene name into the "search box" in the linear genome view or other views
and quickly navigate to genes by gene name.

See the [text-index](/docs/cli#jbrowse-text-index) command docs for more info.
Also see the [FAQ entries for text searching](../../faq#text-searching)

## Conclusion

Now that you have JBrowse configured with an assembly and a couple of tracks,
you can start customizing it further. Check out the rest of the docs for more
information, especially the [JBrowse CLI](/docs/cli) docs for more details on
some of the steps shown here.

## Miscellaneous tips

You can use `--subDir` to organize your data directory:

```bash
mkdir my_bams
## Copies .bam and .bai files to my_bams folder
jbrowse add-track myfile.bam --subDir my_bams --load copy --out /var/www/html/jbrowse
```

You can upgrade your JBrowse release to the latest version with:

```bash
jbrowse upgrade
```

The above command downloads the latest jbrowse-web from github.

To upgrade the CLI tools, you can re-run the install command

```bash
npm install -g @jbrowse/CLI
```

You can use filenames that are different than config.json, and put them in
subfolders too

```bash
## The following adds an assembly to the alt_config.json file specified
## To run JBrowse using this alt_config.json, navigate to http://localhost/jbrowse2/?config=subfolder/alt_config.json
jbrowse add-assembly mygenome.fa --out /path/to/my/jbrowse2/subfolder/alt_config.json --load copy
```
