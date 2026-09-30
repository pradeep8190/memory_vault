/**
 * ============================================================================
 * LIQUID GLASS PILL — WebGL OPTICAL FROSTED BACKGROUND ENGINE
 * ============================================================================
 * 
 * Component: Floating Navigation Bar Lens
 * 
 * Features:
 * - Analytical 2D Rounded Pill Capsule SDF (sdRoundedBox)
 * - Snell's Law Optical Refraction (IOR: 1.540 Crown Glass)
 * - 6-Band Normalized Spectral Chromatic Dispersion (700nm to 405nm)
 * - 13-Tap Wide-Aperture Multi-Tier Gaussian Frosted Diffusion on GPU
 * - Normal Field Gradient (∇SDF) with Specular Edge Bevel Highlights
 * - Tactile Spring Press Kinetics
 */

export const pillVsSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export const pillFsSource = `
  precision highp float;

  varying vec2 v_uv;

  uniform sampler2D u_background;
  uniform vec2 u_resolution;
  uniform vec2 u_pillPos;          // Pill optical center in WebGL pixels
  uniform vec2 u_pillHalfSize;     // Half width & half height in WebGL pixels
  uniform float u_pillRadius;      // Corner radius in device pixels (= half height)
  uniform float u_pressScale;      // Tactile spring press scale (0.97 to 1.0)
  uniform float u_focusProgress;   // Focus expansion & optical bloom (0.0 to 1.0)
  uniform float u_frostBlur;       // Optical frosted diffusion blur spread in device pixels

  // Physical Optical Parameters
  uniform float u_ior;             // Index of Refraction (~1.540 Crown Glass)
  uniform float u_dispersion;      // Abbe Chromatic Dispersion (~0.055)
  uniform float u_lensHeight;      // Dome Height in pixels (~15.0px)
  uniform float u_glassAlpha;      // Glass transparency level (0.0 to 1.0)

  // 6-Band Normalized Spectral Weights for Visible Light (700nm to 405nm)
  vec3 getSpectralWeight(int i) {
    if (i == 0) return vec3(0.40, 0.00, 0.00); // Deep Red (~700nm)
    if (i == 1) return vec3(0.35, 0.26, 0.00); // Amber / Warm Orange (~590nm)
    if (i == 2) return vec3(0.00, 0.40, 0.04); // True Green (~535nm)
    if (i == 3) return vec3(0.00, 0.26, 0.28); // Cyan (~490nm)
    if (i == 4) return vec3(0.04, 0.08, 0.40); // Pure Royal Blue (~445nm)
    return vec3(0.21, 0.00, 0.28);              // Deep Violet (~405nm)
  }

  // Analytical 2D Signed Distance Field for Rounded Box
  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  // Physical Contact Shadow for Elevated Glass Pill
  vec3 sampleCardPlanePill(vec2 uv, vec2 pixelCoord, float scale, vec2 pillPos, vec2 halfSize, float radius) {
    vec3 bg = texture2D(u_background, uv).rgb;

    // Slight downward offset indicating glass pill is slightly elevated
    vec2 shadowOffset = vec2(0.4, -2.2) * scale;
    vec2 diff = (pixelCoord - shadowOffset) - pillPos;
    float dShadow = sdRoundedBox(diff, halfSize, radius);
    float shadowDist = max(0.0, dShadow) / scale;

    vec2 shadowDir = normalize(vec2(0.18, -0.98));
    vec2 pDiff = pixelCoord - pillPos;
    vec2 dirFromCenter = length(pDiff) > 1e-4 ? normalize(pDiff) : vec2(0.0, -1.0);
    float dirWeight = smoothstep(-0.35, 0.55, dot(dirFromCenter, shadowDir));

    float contactAO = exp(-shadowDist / 4.0) * 0.035;
    float penumbra = exp(-shadowDist / 12.0) * 0.025;
    float totalShadow = (contactAO + penumbra) * dirWeight;
    return bg * (1.0 - totalShadow);
  }

  void main() {
    vec2 pixelCoord = v_uv * u_resolution;
    vec2 p = pixelCoord - u_pillPos;

    // Apply tactile spring depression scale
    vec2 effectiveHalfSize = u_pillHalfSize * u_pressScale;
    float effectiveRadius = u_pillRadius * u_pressScale;
    float scale = effectiveHalfSize.y / 26.0;

    // Analytical Distance to Pill Capsule Boundary
    float d = sdRoundedBox(p, effectiveHalfSize, effectiveRadius);

    // Studio Background with Soft Grounding Shadow Outside
    vec3 outsideColor = sampleCardPlanePill(v_uv, pixelCoord, scale, u_pillPos, effectiveHalfSize, effectiveRadius);

    // Outside the Glass Pill
    if (d > 1.5) {
      if (u_glassAlpha < 0.999) {
        gl_FragColor = vec4(0.0);
      } else {
        gl_FragColor = vec4(outsideColor, 1.0);
      }
      return;
    }

    // Inside the Glass Pill
    float distInside = max(0.0, -d);

    // Analytical Surface Normal from SDF Gradient Vector (∇SDF)
    float eps = 1.0 * scale;
    float dx = sdRoundedBox(p + vec2(eps, 0.0), effectiveHalfSize, effectiveRadius) - sdRoundedBox(p - vec2(eps, 0.0), effectiveHalfSize, effectiveRadius);
    float dy = sdRoundedBox(p + vec2(0.0, eps), effectiveHalfSize, effectiveRadius) - sdRoundedBox(p - vec2(0.0, eps), effectiveHalfSize, effectiveRadius);
    vec2 grad = normalize(vec2(dx, dy) + 1e-4);

    // 2D Normalized Coordinates inside Pill
    vec2 normP = clamp(p / effectiveHalfSize, vec2(-1.0), vec2(1.0));
    float rho = length(normP);

    // Meniscus Bevel Profiling
    float bevelWidth = 12.0 * scale;
    float edgeFactor = smoothstep(0.0, bevelWidth, distInside);
    float rimSmooth = smoothstep(0.0, 1.4 * scale, distInside);

    // Curvature Dome Height Profile
    float domeProfile = sqrt(max(0.0, 1.0 - min(rho * 0.70, 0.95) * min(rho * 0.70, 0.95)));
    float surfaceHeight = domeProfile * u_lensHeight;
    float depth = surfaceHeight + (32.0 + u_focusProgress * 4.0) * scale;

    // Continuous Normal Field
    float meniscusSlope = (1.0 - edgeFactor) * 2.60;
    float centerDomeSlope = pow(min(rho, 1.2), 1.3) * 1.20;
    vec2 totalNormalXY = (-grad * meniscusSlope - normP * centerDomeSlope * 0.40) * rimSmooth;
    vec3 normal = normalize(vec3(totalNormalXY, 1.0));

    // Snell's Law Refraction + 6-Band Spectral Chromatic Dispersion with Frosted Diffusion
    vec3 incident = vec3(0.0, 0.0, -1.0);
    vec3 totalRefracted = vec3(0.0);

    vec2 b = (u_frostBlur * scale) / u_resolution;

    for (int i = 0; i < 6; i++) {
      float fi = (float(i) - 2.5) / 2.5;
      float lambdaIOR = u_ior + fi * u_dispersion;

      vec3 refr = refract(incident, normal, 1.0 / lambdaIOR);
      vec2 offset = (refr.xy / abs(refr.z + 1e-4)) * (depth / u_resolution);

      vec2 refrUV = v_uv - offset;

      // 13-tap wide-aperture WebGL optical frosted blur kernel
      vec2 b1 = b;
      vec2 b2 = b * 1.85;
      vec3 sampleCol = 
        texture2D(u_background, refrUV).rgb * 0.22 +
        (texture2D(u_background, refrUV + vec2( b1.x,  0.0)).rgb +
         texture2D(u_background, refrUV - vec2( b1.x,  0.0)).rgb +
         texture2D(u_background, refrUV + vec2( 0.0,  b1.y)).rgb +
         texture2D(u_background, refrUV - vec2( 0.0,  b1.y)).rgb) * 0.11 +
        (texture2D(u_background, refrUV + vec2( b1.x * 0.707,  b1.y * 0.707)).rgb +
         texture2D(u_background, refrUV - vec2( b1.x * 0.707,  b1.y * 0.707)).rgb +
         texture2D(u_background, refrUV + vec2( b1.x * 0.707, -b1.y * 0.707)).rgb +
         texture2D(u_background, refrUV - vec2( b1.x * 0.707, -b1.y * 0.707)).rgb) * 0.05 +
        (texture2D(u_background, refrUV + vec2( b2.x,  0.0)).rgb +
         texture2D(u_background, refrUV - vec2( b2.x,  0.0)).rgb +
         texture2D(u_background, refrUV + vec2( 0.0,  b2.y)).rgb +
         texture2D(u_background, refrUV - vec2( 0.0,  b2.y)).rgb) * 0.035;

      vec3 weight = getSpectralWeight(i);
      totalRefracted += sampleCol * weight;
    }

    // Subpixel Boundary Antialiasing
    float rimAntialias = smoothstep(0.0, 1.0 * scale, distInside);
    totalRefracted *= mix(0.98, 1.0, rimAntialias);

    // Soft Frosted Volumetric Diffusion (diffuse light scattering)
    float frostedVeil = exp(-distInside / (14.0 * scale)) * 0.14 + 0.22;
    vec3 frostTint = vec3(1.0, 0.955, 0.960); // Very very soft subtle red blur
    totalRefracted = mix(totalRefracted, frostTint, frostedVeil);

    // 1. Ultra-Thin White Specular Edge (Top & Bottom)
    float tTB = smoothstep(0.25, 0.85, abs(grad.y));
    float taperTB = tTB * sqrt(tTB);
    float widthTB = mix(0.05, 0.20, taperTB) * scale;
    float specWhite = exp(-distInside / widthTB) * taperTB;
    float topBonus = smoothstep(-0.10, 0.85, grad.y) * 0.35;
    vec3 whiteEdgeLayer = vec3(1.0) * specWhite * (0.85 + topBonus);

    vec3 glassColor = totalRefracted + whiteEdgeLayer;

    // 2. Left and Right Thin Black Edge Reflection (Curved End Caps)
    // Tapers progressively from full width at the center to very thin at the corner edges
    float tCenter = clamp(abs(grad.x), 0.0, 1.0);
    float edgeFade = smoothstep(0.005, 0.06, tCenter);
    float widthTaper = pow(tCenter, 1.15);
    float widthSides = mix(0.032, 0.29, widthTaper) * scale;
    float darkArc = (exp(-distInside / widthSides) + exp(-distInside / (widthSides * 1.6)) * 0.18) * edgeFade;
    vec3 darkEdgeCol = vec3(0.08, 0.10, 0.14);
    glassColor = mix(glassColor, darkEdgeCol, darkArc * 0.55);

    // Subpixel Feathering & Final Antialiased Edge Blending
    float edgeCoverage = smoothstep(0.65, -0.65, d);

    if (u_glassAlpha < 0.999) {
      float alpha = edgeCoverage * u_glassAlpha + specWhite * 0.35;
      alpha = clamp(alpha, 0.0, 1.0);
      gl_FragColor = vec4(glassColor * alpha, alpha);
    } else {
      vec3 finalPixelColor = mix(outsideColor, glassColor, edgeCoverage);
      gl_FragColor = vec4(finalPixelColor, 1.0);
    }
  }
`;

/**
 * LiquidGlassPill Instance Controller
 */
export class LiquidGlassPill {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.width = options.width || 440;
    this.height = options.height || 64;
    this.pillWidth = options.pillWidth !== undefined ? options.pillWidth : this.width;
    this.pillHeight = options.pillHeight !== undefined ? options.pillHeight : this.height;
    this.ior = options.ior || 1.540;
    this.dispersion = options.dispersion || 0.055;
    this.lensHeight = options.lensHeight || 15.0;
    this.frostBlur = options.frostBlur !== undefined ? options.frostBlur : 24.0;
    this.bgRenderer = options.bgRenderer || null;
    this.customRadius = options.radius !== undefined ? options.radius : null;
    this.glassAlpha = options.alpha !== undefined ? options.alpha : 0.90;
    this.preserveDrawingBuffer = options.preserveDrawingBuffer !== undefined ? options.preserveDrawingBuffer : true;

    this.pressScale = 1.0;
    this.focusProgress = 0.0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.bgCanvas = document.createElement('canvas');
    this.bgCtx = this.bgCanvas.getContext('2d', { alpha: false });

    this.initWebGL();
    this.resize();
  }

  initWebGL() {
    this.gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: this.preserveDrawingBuffer,
    });

    if (!this.gl) {
      console.warn('WebGL not available for LiquidGlassPill');
      return;
    }

    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, pillVsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, pillFsSource);

    if (!vs || !fs) return;

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('LiquidGlassPill program error:', gl.getProgramInfoLog(this.program));
      return;
    }

    gl.useProgram(this.program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]),
      gl.STATIC_DRAW
    );

    const aPosition = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uniformNames = [
      'u_background',
      'u_resolution',
      'u_pillPos',
      'u_pillHalfSize',
      'u_pillRadius',
      'u_pressScale',
      'u_focusProgress',
      'u_frostBlur',
      'u_ior',
      'u_dispersion',
      'u_lensHeight',
      'u_glassAlpha',
    ];

    this.uniforms = {};
    uniformNames.forEach((name) => {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    });

    this.bgTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.bgTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  compileShader(type, source) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('LiquidGlassPill compile error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  updateBackground() {
    if (!this.gl) return;
    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;

    if (this.bgRenderer) {
      this.bgRenderer(this.bgCtx, w, h, this.dpr);
    } else {
      this.bgCtx.fillStyle = '#ffffff';
      this.bgCtx.fillRect(0, 0, w, h);
    }

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.bgTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.bgCanvas);
  }

  resize() {
    if (!this.gl) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.round(rect.width) || this.width;
    const h = Math.round(rect.height) || this.height;

    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.bgCanvas.width = w * this.dpr;
    this.bgCanvas.height = h * this.dpr;

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    this.pillCenterX = (w * 0.5) * this.dpr;
    this.pillCenterY = (h * 0.5) * this.dpr;

    const pW = this.pillWidth !== undefined ? this.pillWidth : w;
    const pH = this.pillHeight !== undefined ? this.pillHeight : h;

    this.pillHalfWidth = (pW * 0.5) * this.dpr;
    this.pillHalfHeight = (pH * 0.5) * this.dpr;
    this.pillRadius = (this.customRadius !== null ? this.customRadius : (pH * 0.5)) * this.dpr;

    this.updateBackground();
    this.render();
  }

  setPress(scale) {
    this.pressScale = scale;
    this.render();
  }

  setFocus(progress) {
    this.focusProgress = progress;
    this.render();
  }

  setFrostBlur(amount) {
    this.frostBlur = amount;
    this.render();
  }

  setAlpha(alpha) {
    this.glassAlpha = alpha;
    this.render();
  }

  render() {
    if (!this.gl || !this.program) return;
    const gl = this.gl;

    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.bgTexture);
    gl.uniform1i(this.uniforms.u_background, 0);

    gl.uniform2f(this.uniforms.u_resolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.uniforms.u_pillPos, this.pillCenterX, this.pillCenterY);
    gl.uniform2f(this.uniforms.u_pillHalfSize, this.pillHalfWidth, this.pillHalfHeight);
    gl.uniform1f(this.uniforms.u_pillRadius, this.pillRadius);
    gl.uniform1f(this.uniforms.u_pressScale, this.pressScale);
    gl.uniform1f(this.uniforms.u_focusProgress, this.focusProgress);
    gl.uniform1f(this.uniforms.u_frostBlur, this.frostBlur * this.dpr);
    gl.uniform1f(this.uniforms.u_ior, this.ior);
    gl.uniform1f(this.uniforms.u_dispersion, this.dispersion);
    gl.uniform1f(this.uniforms.u_lensHeight, this.lensHeight * this.dpr);
    gl.uniform1f(this.uniforms.u_glassAlpha, this.glassAlpha);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

// Global fallback for script tag usage
if (typeof window !== 'undefined') {
  window.LiquidGlassPill = LiquidGlassPill;
}
