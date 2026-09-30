/**
 * Liquid Glass Search Bar — WebGL GLSL Shaders
 * Strict Physical Optics & Analytical Surface Mathematics:
 * - Analytical 2D Rounded Pill Capsule SDF (sdRoundedBox with corner radius = half-height)
 * - 100% Pure Snell's Law refraction with 6-Band normalized chromatic dispersion (700nm to 405nm)
 * - Elevated glass pill with whisper-soft physical contact shadow (elevated slightly above plane)
 * - White reflection edge along top and bottom with directional key-light specular glint
 * - Very thin black edge reflection along left and right curved caps
 * - Zero grey inner shadow — crystal-clear glass volume
 */

const searchVsSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const searchFsSource = `
  precision highp float;

  varying vec2 v_uv;

  uniform sampler2D u_background;
  uniform vec2 u_resolution;
  uniform vec2 u_pillPos;          // Pill optical center in WebGL pixels
  uniform vec2 u_pillHalfSize;     // Half width & half height in WebGL pixels
  uniform float u_pillRadius;      // Corner radius in device pixels (= half height)
  uniform float u_pressScale;      // Tactile spring press scale (0.97 to 1.0)
  uniform float u_focusProgress;   // Focus expansion & optical bloom (0.0 to 1.0)

  // Physical Optical Parameters
  uniform float u_ior;             // Index of Refraction (~1.530 Crown Glass)
  uniform float u_dispersion;      // Abbe Chromatic Dispersion (~0.048)
  uniform float u_lensHeight;      // Dome Height in pixels (~14.5px)

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

  // Physical Contact Shadow for Elevated Glass Pill (Whisper-soft, elevated slightly above plane)
  vec3 sampleCardPlanePill(vec2 uv, vec2 pixelCoord, float scale, vec2 pillPos, vec2 halfSize, float radius) {
    vec3 bg = texture2D(u_background, uv).rgb;

    // Slight downward offset (~2.2px) indicating glass pill is slightly elevated above the surface
    vec2 shadowOffset = vec2(0.4, -2.2) * scale;
    vec2 diff = (pixelCoord - shadowOffset) - pillPos;
    float dShadow = sdRoundedBox(diff, halfSize, radius);
    float shadowDist = max(0.0, dShadow) / scale;

    vec2 shadowDir = normalize(vec2(0.18, -0.98));
    vec2 pDiff = pixelCoord - pillPos;
    vec2 dirFromCenter = length(pDiff) > 1e-4 ? normalize(pDiff) : vec2(0.0, -1.0);
    float dirWeight = smoothstep(-0.35, 0.55, dot(dirFromCenter, shadowDir));

    // Very little shadow (subtle grounding, elevated ~2px above plane)
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
    float scale = effectiveRadius / 28.0;

    // Analytical Distance to Pill Capsule Boundary
    float d = sdRoundedBox(p, effectiveHalfSize, effectiveRadius);

    // Studio Background with Soft Grounding Shadow Outside
    vec3 outsideColor = sampleCardPlanePill(v_uv, pixelCoord, scale, u_pillPos, effectiveHalfSize, effectiveRadius);

    // Outside the Glass Pill
    if (d > 1.5) {
      gl_FragColor = vec4(outsideColor, 1.0);
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

    // Snell's Law Refraction + 6-Band Spectral Chromatic Dispersion (100% Pure Optical Crystal Glass)
    vec3 incident = vec3(0.0, 0.0, -1.0);
    vec3 totalRefracted = vec3(0.0);

    for (int i = 0; i < 6; i++) {
      float fi = (float(i) - 2.5) / 2.5;
      float lambdaIOR = u_ior + fi * u_dispersion;

      vec3 refr = refract(incident, normal, 1.0 / lambdaIOR);
      vec2 offset = (refr.xy / abs(refr.z + 1e-4)) * (depth / u_resolution);

      vec2 refrUV = v_uv - offset;
      vec3 sampleCol = texture2D(u_background, refrUV).rgb;
      vec3 weight = getSpectralWeight(i);
      totalRefracted += sampleCol * weight;
    }

    // Subpixel Boundary Antialiasing
    float rimAntialias = smoothstep(0.0, 1.0 * scale, distInside);
    totalRefracted *= mix(0.98, 1.0, rimAntialias);

    // Ambient-like White Inner Shadow (Apple-grade floating glass, whisper-soft ~0.04 peak)
    float ambientWhiteShadow = exp(-distInside / (6.5 * scale)) * 0.032 + 0.012;
    totalRefracted = mix(totalRefracted, vec3(1.0), ambientWhiteShadow);

    // =========================================================================
    // 1. ULTRA-THIN WHITE SPECULAR EDGE (TOP & BOTTOM - THINNER THAN HAIR)
    // =========================================================================
    float tTB = smoothstep(0.25, 0.85, abs(grad.y));
    float taperTB = tTB * sqrt(tTB);
    float widthTB = mix(0.05, 0.20, taperTB) * scale;
    float specWhite = exp(-distInside / widthTB) * taperTB;
    float topBonus = smoothstep(-0.10, 0.85, grad.y) * 0.35;
    vec3 whiteEdgeLayer = vec3(1.0) * specWhite * (0.85 + topBonus);

    vec3 glassColor = totalRefracted + whiteEdgeLayer;

    // =========================================================================
    // 2. LEFT AND RIGHT THIN BLACK EDGE REFLECTION (CURVED END CAPS)
    // =========================================================================
    float tSides = smoothstep(0.25, 0.90, abs(grad.x));
    float taperSides = tSides * sqrt(tSides);
    float widthSides = mix(0.08, 0.32, taperSides) * scale;
    float darkArc = (exp(-distInside / widthSides) + exp(-distInside / (widthSides * 1.5)) * 0.18) * taperSides;
    vec3 darkEdgeCol = vec3(0.10, 0.12, 0.16);
    glassColor = mix(glassColor, darkEdgeCol, darkArc * 0.50);

    // Subpixel Feathering & Final Antialiased Edge Blending
    float edgeCoverage = smoothstep(0.65, -0.65, d);
    vec3 finalPixelColor = mix(outsideColor, glassColor, edgeCoverage);

    gl_FragColor = vec4(finalPixelColor, 1.0);
  }
`;
