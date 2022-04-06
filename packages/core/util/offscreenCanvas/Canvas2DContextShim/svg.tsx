import Canvas2DContextShim from '.'
import React from 'react'
import Path from 'svg-path-generator'
import { parseFont, splitColor } from './util'
import { isMethodCall, isSetterCall } from './types'
import { ShimP } from './context'

export function getSerializedSvg(ctx: Canvas2DContextShim) {
  let currentFill: string | undefined
  let currentStroke: string | undefined
  let currentPath: Array<Array<number>> = []
  let rotation: number | undefined
  let font:
    | Pick<
        ReturnType<typeof parseFont>,
        'fontStyle' | 'fontFamily' | 'fontSize'
      >
    | undefined

  const nodes: React.ReactElement[] = []
  let index = 0
  for (const command of ctx.getCommands()) {
    if (isSetterCall(command)) {
      if (command.name === 'font') {
        if (command.args) {
          // stackoverflow.com/questions/5618676
          // skip lineHeight in the final usage
          const { fontStyle, fontFamily, fontSize } = parseFont(
            command.args[0] as Canvas2DContextShim['font'],
          )
          font = { fontStyle, fontFamily, fontSize }
        }
      }
      if (command.name === 'fillStyle') {
        if (command.args) {
          currentFill = command.args[0] as Canvas2DContextShim['fillStyle']
        }
      }
      if (command.name === 'strokeStyle') {
        if (command.args) {
          currentStroke = command.args[0] as Canvas2DContextShim['strokeStyle']
        }
      }
    } else if (isMethodCall(command)) {
      if (command.name === 'fillRect') {
        const [x, y, w, h] = command.args as ShimP<'fillRect'>
        const { hex, opacity } = splitColor(currentFill)
        const ny = Math.min(y, y + h)
        const nh = Math.abs(h)
        nodes.push(
          <rect
            key={index}
            fill={hex}
            fillOpacity={opacity !== 1 ? opacity : undefined}
            x={x.toFixed(3)}
            y={ny.toFixed(3)}
            width={w.toFixed(3)}
            height={nh.toFixed(3)}
          />,
        )
      }
      if (command.name === 'fillText') {
        const [text, x, y] = command.args as ShimP<'fillText'>
        const { hex, opacity } = splitColor(currentFill)
        nodes.push(
          <text
            key={index}
            fill={hex}
            fillOpacity={opacity !== 1 ? opacity : undefined}
            x={x.toFixed(3)}
            y={y.toFixed(3)}
            {...font}
          >
            {text}
          </text>,
        )
      }
      if (command.name === 'beginPath') {
        currentPath = []
      }
      if (command.name === 'moveTo') {
        currentPath.push(command.args as ShimP<'moveTo'>)
      }
      if (command.name === 'lineTo') {
        currentPath.push(command.args as ShimP<'lineTo'>)
      }
      if (command.name === 'closePath') {
        /* do nothing */
      }
      if (command.name === 'fill') {
        let path = Path().moveTo(...currentPath[0])
        for (let i = 1; i < currentPath.length; i++) {
          path = path.lineTo(...currentPath[i])
        }
        path.end()
        const { hex, opacity } = splitColor(currentFill)
        nodes.push(
          <path
            key={index}
            fill={hex}
            d={path}
            fillOpacity={opacity !== 1 ? opacity : undefined}
          />,
        )
      }
      if (command.name === 'stroke') {
        let path = Path().moveTo(...currentPath[0])
        for (let i = 1; i < currentPath.length; i++) {
          path = path.lineTo(...currentPath[i])
        }
        path.end()
        const { hex, opacity } = splitColor(currentStroke)
        nodes.push(
          <path
            key={index}
            fill="none"
            stroke={hex}
            fillOpacity={opacity !== 1 ? opacity : undefined}
            d={path}
          />,
        )
      }
      if (command.name === 'rotate') {
        const [radians] = command.args as ShimP<'rotate'>
        rotation = (radians * 180) / Math.PI
      }
    } else {
      throw new Error('invalid call')
    }

    index++
  }
  return rotation ? (
    <g transform={`rotate(${rotation})`}>{[...nodes]}</g>
  ) : (
    <>{[...nodes]}</>
  )
}
