import React from 'react'
import { ErrorMessage } from '@jbrowse/core/ui'
import NoConfigMessage from './NoConfigMessage'

export default function StartScreenErrorMessage({ error }: { error: unknown }) {
  return /HTTP 404 fetching config.json/.exec(`${error}`) ? (
    <div>
      <h1>It worked!</h1>
      <p
        style={{
          margin: 8,
          padding: 8,
          background: '#9f9',
          border: '1px solid green',
        }}
      >
        JBrowse 2 is installed. Your next step is to add and configure an
        assembly. Follow our{' '}
        <a href="https://jbrowse.org/jb2/docs/quickstart_web/">
          quick start guide
        </a>{' '}
        to continue or browse the sample data{' '}
        <a href="?config=test_data/volvox/config.json">here</a>.
      </p>
      {process.env.NODE_ENV === 'development' ? <NoConfigMessage /> : null}
    </div>
  ) : (
    <div>
      <h1>JBrowse Error</h1>
      <ErrorMessage error={error} />
    </div>
  )
}
