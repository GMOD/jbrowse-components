import { refuseRetiredStateF } from '@jbrowse/display-kit/retiredSettings'

export const retired = {
  domain:
    '`rows.domain` (`rows: { domain: [...] }`), the row order beside the labels, tree and focus',
  showTranslation: '`color: "codon"`',
  colorByChromosome: '`color: "chromosome"`',
  rowIdentityMode:
    '`color: "identity"` for the heatmap and `y: "identity"` for the X-Y plot',
  mismatchRendering:
    '`color: "base"`, which colours every base, beside the default `color: "mismatch"`',
}

export const refuseRetiredState = refuseRetiredStateF({
  displayType: 'LinearMafDisplay',
  state: ['layout', 'clusterTree', 'clusterProvenance', 'subtreeFilter'],
})
