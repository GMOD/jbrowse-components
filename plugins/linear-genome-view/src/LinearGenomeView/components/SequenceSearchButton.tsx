import React, { useState, useEffect } from 'react'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import Button from '@material-ui/core/Button'
import CloseIcon from '@material-ui/icons/Close'
import Search from '@material-ui/icons/Search'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { LinearGenomeViewModel } from '..'
import bucketmap from './bigsi/bigsis/hg38_16int_bucket_map.json'

/* eslint-disable no-nested-ternary */
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
} from '@material-ui/core'


const WIDGET_HEIGHT = 32
const SPACING = 7

const useStyles = makeStyles(theme => ({
  sequenceSearchButton: {
    background: fade(theme.palette.background.paper, 0.8),
    height: WIDGET_HEIGHT,
    margin: SPACING,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  dialogContent: {
    width: '80em',
  },
}))


function makeBigsiHitsFeatures(
  self: LinearGenomeViewModel,
  response: any,
) {

  const refName = '1'
  //const numBuckets = 32 // needed for computing feature glpyh length

  let uniqueId = 0
  let allFeatures = []

  for (let bucket in response) {
    const bigsiFeatures = response[bucket]
    bigsiFeatures.uniqueId = uniqueId
    bigsiFeatures.bucketStart = bucketmap[bucket].bucketStart
    bigsiFeatures.bucketEnd = bucketmap[bucket].bucketEnd
    bigsiFeatures.name = `${bucketmap[bucket].refName}:${bucketmap[bucket].bucketStart}-${bucketmap[bucket].bucketEnd}`
    bigsiFeatures.refName = refName
    allFeatures.push(bigsiFeatures)
    uniqueId++
    }

  return allFeatures
}

function SequenceSearchButton({ model }: { model: LinearGenomeViewModel }) {
  const classes = useStyles()

  const session = getSession(model)
  const { rpcManager, assemblyManager } = session

  const [trigger, setTrigger] = useState(false);
  const [sequence, setSequence] = useState("");
  const [results, setResults] = useState();

  return (
    <>
      <Button
        variant="outlined"
        className={classes.sequenceSearchButton}
        onClick={() => setTrigger(true)}
      >
        <Search />
      </Button>

      <Dialog 
        maxWidth="xl"
        open={trigger} 
        onClose={() => setTrigger(false)}>

          <DialogTitle>
            Sequence Search
            {trigger ? (
              <IconButton className={classes.closeButton} onClick={() => setTrigger(false)}>
                <CloseIcon />
              </IconButton>
            ) : null}
          </DialogTitle>
          <Divider />

        <>
            <DialogContent>
              <DialogContentText>
                Paste your sequence below to search against the reference.
              </DialogContentText>

            <TextField
                label="Query Sequence"
                variant="outlined"
                value={sequence}
                multiline
                rows={3}
                rowsMax={5}
                fullWidth
                className={classes.dialogContent}
                onChange={() => setSequence(event.target.value)}
            />
            </DialogContent>
        </>
        <DialogActions>
            <Button
            onClick={async () => {
                const sessionId = 'bigsiQuery'
                const querySequence = sequence.replace(/\r?\n|\r/g, '')
                console.log(querySequence)
                const params = {
                    sessionId,
                    querySequence
                }
                //console.log(params)
                const results = await rpcManager.call(
                sessionId,
                "BigsiQueryRPC",
                params
                );
                console.log(results);
                setResults(results);
                const allFeatures = makeBigsiHitsFeatures(model, results)
                console.log('bucket map', allFeatures)
                setTrigger(false) // closes the dialog if you want, or skip this and display the results in the dialog
            }}
            >
            Submit
            </Button>

            <Button onClick={() => setTrigger(false)} color="primary" autoFocus>
              Close
            </Button>
          </DialogActions>
      </Dialog>

      </>
      )
  }
  

export default observer(SequenceSearchButton)
