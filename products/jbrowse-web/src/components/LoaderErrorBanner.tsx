import { ErrorBanner } from '@jbrowse/core/ui'
import { Button } from '@mui/material'

import factoryReset from '../factoryReset.ts'
import NoConfigMessage from './NoConfigMessage.tsx'

export default function LoaderErrorBanner({ error }: { error: unknown }) {
  return /HTTP 404 fetching config.json/.test(`${error}`) ? (
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
        <a href="?config=test_data/volvox/config.json">here</a>. To see what
        JBrowse 2 can do, explore the{' '}
        <a href="https://jbrowse.org/jb2/gallery/">visualization gallery</a> and{' '}
        <a href="https://jbrowse.org/jb2/demos/">live demos</a>.
      </p>
      {process.env.NODE_ENV === 'development' ? <NoConfigMessage /> : null}
    </div>
  ) : (
    <div>
      <h1>JBrowse Error</h1>
      <ErrorBanner error={error} />
      {/* the only way out of this screen: it renders instead of the app, so
      there is no menu to reach. Reloading as-is just fails the same way when
      the cause is in the URL (a bad ?config=, a session= that won't load), so
      the escape hatch is the bare url */}
      <Button
        variant="contained"
        style={{ margin: 20 }}
        onClick={() => {
          factoryReset()
        }}
      >
        Start over without URL options
      </Button>
    </div>
  )
}
