import { geneFragment } from './exportRCode.ts'

import type { GeneRParams } from './exportRCode.ts'

const base: GeneRParams = {
  trackId: 'genes',
  trackName: 'Genes',
  uri: 'https://example.com/genes.gff3.gz',
}

test('emits a gene-model panel from pure ggplot2 primitives', () => {
  const f = geneFragment(base)
  expect(f.plotVariable).toBe('p_genes')
  expect(f.setup).toBe('genes <- "https://example.com/genes.gff3.gz"')
  expect(f.helpers).toEqual(['read_gff', 'gene_layout', 'bp_axis'])
  expect(f.packages).toEqual(['rtracklayer', 'ggplot2'])
  expect(f.plotExpr).toContain(
    'gene_layout(read_gff(genes, chrom, start, end))',
  )
  // directional body line + thin non-CDS boxes under thick CDS boxes
  expect(f.plotExpr).toContain('geom_segment(')
  expect(f.plotExpr).toContain('arrow = arrow(')
  expect(f.plotExpr).toContain('d[!(d$fid %in% d$parent) & d$type != "CDS", ]')
  expect(f.plotExpr).toContain('d[d$type == "CDS", ]')
  // labels de-collide via base ggplot2 (no ggrepel dependency)
  expect(f.plotExpr).toContain('check_overlap = TRUE')
  // panel clips to the region so stacked tracks stay aligned
  expect(f.plotExpr).toContain('coord_cartesian(xlim = c(start, end))')
  expect(f.plotExpr).not.toMatch(/geom_gene|jb_features|ggjbrowse/)
})

test('bed format selects the read_bed reader', () => {
  const f = geneFragment({ ...base, uri: 'x.bed.gz', format: 'bed' })
  expect(f.helpers).toEqual(['read_bed', 'gene_layout', 'bp_axis'])
  expect(f.plotExpr).toContain(
    'gene_layout(read_bed(genes, chrom, start, end))',
  )
})
