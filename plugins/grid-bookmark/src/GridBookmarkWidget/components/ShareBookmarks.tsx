import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'

import { Button } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import copy from 'copy-to-clipboard'

import { getSession } from '@jbrowse/core/util'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import { shareSessionToDynamo } from '@jbrowse/web/src/sessionSharing'

// locals
import { GridBookmarkModel } from '../model'

const useStyles = makeStyles()(() => ({
  flexItem: {
    margin: 5,
  },
}))

function ShareBookmarks({ model }: { model: GridBookmarkModel }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const session = getSession(model)
  const { selectedBookmarks } = model
  const bookmarksToShare =
    selectedBookmarks.length === 0
      ? model.allBookmarksModel
      : model.sharedBookmarksModel

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setLoading(true)
        const snap = getSnapshot(bookmarksToShare)

        const locationUrl = new URL(window.location.href)
        const result = await shareSessionToDynamo(
          snap,
          session.shareURL,
          locationUrl.href,
        )
        if (!cancelled) {
          const params = new URLSearchParams(locationUrl.search)
          params.set('bookmarks', `share-${result.json.sessionId}`)
          params.set('password', result.password)
          locationUrl.search = params.toString()
          setUrl(locationUrl.href)
          setLoading(false)
        }
      } catch (e) {
        session.notify(`${e}`, 'error')
      } finally {
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bookmarksToShare, session])

  return (
    <>
      <Button
        disabled={loading}
        startIcon={<ContentCopyIcon />}
        onClick={async () => {
          copy(url)
          session.notify('Copied to clipboard', 'success')
        }}
      >
        Share
      </Button>
    </>
  )
}

export default observer(ShareBookmarks)
