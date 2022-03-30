/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react'
import {
  Divider,
  Link,
  Paper,
  FormControlLabel,
  Checkbox,
  TextField,
  Typography,
} from '@material-ui/core'
import SimpleFeature, {
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import { getEnv } from 'mobx-state-tree'
import {
  FeatureDetails,
  BaseCard,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import BreakendOptionDialog from './BreakendOptionDialog'
import { parseBreakend } from '@gmod/vcf'

function VariantSamples(props: any) {
  const [filter, setFilter] = useState<any>({})
  const [showFilters, setShowFilters] = useState(false)
  const { feature } = props

  const { samples = {} } = feature
  const preFilteredRows: any = Object.entries(samples)
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
  // note: maps all values into a string, if this is not done rows are not
  // sortable by the data-grid
  try {
    rows = preFilteredRows
      .map((row: any) => ({
        ...Object.fromEntries(
          Object.entries(row[1]).map(entry => [entry[0], String(entry[1])]),
        ),
        sample: row[0],
        id: row[0],
      }))
      .filter((row: any) => {
        return filters.length
          ? filters.every(key => {
              const val = row[key]
              const currFilter = filter[key]
              return currFilter ? val.match(new RegExp(currFilter, 'i')) : true
            })
          : true
      })
  } catch (e) {
    error = e
  }
  // disableSelectionOnClick helps avoid
  // https://github.com/mui-org/material-ui-x/issues/1197
  return (
    <BaseCard {...props} title="Samples">
      {error ? <Typography color="error">{`${error}`}</Typography> : null}

      <FormControlLabel
        control={
          <Checkbox
            checked={showFilters}
            onChange={() => setShowFilters(f => !f)}
          />
        }
        label="Show sample filters"
      />
      {showFilters ? (
        <>
          <Typography>
            These filters can use a plain text search or regex style query, e.g.
            in the genotype field, entering 1 will query for all genotypes that
            include the first alternate allele e.g. 0|1 or 1|1, entering
            [1-9]\d* will find any non-zero allele e.g. 0|2 or 2/33
          </Typography>
          {infoFields.map(({ field }) => {
            return (
              <TextField
                key={`filter-${field}`}
                placeholder={`Filter ${field}`}
                value={filter[field] || ''}
                onChange={event =>
                  setFilter({ ...filter, [field]: event.target.value })
                }
              />
            )
          })}
        </>
      ) : null}
      <div style={{ height: 600, width: '100%', overflow: 'auto' }}>
        <DataGrid
          rows={rows}
          columns={infoFields}
          rowHeight={20}
          headerHeight={25}
          disableSelectionOnClick
          disableColumnMenu
        />
      </div>
    </BaseCard>
  )
}

function BreakendPanel(props: {
  locStrings: string[];
  model: any;
  feature: SimpleFeatureSerialized;
}) {
  const { model, locStrings, feature } = props
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  const [breakpointDialog, setBreakpointDialog] = useState(false)
  let viewType

  try {
    viewType = pluginManager.getViewType('BreakpointSplitView')
  } catch (e) {
    // ignore
  }

  const simpleFeature = new SimpleFeature(feature)
  return (
    <BaseCard {...props} title="Breakends">
      <Typography>Link to linear view of breakend endpoints</Typography>
      <ul>
        {locStrings.map(locString => (
          <li key={`${JSON.stringify(locString)}`}>
            <Link
              href="#"
              onClick={(event: any) => {
                event.preventDefault()
                const { view } = model
                try {
                  if (view) {
                    view.navToLocString?.(locString)
                  } else {
                    throw new Error(
                      'No view associated with this feature detail panel anymore',
                    )
                  }
                } catch (e) {
                  console.error(e)
                  session.notify(`${e}`)
                }
              }}
            >
              {`LGV - ${locString}`}
            </Link>
          </li>
        ))}
      </ul>
      {viewType ? (
        <div>
          <Typography>
            Launch split views with breakend source and target
          </Typography>
          <ul>
            {locStrings.map(locString => (
              <li key={`${JSON.stringify(locString)}`}>
                <Link
                  href="#"
                  onClick={(event: any) => {
                    event.preventDefault()
                    setBreakpointDialog(true)
                  }}
                >
                  {`${feature.refName}:${feature.start} // ${locString} (split view)`}
                </Link>
              </li>
            ))}
          </ul>
          {breakpointDialog ? (
            <BreakendOptionDialog
              model={model}
              feature={simpleFeature}
              viewType={viewType}
              handleClose={() => {
                setBreakpointDialog(false)
              }}
            />
          ) : null}
        </div>
      ) : null}
    </BaseCard>
  )
}

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
      <VariantSamples feature={feat} {...props} />
    </Paper>
  )
}

export default observer(VariantFeatureDetails)
