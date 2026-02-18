import path from 'path'

import { compileShaders } from '../../../compile-shader-utils/index.ts'
import { multiWiggleShader } from '../src/LinearWebGLMultiWiggleDisplay/components/multiWiggleShaders.ts'
import { wiggleShader } from '../src/LinearWebGLWiggleDisplay/components/wiggleShaders.ts'

compileShaders({
  shaders: [
    { name: 'WIGGLE', wgsl: wiggleShader },
    { name: 'MULTI_WIGGLE', wgsl: multiWiggleShader },
  ],
  outDir: path.join(import.meta.dirname, '..', 'src', 'shared', 'generated'),
})
