import { join } from 'path'

import { compileShaders } from '../../../compile-shader-utils/index.ts'
import { wiggleShader } from '../src/LinearWebGLWiggleDisplay/components/wiggleShaders.ts'
import { multiWiggleShader } from '../src/LinearWebGLMultiWiggleDisplay/components/multiWiggleShaders.ts'

compileShaders({
  shaders: [
    { name: 'WIGGLE', wgsl: wiggleShader },
    { name: 'MULTI_WIGGLE', wgsl: multiWiggleShader },
  ],
  outDir: join(import.meta.dirname, '..', 'src', 'shared', 'generated'),
})
