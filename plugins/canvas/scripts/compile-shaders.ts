import path from 'path'

import { compileShaders } from '../../../compile-shader-utils/index.ts'
import {
  ARROW_SHADER,
  CHEVRON_SHADER,
  LINE_SHADER,
  RECT_SHADER,
} from '../src/LinearWebGLFeatureDisplay/components/canvasShaders.ts'

compileShaders({
  shaders: [
    { name: 'RECT', wgsl: RECT_SHADER },
    { name: 'LINE', wgsl: LINE_SHADER },
    { name: 'CHEVRON', wgsl: CHEVRON_SHADER },
    { name: 'ARROW', wgsl: ARROW_SHADER },
  ],
  outDir: path.join(
    import.meta.dirname,
    '..',
    'src',
    'LinearWebGLFeatureDisplay',
    'components',
    'generated',
  ),
})
