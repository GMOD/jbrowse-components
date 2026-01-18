import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Link,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { SequenceSearchModel, BlatResultWithStats } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  container: {
    padding: '16px',
  },
  tableContainer: {
    maxHeight: 400,
  },
  row: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  link: {
    cursor: 'pointer',
  },
}))

const SearchResults = observer(function SearchResults({
  model,
}: {
  model: SequenceSearchModel
}) {
  const { classes } = useStyles()
  const { results, error, progress } = model

  if (error) {
    return (
      <div className={classes.container}>
        <Typography color="error">{error}</Typography>
      </div>
    )
  }

  if (!results) {
    if (progress) {
      return (
        <div className={classes.container}>
          <Typography>{progress}</Typography>
        </div>
      )
    }
    return null
  }

  if (results.length === 0) {
    return (
      <div className={classes.container}>
        <Typography>No matches found</Typography>
      </div>
    )
  }

  return (
    <div className={classes.container}>
      <Typography variant="subtitle2" gutterBottom>
        {results.length} match{results.length !== 1 ? 'es' : ''} found
      </Typography>
      <TableContainer component={Paper} className={classes.tableContainer}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Location</TableCell>
              <TableCell align="right">Score</TableCell>
              <TableCell align="right">Identity</TableCell>
              <TableCell align="right">Coverage</TableCell>
              <TableCell>Strand</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((result, idx) => (
              <ResultRow key={idx} model={model} result={result} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
})

const ResultRow = observer(function ResultRow({
  model,
  result,
}: {
  model: SequenceSearchModel
  result: BlatResultWithStats
}) {
  const { classes } = useStyles()
  const locString = `${result.tName}:${result.tStart + 1}-${result.tEnd}`

  return (
    <TableRow className={classes.row} onClick={() => model.navigateToResult(result)}>
      <TableCell>
        <Link className={classes.link} underline="hover">
          {locString}
        </Link>
      </TableCell>
      <TableCell align="right">{result.score}</TableCell>
      <TableCell align="right">{result.identity.toFixed(1)}%</TableCell>
      <TableCell align="right">{result.coverage.toFixed(1)}%</TableCell>
      <TableCell>{result.strand}</TableCell>
    </TableRow>
  )
})

export default SearchResults
