import React from 'react'
import { observer } from 'mobx-react'
import { Divider, Paper } from '@mui/material'
import { FeatureDetails } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { parseBreakend } from '@gmod/vcf'

// locals
import VariantSampleGrid from './VariantSampleGrid'
import BreakendPanel from './BreakendPanel'
import VariantAnnotationTable from './VariantAnnotationTable'
import { SimpleFeatureSerialized } from '@jbrowse/core/util'

const basicDescriptions = {
  CHROM: 'chromosome: An identifier from the reference genome',
  POS: 'position: The reference position, with the 1st base having position 1',
  ID: 'identifier: Semi-colon separated list of unique identifiers where available',
  REF: 'reference base(s): Each base must be one of A,C,G,T,N (case insensitive).',
  ALT: 'alternate base(s): Comma-separated list of alternate non-reference alleles',
  QUAL: 'quality: Phred-scaled quality score for the assertion made in ALT',
  FILTER:
    'filter status: PASS if this position has passed all filters, otherwise a semicolon-separated list of codes for filters that fail',
}

function VariantFeatureDetails(props: {
  model: {
    featureData: SimpleFeatureSerialized
    descriptions: Record<string, string>
  }
}) {
  const { model } = props
  const { featureData, descriptions } = model
  const feat = JSON.parse(JSON.stringify(featureData))
  const { samples, ...rest } = feat

  return (
    <Paper data-testid="variant-side-drawer">
      <FeatureDetails
        feature={rest}
        descriptions={{ ...basicDescriptions, ...descriptions }}
        {...props}
      />
      <Divider />
      <CsqPanel feature={rest} descriptions={descriptions} />
      <Divider />
      <AnnPanel feature={rest} descriptions={descriptions} />
      <Divider />
      {feat.type === 'breakend' ? (
        <BreakendPanel
          feature={feat}
          locStrings={feat.ALT.map(
            (alt: string) => parseBreakend(alt)?.MatePosition || '',
          )}
          model={model}
        />
      ) : null}
      {feat.type === 'translocation' ? (
        <BreakendPanel
          feature={feat}
          model={model}
          locStrings={[`${feat.INFO.CHR2[0]}:${feat.INFO.END}`]}
        />
      ) : null}
      <VariantSampleGrid
        feature={feat}
        {...props}
        descriptions={descriptions}
      />
    </Paper>
  )
}

function AnnPanel({
  descriptions,
  feature,
}: {
  descriptions: { INFO?: { ANN?: { Description?: string } } }
  feature: { INFO?: { ANN?: string[] } }
}) {
  const annDesc = descriptions?.INFO?.ANN?.Description
  const annFields =
    annDesc?.match(/.*Functional annotations:'(.*)'$/)?.[1].split('|') || []
  const ann = feature.INFO?.ANN || []
  return (
    <VariantAnnotationTable
      fields={annFields}
      data={ann}
      title="Variant ANN field"
    />
  )
}

function CsqPanel({
  descriptions,
  feature,
}: {
  descriptions: { INFO?: { CSQ?: { Description?: string } } }
  feature: { INFO?: { CSQ?: string[] } }
}) {
  const csqDescription = descriptions?.INFO?.CSQ?.Description
  const csqFields =
    csqDescription?.match(/.*Format: (.*)/)?.[1].split('|') || []
  const csq = feature.INFO?.CSQ || []
  return (
    <VariantAnnotationTable
      fields={csqFields}
      data={csq}
      title="Variant CSQ field"
    />
  )
}

export default observer(VariantFeatureDetails)
