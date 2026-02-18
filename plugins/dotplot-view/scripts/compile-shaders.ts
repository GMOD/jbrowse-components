import path from 'path'

import { compileShaders } from '../../../compile-shader-utils/index.ts'
import { dotplotShader } from '../src/DotplotDisplay/dotplotShaders.ts'

compileShaders({
  shaders: [{ name: 'DOTPLOT', wgsl: dotplotShader }],
  outDir: path.join(
    import.meta.dirname,
    '..',
    'src',
    'DotplotDisplay',
    'generated',
  ),
})
