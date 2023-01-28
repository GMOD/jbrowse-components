import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

export function matches(
  query: string,
  conf: AnyConfigurationModel,
  session: AbstractSessionModel,
) {
  const categories = readConfObject(conf, 'category') as string[] | undefined
  const queryLower = query.toLowerCase()
  return (
    getTrackName(conf, session).toLowerCase().includes(queryLower) ||
    !!categories?.filter(c => c.toLowerCase().includes(queryLower)).length
  )
}
