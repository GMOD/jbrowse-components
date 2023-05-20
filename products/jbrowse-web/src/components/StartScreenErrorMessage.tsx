import React from 'react'
import { ErrorMessage } from '@jbrowse/core/ui'
import NoConfigMessage from './NoConfigMessage'

export default function StartScreenErrorMessage({ error }: { error: unknown }) {
  return (
    <>
      <NoConfigMessage />
      {`${error}`.match(/HTTP 404 fetching config.json/) ? (
        <div
          style={{
            margin: 8,
            padding: 8,
            border: '1px solid black',
            background: '#9f9',
          }}
        >
          No config.json found. If you want to learn how to complete your setup,
          visit our{' '}
          <a href="https://jbrowse.org/jb2/docs/quickstart_web/">
            quick start guide
          </a>
          .
        </div>
      ) : (
        <ErrorMessage error={error} />
      )}
    </>
  )
}
