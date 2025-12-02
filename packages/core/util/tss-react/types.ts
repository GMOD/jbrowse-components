import type { CxArg } from './tools/classnames'
import type {
  CSSObject as CSSObject_base,
  Interpolation,
} from '@emotion/serialize'

export type CSSInterpolation = Interpolation<undefined>

export interface CSSObject extends CSSObject_base {
  /** https://emotion.sh/docs/labels */
  label?: string
}

export interface Css {
  (template: TemplateStringsArray, ...args: CSSInterpolation[]): string
  (...args: CSSInterpolation[]): string
}

// SEE: https://github.com/emotion-js/emotion/pull/2276
export type Cx = (...classNames: CxArg[]) => string

export function matchCSSObject(
  arg: TemplateStringsArray | CSSInterpolation,
): arg is CSSObject {
  return (
    arg instanceof Object &&
    !('styles' in arg) &&
    !('length' in arg) &&
    !('__emotion_styles' in arg)
  )
}

export type { CxArg } from './tools/classnames'
