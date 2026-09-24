import { observer } from 'mobx-react'

import { getTrackName } from '../../util/tracks.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import { optionDetail } from './util.ts'

import type { Assembly } from '../../assemblyManager/assembly.ts'
import type { TrackCatalog } from '../../util/index.ts'
import type { Option } from './util.ts'
import type { HTMLAttributes, Key } from 'react'

const useStyles = makeStyles()(theme => ({
  row: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(2),
  },
  label: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  detail: {
    marginLeft: 'auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.8em',
    color: theme.palette.text.secondary,
  },
}))

const SearchOption = observer(function SearchOption({
  props,
  option,
  session,
  assembly,
}: {
  props: HTMLAttributes<HTMLLIElement> & { key: Key }
  option: Option
  session: TrackCatalog
  assembly?: Assembly
}) {
  const { classes, cx } = useStyles()
  const { key, className, ...rest } = props
  const { result } = option
  const detail = optionDetail(result, {
    trackNameOf: trackId => {
      const conf = session.getTrackById(trackId)
      return conf ? getTrackName(conf, session) : undefined
    },
    lengthOf: refName => {
      const index = assembly?.refNameToIndex?.get(refName)
      const region =
        index === undefined ? undefined : assembly?.regions?.[index]
      return region ? region.end - region.start : undefined
    },
  })
  return (
    <li key={key} className={cx(className, classes.row)} {...rest}>
      <span className={classes.label}>{result.getDisplayString()}</span>
      {detail ? <span className={classes.detail}>{detail}</span> : null}
    </li>
  )
})

export default SearchOption
