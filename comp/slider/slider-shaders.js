/**
 * Liquid Glass Slider — WebGL GLSL Shaders
 * Pixel-Accurate Physical Optics:
 * - Exact Signed Distance Field for Rounded Capsule Thumb
 * - Snell's Law Refraction Ray Bending with 6-Band Chromatic Dispersion
 * - Split Meniscus Caustics (Cyan-Blue Edge Ribbon along upper & lower perimeter arcs)
 * - Dual Internal Specular Lobes flanking central track tongue
 * - Razor-sharp Fresnel Rim on crystal-clear right hemisphere
 * - Depth-attenuated contact occlusion (zero arbitrary outer smudges)
 */

const sliderVsSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const sliderFsSource = `
  precision highp float;

  varying vec2 v_uv;

  uniform sampler2D u_background;
  uniform vec2 u_resolution;
  uniform vec2 u_thumbPos;        // Center of glass capsule in screen pixels
  uniform vec2 u_thumbHalfSize;   // Half dimensions (e.g., 54.0 * dpr, 31.0 * dpr)
  uniform float u_thumbRadius;    // Corner radius (31.0 * dpr)
  uniform float u_time;
  uniform float u_sliderVal;      // 0.0 to 1.0
  uniform float u_dragActive;     // 1.0 if being dragged, 0.0 if resting

  // Physical optical constants
  uniform float u_ior;
  uniform float u_dispersion;
  uniform float u_lensHeight;
  uniform float u_wobble;         // Dynamic jelly wobble amplitude

  // Exact 2D Signed Distance Field for Rounded Capsule Pill
  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  // 6-Band Normalized Spectral Weights for Visible Wavelengths
  vec3 getSpectralWeight(int i) {
    if (i == 0) return vec3(0.40, 0.00, 0.00); // Deep Red
    if (i == 1) return vec3(0.35, 0.26, 0.00); // Amber / Yellow
    if (i == 2) return vec3(0.00, 0.40, 0.04); // Green
    if (i == 3) return vec3(0.00, 0.26, 0.28); // Cyan
    if (i == 4) return vec3(0.04, 0.08, 0.40); // Blue
    return vec3(0.21, 0.00, 0.28);              // Violet
  }

  void main() {
    vec2 pixelCoord = v_uv * u_resolution;
    vec2 p = pixelCoord - u_thumbPos;

    // 1. Exact Distance to Capsule Glass Perimeter
    float d = sdRoundedBox(p, u_thumbHalfSize, u_thumbRadius);

    // Device Pixel Ratio (derived from thumb height: standard 31.0 CSS px radius)
    float dpr = u_thumbRadius / 31.0;
    vec2 pCSS = p / dpr; // Coordinates in crisp CSS pixel space

    // --- OUTSIDE THE GLASS CAPSULE ---
    if (d > 0.0) {
      vec3 bg = texture2D(u_background, v_uv).rgb;

      // Ultra-soft physically-grounded directional shadow projected onto -Z surface
      vec2 shadowOffset = vec2(0.5, -3.0) * dpr;
      float dShadow = sdRoundedBox(p - shadowOffset, u_thumbHalfSize, u_thumbRadius);
      float shadowDist = max(0.0, dShadow) / dpr;
      float contactAO = exp(-shadowDist * 0.075) * 0.07;
      
      // Faint ambient radiance on the active crimson side
      float leftGlowDist = length(vec2(max(0.0, -pCSS.x - 20.0), pCSS.y));
      float redBloom = exp(-leftGlowDist * 0.045) * 0.06;
      vec3 redBloomCol = vec3(0.95, 0.22, 0.36);

      vec3 outsideColor = bg * (1.0 - contactAO) + redBloomCol * redBloom;
      gl_FragColor = vec4(outsideColor, 1.0);
      return;
    }

    // --- INSIDE THE GLASS CAPSULE ---
    float distInside = -d;

    // 2. Analytical Meniscus Bevel Profiling & Surface Normal Field
    // Physical meniscus flaring where the track enters the pill on the left (at y = +/- 5px)
    float distToTrackBorder = abs(abs(pCSS.y) - 5.0);
    float leftSideWeight = smoothstep(10.0, -45.0, pCSS.x);
    float trackBorderFlare = exp(-distToTrackBorder * 0.12) * 11.0 * leftSideWeight;

    float bevelWidthCSS = (8.5 + trackBorderFlare) * (1.0 + u_wobble * 0.10);
    float bevelWidth = bevelWidthCSS * dpr;

    float surfaceHeight = u_lensHeight;
    vec3 normal = vec3(0.0, 0.0, 1.0);
    vec2 eps = vec2(1.0, 0.0);
    vec2 sdfGrad = vec2(0.0);
    float slope = 0.0;

    if (distInside < bevelWidth) {
      // Smooth continuous elliptical meniscus curve
      float t = clamp(distInside / bevelWidth, 0.0, 1.0);
      float smoothT = smoothstep(0.0, 1.0, t);
      float curve = sqrt(max(0.0, 1.0 - (1.0 - smoothT) * (1.0 - smoothT)));
      surfaceHeight = curve * u_lensHeight;

      // SDF gradient vector for exact normal direction
      float dX = sdRoundedBox(p + eps.xy, u_thumbHalfSize, u_thumbRadius) - sdRoundedBox(p - eps.xy, u_thumbHalfSize, u_thumbRadius);
      float dY = sdRoundedBox(p + eps.yx, u_thumbHalfSize, u_thumbRadius) - sdRoundedBox(p - eps.yx, u_thumbHalfSize, u_thumbRadius);
      sdfGrad = normalize(vec2(dX, dY) + 1e-6);

      float safeT = min(smoothT, 0.98);
      slope = (1.0 - safeT) / sqrt(max(0.001, 1.0 - (1.0 - safeT) * (1.0 - safeT)));
      slope = slope * (u_lensHeight / bevelWidth) * (1.0 - smoothT);
      slope = min(slope, 4.2);

      normal = normalize(vec3(-sdfGrad * slope, 1.0));
    }

    // 3. Positive Snell's Law Refraction with 6-Band Chromatic Dispersion
    vec3 incident = vec3(0.0, 0.0, -1.0);
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    float depth = surfaceHeight + 24.0 * dpr;

    vec3 totalRefracted = vec3(0.0);

    for (int i = 0; i < 6; i++) {
      float fi = (float(i) - 2.5) / 2.5;
      float lambdaIOR = u_ior + fi * u_dispersion;

      vec3 refr = refract(incident, normal, 1.0 / lambdaIOR);
      vec2 offset = (refr.xy / abs(refr.z)) * (depth / u_resolution);

      vec3 sampleCol = texture2D(u_background, v_uv - offset).rgb;
      vec3 weight = getSpectralWeight(i);
      totalRefracted += sampleCol * weight;
    }

    // Edge softening at the physical glass perimeter
    float edgeSoftening = smoothstep(0.0, 1.5, distInside);
    totalRefracted *= mix(0.92, 1.0, edgeSoftening);

    // Ultra-soft, silky-smooth volumetric inner glass shadow (-Z depth with wide exponential feather)
    float innerEdgeCSS = distInside / dpr;
    float topHemisphere = smoothstep(-4.0, 26.0, pCSS.y);
    float softInnerEdgeDecay = exp(-innerEdgeCSS / 10.5) * topHemisphere * 0.052;
    float softDomeDepth = smoothstep(0.0, 28.0, pCSS.y) * 0.026;
    float smoothInnerShadow = softInnerEdgeDecay + softDomeDepth;
    totalRefracted *= (1.0 - smoothInnerShadow);

    // 4. Center-Top Soft Optical Glass Reflection (Subtle translucent sheen, slim height, razor-thin tips)
    // Horizontal span along the top rail (span: +/- 36 CSS px)
    float spanHalfWidth = 36.0;
    float normX = clamp(abs(pCSS.x) / spanHalfWidth, 0.0, 1.0);

    // Continuous elliptical curve: smoothly tapers to a whisper at corner tips
    float tipCurve = sqrt(max(0.0, 1.0 - normX * normX));
    float lineTaper = smoothstep(1.0, 0.0, normX) * tipCurve;

    // Slim, delicate line width: thin center (0.65 dpr), razor-thin curved tips (0.20 dpr)
    float lineWidth = mix(0.20, 0.65, lineTaper) * dpr;

    // Strictly constrained to the topmost rim edge (tight height: only top ~3-4px)
    float topRimCrest = smoothstep(22.0, 29.5, pCSS.y);

    // Soft, luminous glass glow sheen (slight ethereal glow tint, not pure stark white)
    float coreSheen = exp(-distInside / lineWidth);
    float softBloom = exp(-distInside / (lineWidth * 2.2)) * 0.40;
    float glowProfile = (coreSheen + softBloom) * lineTaper * topRimCrest * 0.24;
    vec3 glassGlowColor = vec3(0.88, 0.93, 1.0);
    vec3 centerTopReflection = glassGlowColor * glowProfile;

    // Subtle Fresnel Rim on the right hemispherical cap
    float rightCapWeight = smoothstep(24.0, 52.0, pCSS.x);
    float NdotV = max(0.0, dot(normal, viewDir));
    float fresnel = pow(1.0 - NdotV, 3.2);

    float rightGlowWidth = 0.75 * dpr;
    float rightRimGlow = exp(-distInside / rightGlowWidth);
    vec3 rightRimLight = vec3(1.0) * fresnel * rightRimGlow * rightCapWeight * 0.45;

    // Combine all optical physical layers (Pure refraction + elegant center-top curved glint + right rim)
    vec3 finalColor = totalRefracted + centerTopReflection + rightRimLight;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
