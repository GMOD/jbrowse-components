/* eslint-disable react/prop-types,@typescript-eslint/no-explicit-any */
import React, { useState } from 'react'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'

import { DataGrid } from '@material-ui/data-grid'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import {
  BaseFeatureDetails,
  BaseCard,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

function VariantSamples(props: any) {
  const [filter, setFilter] = useState({})
  const { feature } = props

  const preFilteredRows = Object.entries(feature.samples || {})
  if (!preFilteredRows.length) {
    return null
  }
  const infoFields = ['sample', ...Object.keys(preFilteredRows[0][1])].map(
    field => ({
      field,
    }),
  )
  let error
  let rows = []
  const filters = Object.keys(filter)

  // catch some error thrown from regex
  try {
    rows = preFilteredRows
      .map(row => {
        return { sample: row[0], ...row[1], id: row[0] }
      })
      .filter(row =>
        filters.length
          ? filters.some(key => String(row[key]).match(filter[key] || ''))
          : true,
      )
  } catch (e) {
    error = e
  }

  return (
    <BaseCard {...props} title="Samples">
      {error ? <Typography color="error">{`${error}`}</Typography> : null}

      {infoFields.map(({ field }) => {
        return (
          <TextField
            key={`filter-${field}`}
            placeholder={`Filter ${field} (regex)`}
            value={filter[field] || ''}
            onChange={event =>
              setFilter({ ...filter, [field]: event.target.value })
            }
          />
        )
      })}
      <div style={{ height: 600, width: '100%' }}>
        <DataGrid
          autoHeight
          rows={rows}
          columns={infoFields}
          rowHeight={20}
          headerHeight={25}
        />
      </div>
    </BaseCard>
  )
}

function VariantFeatureDetails(props: any) {
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  const { samples, ...rest } = feat
  const descriptions = {
    CHROM: 'chromosome: An identifier from the reference genome',
    POS:
      'position: The reference position, with the 1st base having position 1',
    ID:
      'identifier: Semi-colon separated list of unique identifiers where available',
    REF:
      'reference base(s): Each base must be one of A,C,G,T,N (case insensitive).',
    ALT:
      ' alternate base(s): Comma-separated list of alternate non-reference alleles',
    QUAL: 'quality: Phred-scaled quality score for the assertion made in ALT',
    FILTER:
      'filter status: PASS if this position has passed all filters, otherwise a semicolon-separated list of codes for filters that fail',
  }

  return (
    <Paper data-testid="variant-side-drawer">
      <BaseFeatureDetails
        feature={rest}
        descriptions={descriptions}
        {...props}
      />
      <Divider />
      <VariantSamples feature={feat} {...props} />
    </Paper>
  )
}

export default observer(VariantFeatureDetails)
