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
  // body line + exon boxes, split from one laid-out data.frame
  expect(f.plotExpr).toContain('geom_segment(')
  expect(f.plotExpr).toContain('geom_rect(')
  expect(f.plotExpr).toContain('d[is.na(d$parent), ]')
  expect(f.plotExpr).toContain('d[!(d$fid %in% d$parent), ]')
  // panel clips to the region so stacked tracks stay aligned
  expect(f.plotExpr).toContain('coord_cartesian(xlim = c(start, end))')
  expect(f.plotExpr).not.toMatch(/geom_gene|jb_features|ggjbrowse/)
})
