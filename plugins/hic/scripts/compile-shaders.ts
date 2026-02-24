import path from 'path'

import { compileShaders } from '../../../compile-shader-utils/index.ts'
import { hicShader } from '../src/LinearHicDisplay/components/hicShaders.ts'

compileShaders({
  shaders: [{ name: 'HIC', wgsl: hicShader }],
  outDir: path.join(import.meta.dirname, '..', 'src', 'shared', 'generated'),
})
