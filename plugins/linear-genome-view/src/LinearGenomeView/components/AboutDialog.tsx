/* eslint-disable react/prop-types,@typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react'
import { getSnapshot } from 'mobx-state-tree'
import { readConfObject, getConf } from '@gmod/jbrowse-core/configuration'
import { getSession } from '@gmod/jbrowse-core/util'
import { getRpcSessionId } from '@gmod/jbrowse-core/util/tracks'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import Typography from '@material-ui/core/Typography'
import ExpandMore from '@material-ui/icons/ExpandMore'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import Tooltip from '@material-ui/core/Tooltip'
import SanitizedHTML from '@gmod/jbrowse-core/ui/SanitizedHTML'
import isObject from 'is-object'
import { BaseTrackModel } from '../../BasicTrack/baseTrackModel'

export const useStyles = makeStyles(theme => ({
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
  expandIcon: {
    color: '#FFFFFF',
  },
  paperRoot: {
    background: theme.palette.grey[100],
  },
  field: {
    display: 'flex',
  },
  fieldName: {
    wordBreak: 'break-all',
    minWidth: 100,
    maxWidth: 350,
    borderBottom: '1px solid #0003',
    backgroundColor: theme.palette.grey[200],
    marginRight: theme.spacing(1),
    padding: theme.spacing(0.5),
  },
  fieldValue: {
    wordBreak: 'break-word',
    maxHeight: 300,
    padding: theme.spacing(0.5),
    overflow: 'auto',
  },
  fieldSubvalue: {
    wordBreak: 'break-word',
    maxHeight: 300,
    padding: theme.spacing(0.5),
    backgroundColor: theme.palette.grey[100],
    border: `1px solid ${theme.palette.grey[300]}`,
    boxSizing: 'border-box',
    overflow: 'auto',
  },
}))

interface BaseCardProps {
  title: string
}

export const BaseCard: React.FunctionComponent<BaseCardProps> = props => {
  const classes = useStyles()
  const { children, title } = props
  return (
    <ExpansionPanel style={{ marginTop: '4px' }} defaultExpanded>
      <ExpansionPanelSummary
        expandIcon={<ExpandMore className={classes.expandIcon} />}
      >
        <Typography variant="button"> {title}</Typography>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails className={classes.expansionPanelDetails}>
        {children}
      </ExpansionPanelDetails>
    </ExpansionPanel>
  )
}

const omit = ['refNames']
interface AttributeProps {
  attributes: Record<string, any>
  omit?: string[]
  prepend?: string
  formatter?: (val: unknown) => JSX.Element
  descriptions?: Record<string, React.ReactNode>
  showHidden?: boolean
}

export const Attributes: React.FunctionComponent<AttributeProps> = props => {
  const classes = useStyles()
  const {
    attributes,
    prepend = '',
    omit: propOmit = [],
    showHidden = false,
    formatter = (value: unknown) => (
      <SanitizedHTML
        html={isObject(value) ? JSON.stringify(value) : String(value)}
      />
    ),
    descriptions,
  } = props

  const SimpleValue = ({ name, value }: { name: string; value: any }) => {
    const description = descriptions && descriptions[name]
    return (
      <div style={{ display: 'flex' }}>
        {description ? (
          <Tooltip title={description} placement="left">
            <div className={classes.fieldName}>{name}</div>
          </Tooltip>
        ) : (
          <div className={classes.fieldName}>{name}</div>
        )}
        <div className={classes.fieldValue}>{formatter(value)}</div>
      </div>
    )
  }
  const ArrayValue = ({ name, value }: { name: string; value: any[] }) => {
    const description = descriptions && descriptions[name]

    return (
      <div style={{ display: 'flex' }}>
        {description ? (
          <Tooltip title={description} placement="left">
            <div className={classes.fieldName}>{name}</div>
          </Tooltip>
        ) : (
          <div className={classes.fieldName}>{name}</div>
        )}
        {value.map((val, i) => (
          <div key={`${name}-${i}`} className={classes.fieldSubvalue}>
            {formatter(val)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {Object.entries(attributes)
        .filter(
          ([k, v]) =>
            v !== undefined && !omit.includes(k) && !propOmit.includes(k),
        )

        .map(([key, value], index) => {
          if (value.tag && value.data) {
            return value.hidden && !showHidden ? null : (
              <SimpleValue
                key={`${value.tag}_${index}`}
                name={value.tag}
                value={value.data}
              />
            )
          }
          if (Array.isArray(value)) {
            return value.length === 1 ? (
              <SimpleValue
                key={key}
                name={`${prepend ? `${prepend}.` : ''}${key}`}
                value={value[0]}
              />
            ) : (
              <ArrayValue
                key={key}
                name={`${prepend ? `${prepend}.` : ''}${key}`}
                value={value}
              />
            )
          }
          if (isObject(value)) {
            return (
              <Attributes
                key={key}
                attributes={value}
                descriptions={descriptions}
                prepend={`${prepend ? `${prepend}.` : ''}${key}`}
              />
            )
          }

          return (
            <SimpleValue
              key={key}
              name={`${prepend ? `${prepend}.` : ''}${key}`}
              value={value}
            />
          )
        })}
    </>
  )
}

export default function AboutDialog({
  model,
  handleClose,
}: {
  model: BaseTrackModel
  handleClose: () => void
}) {
  const [info, setInfo] = useState<Record<string, any>>()
  const [showHidden, setShowHidden] = useState(false)
  const data = getSnapshot(model.configuration)
  const session = getSession(model)
  const { rpcManager } = session
  const sessionId = getRpcSessionId(model)

  useEffect(() => {
    const aborter = new AbortController()
    ;(async () => {
      const result = (await rpcManager.call(sessionId, 'CoreGetInfo', {
        adapterConfig: getSnapshot(model.configuration.adapter),
        signal: aborter.signal,
      })) as Record<string, unknown>
      setInfo(result)
    })()
    return () => {
      aborter.abort()
    }
  }, [model, rpcManager, sessionId])

  let trackName = getConf(model, 'name')
  if (getConf(model, 'type') === 'ReferenceSequenceTrack') {
    trackName = 'Reference Sequence'
    session.assemblies.forEach(assembly => {
      if (assembly.sequence === model.configuration) {
        trackName = `Reference Sequence (${readConfObject(assembly, 'name')})`
      }
    })
  }
  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{trackName}</DialogTitle>
      <DialogContent>
        <BaseCard title="Configuration">
          <Attributes attributes={data} />
        </BaseCard>
        {info !== null ? (
          <BaseCard title="File info">
            {info === undefined ? (
              'Loading file data...'
            ) : (
              <Attributes attributes={info} showHidden={showHidden} />
            )}
            <Button onClick={() => setShowHidden(hidden => !hidden)}>
              {!showHidden ? 'Show hidden entries' : 'Hide hidden entries'}
            </Button>
          </BaseCard>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
