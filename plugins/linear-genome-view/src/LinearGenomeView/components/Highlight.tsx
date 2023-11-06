import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { getSession, localStorageGetItem } from '@jbrowse/core/util'

import BookmarkIcon from '@mui/icons-material/Bookmark'

// locals
import { LinearGenomeViewModel } from '../model'
import { Tooltip } from '@mui/material'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    position: 'absolute',
    textAlign: 'center',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'start',
  },
})

const intensify = (rgba: string, opacity: number) => {
  const values = rgba.replace(/[^\d,.]/g, '').split(',')
  const originalOpacity = values.pop()
  // originalOpacity !== '0' assumes if the user has set the opacity of this highlight to 0, they probably don't want to see the label either
  const n = `rgba(${values.join(', ')}, ${
    originalOpacity !== '0' ? opacity : 0
  })`
  return n
}

export default observer(function Highlight({ model }: { model: LGV }) {
  const { classes } = useStyles()

  const { showBookmarkHighlights, showBookmarkLabels } = model
  const session = getSession(model)
  const assemblyNames = new Set(session.assemblyNames)

  const localStorageKeyF = () =>
    typeof window !== undefined
      ? `bookmarks-${[window.location.host + window.location.pathname].join(
          '-',
        )}`
      : 'empty'

  const localStorage = JSON.parse(
    localStorageGetItem(localStorageKeyF()) || '[]',
  )

  const [bookmarks, setBookmarks] = useState(
    localStorage.filter((value: any) => assemblyNames.has(value.assemblyName)),
  )

  window.addEventListener('storage', () => {
    setBookmarks(
      localStorage.filter((value: any) =>
        assemblyNames.has(value.assemblyName),
      ),
    )
  })

  useEffect(() => {
    setBookmarks(
      localStorage.filter((value: any) =>
        assemblyNames.has(value.assemblyName),
      ),
    )
  }, [localStorage?.length, JSON.stringify(localStorage)])

  return (
    <>
      {showBookmarkHighlights
        ? bookmarks
            .map((r: any) => {
              const s = model.bpToPx({
                refName: r.refName,
                coord: r.start,
              })
              const e = model.bpToPx({
                refName: r.refName,
                coord: r.end,
              })
              return s && e
                ? {
                    width: Math.max(Math.abs(e.offsetPx - s.offsetPx), 3),
                    left: Math.min(s.offsetPx, e.offsetPx) - model.offsetPx,
                    highlight: r.highlight,
                    label: r.label,
                  }
                : undefined
            })
            .filter(
              (
                f: any,
              ): f is { width: number; left: number; highlight: string } => !!f,
            )
            .map(({ left, width, highlight, label }: any, idx: number) => (
              <div
                key={`${left}_${width}_${idx}`}
                className={classes.highlight}
                style={{ left, width, background: highlight }}
              >
                {showBookmarkLabels ? (
                  <Tooltip title={label} arrow>
                    <BookmarkIcon
                      fontSize="small"
                      sx={{ color: `${intensify(highlight, 0.8)}` }}
                    />
                  </Tooltip>
                ) : null}
              </div>
            ))
        : null}
    </>
  )
})
