import React, { useEffect, useMemo, useState } from 'react'
import { observer } from 'mobx-react'
import { Region } from '@jbrowse/core/util/types'
import { readConfObject } from '@jbrowse/core/configuration'
import { makeStyles } from '@material-ui/core/styles'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Container,
  Typography,
  Divider,
  IconButton,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { getSession } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { LinearGenomeViewModel } from '..'
import queryBigsi from './bigsi/query_bigsi'
//import bigsi from './bigsi/bigsis/hg38_chr1and2.json'
//import hexBigsi from './bigsi/bigsis/hg38_hex.json'
//import bucketmap from './bigsi/bigsis/hg38_bucket_map.json'
import bucketmap from './bigsi/bigsis/hg38_16int_bucket_map.json'

const useStyles = makeStyles(theme => ({
  loadingMessage: {
    padding: theme.spacing(5),
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
  textAreaFont: {
    fontFamily: 'Courier New',
  },
}))

function makeBigsiHitsFeatures(
  self: LinearGenomeViewModel,
  response: any,
) {

  const refName =
    self.leftBigsiOffset?.refName || self.rightBigsiOffset?.refName || ''

  const numBuckets = 10
  const featureLength = (self.rightBigsiOffset.coord - self.leftBigsiOffset.coord)/numBuckets

  let uniqueId = 0
  let allFeatures = []
  for (let bucket in response) {
    const bigsiFeatures = response[bucket]
    bigsiFeatures.uniqueId = uniqueId
    bigsiFeatures.bucketStart = bucketmap[bucket].bucketStart
    bigsiFeatures.bucketEnd = bucketmap[bucket].bucketEnd
    bigsiFeatures.name = `${bucketmap[bucket].refName}:${bucketmap[bucket].bucketStart}-${bucketmap[bucket].bucketEnd}`
    bigsiFeatures.start = self.leftBigsiOffset.coord + (parseInt(bucket%10) * featureLength)
    bigsiFeatures.end = bigsiFeatures.start + featureLength - 1
    bigsiFeatures.refName = refName
    allFeatures.push(bigsiFeatures)
    uniqueId++
    }

  return allFeatures
}

async function getBigsiHitsFeatures(
  self: LinearGenomeViewModel,
  query: string,
) {
    
  const response = await queryBigsi.runBinaryBigsiQuery(query)
       
  const allFeatures = makeBigsiHitsFeatures(self, response)

  return allFeatures
}

function constructBigsiTrack(
    self: LinearGenomeViewModel,
    allFeatures,
){
    const refName =
      self.leftBigsiOffset?.refName || self.rightBigsiOffset?.refName || ''
    const assemblyName = 
      self.leftBigsiOffset?.assemblyName || self.rightBigsiOffset?.assemblyName

    const bigsiQueryTrack = {
            trackId: `track-${Date.now()}`,
            name: `Sequence Search ${assemblyName}:Chr${refName}:${self.leftBigsiOffset.coord}-${self.rightBigsiOffset.coord}`,
            assemblyNames: ['hg38'],
            type: 'FeatureTrack',
            adapter: {
                type: 'FromConfigAdapter',
                features: allFeatures,
                //features: [ { "refName": "1", "start":1, "end":200000, "uniqueId": "id1" }],
                },
            }

    const session = getSession(self)
    session.addTrackConf(bigsiQueryTrack)

    self.showTrack(bigsiQueryTrack.trackId)
    //console.log(response)

}

/**
 * Fetches and returns a list features for a given list of regions
 * @param selectedRegions - Region[]
 * @returns Features[]
 */
export async function fetchSequence(
  self: LinearGenomeViewModel,
  selectedRegions: Region[],
) {
  const session = getSession(self)
  const assemblyName =
    self.leftBigsiOffset?.assemblyName || self.rightBigsiOffset?.assemblyName || ''
  const { rpcManager, assemblyManager } = session
  const assemblyConfig = assemblyManager.get(assemblyName)?.configuration

  // assembly configuration
  const adapterConfig = readConfObject(assemblyConfig, ['sequence', 'adapter'])

  const sessionId = 'getSequence'
  const chunks = (await Promise.all(
    selectedRegions.map(region =>
      rpcManager.call(sessionId, 'CoreGetFeatures', {
        adapterConfig,
        region,
        sessionId,
      }),
    ),
  )) as Feature[][]


  // assumes that we get whole sequence in a single getFeatures call
  return chunks.map(chunk => chunk[0])
}

function BigsiDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const classes = useStyles()
  const session = getSession(model)
  const [error, setError] = useState<Error>()
  const [sequence, setSequence] = useState('')
  const loading = Boolean(!sequence) || Boolean(error)
  const { leftBigsiOffset, rightBigsiOffset } = model

  // avoid infinite looping of useEffect
  // random note: the current selected region can't be a computed because it
  // uses action on base1dview even though it's on the ephemeral base1dview
  const regionsSelected = useMemo(
    () => model.getSelectedRegions(leftBigsiOffset, rightBigsiOffset),
    [model, leftBigsiOffset, rightBigsiOffset],
  )

  console.log('regionsSelected', regionsSelected)

  useEffect(() => {
    let active = true


    ;(async () => {
      try {
        if (regionsSelected.length > 0) {
          const chunks = (await fetchSequence(model, regionsSelected))[0].data.seq
          if (active) {
            const allFeatures = await getBigsiHitsFeatures(model, chunks)
            console.log('allFeatures ', allFeatures)
            constructBigsiTrack(model, allFeatures)
            setSequence(chunks)
          }
        } else {
          throw new Error('Selected region is out of bounds')
        }
      } catch (e) {
        console.error(e)
        if (active) {
          setError(e)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [model, session, regionsSelected, setSequence])

  const sequenceTooLarge = sequence.length > 300_000

  return (
    <Dialog
      data-testid="bigsi-dialog"
      maxWidth="xl"
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        Sequence Search
        {handleClose ? (
          <IconButton
            data-testid="close-BigsiDialog"
            className={classes.closeButton}
            onClick={() => {
              handleClose()
              model.setBigsiOffsets(undefined, undefined)
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <Divider />

      <DialogContent>
        {error ? <Typography color="error">{`${error}`}</Typography> : null}
        {loading && !error ? (
          <Container> 
            Retrieving search hits...

            <CircularProgress
              style={{
                marginLeft: 10,
              }}
              size={20}
              disableShrink
            />
          </Container>
        ) : <Container> Query complete! </Container> }
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
            model.setBigsiOffsets(undefined, undefined)
          }}
          color="primary"
          autoFocus
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(BigsiDialog)
