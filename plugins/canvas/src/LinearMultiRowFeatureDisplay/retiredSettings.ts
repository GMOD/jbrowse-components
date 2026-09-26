import { refuseRetiredStateF } from '@jbrowse/display-kit/retiredSettings'

export const retired = {
  partitionField: '`rows` (`rows: "sample"`, or `rows: { field, domain }`)',
  domain: '`rows.domain`',
  sampleColorMap: '`rowColor: { domain: [...rows], range: [...colors] }`',
  colorDomain: '`color.domain`',
  legend:
    '`color: { scale: "identity", domain: [...colors], labels: [...names] }`',
}

export const refuseRetiredState = refuseRetiredStateF({
  displayType: 'LinearMultiRowFeatureDisplay',
  state: ['layout', 'clusterTree', 'clusterProvenance', 'subtreeFilter'],
})
