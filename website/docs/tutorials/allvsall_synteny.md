---
title: Synteny all-vs-all
description: Stack strains in a linear synteny view from one all-vs-all PAF
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

A linear synteny view can stack more than two genomes: N genome rows with a
synteny "ribbon" band between each adjacent pair. When the genomes are closely
related (strains or accessions of one species), the most convenient source is a
single all-vs-all PAF, with every genome aligned to every other. This tutorial
builds a four-strain _E. coli_ pangenome view from one such file.

Every figure below links to the live session that produced it. Open the finished
stacked view from its caption to explore it yourself.

For cross-species comparisons built from gene-level ortholog tables instead, see
[Synteny from ortholog tables](/docs/tutorials/multiway_synteny).

## Producing an all-vs-all PAF

An all-vs-all PAF is what the [PGGB](https://github.com/pangenome/pggb) mapping
step produces, but you can also make one yourself: concatenate
[PanSN](https://github.com/pangenome/PanSN-spec)-named genomes and self-align
them with [minimap2](https://github.com/lh3/minimap2). PanSN (Pangenome Sequence
Naming) names every sequence `sample#haplotype#contig`, e.g. `K12#1#chr`. It's
how pangenome tools tell which genome a sequence belongs to, and later on the
adapter uses that `sample` prefix to classify each PAF record.

First obtain each strain's genome FASTA. This example uses four complete NCBI
RefSeq assemblies, fetched with the NCBI
[`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
CLI (a `strain accession` table keeps the short names we use throughout):

```bash
while read -r strain acc; do
  datasets download genome accession "$acc" --include genome,gff3 --filename "$strain.zip"
  unzip -o "$strain.zip" -d "$strain"
  # keep only the chromosome (the first record; the rest are plasmids) and give
  # it one short name, so every strain row reads `chr` rather than an accession
  awk '/^>/{n++; if (n == 1) print ">chr"; next} n == 1' \
    "$strain"/ncbi_dataset/data/*/*.fna > "$strain.fa"
done <<'EOF'
K12     GCF_000005845.2
Sakai   GCF_000008865.2
CFT073  GCF_000007445.1
NCTC86  GCF_003697165.2
EOF
```

(`GCF_000005845.2` is K-12 MG1655, `GCF_000008865.2` is O157:H7 Sakai,
`GCF_000007445.1` is the uropathogenic CFT073, and `GCF_003697165.2` is the _E.
coli_ type strain NCTC 86 / ATCC 11775.) `gff3` pulls each strain's annotation
down in the same call; [gene tracks](#add-gene-tracks) use it further below.

Those four FASTAs become the JBrowse assemblies as-is. The PanSN names exist
only inside the PAF, so make a separate concatenated copy for minimap2 rather
than renaming the originals — the haplotype is always `1` here, since these are
haploid bacterial assemblies:

```bash
for strain in K12 Sakai CFT073 NCTC86; do
  # '>chr' -> '>K12#1#chr'
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa

minimap2 -c -x asm20 all.fa all.fa > all_vs_all.paf
```

`-c` emits the base-level CIGAR the linear synteny view needs. Self-alignments
are deliberately kept: they're what makes the
[one-vs-all](#one-strain-against-all-the-others) mode below show a strain's own
repeats (rRNA operons, IS elements). The adapter drops only the degenerate
full-length self-diagonal, so keeping them costs nothing. Add `-X` if you want a
strictly pairwise file, at the price of that paralogy.

## Set up the four assemblies

The stacked view has one row per strain, so each strain FASTA must be a JBrowse
assembly whose name matches an entry in the track's `assemblyNames`. Compress
and index each one, then load it:

```bash
for strain in K12 Sakai CFT073 NCTC86; do
  bgzip -f $strain.fa
  samtools faidx $strain.fa.gz    # writes the .fai and .gzi JBrowse needs
  jbrowse add-assembly $strain.fa.gz --name $strain --load copy
done
```

Each assembly's reference sequence name is the plain `chr` from its FASTA,
**not** the PanSN name. The PanSN prefix is how the adapter decides which strain
a PAF record belongs to, and it strips that prefix before matching against the
assembly — so `K12#1#chr` in the PAF resolves to `chr` in the `K12` assembly. An
assembly whose refNames still carry the prefix matches nothing and draws an
empty view. See the
[assemblies configuration guide](/docs/config_guides/assemblies) for the
equivalent JSON and other indexing options.

## Loading the PAF with AllVsAllPAFAdapter

Since the file already holds every pairwise comparison, a single track can back
every band of the stacked view. List every assembly the file covers in
`assemblyNames`. The synteny view then tells the adapter which pair each band
draws, and the adapter keeps only the records whose PanSN prefixes match that
pair:

```json
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_ava",
  "name": "E. coli pangenome (all-vs-all PAF)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"],
  "adapter": {
    "type": "AllVsAllPAFAdapter",
    "pafLocation": { "uri": "all_vs_all.paf" },
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"]
  }
}
```

If a JBrowse assembly name differs from its PanSN sample prefix, map it with the
`assemblyNameToPanSN` slot (e.g. if you named the assembly `Ecoli_K12` but its
PanSN prefix is `K12`, use `{ "Ecoli_K12": "K12" }`).

To add the track from the command line instead of editing the config by hand,
pass `--adapterType` explicitly, since the `.paf` extension alone would
otherwise be read as a pairwise `PAFAdapter`:

```bash
jbrowse add-track all_vs_all.paf --adapterType AllVsAllPAFAdapter \
  -a K12,Sakai,CFT073,NCTC86 --load copy
```

Both the track and the adapter get the four `assemblyNames`.

## Large files: index with make-pif

`AllVsAllPAFAdapter` reads the whole PAF into memory, which is fine for strains
of one species but does not scale to a whole-genome pangenome of many samples.
For those, index the file once with `jbrowse make-pif` and switch the adapter to
`AllVsAllIndexedPAFAdapter`. A tabix range query then fetches only the records
overlapping the region in view instead of loading the entire file:

```bash
# produces all_vs_all.pif.gz and all_vs_all.pif.gz.tbi
jbrowse make-pif all_vs_all.paf
```

`make-pif` reads the PanSN names as it goes and finishes by printing the exact
`add-track` command for the samples it found, so you can paste it straight back:

```bash
jbrowse add-track all_vs_all.pif.gz --adapterType AllVsAllIndexedPAFAdapter \
  -a CFT073,K12,NCTC86,Sakai --load copy
```

Everything else about the track is unchanged — only the `adapter` block differs
from the un-indexed version above:

```json
{
  "type": "AllVsAllIndexedPAFAdapter",
  "pifGzLocation": { "uri": "all_vs_all.pif.gz" },
  "index": { "location": { "uri": "all_vs_all.pif.gz.tbi" } },
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"]
}
```

`assemblyNames`, `assemblyNameToPanSN`, and stacking the rows all work as above.
The `.pif.gz` keeps its PanSN sequence names, and `make-pif` also emits a coarse
zoomed-out tier so whole-genome views stay responsive.

## Stacking the genomes

With the track in your config, you can stack the four strains from the UI, or
declaratively so the view opens on load.

### From the UI

Open a linear synteny view (**Add → Linear synteny view**) to reach the import
form. Because `ecoli_ava` lists all four assemblies, you don't have to build the
rows by hand: open **Quick start from a synteny track** and choose it. Each
assembly it lists becomes a row, one per strain, and that one track gets wired
up to back every band. Click **Launch** and you have the stacked view.

You can still build the stack by hand, using **Add row** to add a strain and the
connector button between each pair to pick its synteny track, but for an
all-vs-all track Quick start saves you the trouble.

<Figure caption="The all-vs-all quick start in the import form. (1) Pick the ecoli_ava track. (2) Its four assemblies fill in as rows. (3) Launch." src="/img/multiway_synteny/ecoli_import_form.png" />

### Declaratively with defaultSession

To open the stacked view automatically on load, add a top-level `defaultSession`
key to your `config.json` holding a `LinearSyntenyView` snapshot. Four rows
means three bands, so `tracks` has three entries, all served by the same track:

```json
{
  "defaultSession": {
    "name": "E. coli 4-strain pangenome",
    "views": [
      {
        "type": "LinearSyntenyView",
        "init": {
          "views": [
            { "assembly": "K12" },
            { "assembly": "Sakai" },
            { "assembly": "CFT073" },
            { "assembly": "NCTC86" }
          ],
          "tracks": [["ecoli_ava"], ["ecoli_ava"], ["ecoli_ava"]],
          "drawCurves": true,
          "minAlignmentLength": 10000
        }
      }
    ]
  }
}
```

`tracks` is one entry per band: `tracks[0]` connects rows 0–1, `tracks[1]` rows
1–2, and `tracks[2]` rows 2–3, all served by `ecoli_ava`. `minAlignmentLength`
hides minimap2's many short alignments, which would otherwise bury the shared
backbone under a dense noise band. Tune it to taste. The one-time load settings
(row order, tracks, `drawCurves`, `minAlignmentLength`) go under `init`. See the
[ortholog-tables tutorial](/docs/tutorials/multiway_synteny) for a fuller
walk-through of the `defaultSession` structure.

The row order here is a free choice. Unlike a reference-anchored `.blocks`
table, an all-vs-all file is a complete graph, so every adjacent pair you happen
to stack is a direct alignment rather than a transitive link.

<Figure caption="Four E. coli strains (K-12, Sakai, CFT073, NCTC86) stacked from one minimap2 all-vs-all PAF (short alignments hidden with minAlignmentLength). The continuous ribbons are the ~4 Mb backbone shared by all four strains, and the gaps are strain-specific islands." src="/img/multiway_synteny/ecoli_pangenome.png" />

The gaps in those ribbons are where the strains actually differ. Sakai's are the
prophage S-loops carrying the Shiga-toxin genes
([Hayashi et al. 2001](https://academic.oup.com/dnaresearch/article/8/1/11/466363)),
and CFT073 carries its own pathogenicity islands
([Welch et al. 2002](https://www.pnas.org/doi/10.1073/pnas.252529799)).

## Add gene tracks

A gap is just absence of a ribbon, so on its own it only tells you the strains
differ, not what they differ by. The annotations downloaded alongside each
genome answer that. They need the same two adjustments the FASTA got — the GFF's
seqid is the chromosome accession, which has to become `chr` to match the
assembly, and the plasmid features have to be dropped rather than renamed, since
the assembly kept only the chromosome:

```bash
for strain in K12 Sakai CFT073 NCTC86; do
  # the chromosome is the FASTA's first record, whose accession is the seqid to keep
  acc=$(awk '/^>/{print substr($1, 2); exit}' "$strain"/ncbi_dataset/data/*/*.fna)
  # -F'\t' matters: the default separator also splits on the spaces inside GFF
  # attributes, which rewriting the line with OFS would then turn into tabs
  awk -F'\t' -v acc="$acc" -v OFS='\t' '$1 == acc {$1 = "chr"; print}' \
    "$strain"/ncbi_dataset/data/*/genomic.gff > "$strain.gff"

  jbrowse sort-gff "$strain.gff" | bgzip > "$strain.gff.gz"
  tabix "$strain.gff.gz"
  jbrowse add-track "$strain.gff.gz" -a "$strain" --name "$strain genes" --load copy
done
```

Each track is added to one strain's assembly, so it rides along with that
strain's row in the stacked view. Skipping the plasmid filter is the easy
mistake here: Sakai's two plasmids contribute 183 features that would otherwise
land on `chr` at coordinates that mean nothing.

With genes loaded, the gaps become readable. Navigate Sakai's row to
`chr:1,267,000-1,268,400` and the gap holds `stx2A` and `stx2B` — the
Shiga-toxin subunits, sitting in a region where no alignment to K-12 exists at
all. The second copy, `stx1A`/`stx1B`, is at `chr:2,924,600-2,925,900`. That
absence is the point: these are the prophage-borne genes that make O157:H7
pathogenic and that K-12 simply does not carry.

## One strain against all the others

Stacking is not the only thing the file is good for. Put the same track in a
plain linear genome view, where there is no second row and so no target
assembly, and it draws the strain you are looking at against every other sample
in the file at once.

This one-vs-all mode is looser about `assemblyNames` than the stacked view is. A
mate the track does not list still draws, labelled by its bare PanSN prefix, so
a plain view of K12 can show all three other strains without loading them as
assemblies. A strain's own paralogy draws as well, since a same-sample alignment
between two loci is a real alignment: view one copy and you see the link to the
other, and a tandem pair on one contig draws at both ends. Clicking a feature
offers to launch a synteny view against its mate, but only for mates the track
lists in `assemblyNames`, since the view needs a real assembly to open a row
for.

## Where to take it next

**Open a dotplot.** The same track works in **Add → Dotplot view**, which shows
whole-genome structure (inversions, translocations) that the stacked ribbons
compress into crossings.

**Scale it up.** Four strains fit in memory comfortably; a real pangenome of
hundreds does not. The PIF path above is the same workflow — `make-pif` and
change the adapter type. `make-pif --coarse` tunes the zoomed-out tier, and
`--csi` is only needed for sequences longer than ~512 Mb (not an issue for _E.
coli_).

## See also

- [Synteny from ortholog tables](/docs/tutorials/multiway_synteny) - the
  cross-species, gene-based `.blocks` workflow
- [Synteny visualization](/docs/tutorials/synteny_visualization) - pairwise
  dotplot and linear synteny basics
- [AllVsAllPAFAdapter config](/docs/config/allvsallpafadapter) - full schema for
  the un-indexed adapter used above
- [AllVsAllIndexedPAFAdapter config](/docs/config/allvsallindexedpafadapter) -
  the tabix-backed adapter for whole-genome pangenomes
- [LGVSyntenyDisplay config](/docs/config/lgvsyntenydisplay) - the display that
  draws the one-vs-all view in a plain linear genome view
- [PIF format](/docs/developer_guides/pif_format) - the indexed alignment format
  `make-pif` produces
- [Multi-way synteny in an embedded app](https://jbrowse.org/storybook/app/multiway-synteny-example/)
  - this same four-strain all-vs-all view running live in `@jbrowse/react-app2`
