/**
 * Integration Example: WebGL Pileup Renderer for JBrowse
 *
 * This file shows a complete example of how to integrate a WebGL-based
 * renderer into JBrowse's plugin architecture.
 *
 * Key integration points:
 * 1. Extend BoxRendererType (for layout management)
 * 2. Override render() to use WebGL
 * 3. Use rpcResult() for efficient ImageBitmap transfer
 * 4. Register via plugin system
 */

import { lazy } from 'react'

import {
  AnyConfigurationSchemaType,
  readConfObject,
} from '@jbrowse/core/configuration'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { types } from 'mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature } from '@jbrowse/core/util'

// ============================================================================
// CONFIGURATION SCHEMA
// ============================================================================

const configSchema = (pluginManager: PluginManager) =>
  types.compose(
    'WebGLPileupRendererConfig',
    pluginManager.pluggableConfigSchemaType('renderer'),
    types.model({
      type: types.literal('WebGLPileupRenderer'),
      featureHeight: types.optional(types.number, 7),
      maxHeight: types.optional(types.number, 1200),
      noSpacing: types.optional(types.boolean, false),
    }),
  )

// ============================================================================
// WEBGL RENDERING CORE
// ============================================================================

const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in float a_y;
in float a_flags;
in float a_mapq;
in float a_insertSize;
in uint a_colorIdx;

uniform vec2 u_domainX;
uniform float u_canvasHeight;
uniform float u_featureHeight;
uniform int u_colorScheme;

out vec4 v_color;
out vec2 v_localPos;

// Color schemes
vec3 strandColor(float flags) {
  bool isReverse = mod(floor(flags / 16.0), 2.0) > 0.5;
  return isReverse ? vec3(0.596, 0.596, 0.925) : vec3(0.925, 0.596, 0.596);
}

vec3 mapqColor(float mapq) {
  float t = clamp(mapq / 60.0, 0.0, 1.0);
  return mix(vec3(0.85, 0.35, 0.35), vec3(0.35, 0.45, 0.85), t);
}

vec3 insertSizeColor(float insertSize) {
  float normal = 400.0;
  float dev = abs(insertSize - normal) / normal;
  if (insertSize < normal) {
    return mix(vec3(0.6), vec3(0.85, 0.25, 0.25), clamp(dev, 0.0, 1.0));
  }
  return mix(vec3(0.6), vec3(0.25, 0.4, 0.85), clamp(dev, 0.0, 1.0));
}

vec3 firstOfPairColor(float flags) {
  bool isFirst = mod(floor(flags / 64.0), 2.0) > 0.5;
  return isFirst ? vec3(0.925, 0.596, 0.596) : vec3(0.596, 0.596, 0.925);
}

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;
  v_localPos = vec2(localX, localY);

  float domainWidth = u_domainX.y - u_domainX.x;
  float sx1 = (a_position.x - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (a_position.y - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx = mix(sx1, sx2, localX);

  float readH = u_featureHeight / u_canvasHeight * 2.0;
  float yTop = 1.0 - (a_y * u_featureHeight) / u_canvasHeight * 2.0;
  float yBot = yTop - readH;
  float sy = mix(yBot, yTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Select color based on scheme
  vec3 color;
  if (u_colorScheme == 0) {
    color = strandColor(a_flags);
  } else if (u_colorScheme == 1) {
    color = mapqColor(a_mapq);
  } else if (u_colorScheme == 2) {
    color = insertSizeColor(a_insertSize);
  } else if (u_colorScheme == 3) {
    color = firstOfPairColor(a_flags);
  } else {
    color = vec3(0.6);
  }

  v_color = vec4(color, 1.0);
}
`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
in vec2 v_localPos;

out vec4 fragColor;

void main() {
  // Darken edges for visual separation
  float border = 0.08;
  float alpha = 1.0;
  if (v_localPos.y < border || v_localPos.y > 1.0 - border) {
    alpha = 0.65;
  }
  fragColor = vec4(v_color.rgb * alpha, v_color.a);
}
`

// Shader for mismatches (second pass)
const MISMATCH_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;
in float a_y;
in float a_base;

uniform vec2 u_domainX;
uniform float u_canvasHeight;
uniform float u_featureHeight;
uniform float u_bpPerPx;

out vec4 v_color;

vec3 baseColors[5] = vec3[5](
  vec3(0.35, 0.75, 0.35),  // A = green
  vec3(0.35, 0.35, 0.85),  // C = blue
  vec3(0.85, 0.65, 0.25),  // G = yellow/orange
  vec3(0.85, 0.35, 0.35),  // T = red
  vec3(0.5, 0.5, 0.5)      // N = gray
);

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;
  float x1 = a_position;
  float x2 = a_position + 1.0;

  float sx1 = (x1 - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (x2 - u_domainX.x) / domainWidth * 2.0 - 1.0;

  // Ensure minimum width
  float minW = 3.0 / domainWidth * 2.0;
  if (sx2 - sx1 < minW) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minW * 0.5;
    sx2 = mid + minW * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  float readH = u_featureHeight / u_canvasHeight * 2.0;
  float yTop = 1.0 - (a_y * u_featureHeight) / u_canvasHeight * 2.0;
  float yBot = yTop - readH;
  float sy = mix(yBot, yTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  int baseIdx = int(clamp(a_base, 0.0, 4.0));
  v_color = vec4(baseColors[baseIdx], 1.0);
}
`

const MISMATCH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// ============================================================================
// LAYOUT COMPUTATION
// ============================================================================

interface LayoutResult {
  yPositions: Map<string, number>
  maxY: number
}

function computePileupLayout(features: Feature[]): LayoutResult {
  const sorted = [...features].sort((a, b) => a.get('start') - b.get('start'))

  const levels: number[] = []
  const yPositions = new Map<string, number>()

  for (const feature of sorted) {
    const start = feature.get('start')
    const end = feature.get('end')

    let y = 0
    for (const [i, level] of levels.entries()) {
      if (level <= start) {
        y = i
        break
      }
      y = i + 1
    }

    yPositions.set(feature.id(), y)
    levels[y] = end + 2
  }

  return {
    yPositions,
    maxY: levels.length,
  }
}

// ============================================================================
// WEBGL RENDERING FUNCTION
// ============================================================================

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info}`)
  }
  return shader
}

function createProgram(
  gl: WebGL2RenderingContext,
  vs: string,
  fs: string,
): WebGLProgram {
  const program = gl.createProgram()
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`)
  }
  return program
}

interface RenderOptions {
  features: Feature[]
  region: { start: number; end: number; refName: string }
  bpPerPx: number
  featureHeight: number
  maxHeight: number
  colorScheme: number
  showMismatches: boolean
  highResolutionScaling: number
}

interface RenderOutput {
  imageData: ImageBitmap
  width: number
  height: number
  maxHeightReached: boolean
  layout: LayoutResult
}

async function renderWebGL(opts: RenderOptions): Promise<RenderOutput> {
  const {
    features,
    region,
    bpPerPx,
    featureHeight,
    maxHeight,
    colorScheme,
    showMismatches,
    highResolutionScaling,
  } = opts

  // Empty case
  if (features.length === 0) {
    const canvas = new OffscreenCanvas(1, 1)
    return {
      imageData: canvas.transferToImageBitmap(),
      width: 1,
      height: 1,
      maxHeightReached: false,
      layout: { yPositions: new Map(), maxY: 0 },
    }
  }

  // Compute layout
  const layout = computePileupLayout(features)

  // Calculate dimensions
  const width = Math.ceil((region.end - region.start) / bpPerPx)
  const height = Math.min(layout.maxY * featureHeight, maxHeight)
  const maxHeightReached = layout.maxY * featureHeight > maxHeight

  // Create canvas
  const canvas = new OffscreenCanvas(
    Math.max(1, width * highResolutionScaling),
    Math.max(1, height * highResolutionScaling),
  )

  const gl = canvas.getContext('webgl2', {
    antialias: true,
    premultipliedAlpha: false,
  })

  if (!gl) {
    throw new Error('WebGL2 not available')
  }

  // === PASS 1: Render reads ===
  const readProgram = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)

  // Prepare read data
  const positions = new Float32Array(features.length * 2)
  const yCoords = new Float32Array(features.length)
  const flags = new Float32Array(features.length)
  const mapqs = new Float32Array(features.length)
  const insertSizes = new Float32Array(features.length)

  // Collect mismatches for second pass
  const mismatches: { pos: number; y: number; base: number }[] = []

  for (const [i, f] of features.entries()) {
    const start = f.get('start')
    const end = f.get('end')
    const y = layout.yPositions.get(f.id()) ?? 0

    positions[i * 2] = start
    positions[i * 2 + 1] = end
    yCoords[i] = y
    flags[i] = f.get('flags') ?? 0
    mapqs[i] = f.get('score') ?? f.get('qual') ?? 60
    insertSizes[i] = Math.abs(f.get('template_length') ?? 400)

    // Collect mismatches if zoomed in enough
    if (showMismatches && bpPerPx < 10) {
      const mm = f.get('mismatches')
      if (mm) {
        for (const m of mm) {
          if (m.type === 'mismatch') {
            const base = 'ACGTN'.indexOf(m.base?.toUpperCase() ?? 'N')
            mismatches.push({
              pos: start + m.start,
              y,
              base: base !== -1 ? base : 4,
            })
          }
        }
      }
    }
  }

  // Create VAO for reads
  const readVAO = gl.createVertexArray()
  gl.bindVertexArray(readVAO)

  function uploadBuffer(data: Float32Array, attrib: string, size: number) {
    const loc = gl.getAttribLocation(readProgram, attrib)
    if (loc < 0) {
      return
    }
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  uploadBuffer(positions, 'a_position', 2)
  uploadBuffer(yCoords, 'a_y', 1)
  uploadBuffer(flags, 'a_flags', 1)
  uploadBuffer(mapqs, 'a_mapq', 1)
  uploadBuffer(insertSizes, 'a_insertSize', 1)

  // Render reads
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0.96, 0.96, 0.96, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.useProgram(readProgram)
  gl.uniform2f(
    gl.getUniformLocation(readProgram, 'u_domainX'),
    region.start,
    region.end,
  )
  gl.uniform1f(gl.getUniformLocation(readProgram, 'u_canvasHeight'), height)
  gl.uniform1f(
    gl.getUniformLocation(readProgram, 'u_featureHeight'),
    featureHeight,
  )
  gl.uniform1i(gl.getUniformLocation(readProgram, 'u_colorScheme'), colorScheme)

  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, features.length)

  // === PASS 2: Render mismatches (if any) ===
  if (mismatches.length > 0) {
    const mmProgram = createProgram(
      gl,
      MISMATCH_VERTEX_SHADER,
      MISMATCH_FRAGMENT_SHADER,
    )

    const mmVAO = gl.createVertexArray()
    gl.bindVertexArray(mmVAO)

    const mmPos = new Float32Array(mismatches.map(m => m.pos))
    const mmY = new Float32Array(mismatches.map(m => m.y))
    const mmBase = new Float32Array(mismatches.map(m => m.base))

    function uploadMM(data: Float32Array, attrib: string) {
      const loc = gl.getAttribLocation(mmProgram, attrib)
      if (loc < 0) {
        return
      }
      const buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(loc, 1)
    }

    uploadMM(mmPos, 'a_position')
    uploadMM(mmY, 'a_y')
    uploadMM(mmBase, 'a_base')

    gl.useProgram(mmProgram)
    gl.uniform2f(
      gl.getUniformLocation(mmProgram, 'u_domainX'),
      region.start,
      region.end,
    )
    gl.uniform1f(gl.getUniformLocation(mmProgram, 'u_canvasHeight'), height)
    gl.uniform1f(
      gl.getUniformLocation(mmProgram, 'u_featureHeight'),
      featureHeight,
    )
    gl.uniform1f(gl.getUniformLocation(mmProgram, 'u_bpPerPx'), bpPerPx)

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, mismatches.length)
  }

  // Transfer result
  const imageData = canvas.transferToImageBitmap()

  return {
    imageData,
    width,
    height,
    maxHeightReached,
    layout,
  }
}

// ============================================================================
// RENDERER CLASS
// ============================================================================

export default class WebGLPileupRenderer extends BoxRendererType {
  supportsSVG = false

  async render(renderProps: RenderArgsDeserialized) {
    const {
      regions,
      bpPerPx,
      config,
      colorBy,
      highResolutionScaling = 1,
    } = renderProps

    const features = await this.getFeatures(renderProps)
    const featureArray = [...features.values()]

    const region = regions[0]
    if (!region) {
      throw new Error('No region')
    }

    // Determine color scheme from colorBy
    let colorScheme = 0
    if (colorBy?.type === 'strand') {
      colorScheme = 0
    } else if (colorBy?.type === 'mappingQuality') {
      colorScheme = 1
    } else if (colorBy?.type === 'insertSize') {
      colorScheme = 2
    } else if (colorBy?.type === 'firstOfPairStrand') {
      colorScheme = 3
    }

    const featureHeight = readConfObject(config, 'featureHeight') ?? 7
    const maxHeight = readConfObject(config, 'maxHeight') ?? 1200

    const result = await renderWebGL({
      features: featureArray,
      region,
      bpPerPx,
      featureHeight,
      maxHeight,
      colorScheme,
      showMismatches: bpPerPx < 10,
      highResolutionScaling,
    })

    // Return result with ImageBitmap transfer
    return {
      ...result,
      features: new Map(), // Could serialize features for click handling
      html: '',
    }
  }
}

// ============================================================================
// PLUGIN REGISTRATION
// ============================================================================

export function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new WebGLPileupRenderer({
      name: 'WebGLPileupRenderer',
      displayName: 'WebGL Pileup renderer',
      ReactComponent: lazy(() => import('@jbrowse/core/ui/PrerenderedCanvas')),
      configSchema: configSchema(pluginManager),
      pluginManager,
    })
  })
}

// ============================================================================
// USAGE NOTES
// ============================================================================

/**
 * To use this renderer:
 *
 * 1. Import and register in your plugin's index.ts:
 *
 *    import { register as registerWebGLPileup } from './WebGLPileupRenderer'
 *    export default class AlignmentsPlugin extends Plugin {
 *      install(pluginManager: PluginManager) {
 *        registerWebGLPileup(pluginManager)
 *        // ... other registrations
 *      }
 *    }
 *
 * 2. Create a display type that uses this renderer:
 *
 *    pluginManager.addDisplayType(() => {
 *      const configSchema = ConfigurationSchema(
 *        'LinearWebGLPileupDisplay',
 *        { renderer: types.optional(types.literal('WebGLPileupRenderer')) },
 *        { baseConfiguration: baseLinearDisplayConfigSchema }
 *      )
 *      return new DisplayType({
 *        name: 'LinearWebGLPileupDisplay',
 *        configSchema,
 *        stateModel: ...,
 *      })
 *    })
 *
 * 3. Or just change the renderer in an existing track config:
 *
 *    {
 *      "type": "AlignmentsTrack",
 *      "displays": [{
 *        "type": "LinearPileupDisplay",
 *        "renderer": { "type": "WebGLPileupRenderer" }
 *      }]
 *    }
 *
 * Benefits of this approach:
 * - GPU-accelerated rendering (much faster for high read counts)
 * - Fits existing JBrowse architecture
 * - Uses same PrerenderedCanvas display component
 * - ImageBitmap transfer is efficient (no serialization overhead)
 *
 * Limitations:
 * - Still creates new WebGL context per render (JBrowse architecture)
 * - No persistent "upload once, update uniforms" pattern
 * - For true smooth zoom, would need architectural changes
 */
