import { useEffect } from 'react'

import { createWheelZoomController } from '@jbrowse/core/util/wheelZoom'

import type { WheelZoomView } from '@jbrowse/core/util/wheelZoom'
import type React from 'react'

interface GenomeViewModel extends WheelZoomView {
  scrollZoom?: boolean
}

export function useWheelScroll(
  ref: React.RefObject<HTMLDivElement | null>,
  model: GenomeViewModel,
) {
  useEffect(() => {
    const curr = ref.current
    return curr
      ? createWheelZoomController({
          element: curr,
          resolveTarget: () => ({
            views: [model],
            scrollZoom: !!model.scrollZoom,
            originElement: () => curr,
          }),
        })
      : undefined
  }, [model, ref])
}
