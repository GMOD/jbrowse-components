const VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-vertex (quad corners)
in vec2 a_quadPos;

// Per-instance
in vec2 a_position;
in float a_count;

uniform float u_binWidth;
uniform float u_yScalar;
uniform vec2 u_canvasSize;
uniform float u_viewScale;
uniform float u_viewOffsetX;

out float v_count;

void main() {
  vec2 pos = a_position + a_quadPos * u_binWidth;

  // Rotate -45 degrees
  float c = 0.7071067811865476;
  float rx = (pos.x + pos.y) * c;
  float ry = (-pos.x + pos.y) * c;

  // Apply view scale (zoom) and offset (scroll)
  rx = rx * u_viewScale + u_viewOffsetX;
  ry = ry * u_viewScale;

  ry *= u_yScalar;

  float clipX = (rx / u_canvasSize.x) * 2.0 - 1.0;
  float clipY = 1.0 - (ry / u_canvasSize.y) * 2.0;

  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_count = a_count;
}
`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float v_count;

uniform sampler2D u_colorRamp;
uniform float u_maxScore;
uniform int u_useLogScale;

out vec4 fragColor;

void main() {
  float m = u_useLogScale == 1 ? u_maxScore : u_maxScore / 20.0;
  float t;
  if (u_useLogScale == 1) {
    t = log2(max(v_count, 1.0)) / log2(max(m, 1.0));
  } else {
    t = v_count / max(m, 0.001);
  }
  t = clamp(t, 0.0, 1.0);
  fragColor = texture(u_colorRamp, vec2(t, 0.5));
}
`

const FALL_STOPS: [number, number, number][] = [
  [255, 255, 255],
  [255, 255, 204],
  [255, 237, 160],
  [254, 217, 118],
  [254, 178, 76],
  [253, 141, 60],
  [252, 78, 42],
  [227, 26, 28],
  [189, 0, 38],
  [128, 0, 38],
  [0, 0, 0],
]

function generateJuiceboxRamp(): Uint8Array {
  const data = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    data[i * 4] = 255
    data[i * 4 + 1] = 0
    data[i * 4 + 2] = 0
    data[i * 4 + 3] = i
  }
  return data
}

function generateFallRamp(): Uint8Array {
  const data = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const stopIndex = t * (FALL_STOPS.length - 1)
    const lower = Math.floor(stopIndex)
    const upper = Math.min(lower + 1, FALL_STOPS.length - 1)
    const frac = stopIndex - lower
    const lo = FALL_STOPS[lower]!
    const hi = FALL_STOPS[upper]!

    data[i * 4] = Math.round(lo[0] * (1 - frac) + hi[0] * frac)
    data[i * 4 + 1] = Math.round(lo[1] * (1 - frac) + hi[1] * frac)
    data[i * 4 + 2] = Math.round(lo[2] * (1 - frac) + hi[2] * frac)
    data[i * 4 + 3] = 255
  }
  return data
}

function generateViridisRamp(): Uint8Array {
  // Inline a simplified viridis LUT (256 entries)
  // Generated from the d3-scale-chromatic viridis colormap
  const spec =
    '44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725'
  const data = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const hex = spec.slice(i * 6, i * 6 + 6)
    data[i * 4] = parseInt(hex.slice(0, 2), 16)
    data[i * 4 + 1] = parseInt(hex.slice(2, 4), 16)
    data[i * 4 + 2] = parseInt(hex.slice(4, 6), 16)
    data[i * 4 + 3] = 255
  }
  return data
}

export function generateColorRamp(colorScheme?: string): Uint8Array {
  switch (colorScheme) {
    case 'fall':
      return generateFallRamp()
    case 'viridis':
      return generateViridisRamp()
    default:
      return generateJuiceboxRamp()
  }
}

export interface HicRenderState {
  binWidth: number
  yScalar: number
  canvasWidth: number
  canvasHeight: number
  maxScore: number
  useLogScale: boolean
  viewScale: number
  viewOffsetX: number
}

export class WebGLHicRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject | null = null
  private buffers: WebGLBuffer[] = []
  private instanceCount = 0
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private colorRampTexture: WebGLTexture | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })

    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
    this.cacheUniforms([
      'u_binWidth',
      'u_yScalar',
      'u_canvasSize',
      'u_maxScore',
      'u_useLogScale',
      'u_colorRamp',
      'u_viewScale',
      'u_viewOffsetX',
    ])

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  private createShader(type: number, source: string) {
    const gl = this.gl
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

  private createProgram(vsSource: string, fsSource: string) {
    const gl = this.gl
    const vs = this.createShader(gl.VERTEX_SHADER, vsSource)
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource)
    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.detachShader(program, vs)
    gl.detachShader(program, fs)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program)
      gl.deleteProgram(program)
      throw new Error(`Program link error: ${info}`)
    }
    return program
  }

  private cacheUniforms(names: string[]) {
    for (const name of names) {
      this.uniforms[name] = this.gl.getUniformLocation(this.program, name)
    }
  }

  uploadData(data: {
    positions: Float32Array
    counts: Float32Array
    numContacts: number
  }) {
    const gl = this.gl

    this.deleteBuffers()

    if (data.numContacts === 0) {
      this.instanceCount = 0
      return
    }

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)

    // Unit quad geometry
    const quadVertices = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
    const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3])

    const quadPosLoc = gl.getAttribLocation(this.program, 'a_quadPos')
    const quadBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(quadPosLoc)
    gl.vertexAttribPointer(quadPosLoc, 2, gl.FLOAT, false, 0, 0)

    const indexBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW)

    // Per-instance position buffer
    const posLoc = gl.getAttribLocation(this.program, 'a_position')
    const posBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(posLoc, 1)

    // Per-instance count buffer
    const countLoc = gl.getAttribLocation(this.program, 'a_count')
    const countBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, countBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data.counts, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(countLoc)
    gl.vertexAttribPointer(countLoc, 1, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(countLoc, 1)

    this.buffers = [quadBuffer, indexBuffer, posBuffer, countBuffer]
    gl.bindVertexArray(null)
    this.instanceCount = data.numContacts
  }

  uploadColorRamp(colors: Uint8Array) {
    const gl = this.gl
    if (this.colorRampTexture) {
      gl.deleteTexture(this.colorRampTexture)
    }
    this.colorRampTexture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.colorRampTexture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      colors,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  render(state: HicRenderState) {
    const gl = this.gl
    const {
      canvasWidth,
      canvasHeight,
      binWidth,
      yScalar,
      maxScore,
      useLogScale,
      viewScale,
      viewOffsetX,
    } = state

    if (
      this.canvas.width !== canvasWidth ||
      this.canvas.height !== canvasHeight
    ) {
      this.canvas.width = canvasWidth
      this.canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.vao || this.instanceCount === 0 || !this.colorRampTexture) {
      return
    }

    gl.useProgram(this.program)

    gl.uniform1f(this.uniforms.u_binWidth!, binWidth)
    gl.uniform1f(this.uniforms.u_yScalar!, yScalar)
    gl.uniform2f(this.uniforms.u_canvasSize!, canvasWidth, canvasHeight)
    gl.uniform1f(this.uniforms.u_maxScore!, maxScore)
    gl.uniform1i(this.uniforms.u_useLogScale!, useLogScale ? 1 : 0)
    gl.uniform1f(this.uniforms.u_viewScale!, viewScale)
    gl.uniform1f(this.uniforms.u_viewOffsetX!, viewOffsetX)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.colorRampTexture)
    gl.uniform1i(this.uniforms.u_colorRamp!, 0)

    gl.bindVertexArray(this.vao)
    gl.drawElementsInstanced(
      gl.TRIANGLES,
      6,
      gl.UNSIGNED_SHORT,
      0,
      this.instanceCount,
    )
    gl.bindVertexArray(null)
  }

  private deleteBuffers() {
    const gl = this.gl
    for (const buf of this.buffers) {
      gl.deleteBuffer(buf)
    }
    this.buffers = []
    if (this.vao) {
      gl.deleteVertexArray(this.vao)
      this.vao = null
    }
  }

  destroy() {
    this.deleteBuffers()
    const gl = this.gl
    if (this.colorRampTexture) {
      gl.deleteTexture(this.colorRampTexture)
    }
    gl.deleteProgram(this.program)
  }
}
