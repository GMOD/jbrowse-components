import { useCallback, useRef, useState } from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiVariantCrosshairs'
import LegendBar from '../../shared/components/MultiVariantLegendBar'
import TreeSidebar from '../../shared/components/TreeSidebar'

import type { MultiLinearVariantDisplayModel } from '../model'

const MultiLinearVariantDisplayComponent = observer(function (props: {
  model: MultiLinearVariantDisplayModel
}) {
  const { model } = props
  const ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>()
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>()

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    const clientX = event.clientX
    const clientY = event.clientY
    rafRef.current = requestAnimationFrame(() => {
      const rect = ref.current?.getBoundingClientRect()
      if (rect) {
        setMousePos({
          x: clientX - rect.left,
          y: clientY - rect.top,
        })
      }
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    setMousePos(undefined)
  }, [])

  return (
    <div ref={ref} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <TreeSidebar model={model} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
        }}
      >
        <BaseLinearDisplayComponent {...props} />
      </div>
      <LegendBar model={model} />

      {mousePos ? (
        <Crosshair mouseX={mousePos.x} mouseY={mousePos.y} model={model} />
      ) : null}
    </div>
  )
})

export default MultiLinearVariantDisplayComponent
