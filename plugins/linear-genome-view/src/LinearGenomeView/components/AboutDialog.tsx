/* eslint-disable react/prop-types,@typescript-eslint/no-explicit-any,no-nested-ternary */
import React, { useState, useEffect } from 'react'
import { readConfObject, getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Tooltip,
  Typography,
} from '@material-ui/core'
import ExpandMore from '@material-ui/icons/ExpandMore'
import { makeStyles } from '@material-ui/core/styles'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import isObject from 'is-object'

export const useStyles = makeStyles(theme => ({
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
  expandIcon: {
    color: '#FFFFFF',
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
    <Accordion style={{ marginTop: '4px' }} defaultExpanded>
      <AccordionSummary
        expandIcon={<ExpandMore className={classes.expandIcon} />}
      >
        <Typography variant="button"> {title}</Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.expansionPanelDetails}>
        {children}
      </AccordionDetails>
    </Accordion>
  )
}

const omit = ['refNames', 'displays', 'baseUri']
interface AttributeProps {
  attributes: Record<string, any>
  omit?: string[]
  prepend?: string
  formatter?: (val: unknown) => JSX.Element
  descriptions?: Record<string, React.ReactNode>
}

export const Attributes: React.FunctionComponent<AttributeProps> = props => {
  const classes = useStyles()
  const {
    attributes,
    prepend = '',
    omit: propOmit = [],
    formatter = (value: unknown) => (
      <SanitizedHTML
        html={isObject(value) ? JSON.stringify(value) : String(value)}
      />
    ),
    descriptions,
  } = props

  const tags: string[] = Object.values(attributes)
    .filter(val => val !== undefined)
    .map(val => {
      return val.tag
    })
    .filter(val => !!val)

  const counts = tags.reduce((accum, entry) => {
    if (!accum[entry]) accum[entry] = 1
    else accum[entry]++
    return accum
  }, {} as { [key: string]: number })
  const hidden = Object.entries(counts)
    .filter(([_, value]) => {
      return value > 50
    })
    .map(entry => entry[0])
  const [currHidden, setCurrHidden] = useState(hidden)

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
            return currHidden.includes(value.tag) ? null : (
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
      {hidden.length ? (
        <>
          {currHidden.length ? (
            <>
              <Typography color="textSecondary">
                {`Note: Some entries were hidden (${currHidden}), click button below to reveal`}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setCurrHidden([])}
              >
                {`Show ${currHidden}`}
              </Button>
            </>
          ) : (
            <Button
              color="primary"
              variant="contained"
              onClick={() => setCurrHidden(hidden)}
            >{`Hide ${hidden}`}</Button>
          )}
        </>
      ) : null}
    </>
  )
}

type FileInfo = Record<string, unknown> | string

export default function AboutDialog({
  model,
  handleClose,
}: {
  model: BaseTrackModel
  handleClose: () => void
}) {
  const [info, setInfo] = useState<FileInfo>()
  const [error, setError] = useState<Error>()
  const conf = getConf(model)
  const session = getSession(model)
  const { rpcManager } = session
  const sessionId = getRpcSessionId(model)

  useEffect(() => {
    const aborter = new AbortController()
    const { signal } = aborter
    let cancelled = false
    ;(async () => {
      try {
        const adapterConfig = getConf(model, 'adapter')
        const result = await rpcManager.call(sessionId, 'CoreGetInfo', {
          adapterConfig,
          signal,
        })
        if (!cancelled) {
          setInfo(result as FileInfo)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e)
        }
      }
    })()

    return () => {
      aborter.abort()
      cancelled = true
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
          <Attributes attributes={conf} />
        </BaseCard>
        {info !== null ? (
          <BaseCard title="File info">
            {error ? (
              <Typography color="error">{`${error}`}</Typography>
            ) : info === undefined ? (
              'Loading file data...'
            ) : (
              <Attributes
                attributes={
                  typeof info === 'string'
                    ? {
                        header: `<pre>${info
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')}</pre>`,
                      }
                    : info
                }
              />
            )}
          </BaseCard>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
