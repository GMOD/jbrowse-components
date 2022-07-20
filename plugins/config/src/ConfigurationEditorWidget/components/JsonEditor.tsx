import React, { lazy, useEffect, useState } from 'react'
import { useDebounce } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  error: {
    color: 'red',
    fontSize: '0.8em',
  },
})

const CodeEditor = lazy(() => import('./CodeEditor'))

function JsonEditor({
  slot,
}: {
  slot: {
    name: string
    description: string
    value: unknown
    set: (arg: unknown) => void
  }
}) {
  const { classes } = useStyles()
  const [contents, setContents] = useState(JSON.stringify(slot.value, null, 2))
  const [error, setError] = useState<unknown>()
  const debouncedJson = useDebounce(contents, 400)

  useEffect(() => {
    try {
      slot.set(JSON.parse(debouncedJson))
      setError(undefined)
    } catch (e) {
      setError(e)
    }
  }, [debouncedJson, slot])

  return (
    <>
      {error ? <p className={classes.error}>{`${error}`}</p> : null}
      <React.Suspense fallback={<div />}>
        <CodeEditor contents={contents} setContents={setContents} />
      </React.Suspense>
    </>
  )
}

export default observer(JsonEditor)
