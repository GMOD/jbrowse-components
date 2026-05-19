import { assembleLocString } from '../../util/index.ts'
import { getStrandStr } from '../util.tsx'

import type { BaseProps } from '../types.tsx'

export default function Position(props: BaseProps) {
  const { feature } = props
  const loc = assembleLocString(feature)
  return <>{`${loc} ${getStrandStr(feature.strand)}`}</>
}
