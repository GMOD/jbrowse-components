import path from 'path'

import { compileShaders } from '../../../compile-shader-utils/index.ts'
import { wiggleShader } from '../src/shared/wiggleShader.ts'

compileShaders({
  shaders: [{ name: 'WIGGLE', wgsl: wiggleShader }],
  outDir: path.join(import.meta.dirname, '..', 'src', 'shared', 'generated'),
})
