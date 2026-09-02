---
title: JBrowse web quick start
description:
  Set up a self-hosted JBrowse Web instance and add an assembly and tracks
data: download
---

Install the `@jbrowse/cli`, download JBrowse web, add an assembly and tracks,
and serve the result as a folder of static files.

Other ways to run JBrowse:

- [JBrowse desktop](/docs/quickstart_desktop) - open local files without a web
  server
- [](/docs/embedded_components) - embed a view in your own web app

The folder this guide builds also opens directly in JBrowse Desktop. See
[](/docs/tutorials/cli_desktop).

## TLDR

Needs Node.js 18+, samtools and tabix. Swap `genome.fa`, `file.bam` and
`file.vcf` for your own files.

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

Each `add-*` command writes an entry to `config.json` and copies the data file
next to it. The result is a static site: no database, no server-side code.

## Reproduce it end to end

[`build_quickstart_web.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_quickstart_web.sh)
runs the same flow against the volvox sample data JBrowse ships, with every
input pinned:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_quickstart_web.sh
bash build_quickstart_web.sh               # builds ./quickstart_web_build/jbrowse2
npx serve -S quickstart_web_build/jbrowse2 # then open the printed URL
```

It needs `samtools`, `bgzip`, `tabix`, `curl` and node, and produces a config
with an alignments track, a coverage track, a variant track and a searchable
gene track.

## Prerequisites

- Node.js 18+ - use [NodeSource](https://github.com/nodesource) or
  [NVM](https://github.com/nvm-sh/nvm), not `apt` (tends to install old
  versions)
- [samtools](http://www.htslib.org/): `sudo apt install samtools` or
  `brew install samtools`
- [tabix](http://www.htslib.org/doc/tabix.html): `sudo apt install tabix` or
  `brew install htslib`
- [bcftools](https://samtools.github.io/bcftools/) (optional, for VCF
  sorting/indexing): `sudo apt install bcftools` or `brew install bcftools`

## Installing the JBrowse CLI

```bash
npm install -g @jbrowse/cli
jbrowse --version
```

To avoid a global install, replace `jbrowse` with `npx @jbrowse/cli` in any
command below.

## Download JBrowse 2

```bash
jbrowse create jbrowse2
cd jbrowse2
```

This downloads and unzips jbrowse-web into `jbrowse2/`. The rest of this guide
runs from inside that folder. The zip is also available from
https://github.com/GMOD/jbrowse-components/releases.

## Running JBrowse 2

JBrowse 2 needs a web server; opening `index.html` directly does not work.

```bash
npx serve -S .
```

`-S` resolves symlinks, which matters once you add tracks with `--load symlink`.
Open `http://localhost:3000` and click a sample config to confirm the install.

For production, copy the folder into your web server's static directory (e.g.
`/var/www/html/jbrowse2/`) and visit `http://yourserver/jbrowse2`.

<Figure caption="The JBrowse 2 fresh-install screen, shown when no config.json is present yet. An 'It worked!' banner plus a list of sample configs and demo sessions to try." src="/img/config_not_found.png"/>

<Figure caption="JBrowse 2 screen with a sample configuration" src="/img/sample_config.png"/>

## Adding tracks

Every command below:

- runs from inside `jbrowse2/`, so `--out` is omitted. Pass
  `--out /var/www/html/jbrowse2` (a directory holding `config.json`, or a config
  file path) to write elsewhere
- uses `--load copy`, which puts the data file next to `config.json`. Use
  `--load symlink` to symlink instead

For data already hosted elsewhere, pass the URL instead of a path and the track
records that URL:

```bash
jbrowse add-track https://data.myuniversity.edu/rnaseq/sample1.bam
```

Most formats need an index file (`.fai`, `.bai`, `.tbi`) beside the data file.
JBrowse never downloads a whole BAM or VCF; the index tells it which byte range
holds the region on screen. `add-track` finds the index by its conventional name
and records both.

`jbrowse add-track --help` lists all options. Supported formats and the adapter
each maps to: [](/docs/config_guides/file_types).

### Genome assembly (FASTA)

```bash
samtools faidx genome.fa
jbrowse add-assembly genome.fa --load copy
```

`--name` (`-n`) sets the assembly name, which defaults to the filename.
Bgzip-compressed indexed FASTA and 2bit also work.

<Figure caption="JBrowse 2 linear genome view setup with volvox in assembly dropdown" src="/img/lgv_assembly.png"/>

### BAM / CRAM

```bash
samtools index file.bam   # or file.cram
jbrowse add-track file.bam --load copy
```

See the [alignments track guide](/docs/user_guides/alignments_track).

<Figure caption="JBrowse 2 linear genome view with alignments track" src="/img/volvox_alignments.png"/>

### VCF

VCFs must be bgzip-compressed and tabix-indexed. `bgzip` is gzip written in
blocks, so tabix can jump to a region without decompressing the whole file; a
plain `gzip` file cannot be indexed:

```bash
bgzip file.vcf
tabix file.vcf.gz
jbrowse add-track file.vcf.gz --load copy
```

If tabix reports the VCF is unsorted:

```bash
bcftools sort file.vcf > file.sorted.vcf
bgzip file.sorted.vcf
tabix file.sorted.vcf.gz
```

<Figure caption="JBrowse 2 linear genome view with variant track" src="/img/volvox_variants.png"/>

For multi-sample VCFs, see the
[multi-sample variant guide](/docs/user_guides/multivariant_track).

### BigWig / BigBed

No external index needed:

```bash
jbrowse add-track file.bw --load copy
```

See the [quantitative track guide](/docs/user_guides/quantitative_track).

### GFF3

GFF3 is often unsorted, and tabix needs features ordered by reference name and
start, so sort before compressing:

```bash
jbrowse sort-gff yourfile.gff | bgzip > yourfile.sorted.gff.gz
tabix yourfile.sorted.gff.gz
jbrowse add-track yourfile.sorted.gff.gz --load copy
```

See the [gene track guide](/docs/user_guides/gene_track).

### GTF

`sort-gff` sorts GTF too:

```bash
jbrowse sort-gff yourfile.gtf | bgzip > yourfile.sorted.gtf.gz
tabix yourfile.sorted.gtf.gz
jbrowse add-track yourfile.sorted.gtf.gz --load copy
```

A plain `.gtf` loads without indexing, but is read whole, so sort and index
anything genome-scale.

GTF has no `Name` or `ID` attribute. Transcripts group into a gene by `gene_id`,
and [`aggregateField`](/docs/config/gtftabixadapter/#slot-aggregatefield) names
the attribute that labels the gene. `jbrowse text-index` matches the GTF
spellings (`gene_name`, `transcript_name`, `gene_id`, `transcript_id`) without
`--attributes`.

See the [gene track guide](/docs/user_guides/gene_track).

### Synteny (PAF)

Align two assemblies with [minimap2](https://github.com/lh3/minimap2) and load
the result as a synteny track:

```bash
minimap2 -cx asm20 grape.fa peach.fa > peach_vs_grape.paf

jbrowse add-assembly grape.fa --load copy -n grape
jbrowse add-assembly peach.fa --load copy -n peach
jbrowse add-track peach_vs_grape.paf --assemblyNames peach,grape --load copy
```

`--assemblyNames` takes `query,target`, the **reverse** of minimap2's
`target query` argument order. Setting `queryAssembly` and `targetAssembly` on
the adapter in `config.json` avoids the question (see the
[synteny track config guide](/docs/config_guides/synteny_track)).

Pick the `-cx` preset by divergence:

- `asm5` - closely related, up to ~5% divergence
- `asm10` - moderately diverged
- `asm20` - cross-species, up to ~20% divergence

Other synteny formats load the same way
(`jbrowse add-track alignment.delta --assemblyNames query,target ...`):

- `.delta` (MUMmer/NUCmer)
- `.chain` (UCSC)
- `.anchors` and `.anchors.simple` (MCScan)
- `.out` (MashMap)

For large alignments, convert to indexed PIF first with `jbrowse make-pif`.

See also the [linear synteny view](/docs/user_guides/linear_synteny_view),
[dotplot view](/docs/user_guides/dotplot_view),
[synteny visualization tutorial](/docs/tutorials/synteny_visualization),
[all-vs-all synteny](/docs/tutorials/allvsall_synteny), and
[multi-way synteny](/docs/tutorials/multiway_synteny_grape_peach_cacao).

## Hosting your own data

The folder you built is a **static site**. Any web server, S3 or GCS bucket, or
institutional file host can serve it; the browser fetches the slices of each
data file it needs. See [](/docs/config_guides/deploying), including generating
`config.json` from a samplesheet.

Two host properties decide whether tracks load, and both fail quietly:

- **Byte-range requests.** The host must answer a `Range` header with
  `206 Partial Content`. A host that returns the whole file with `200` is the
  usual reason a track that works locally shows nothing in production. See
  [](/docs/config_guides/serving_data#indexed-binary-files-do-not-work-on-my-server).
- **No re-compression.** Serving a `.bam` or `.bgz` through gzip corrupts the
  byte offsets the index depends on. See
  [](/docs/config_guides/serving_data#configure-gzip-for-text-never-for-bgzf).

Object storage satisfies both by default. Data on a different domain than the
app also needs a
[CORS policy](/docs/config_guides/serving_data#cors-errors-on-remote-files). For
data that cannot be public, see [](/docs/config_guides/authentication).

## Indexing feature names for searching

```bash
jbrowse text-index
```

This builds a name index, separate from the tabix index, over the feature names
and IDs in GFF3, GTF and VCF tracks. Once built, a gene name typed into the
location search box jumps to that feature. Other track types are skipped
silently; name one with `--tracks` and it says why. See
[](/docs/config_guides/text_searching) for which attributes are indexed, the
[text-index docs](/docs/cli#jbrowse-text-index) for flags, and
[the trix index format](/docs/config_guides/text_searching#the-trix-index-format)
for how the index files work.

## Tutorials

- [](/docs/tutorials/cli_desktop)
- [Synteny visualization](/docs/tutorials/synteny_visualization)
- [Cancer structural variants](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/tutorials/population_genomics)
- [Long-read methylation](/docs/tutorials/methylation)
- [RNA-seq](/docs/tutorials/rnaseq)
- [All tutorials](/docs/tutorials)

## See also

- [](/docs/user_guide)
- [](/docs/config_guides/file_types)
- [](/docs/config_guide)
- [CLI reference](/docs/cli)
- [](/docs/faq)
- [CORS errors](/docs/config_guides/serving_data#cors-errors-on-remote-files)

## Tips

**Organize data into subdirectories:**

```bash
jbrowse add-track myfile.bam --subDir my_bams --load copy --out /var/www/html/jbrowse2
```

**Upgrade JBrowse to the latest release:**

```bash
jbrowse upgrade /var/www/html/jbrowse2
```

**Upgrade the CLI:**

```bash
npm install -g @jbrowse/cli
```

**Use a custom config filename:**

```bash
jbrowse add-assembly mygenome.fa --out /path/to/jbrowse2/alt_config.json --load copy
# Access at: http://localhost/jbrowse2/?config=alt_config.json
```
