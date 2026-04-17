import { CANVAS_FEATURE_PASSES } from '../../../../plugins/canvas/src/LinearBasicDisplay/components/GpuCanvasFeatureRenderer.ts'
import { DOTPLOT_PASSES } from '../../../../plugins/dotplot-view/src/DotplotDisplay/GpuDotplotRenderer.ts'
import { HIC_PASSES } from '../../../../plugins/hic/src/LinearHicDisplay/components/GpuHicRenderer.ts'
import { SYNTENY_PASSES } from '../../../../plugins/linear-comparative-view/src/LinearSyntenyDisplay/GpuSyntenyRenderer.ts'
import { LD_PASSES } from '../../../../plugins/variants/src/LDDisplay/components/GpuLDRenderer.ts'
import { VARIANT_PASSES } from '../../../../plugins/variants/src/MultiVariantDisplay/components/GpuVariantRenderer.ts'
import { VARIANT_MATRIX_PASSES } from '../../../../plugins/variants/src/MultiVariantMatrixDisplay/components/GpuVariantMatrixRenderer.ts'
import { WIGGLE_PASSES } from '../../../../plugins/wiggle/src/shared/GpuWiggleRenderer.ts'

import type { GlAttributeLayout, PassDescriptor } from './hal/types.ts'
// Multi-synteny and alignments have deep import chains that hit jest module
// resolution issues, so they are tested via their own plugin test suites instead.

interface GlslAttribute {
  name: string
  type: string
  components: number
  integer: boolean
}

function parseGlslAttributes(glsl: string): GlslAttribute[] {
  const attrs: GlslAttribute[] = []
  for (const line of glsl.split('\n')) {
    const match =
      /^\s*in\s+(uvec(\d)|uint|ivec(\d)|int|vec(\d)|float)\s+(\w+)\s*;/.exec(
        line,
      )
    if (match) {
      const glslType = match[1]!
      const name = match[5]!

      let components = 1
      let type: 'float' | 'uint' | 'int' = 'float'
      let integer = false

      if (glslType.startsWith('uvec')) {
        components = Number.parseInt(match[2]!, 10)
        type = 'uint'
        integer = true
      } else if (glslType === 'uint') {
        type = 'uint'
        integer = true
      } else if (glslType.startsWith('ivec')) {
        components = Number.parseInt(match[3]!, 10)
        type = 'int'
        integer = true
      } else if (glslType === 'int') {
        type = 'int'
        integer = true
      } else if (glslType.startsWith('vec')) {
        components = Number.parseInt(match[4]!, 10)
      }

      attrs.push({ name, type, components, integer })
    }
  }
  return attrs
}

function validateSync(
  passId: string,
  glAttributes: GlAttributeLayout[],
  glslVertex: string,
) {
  const glslAttrs = parseGlslAttributes(glslVertex)

  // glAttributes describes the VERTEX BUFFER layout — every byte the GPU
  // reads. The GLSL shader may omit an attribute if its body doesn't
  // reference it (Slang's compiler dead-code-eliminates unused inputs, and
  // buffer-sharing passes like line/chevron declare all fields even if only
  // one side uses each). So it's a sync error only when the GLSL declares an
  // attribute that's NOT in the buffer layout — the reverse direction is
  // fine. When the GLSL does have the attribute, its type/components must
  // match the TS descriptor.
  for (const attr of glAttributes) {
    const glslAttr = glslAttrs.find(a => a.name === attr.name)
    if (glslAttr) {
      it(`${passId}: "${attr.name}" type=${attr.type} components=${attr.components} integer=${attr.integer}`, () => {
        expect(glslAttr.type).toBe(attr.type)
        expect(glslAttr.components).toBe(attr.components)
        expect(glslAttr.integer).toBe(attr.integer)
      })
    }
  }

  for (const glslAttr of glslAttrs) {
    it(`${passId}: GLSL "${glslAttr.name}" has matching glAttribute`, () => {
      expect(glAttributes.find(a => a.name === glslAttr.name)).toBeDefined()
    })
  }
}

function validatePassDescriptors(label: string, passes: PassDescriptor[]) {
  describe(`glAttribute ↔ GLSL sync — ${label}`, () => {
    for (const pass of passes) {
      validateSync(pass.id, pass.glAttributes, pass.glslVertex)
    }
  })
}

validatePassDescriptors('wiggle', WIGGLE_PASSES)
validatePassDescriptors('variant', VARIANT_PASSES)
validatePassDescriptors('variant-matrix', VARIANT_MATRIX_PASSES)
validatePassDescriptors('ld', LD_PASSES)
validatePassDescriptors('hic', HIC_PASSES)
validatePassDescriptors('canvas-feature', CANVAS_FEATURE_PASSES)
validatePassDescriptors('dotplot', DOTPLOT_PASSES)
validatePassDescriptors('synteny', SYNTENY_PASSES)
