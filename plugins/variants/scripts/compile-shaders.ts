import path from 'path'

import { compileShaders } from '../../../compile-shader-utils/index.ts'
import { variantShader } from '../src/MultiWebGLVariantDisplay/components/variantShaders.ts'
import { variantMatrixShader } from '../src/MultiWebGLVariantMatrixDisplay/components/variantMatrixShaders.ts'

compileShaders({
  shaders: [
    { name: 'VARIANT', wgsl: variantShader },
    { name: 'VARIANT_MATRIX', wgsl: variantMatrixShader },
  ],
  outDir: path.join(import.meta.dirname, '..', 'src', 'shared', 'generated'),
})
