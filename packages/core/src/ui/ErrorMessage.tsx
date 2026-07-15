import RefreshIcon from '@mui/icons-material/Refresh'
import { Button } from '@mui/material'

import RedErrorMessageBox from './RedErrorMessageBox.tsx'

// chunk load failures usually mean a stale asset manifest (e.g. server
// redeploy) or a network hiccup; a reload fetches the current chunks
function isChunkLoadError(error: unknown) {
  const name = error instanceof Error ? error.name : ''
  const message = `${error}`.toLowerCase()
  return (
    name === 'ChunkLoadError' ||
    (message.includes('loading') &&
      message.includes('chunk') &&
      message.includes('failed')) ||
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module')
  )
}

export default function ErrorMessage({ error }: { error: unknown }) {
  return isChunkLoadError(error) ? (
    <RedErrorMessageBox>
      <div>
        Failed to load part of the application, likely due to a server update or
        network error. Refreshing the page usually fixes it.
      </div>
      <Button
        variant="contained"
        startIcon={<RefreshIcon />}
        onClick={() => {
          window.location.reload()
        }}
        style={{ margin: 4 }}
      >
        Refresh page
      </Button>
      <div>{`${error}`}</div>
    </RedErrorMessageBox>
  ) : (
    <RedErrorMessageBox>{`${error}`}</RedErrorMessageBox>
  )
}
