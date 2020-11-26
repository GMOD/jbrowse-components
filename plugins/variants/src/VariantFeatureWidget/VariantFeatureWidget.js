/* eslint-disable react/prop-types */
import React, { useState } from 'react'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableSortLabel from '@material-ui/core/TableSortLabel'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import TablePagination from '@material-ui/core/TablePagination'
import TextField from '@material-ui/core/TextField'
import { observer } from 'mobx-react'
import {
  BaseFeatureDetails,
  BaseCard,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

function VariantSamples(props) {
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [sampleFilter, setSampleFilter] = useState('')
  const [filter, setFilter] = useState({})
  const [order, setOrder] = useState('asc')
  const [orderBy, setOrderBy] = useState('')
  const [page, setPage] = useState(0)
  const { feature } = props

  const preFilteredRows = Object.entries(feature.samples || {})
  if (!preFilteredRows.length) {
    return null
  }
  const infoFields = Object.keys(preFilteredRows[0][1])
  let error
  let rows = []
  const filters = Object.keys(filter)

  // catch some error thrown from regex
  try {
    rows = preFilteredRows
      .filter(row => row[0].match(sampleFilter))
      .filter(row =>
        filters.length
          ? filters.some(key => String(row[1][key]).match(filter[key] || ''))
          : true,
      )
      .sort(
        (a, b) =>
          (order === 'desc' ? -1 : 1) *
          (orderBy === 'Sample'
            ? a[0].localeCompare(b[0])
            : String(a[1][orderBy]).localeCompare(String(b[1][orderBy]))),
      )
  } catch (e) {
    error = e
  }

  return (
    <BaseCard {...props} title="Samples">
      {error ? String(error) : null}
      <TableContainer>
        <TextField
          placeholder="Filter sample (regex)"
          value={sampleFilter}
          onChange={event => setSampleFilter(event.target.value)}
        />
        {infoFields.map(field => {
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
        {rows.length > rowsPerPage ? (
          <TablePagination
            rowsPerPageOptions={[10, 50, 100, 1000]}
            component="div"
            count={rows.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onChangePage={(event, newPage) => {
              setPage(newPage)
            }}
            onChangeRowsPerPage={event => {
              setRowsPerPage(parseInt(event.target.value, 10))
              setPage(0)
            }}
          />
        ) : null}
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Sample', ...infoFields].map(f => (
                <TableCell
                  key={f}
                  sortDirection={orderBy === f ? order : false}
                >
                  <TableSortLabel
                    active={orderBy === f}
                    direction={orderBy === f ? order : 'asc'}
                    onClick={() => {
                      const isAsc = orderBy === f && order === 'asc'
                      setOrder(isAsc ? 'desc' : 'asc')
                      setOrderBy(f)
                    }}
                  >
                    {f}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map(([key, value]) => {
                return (
                  value && (
                    <TableRow key={key}>
                      <TableCell component="th" scope="row">
                        {key}
                      </TableCell>
                      {infoFields.map(f => {
                        return (
                          <TableCell key={f}>
                            {value[f] === null ? '.' : String(value[f])}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                )
              })}
          </TableBody>
        </Table>
      </TableContainer>
    </BaseCard>
  )
}

function VariantFeatureDetails(props) {
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
