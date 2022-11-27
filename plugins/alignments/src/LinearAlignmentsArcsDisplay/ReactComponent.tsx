import React, { useRef, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { LinearAlignmentsArcsDisplayModel } from './model'

type LGV = LinearGenomeViewModel

const height = 500

function LinearAlignmentsArcDisplay(args: {
  model: LinearAlignmentsArcsDisplayModel
}) {
  const { model } = args
  const view = getContainingView(model) as LGV
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) {
      return
    }
    const width = canvas.getBoundingClientRect().width * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    canvas.width = width
    ctx.clearRect(0, 0, width, height)
    ctx.scale(2, 2)
    const map = {} as { [key: string]: any[] }

    // pair features
    model.arcFeatures
      ?.filter(f => f.flags & 1)
      .forEach(f => {
        if (!map[f.name]) {
          map[f.name] = []
        }
        map[f.name].push(f)
      })

    Object.values(map)
      .filter(val => val.length === 2)
      .forEach(val => {
        const [v0, v1] = val
        const sameRef = v0.refName === v1.refName
        if (sameRef) {
          const s = Math.min(v0.start, v1.start)
          const e = Math.max(v0.end, v1.end)
          const r1 = view.bpToPx({ refName: v0.refName, coord: s })
          const r2 = view.bpToPx({ refName: v0.refName, coord: e })

          if (!r1 || !r2) {
            return
          }
          const radius = (r2.offsetPx - r1.offsetPx) / 2
          const absrad = Math.abs(radius)
          ctx.beginPath()
          ctx.strokeStyle = `hsl(${Math.log10(Math.abs(e - s)) * 10},50%,50%)`
          const p = r1.offsetPx - view.offsetPx
          ctx.moveTo(p, 0)
          ctx.arc(p + radius, 0, absrad, 0, Math.PI)
          ctx.stroke()
        }
      })
  }, [model.arcFeatures, view, JSON.stringify(view.coarseDynamicBlocks)])

  return (
    <canvas ref={ref} style={{ width: '100%', height }} height={height * 2} />
  )
}

export default observer(LinearAlignmentsArcDisplay)
