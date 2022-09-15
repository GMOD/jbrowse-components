/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { observer } from 'mobx-react'
import { Divider, Paper } from '@mui/material'
import { FeatureDetails } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { parseBreakend } from '@gmod/vcf'

// locals
import VariantSampleGrid from './VariantSampleGrid'
import VariantCsqPanel from './VariantCsqPanel'
import VariantAnnPanel from './VariantAnnPanel'
import BreakendPanel from './BreakendPanel'

function VariantFeatureDetails(props: any) {
  const { model } = props
  const { featureData, descriptions } = model
  const feat = JSON.parse(JSON.stringify(featureData))
  const { samples, ...rest } = feat
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

  return (
    <Paper data-testid="variant-side-drawer">
      <FeatureDetails
        feature={rest}
        descriptions={{ ...basicDescriptions, ...descriptions }}
        {...props}
      />
      <Divider />
      <VariantCsqPanel feature={rest} descriptions={descriptions} />
      <Divider />
      <VariantAnnPanel feature={rest} descriptions={descriptions} />
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

export default observer(VariantFeatureDetails)
