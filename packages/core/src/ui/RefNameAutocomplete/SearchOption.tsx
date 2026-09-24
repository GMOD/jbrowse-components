import { ListItemText } from '@mui/material'
import { observer } from 'mobx-react'

import { getTrackName } from '../../util/tracks.ts'
import { optionDetail } from './util.ts'

import type { Assembly } from '../../assemblyManager/assembly.ts'
import type { TrackCatalog } from '../../util/index.ts'
import type { Option } from './util.ts'
import type { HTMLAttributes, Key } from 'react'

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
  const { key, ...rest } = props
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
    <li key={key} {...rest}>
      <ListItemText
        primary={result.getDisplayString()}
        secondary={detail}
        slotProps={{
          primary: { noWrap: true },
          secondary: { noWrap: true },
        }}
      />
    </li>
  )
})

export default SearchOption
