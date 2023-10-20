import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { getSession, localStorageGetItem } from '@jbrowse/core/util'

// locals
import { LinearGenomeViewModel } from '../model'
import { number } from 'prop-types'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    position: 'absolute',
    textAlign: 'center',
    overflow: 'hidden',
  },
})

export default observer(function Highlight({ model }: { model: LGV }) {
  const { classes } = useStyles()

  const { showBookmarkHighlights } = model
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
                  }
                : undefined
            })
            .filter(
              (
                f: any,
              ): f is { width: number; left: number; highlight: string } => !!f,
            )
            .map(({ left, width, highlight }: any, idx: number) => (
              <div
                key={`${left}_${width}_${idx}`}
                className={classes.highlight}
                style={{ left, width, background: highlight }}
              />
            ))
        : null}
    </>
  )
})
