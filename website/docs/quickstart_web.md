---
title: JBrowse web quick start
description:
  Set up a self-hosted JBrowse Web instance and add an assembly and tracks
data: download
---

This guide sets up a self-hosted JBrowse Web instance with the `@jbrowse/cli`
command-line tool: download JBrowse, add an assembly and tracks, and serve the
result as a folder of files on a web server. The same folder opens in
[JBrowse Desktop](/docs/quickstart_desktop) with no server
([](/docs/tutorials/cli_desktop)), and [](/docs/embedded_components) puts a view
in your own web app.

## TLDR

Adding an assembly or a track writes an entry to `config.json` and copies the
data file next to it, so the folder is a self-contained static site: no
database, no server-side code. The commands need Node.js 18+, samtools and
tabix, and use placeholder filenames you swap for your own.

```bash
npm install -g @jbrowse/cli
jbrowse create jbrowse2 && cd jbrowse2

samtools faidx genome.fa
jbrowse add-assembly genome.fa --load copy

samtools index file.bam
jbrowse add-track file.bam --load copy

bgzip file.vcf
tabix file.vcf.gz
jbrowse add-track file.vcf.gz --load copy

jbrowse text-index
npx serve -S .
```

## Reproduce it end to end

[`build_quickstart_web.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_quickstart_web.sh)
runs the same flow against the volvox sample data JBrowse ships, with a FASTA, a
BAM, a BigWig, a VCF and a GFF3, every input pinned:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_quickstart_web.sh
bash build_quickstart_web.sh               # builds ./quickstart_web_build/jbrowse2
npx serve -S quickstart_web_build/jbrowse2 # then open the printed URL
```

## Prerequisites

- Node.js 18+, from [NodeSource](https://github.com/nodesource) or
  [NVM](https://github.com/nvm-sh/nvm) rather than `apt`, which installs old
  versions
- [samtools](http://www.htslib.org/): `sudo apt install samtools` or
  `brew install samtools`
- [tabix](http://www.htslib.org/doc/tabix.html): `sudo apt install tabix` or
  `brew install htslib`
- [bcftools](https://samtools.github.io/bcftools/), optional, for sorting a VCF

## Install and run

```bash
npm install -g @jbrowse/cli   # or npx @jbrowse/cli in place of jbrowse below
jbrowse create jbrowse2       # downloads and unzips jbrowse-web
cd jbrowse2
npx serve -S .                # http://localhost:3000
```

- JBrowse needs a web server; opening `index.html` directly does not work. The
  `-S` flag makes `serve` follow symlinks, for tracks added with
  `--load symlink`.
- Click the sample config to confirm the install works.
- For production, put the folder in your web server's static directory, such as
  `/var/www/html/jbrowse2/`.

<Figure caption="The JBrowse 2 fresh-install screen, shown when no config.json is present yet. An 'It worked!' banner plus a list of sample configs and demo sessions to try." src="/img/config_not_found.png"/>

<Figure caption="JBrowse 2 screen with a sample configuration" src="/img/sample_config.png"/>

## Adding tracks

- The examples run from inside `jbrowse2/`. To write elsewhere, add
  `--out /var/www/html/jbrowse2`, a directory containing `config.json` or a path
  to a config file.
- `--load copy` puts the data file next to `config.json` so one server serves
  both; `--load symlink` links it instead. For data your lab already hosts, pass
  the URL in place of a path and the track records that URL:
  `jbrowse add-track https://data.myuniversity.edu/rnaseq/sample1.bam`.
- The track type and adapter come from the file's extension.
  [](/docs/config_guides/file_types) lists every format and the adapter it maps
  to, and `jbrowse add-track --help` the options.

### Genome assembly (FASTA)

```bash
samtools faidx genome.fa
jbrowse add-assembly genome.fa --load copy
```

`--name` (`-n`) sets the assembly name, which defaults to the filename.
bgzip-compressed indexed FASTA and 2bit work too.

<Figure caption="JBrowse 2 linear genome view setup with volvox in assembly dropdown" src="/img/lgv_assembly.png"/>

### BAM / CRAM

```bash
samtools index file.bam   # or file.cram
jbrowse add-track file.bam --load copy
```

<Figure caption="JBrowse 2 linear genome view with alignments track" src="/img/volvox_alignments.png"/>

### VCF

A VCF must be bgzip-compressed and tabix-indexed. If tabix reports it unsorted,
`bcftools sort file.vcf > file.sorted.vcf` first.

```bash
bgzip file.vcf
tabix file.vcf.gz
jbrowse add-track file.vcf.gz --load copy
```

<Figure caption="JBrowse 2 linear genome view with variant track" src="/img/volvox_variants.png"/>

### BigWig / BigBed

No index needed: `jbrowse add-track file.bw --load copy`.

### GFF3 and GTF

`jbrowse sort-gff` sorts either format, since GTF shares GFF3's refName and
start columns:

```bash
jbrowse sort-gff yourfile.gff | bgzip > yourfile.sorted.gff.gz
tabix yourfile.sorted.gff.gz
jbrowse add-track yourfile.sorted.gff.gz --load copy
```

A plain `.gff3` or `.gtf` loads without any of this, but the whole file is read
at once, so sort and index anything genome-scale. How a GTF's per-feature lines
become gene models is on [](/docs/config_guides/file_types#gtf-gene-models).

### Synteny

An alignment between two assemblies (PAF, delta, chain, MCScan anchors, MashMap)
loads as a synteny track naming both, `--assemblyNames query,target`.
[](/docs/config_guides/synteny_track) covers the formats and minimap2 presets,
and [](/docs/tutorials/synteny_visualization) runs one end to end.

## Hosting your own data

The folder is a static site: plain files a web server hands out unchanged, and
the visitor's browser fetches the pieces of each data file it needs. Any web
server, S3 or GCS bucket, or institutional file host can serve it
([](/docs/config_guides/deploying)). Two properties decide whether a host works,
and both fail quietly:

- **Byte-range requests.** JBrowse reads slices of a BAM, CRAM, BigWig or tabix
  file, so the host has to answer a `Range` header with `206 Partial Content`. A
  host returning the whole file with `200` is the usual reason a track that
  works locally shows nothing in production
  ([](/docs/config_guides/serving_data#indexed-binary-files-do-not-work-on-my-server)).
- **No re-compression of compressed files.** Serving a `.bam` or `.bgz` through
  gzip corrupts the byte offsets the index depends on
  ([](/docs/config_guides/serving_data#configure-gzip-for-text-never-for-bgzf)).

Object storage satisfies both, which is why S3 and GCS are common homes for the
data even when the app is served elsewhere. Data on a different domain than the
app needs a
[CORS policy](/docs/config_guides/serving_data#cors-errors-on-remote-files), and
data that cannot be public needs
[authentication](/docs/config_guides/authentication).

## Indexing feature names for searching

```bash
jbrowse text-index
```

Indexes the GFF3, GTF and VCF tracks in the config so names can be typed into
the location box. Every other track is skipped silently; name one with
`--tracks` and it says why. [](/docs/config_guides/text_searching) covers which
attributes are indexed and how to narrow the set.

## Tips

- **Subdirectories:**
  `jbrowse add-track myfile.bam --subDir my_bams --load copy --out /var/www/html/jbrowse2`
- **Upgrade JBrowse:** `jbrowse upgrade /var/www/html/jbrowse2`
- **Upgrade the CLI:** `npm install -g @jbrowse/cli`
- **A second config in the same folder:**
  `jbrowse add-assembly mygenome.fa --out /path/to/jbrowse2/alt_config.json --load copy`,
  opened at `?config=alt_config.json`

## See also

- [](/docs/user_guide)
- [](/docs/config_guide)
- [CLI reference](/docs/cli)
- [](/docs/faq)
