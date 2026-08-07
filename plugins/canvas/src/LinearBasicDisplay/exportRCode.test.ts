import { geneFragment, translateFeatureFilters } from './exportRCode.ts'

import type { GeneRParams } from './exportRCode.ts'

const base: GeneRParams = {
  trackId: 'genes',
  trackName: 'Genes',
  uri: 'https://example.com/genes.gff3.gz',
}

test('emits a gene-model panel from pure ggplot2 primitives', () => {
  const f = geneFragment(base)
  expect(f.plotVariable).toBe('p_genes')
  expect(f.setup).toContain('genes <- "https://example.com/genes.gff3.gz"')
  expect(f.helpers).toEqual([
    'read_gff',
    'feature_filter',
    'gene_layout',
    'label_room',
  ])
  expect(f.packages).toEqual(['rtracklayer', 'ggplot2'])
  // the read is BOUND (dataExpr) rather than inlined into the plot, so the
  // panel's height can be a function of the rows it packed
  expect(f.dataExpr).toBe(
    'gene_layout(feature_filter(read_regions(function(chrom, start, end) read_gff(genes, chrom, start, end), regions, c("start", "end")), genes_filters, NULL))',
  )
  expect(f.plotExpr).toContain('ggplot(d_genes)')
  expect(f.heightWeightExpr).toContain('d_genes$row')
  // directional body line + thin non-CDS boxes under thick CDS boxes
  expect(f.plotExpr).toContain('geom_segment(')
  expect(f.plotExpr).toContain('arrow = arrow(')
  // CDS first, then the leaves on top with a white hairline: a polyprotein's
  // mature peptides tile their CDS end to end, so underneath it they were
  // invisible and unedged they would have merged into one bar
  expect(f.plotExpr.indexOf('d[d$type == "CDS", ]')).toBeLessThan(
    f.plotExpr.indexOf('d[!(d$fid %in% d$parent) & d$type != "CDS", ]'),
  )
  expect(f.plotExpr).toContain('colour = "white", linewidth = 0.1')
  // names are drawn only where they fit, JBrowse's own fitWidth decimation —
  // without it a dense window comes out as a wall of overlapping text where the
  // browser draws bare glyphs. check_overlap is the second line of defence.
  expect(f.plotExpr).toContain('d[label_room(d, regions, fig_width_px), ]')
  expect(f.plotExpr).toContain('check_overlap = TRUE')
  expect(f.plotExpr).not.toMatch(/geom_gene|jb_features|ggjbrowse/)
})

test('bed format selects the read_bed reader', () => {
  const f = geneFragment({ ...base, uri: 'x.bed.gz', format: 'bed' })
  expect(f.helpers).toEqual([
    'read_bed',
    'feature_filter',
    'gene_layout',
    'label_room',
  ])
  expect(f.dataExpr).toBe(
    'gene_layout(feature_filter(read_regions(function(chrom, start, end) read_bed(genes, chrom, start, end), regions, c("start", "end")), genes_filters, NULL))',
  )
})

// Every UCSC-hub feature track is a BigBed, and read_bed's text parser cannot
// open one — it needs the indexed reader, selected by the named `format` so it
// still follows an omitted `attrs`.
test('bigbed format reads through read_bed in its indexed mode', () => {
  const f = geneFragment({ ...base, uri: 'x.bb', format: 'bigbed' })
  expect(f.helpers).toEqual([
    'read_bed',
    'feature_filter',
    'gene_layout',
    'label_room',
  ])
  expect(f.dataExpr).toContain(
    'read_bed(genes, chrom, start, end, format = "bigBed")',
  )
})

test('an attrs list and the bigBed mode coexist', () => {
  const f = geneFragment({
    ...base,
    uri: 'x.bb',
    format: 'bigbed',
    filters: [{ attr: 'svType', op: '==', value: 'DEL', jexl: "x=='DEL'" }],
  })
  expect(f.dataExpr).toContain(
    'read_bed(genes, chrom, start, end, c("svType"), format = "bigBed")',
  )
})

test('a jexl attribute filter becomes an editable R predicate', () => {
  const { rules, untranslated } = translateFeatureFilters([
    // the default every feature display ships with, in the config's unprefixed
    // form, and the same thing as activeFilters() hands it over
    `get(feature,'gbkey')!='Src'`,
    `jexl:feature.source=='BestRefSeq'`,
  ])
  expect(untranslated).toEqual([])
  const f = geneFragment({ ...base, filters: rules })
  // a missing attribute is jexl's `undefined`: it passes != and fails ==
  expect(f.setup).toContain(`function(f) is.na(f$gbkey) | f$gbkey != "Src"`)
  expect(f.setup).toContain(
    `function(f) !is.na(f$source) & f$source == "BestRefSeq"`,
  )
  // each predicate carries the browser setting it came from
  expect(f.setup).toContain(`# get(feature,'gbkey')!='Src'`)
  // and only the attributes a rule reads are pulled out of the GFF
  expect(f.dataExpr).toContain(
    'read_gff(genes, chrom, start, end, c("gbkey", "source"))',
  )
})

test('a jexl filter it cannot translate is named, not dropped in silence', () => {
  const { rules, untranslated } = translateFeatureFilters([
    `jexl:get(feature,'score') > 10`,
  ])
  expect(rules).toEqual([])
  expect(untranslated).toEqual([`get(feature,'score') > 10`])
  const f = geneFragment({ ...base, untranslatedFilters: untranslated })
  expect(f.setup).toContain('NOT TRANSLATED')
  expect(f.setup).toContain(`get(feature,'score') > 10`)
})

test('"Show only genes" emits the admitted top-level types', () => {
  const f = geneFragment({ ...base, geneTypes: ['mRNA', 'gene'] })
  expect(f.setup).toContain('genes_types <- c("mRNA", "gene")')
  expect(f.dataExpr).toContain(', genes_filters, genes_types)')
})

// A glyph is a fixed fraction of one row, so a panel packing a single row had a
// y-range of 0.7 and drew that one gene as a solid bar across the whole panel.
test('the y scale covers a minimum number of rows', () => {
  expect(geneFragment(base).plotExpr).toContain('expand_limits(y = 4)')
})

// The browser's "Longest coding transcript" mode. The R twin drew every isoform,
// which at gene-scale zoom is exactly what the browser stops doing — a 6 kb
// window over one hg38 gene came out as a solid block of stacked transcripts.
test('longestCoding collapses isoforms before the packing', () => {
  const f = geneFragment({ ...base, collapseIsoforms: ['mRNA', 'transcript'] })
  expect(f.helpers).toContain('collapse_isoforms')
  // inside gene_layout, outside feature_filter: collapsing after the packing
  // would leave the dropped transcripts' rows reserved
  expect(f.dataExpr).toContain('gene_layout(collapse_isoforms(feature_filter(')
  expect(f.dataExpr).toContain('), genes_transcript_types))')
  expect(f.setup).toContain('genes_transcript_types <- c("mRNA", "transcript")')
})

test('every transcript is drawn when the mode is not longestCoding', () => {
  const f = geneFragment(base)
  expect(f.helpers).not.toContain('collapse_isoforms')
  expect(f.dataExpr).not.toContain('collapse_isoforms')
})

// A fixed weight gave a 61-row window of structural variants the same two
// inches as a three-gene one. The floor keeps every ordinary gene panel exactly
// as tall as it has always been.
test('the panel height is a function of the rows actually packed', () => {
  const f = geneFragment(base)
  expect(f.heightWeightExpr).toBe(
    'max(2, max(c(d_genes$row, 0), na.rm = TRUE) / 4)',
  )
})
