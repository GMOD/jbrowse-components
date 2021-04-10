/* eslint-disable no-nested-ternary */
import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
} from '@material-ui/core'
import { readConfObject } from '../configuration'
import { getSession } from '../util'
import { BaseCard, Attributes } from '../BaseFeatureWidget/BaseFeatureDetail'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

type FileInfo = Record<string, unknown> | string

export default function AboutDialog({
  model,
  handleClose,
}: {
  model: AnyConfigurationModel
  handleClose: () => void
}) {
  const [info, setInfo] = useState<FileInfo>()
  const [error, setError] = useState<Error>()
  const session = getSession(model)
  const { rpcManager } = session
  const sessionId = model.trackId
  const conf = readConfObject(model)

  useEffect(() => {
    const aborter = new AbortController()
    const { signal } = aborter
    let cancelled = false
    ;(async () => {
      try {
        const adapterConfig = readConfObject(model, 'adapter')
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

  let trackName = readConfObject(model, 'name')
  if (readConfObject(model, 'type') === 'ReferenceSequenceTrack') {
    trackName = 'Reference Sequence'
    session.assemblies.forEach(assembly => {
      if (assembly.sequence === model.configuration) {
        trackName = `Reference Sequence (${readConfObject(assembly, 'name')})`
      }
    })
  }

  const details =
    typeof info === 'string'
      ? {
          header: `<pre>${info
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</pre>`,
        }
      : info || {}
  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>{trackName}</DialogTitle>
      <DialogContent>
        <BaseCard title="Configuration">
          <Attributes
            attributes={conf}
            omit={['displays', 'baseUri', 'refNames']}
          />
        </BaseCard>
        {info !== null ? (
          <BaseCard title="File info">
            {error ? (
              <Typography color="error">{`${error}`}</Typography>
            ) : !info ? (
              'Loading file data...'
            ) : (
              <Attributes attributes={details} />
            )}
          </BaseCard>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
