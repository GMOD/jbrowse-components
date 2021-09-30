import React, { useState, useEffect } from 'react'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import Button from '@material-ui/core/Button'
import { makeStyles } from '@material-ui/core/styles'
import Search from '@material-ui/icons/Search'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { LinearGenomeViewModel } from '..'

/* eslint-disable no-nested-ternary */
import {
  Dialog,
} from '@material-ui/core'

const WIDGET_HEIGHT = 32
const SPACING = 7

const useStyles = makeStyles(theme => ({
  sequenceSearchButton: {
    background: fade(theme.palette.background.paper, 0.8),
    height: WIDGET_HEIGHT,
    margin: SPACING,
  },
}))

function SequenceSearchButton({ model }: { model: LinearGenomeViewModel }) {
  const classes = useStyles()

  const session = getSession(model)
  const { rpcManager, assemblyManager } = session

  const [trigger, setTrigger] = useState(false);
  const [sequence, setSequence] = useState("");
  const [results, setResults] = useState();

  return (
    <div>
      <Button
        variant="outlined"
        className={classes.sequenceSearchButton}
        onClick={() => setTrigger(true)}
      >
        <Search />
      </Button>
      <Dialog open={trigger} onClose={() => setTrigger(false)}>
        <p>Enter your sequence here</p>
        <input
          type="textarea"
          value={sequence}
          onChange={() => setSequence(event.target.value)}
        />
        <Button
          onClick={async () => {
            const sessionId = 'bigsiQuery'
            const querySequence = sequence
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
            setTrigger(false) // closes the dialog if you want, or skip this and display the results in the dialog
          }}
        >
          Submit
        </Button>
      </Dialog>
    </div>
  )
}

export default observer(SequenceSearchButton)
