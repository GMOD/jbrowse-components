---
id: quickstart_web
title: JBrowse web setup using the CLI
toplevel: true
---

## TLDR

- Install Node.js 18+, samtools, tabix
- `npm install -g @jbrowse/cli`
- `jbrowse create jbrowse2 && cd jbrowse2 && npx serve -S .`
- `samtools faidx genome.fa && jbrowse add-assembly genome.fa --load copy`
- `samtools index file.bam && jbrowse add-track file.bam --load copy`
- `bgzip file.vcf && tabix file.vcf.gz && jbrowse add-track file.vcf.gz --load copy`
- `jbrowse text-index`

## Prerequisites

- Node.js 18+ — use [NodeSource](https://github.com/nodesource) or
  [NVM](https://github.com/nvm-sh/nvm), not `apt` (tends to install old
  versions)
- [samtools](http://www.htslib.org/): `sudo apt install samtools` or
  `brew install samtools`
- [tabix](http://www.htslib.org/doc/tabix.html): `sudo apt install tabix` or
  `brew install htslib`

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

This downloads and unzips jbrowse-web into a folder named `jbrowse2`.
Alternatively, download the zip manually from
https://github.com/GMOD/jbrowse-components/releases.

## Running JBrowse 2

JBrowse 2 requires a web server — opening `index.html` directly in your browser
won't work.

For production, place the folder in your web server's static directory (e.g.
`/var/www/html/jbrowse2/`) and visit `http://yourserver/jbrowse2`.

To verify locally:

```bash
cd jbrowse2/
npx serve -S .
```

Navigate to `http://localhost:3000`. Click the sample config to confirm things
are working.

<Figure caption="JBrowse 2 screen showing no configuration found" src="/img/config_not_found.png"/>

<Figure caption="JBrowse 2 screen with a sample configuration" src="/img/sample_config.png"/>

## Adding tracks

### Genome assembly (FASTA)

```bash
samtools faidx genome.fa
jbrowse add-assembly genome.fa --load copy --out /var/www/html/jbrowse/
```

This writes an assembly entry to `config.json` and copies `genome.fa` and
`genome.fa.fai` into the output directory. Use `--load symlink` to symlink
instead of copying.

JBrowse 2 also supports bgzip-compressed indexed FASTA and 2bit files.

<Figure caption="JBrowse 2 linear genome view setup with volvox in assembly dropdown" src="/img/lgv_assembly.png"/>

### BAM / CRAM

```bash
samtools index file.bam
jbrowse add-track file.bam --load copy --out /var/www/html/jbrowse

samtools index file.cram
jbrowse add-track file.cram --load copy --out /var/www/html/jbrowse
```

Run `jbrowse add-track --help` for more options.

<Figure caption="JBrowse 2 linear genome view with alignments track" src="/img/volvox_alignments.png"/>

### VCF

VCFs must be bgzip-compressed and tabix-indexed:

```bash
bgzip file.vcf
tabix file.vcf.gz
jbrowse add-track file.vcf.gz --load copy --out /var/www/html/jbrowse
```

:::note If tabix reports the VCF is unsorted, sort it first:

```bash
bcftools sort file.vcf > file.sorted.vcf
bgzip file.sorted.vcf
tabix file.sorted.vcf.gz
```

You can also use `bcftools` to bgzip and index in one step:

```bash
bcftools view file.vcf --output-type z > file.vcf.gz
bcftools index --tbi file.vcf.gz
```

See https://www.htslib.org/ for more on `bgzip`, `tabix`, and `bcftools`. :::

<Figure caption="JBrowse 2 linear genome view with variant track" src="/img/volvox_variants.png"/>

### BigWig / BigBed

No external index needed:

```bash
jbrowse add-track file.bw --load copy --out /var/www/html/jbrowse
```

### GFF3

```bash
jbrowse sort-gff yourfile.gff | bgzip > yourfile.sorted.gff.gz
tabix yourfile.sorted.gff.gz
jbrowse add-track yourfile.sorted.gff.gz --load copy
```

### Synteny (PAF)

Use [minimap2](https://github.com/lh3/minimap2) to align two assemblies and load
the result as a synteny track:

```bash
minimap2 -cx asm20 grape.fa peach.fa > peach_vs_grape.paf

jbrowse add-assembly grape.fa --load copy -n grape --out /var/www/html/jbrowse
jbrowse add-assembly peach.fa --load copy -n peach --out /var/www/html/jbrowse
```

Note: `--assemblyNames` order is `query,target` — the **reverse** of the
`minimap2` argument order (`minimap2 target query`). For
`minimap2 grape.fa peach.fa`, peach is the query, so load with
`--assemblyNames peach,grape`:

```bash
jbrowse add-track peach_vs_grape.paf --assemblyNames peach,grape --load copy --out /var/www/html/jbrowse
```

To sidestep the ordering question, you can instead set the named `queryAssembly`
and `targetAssembly` fields on the adapter in `config.json` (see the
[synteny track config guide](/docs/config_guides/synteny_track)).

The `-cx asm20` preset suits divergent / cross-species comparisons (up to ~20%
divergence). Use `asm5` for closely related assemblies (up to ~5%) or `asm10`
for moderately diverged ones. See the
[minimap2 docs](https://github.com/lh3/minimap2) for details.

## Indexing feature names for searching

Optionally, build a text index so users can search by gene name or feature ID:

```bash
jbrowse text-index --out /var/www/html/jbrowse
```

This indexes GFF3Tabix and VCFTabix tracks. Once complete, names can be typed
directly into the location search box. See the
[text-index docs](/docs/cli#jbrowse-text-index) and
[FAQ](/docs/faq#text-searching) for more.

## Next steps

- [User guide](/docs/user_guide) — track types, views, and UI features
- [Config guide](/docs/config_guide) — advanced track and assembly configuration
- [CLI reference](/docs/cli) — full reference for all CLI commands
- [FAQ](/docs/faq) — common questions including text searching and CORS

## Tips

**Organize data into subdirectories:**

```bash
jbrowse add-track myfile.bam --subDir my_bams --load copy --out /var/www/html/jbrowse
```

**Upgrade JBrowse to the latest release:**

```bash
jbrowse upgrade
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
