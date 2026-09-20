---
title: SV inspector view
description: Structural variant spreadsheet and circular view
guide_category: Views
---

The SV inspector is a combined variant table and whole-genome circular view for
triaging structural variant calls. For an end-to-end walkthrough on real cancer
sequencing data, see the
[C-GIAB tutorial](/docs/tutorials/sv_visualization_cgiab).

Launch it from the **Add** menu in the main menu bar; an import form then asks
for your SV data.

<Figure caption="Launching the SV inspector from the Add menu." src="/img/sv_cgiab/translocation_sv_inspector_start.png" />

The following formats are supported:

- VCF or VCF.gz (plain text or (b)gzipped)
- BED, BEDPE
- STAR-fusion result file

A STAR-Fusion table is a `.tsv`, so the import form reads its File Type off the
filename (`star-fusion`, `fusion_predictions`) or the `#FusionName` header line,
and the menu sets it by hand for a file named some other way;
[](/docs/tutorials/k562_fusions) walks a caller's output through the inspector
and out to the reads behind each call.

## Record types and compatible callers

The SV inspector is best for long-range SV records: VCF entries with
`SVTYPE=BND` (breakends; the VCF-spec way to encode translocations) or the
caller-specific `SVTYPE=TRA` used by some tools.

Single-locus deletions and duplications load into the table like anything else,
but the circular overview cannot draw them: a chord runs between a record's two
ends, and at whole-genome scale a deletion's two ends are the same point. The
legend below the circle says so — it counts every class in the rows on screen,
including the ones with no chord to draw, so a mostly-local callset reads as
such.

Compatible variant callers include:

- Short-read - Manta, Delly, Lumpy
- Long-read - pbsv, Sniffles

## Example workflow

Load this
[VCF of translocation events](https://jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf)
called from the SKBR3 breast cancer cell line
([published data](https://schatz-lab.org/publications/SKBR3/)). Paste the URL
into the import form and select hg19:

<Figure caption="The SV inspector import form with a VCF URL pasted. As the callout notes, 'Open from track' fills the inspector from a VCF track already open in the session." src="/img/sv_inspector_importform_after.png" />

## SV inspector results

The loaded file appears as a searchable table, one variant per row, alongside a
whole-genome circular overview.

<Figure caption="The SV inspector with loaded results." src="/img/sv_inspector_importform_loaded.png" />

Table filters are reflected in the circular view.

<Figure caption="The SV inspector with filter applied." src="/img/sv_inspector_importform_filtered.png" />

<Video src="/media/sv/inspector_route.mp4" caption="The same callset from the Add menu onward: the import form, the URL and assembly it takes, the table and circle it opens, and a chromosome typed into the table filter, which filters the chords too." />

## Rearrangement events

A complex rearrangement is several junctions, and some callers say which ones
belong together in VCF 4.4's `EVENT` key; the C-GIAB benchmark and DRAGEN both
write it. When the file has it, a **Filter by event** dropdown appears beside
**Filter by SV type**, listing each event with its record count and the
chromosomes it touches. Choosing one narrows the table and the circle to that
event's records, and with **show only regions with data** on, the circle redraws
over those chromosomes alone.

With no event chosen, selecting a row or chord of an event dims every chord
outside that event, so its other junctions stand out against the whole callset.

The dropdown lists a value only when its records describe more than one
junction. A breakend callset writes each junction twice, once from either end,
and GRIDSS gives that pair an `EVENT` of its own, so a list of every value would
name every breakpoint in the file.

JBrowse reads the grouping and does not compute one, and it reads the standard
key only. A caller that files the same grouping under its own key needs the key
renamed before import. [Severus](https://github.com/KolmogorovLab/Severus)
writes `CLUSTERID`, and `MATE_ID` where the specification has `MATEID`:

```bash
zcat severus_somatic.vcf.gz |
  sed -e 's/^##INFO=<ID=CLUSTERID,/##INFO=<ID=EVENT,/' \
      -e 's/^##INFO=<ID=MATE_ID,/##INFO=<ID=MATEID,/' \
      -e 's/;CLUSTERID=/;EVENT=/' -e 's/;MATE_ID=/;MATEID=/' |
  bgzip > severus_somatic.event.vcf.gz
```

## Launching breakpoint split view

Click a feature in the circular view, or the triangle dropdown on any table row,
to open the
[breakpoint split view](/docs/user_guides/sv_visualization#breakpoint-split-view)
for that variant: two stacked linear genome views, each centered on one
breakpoint, both showing the callset. Add alignment tracks from the split view's
track selector, and the arcs and splines connecting supporting reads appear
automatically. The next row or chord opens in the same split view and keeps
those tracks, including when its chain has more panels.

For a record filed under an event, the dialog offers **Open every locus of**
that event: one panel per locus the event's junctions touch, in genome order,
with breakends closer together than the window size sharing a panel.

To skip that step, name the evidence in the session or link: the
[`drilldownTracks`](/docs/urlparams#sv-inspector) launch key lists the trackIds
every view a row or chord opens starts with, such as the tumor and normal
alignments, a coverage track, or an assembly's synteny track.

## See also

- [](/docs/user_guides/circular_view)
- [](/docs/user_guides/spreadsheet_view)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [Cancer SVs (C-GIAB) tutorial](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/tutorials/k562_fusions)
- [Multi-sample SVs (1000 Genomes) tutorial](/docs/tutorials/sv_multisamples)
