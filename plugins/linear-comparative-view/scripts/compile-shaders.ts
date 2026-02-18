import { join } from 'path'

import { compileShaders } from '../../../compile-shader-utils/index.ts'
import {
  fillVertexShader,
  edgeVertexShader,
} from '../src/LinearSyntenyDisplay/syntenyShaders.ts'

compileShaders({
  shaders: [
    {
      name: 'FILL',
      wgsl: fillVertexShader,
      entryPoints: ['vs_main', 'fs_main', 'fs_picking'],
    },
    {
      name: 'EDGE',
      wgsl: edgeVertexShader,
      entryPoints: ['vs_main', 'fs_main'],
    },
  ],
  outDir: join(
    import.meta.dirname,
    '..',
    'src',
    'LinearSyntenyDisplay',
    'generated',
  ),
})
