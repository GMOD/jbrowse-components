import { useState } from 'react'

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
  IconButton,
  Collapse,
  Box,
  Button,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { observer } from 'mobx-react'

import type { SequenceSearchModel, BlatResultWithStats, IsPcrResult } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  container: {
    padding: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
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
  sequenceBox: {
    fontFamily: 'monospace',
    fontSize: '12px',
    backgroundColor: theme.palette.grey[100],
    padding: '8px',
    borderRadius: '4px',
    wordBreak: 'break-all',
    maxHeight: '150px',
    overflow: 'auto',
  },
  expandCell: {
    width: '48px',
    padding: '0 8px',
  },
}))

const BlatResults = observer(function BlatResults({
  model,
  results,
}: {
  model: SequenceSearchModel
  results: BlatResultWithStats[]
}) {
  const { classes } = useStyles()

  return (
    <TableContainer component={Paper} className={classes.tableContainer}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Location</TableCell>
            <TableCell align="right">Score</TableCell>
            <TableCell align="right">Identity</TableCell>
            <TableCell align="right">Coverage</TableCell>
            <TableCell>Strand</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((result, idx) => (
            <BlatResultRow key={idx} model={model} result={result} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
})

const BlatResultRow = observer(function BlatResultRow({
  model,
  result,
}: {
  model: SequenceSearchModel
  result: BlatResultWithStats
}) {
  const { classes } = useStyles()
  const locString = `${result.tName}:${result.tStart + 1}-${result.tEnd}`

  return (
    <TableRow className={classes.row}>
      <TableCell onClick={() => model.navigateToBlatResult(result)}>
        <Link className={classes.link} underline="hover">
          {locString}
        </Link>
      </TableCell>
      <TableCell align="right">{result.score}</TableCell>
      <TableCell align="right">{result.identity.toFixed(1)}%</TableCell>
      <TableCell align="right">{result.coverage.toFixed(1)}%</TableCell>
      <TableCell>{result.strand}</TableCell>
      <TableCell>
        <IconButton
          size="small"
          onClick={() => navigator.clipboard.writeText(locString)}
          title="Copy location to clipboard"
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => model.openOnUcsc(locString)}
          title="View on UCSC Genome Browser"
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  )
})

const IsPcrResults = observer(function IsPcrResults({
  model,
  results,
}: {
  model: SequenceSearchModel
  results: IsPcrResult[]
}) {
  const { classes } = useStyles()

  return (
    <TableContainer component={Paper} className={classes.tableContainer}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell className={classes.expandCell} />
            <TableCell>Location</TableCell>
            <TableCell align="right">Product Size</TableCell>
            <TableCell>Strand</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((result, idx) => (
            <IsPcrResultRow key={idx} model={model} result={result} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
})

const IsPcrResultRow = observer(function IsPcrResultRow({
  model,
  result,
}: {
  model: SequenceSearchModel
  result: IsPcrResult
}) {
  const { classes } = useStyles()
  const [expanded, setExpanded] = useState(false)
  const locString = `${result.chrom}:${result.chromStart}-${result.chromEnd}`

  const handleCopySequence = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (result.sequence) {
      navigator.clipboard.writeText(result.sequence)
    }
  }

  return (
    <>
      <TableRow className={classes.row}>
        <TableCell className={classes.expandCell}>
          {result.sequence && (
            <IconButton
              size="small"
              onClick={e => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </TableCell>
        <TableCell onClick={() => model.navigateToIsPcrResult(result)}>
          <Link className={classes.link} underline="hover">
            {locString}
          </Link>
        </TableCell>
        <TableCell align="right">{result.productSize} bp</TableCell>
        <TableCell>{result.strand}</TableCell>
        <TableCell>
          <IconButton
            size="small"
            onClick={() => navigator.clipboard.writeText(locString)}
            title="Copy location to clipboard"
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
          {result.sequence && (
            <IconButton
              size="small"
              onClick={handleCopySequence}
              title="Copy sequence to clipboard"
            >
              <ContentCopyIcon fontSize="small" color="secondary" />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => model.openOnUcsc(locString)}
            title="View on UCSC Genome Browser"
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>
      {result.sequence && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 1 }}>
                <Typography variant="caption" color="textSecondary">
                  PCR Product Sequence ({result.sequence.length} bp)
                </Typography>
                <div className={classes.sequenceBox}>{result.sequence}</div>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  )
})

const SearchResults = observer(function SearchResults({
  model,
}: {
  model: SequenceSearchModel
}) {
  const { classes } = useStyles()
  const { blatResults, isPcrResults, error, progress, mode } = model

  if (error) {
    return (
      <div className={classes.container}>
        <Typography color="error">{error}</Typography>
      </div>
    )
  }

  const hasResults =
    ((mode === 'blat' || mode === 'transBlat') && blatResults) ||
    (mode === 'isPcr' && isPcrResults)

  if (!hasResults) {
    if (progress) {
      return (
        <div className={classes.container}>
          <Typography>{progress}</Typography>
        </div>
      )
    }
    return null
  }

  if ((mode === 'blat' || mode === 'transBlat') && blatResults) {
    if (blatResults.length === 0) {
      return (
        <div className={classes.container}>
          <Typography>No matches found</Typography>
        </div>
      )
    }

    const resultLabel = mode === 'transBlat' ? 'transBlat' : 'BLAT'

    return (
      <div className={classes.container}>
        <div className={classes.header}>
          <Typography variant="subtitle2">
            {blatResults.length} {resultLabel} match
            {blatResults.length !== 1 ? 'es' : ''} found
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => model.createResultsTrack()}
          >
            Create Track
          </Button>
        </div>
        <BlatResults model={model} results={blatResults} />
      </div>
    )
  }

  if (mode === 'isPcr' && isPcrResults) {
    if (isPcrResults.length === 0) {
      return (
        <div className={classes.container}>
          <Typography>No PCR products found</Typography>
        </div>
      )
    }

    return (
      <div className={classes.container}>
        <div className={classes.header}>
          <Typography variant="subtitle2">
            {isPcrResults.length} PCR product
            {isPcrResults.length !== 1 ? 's' : ''} found
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => model.createResultsTrack()}
          >
            Create Track
          </Button>
        </div>
        <IsPcrResults model={model} results={isPcrResults} />
      </div>
    )
  }

  return null
})

export default SearchResults
