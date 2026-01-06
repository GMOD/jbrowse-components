'use client'

export { keyframes } from '@emotion/react'
export { makeStyles } from './mui/index.ts'

// Export cx as a standalone function (wrapper around classnames)
import { type CxArg, classnames } from './tools/classnames.ts'
export function cx(...args: CxArg[]): string {
  return classnames(args)
}
