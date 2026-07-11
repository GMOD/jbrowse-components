---
title: JBrowse web quick start
---

This guide sets up a self-hosted JBrowse web instance: you'll use the
`@jbrowse/cli` command-line tool to download JBrowse, add an assembly and
tracks, and serve the result as a static site. It's the right path if you want a
genome browser you host and share via a URL.

Other ways to run JBrowse:

- [JBrowse desktop](/docs/quickstart_desktop) — open local files without a web
  server
- [Embedded components](/docs/embedded_components) — embed a view in your own
  web app

## TLDR

- Install Node.js 18+, samtools, tabix
- `npm install -g @jbrowse/cli`
- `jbrowse create jbrowse2 && cd jbrowse2`
- `samtools faidx genome.fa && jbrowse add-assembly genome.fa --load copy`
- `samtools index file.bam && jbrowse add-track file.bam --load copy`
- `bgzip file.vcf && tabix file.vcf.gz && jbrowse add-track file.vcf.gz --load copy`
- `jbrowse text-index`
- `npx serve -S .`

## Prerequisites

- Node.js 18+ — use [NodeSource](https://github.com/nodesource) or
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

:::note

To avoid a global install, replace `jbrowse` with `npx @jbrowse/cli` in any
command below.

:::

## Download JBrowse 2

```bash
jbrowse create jbrowse2
```

This downloads and unzips jbrowse-web into a folder named `jbrowse2`. Run
`cd jbrowse2` before any further commands. Alternatively, download the zip
manually from https://github.com/GMOD/jbrowse-components/releases.

## Running JBrowse 2

JBrowse 2 requires a web server — opening `index.html` directly in your browser
won't work.

To verify locally:

```bash
cd jbrowse2/
npx serve -S .
```

The `-S` flag tells `serve` to resolve symlinks rather than return a 404 —
relevant if you later add tracks with `--load symlink`.

Navigate to `http://localhost:3000`. Click the sample config to confirm the
install works.

For production, place the folder in your web server's static directory (e.g.
`/var/www/html/jbrowse2/`) and visit `http://yourserver/jbrowse2`.

<Figure caption="The JBrowse 2 fresh-install screen, shown when no config.json is present yet — an 'It worked!' banner plus a list of sample configs and demo sessions to try" src="/img/config_not_found.png"/>

<Figure caption="JBrowse 2 screen with a sample configuration" src="/img/sample_config.png"/>

## Adding tracks

The examples below run from inside `jbrowse2/`, so they omit `--out` (which
defaults to the current directory). To write elsewhere, add
`--out /var/www/html/jbrowse2` — either a directory containing `config.json` or
a path to a specific config file. Run `jbrowse add-track --help` for all
options.

For the full list of supported formats and the adapter each maps to, see
[Supported file types](/docs/config_guides/file_types).

### Genome assembly (FASTA)

```bash
samtools faidx genome.fa
jbrowse add-assembly genome.fa --load copy
```

This writes an assembly entry to `config.json` and copies `genome.fa` and
`genome.fa.fai` into the output directory. Use `--load symlink` to symlink
instead of copying.

Use `--name` (shorthand `-n`) to set a human-readable assembly name (defaults to
the filename).

JBrowse 2 also supports bgzip-compressed indexed FASTA and 2bit files.

<Figure caption="JBrowse 2 linear genome view setup with volvox in assembly dropdown" src="/img/lgv_assembly.png"/>

### BAM / CRAM

```bash
samtools index file.bam   # or file.cram
jbrowse add-track file.bam --load copy
```

See the [alignments track guide](/docs/user_guides/alignments_track).

<Figure caption="JBrowse 2 linear genome view with alignments track" src="/img/volvox_alignments.png"/>

### VCF

VCFs must be bgzip-compressed and tabix-indexed:

```bash
bgzip file.vcf
tabix file.vcf.gz
jbrowse add-track file.vcf.gz --load copy
```

:::note

If tabix reports the VCF is unsorted, sort it first:

```bash
bcftools sort file.vcf > file.sorted.vcf
bgzip file.sorted.vcf
tabix file.sorted.vcf.gz
```

See https://www.htslib.org/ for more on `bgzip`, `tabix`, and `bcftools`.

:::

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

```bash
jbrowse sort-gff yourfile.gff | bgzip > yourfile.sorted.gff.gz
tabix yourfile.sorted.gff.gz
jbrowse add-track yourfile.sorted.gff.gz --load copy
```

See the [gene track guide](/docs/user_guides/gene_track).

### Synteny (PAF)

Use [minimap2](https://github.com/lh3/minimap2) to align two assemblies and load
the result as a synteny track:

```bash
minimap2 -cx asm20 grape.fa peach.fa > peach_vs_grape.paf

jbrowse add-assembly grape.fa --load copy -n grape
jbrowse add-assembly peach.fa --load copy -n peach
```

Note: `--assemblyNames` takes `query,target` — the **reverse** of minimap2's
`target query` order. Above, `minimap2 grape.fa peach.fa` makes peach the query,
so load with `--assemblyNames peach,grape`:

```bash
jbrowse add-track peach_vs_grape.paf --assemblyNames peach,grape --load copy
```

To sidestep the ordering question, you can instead set the named `queryAssembly`
and `targetAssembly` fields on the adapter in `config.json` (see the
[synteny track config guide](/docs/config_guides/synteny_track)).

The `-cx asm20` preset suits divergent / cross-species comparisons (up to ~20%
divergence). Use `asm5` for closely related assemblies (up to ~5%) or `asm10`
for moderately diverged ones. See the
[minimap2 docs](https://github.com/lh3/minimap2) for details.

Other supported synteny formats: `.delta` (MUMmer/NUCmer), `.chain` (UCSC),
`.anchors` and `.anchors.simple` (MCScan), and `.out` (MashMap). Add them the
same way — `jbrowse add-track alignment.delta --assemblyNames query,target ...`.
For large alignments, convert to indexed PIF first with `jbrowse make-pif`.

See also the [linear synteny view](/docs/user_guides/linear_synteny_view),
[dotplot view](/docs/user_guides/dotplot_view),
[synteny visualization tutorial](/docs/tutorials/synteny_visualization),
[all-vs-all synteny](/docs/tutorials/allvsall_synteny), and
[multi-way synteny](/docs/tutorials/multiway_synteny).

## Indexing feature names for searching

Optionally, build a text index so users can search by gene name or feature ID:

```bash
jbrowse text-index
```

This indexes GFF3 and VCF tracks (tabix-indexed or plain). Once complete, names
can be typed directly into the location search box. See the
[text-index docs](/docs/cli#jbrowse-text-index) and
[FAQ](/docs/faq#text-searching) for more.

## Tutorials

- [Synteny visualization](/docs/tutorials/synteny_visualization)
- [Cancer structural variants](/docs/tutorials/sv_visualization_cgiab)
- [Population genomics](/docs/tutorials/population_genomics)
- [DNA methylation](/docs/tutorials/methylation)
- [RNA-seq](/docs/tutorials/rnaseq)
- [All tutorials](/docs/tutorials)

## See also

- [User guide](/docs/user_guide) — track types, views, and UI features
- [Supported file types](/docs/config_guides/file_types) — every format and its
  adapter
- [Config guide](/docs/config_guide) — advanced track and assembly configuration
- [CLI reference](/docs/cli) — full reference for all CLI commands
- [FAQ](/docs/faq) — common questions including text searching
- [CORS errors](/docs/faq#why-do-i-get-a-cors-error-when-loading-remote-files) —
  if tracks fail to load from remote URLs

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
