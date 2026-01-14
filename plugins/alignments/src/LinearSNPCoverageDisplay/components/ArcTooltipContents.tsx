import { toLocale } from '@jbrowse/core/util'

import { getStrandLabel } from './arcUtils.ts'

import type { ArcData } from './arcUtils.ts'

export default function ArcTooltipContents({ arc }: { arc: ArcData }) {
  return (
    <div>
      <div>
        <strong>Intron/Skip</strong>
      </div>
      <div>
        Location: {arc.refName}:{toLocale(arc.start)}-{toLocale(arc.end)}
      </div>
      <div>Length: {toLocale(arc.end - arc.start)} bp</div>
      <div>Reads supporting junction: {arc.score}</div>
      <div>Strand: {getStrandLabel(arc.strand)}</div>
    </div>
  )
}
