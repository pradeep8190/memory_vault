export const lensFragmentShader = `
  precision highp float;
  varying vec2 v_uv;

  uniform sampler2D u_background;
  uniform vec2 u_resolution;
  uniform vec2 u_lensPos;         // Center in device pixels (X, Y)
  uniform vec2 u_lensHalfSize;    // Dynamic half-size (Wx, Wy) from volume conservation
  uniform float u_lensRadius;     // Dynamic corner radius in device pixels
  uniform vec2 u_velocity;        // Current fluid velocity (X, Y)
  uniform float u_fluidWave;      // Dynamic fluid surface wave oscillation amplitude
  uniform float u_splashHeight;   // Hydraulic braking splash wave surge
  uniform float u_ior;            // Base Index of Refraction (~1.49 Acrylic/Water)
  uniform float u_dispersion;     // Cauchy Abbe Chromatic Dispersion (~0.045)
  uniform float u_dpr;            // Device Pixel Ratio
  uniform float u_activeProgress; // 0.0 = Resting Static Light Grey Pill, 1.0 = Active Liquid Glass Lens
  uniform float u_attraction;     // Optical border attraction strength (0.0 to 1.5)
  uniform float u_time;           // Time in seconds for ambient micro-animations

  // 6-Band Normalized Spectral Weights for Visible Wavelengths (700nm to 405nm)
  vec3 getSpectralWeight(int i) {
    if (i == 0) return vec3(0.40, 0.00, 0.00); // Deep Red (~700nm)
    if (i == 1) return vec3(0.35, 0.26, 0.00); // Amber / Yellow (~590nm)
    if (i == 2) return vec3(0.00, 0.40, 0.04); // Green (~535nm)
    if (i == 3) return vec3(0.00, 0.26, 0.28); // Cyan (~490nm)
    if (i == 4) return vec3(0.04, 0.08, 0.40); // Blue (~445nm)
    return vec3(0.21, 0.00, 0.28);              // Violet (~405nm)
  }

  // Analytical 2D Signed Distance Field for Rounded Pill Capsule
  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }



  void main() {
    vec2 pixelCoord = v_uv * u_resolution;
    vec2 p = pixelCoord - u_lensPos;

    // Analytical Distance to Lens Boundary
    float d = sdRoundedBox(p, u_lensHalfSize, u_lensRadius);

    // --- OUTSIDE THE LENS ---
    if (d > 0.0) {
      vec3 bg = texture2D(u_background, v_uv).rgb;

      // Physics Grounding Contact Shadow & Ambient Occlusion (Tighter & significantly reduced)
      vec2 shadowOffset = vec2(0.3 * u_dpr, mix(-1.0, -2.0, u_activeProgress) * u_dpr);
      float dShadow = sdRoundedBox(p - shadowOffset, u_lensHalfSize, u_lensRadius);
      float shadowDist = max(0.0, dShadow) / u_dpr;

      float contactAO = exp(-shadowDist * mix(0.24, 0.16, u_activeProgress)) * mix(0.016, 0.024, u_activeProgress);
      float penumbra = exp(-shadowDist * mix(0.09, 0.05, u_activeProgress)) * mix(0.006, 0.012, u_activeProgress);
      float totalShadow = contactAO + penumbra;

      gl_FragColor = vec4(bg * (1.0 - totalShadow), 1.0);
      return;
    }

    // --- INSIDE THE LENS ---
    float distInside = max(0.0, -d);
    vec3 bgDirect = texture2D(u_background, v_uv).rgb;

    float eps = 1.0 * u_dpr;
    float ripple = sin(p.x * 0.05 - u_velocity.x * 0.01) * cos(p.y * 0.08) * u_fluidWave * u_dpr;

    // Analytical 2D Normal Gradient of Pill Capsule Perimeter (exact 0px boundary normal)
    float dDx = sdRoundedBox(p + vec2(eps, 0.0), u_lensHalfSize, u_lensRadius) - sdRoundedBox(p - vec2(eps, 0.0), u_lensHalfSize, u_lensRadius);
    float dDy = sdRoundedBox(p + vec2(0.0, eps), u_lensHalfSize, u_lensRadius) - sdRoundedBox(p - vec2(0.0, eps), u_lensHalfSize, u_lensRadius);
    vec2 rimGrad = normalize(vec2(dDx, dDy) + 1e-5);

    // Continuous bevel from 0px border inward
    float bevelWidth = min(u_lensHalfSize.y * 0.45, 7.5 * u_dpr);
    float bevelFactor = clamp(distInside / bevelWidth, 0.0, 1.0);
    float smoothBevel = smoothstep(0.0, 1.0, bevelFactor);
    float rimSlope = pow(1.0 - bevelFactor, 1.3);

    // Dynamic fluid velocity shear tilt
    vec2 velocityShear = clamp(-u_velocity * 0.0003, vec2(-0.25), vec2(0.25));

    vec3 normal = normalize(vec3(-rimGrad * rimSlope * 1.8 + velocityShear, 1.0));
    vec3 incidentRay = vec3(0.0, 0.0, -1.0);
    vec3 viewDir = vec3(0.0, 0.0, 1.0);

    // Optical Path Depth physically driven by lens thickness
    float opticalGrowth = smoothstep(0.0, 0.85, u_activeProgress);
    float totalDepth = (16.0 * u_dpr * smoothBevel + u_splashHeight + ripple) * opticalGrowth;

    // Dynamic Index of Refraction
    float activeIOR = mix(1.0, u_ior, smoothstep(0.05, 0.95, u_activeProgress));

    // Dispersion flame starts at the border and expands inward according to u_dispersion value (0.00 to 1.00)
    float flameWidth = (2.5 + u_dispersion * 14.0) * u_dpr;
    float flameProgress = clamp(distInside / flameWidth, 0.0, 1.0);
    float flameFactor = pow(1.0 - flameProgress, 1.6);

    float safeDispersion = u_dispersion * 0.55 * flameFactor;

    // Vector Snell's Law Refraction + Cauchy 6-Band Spectral Dispersion
    vec3 totalRefractedColor = vec3(0.0);
    vec3 baseRefractedRay = refract(incidentRay, normal, 1.0 / activeIOR);
    if (length(baseRefractedRay) < 0.01) {
      baseRefractedRay = incidentRay;
    }

    // Dynamic optical border attraction pulling graphics directly to the main border (no inner ring, no gap)
    float attractReach = min(u_lensHalfSize.y * 0.65, 16.0 * u_dpr);
    float attractNorm = clamp(distInside / attractReach, 0.0, 1.0);
    float attractProfile = pow(1.0 - attractNorm, 1.8);
    float attractMagnitude = (u_attraction * 22.0 * u_dpr) * attractProfile * smoothstep(0.1, 0.9, u_activeProgress);
    vec2 attractOffset = -rimGrad * (attractMagnitude / u_resolution);
    float maxVerticalShift = (distInside * 0.35 + 1.5 * u_dpr) / u_resolution.y;
    attractOffset.y = clamp(attractOffset.y, -maxVerticalShift, maxVerticalShift);

    // Direct spectral flame displacement expanding inward with dispersion value (0.00 to 1.00)
    vec2 spectralDisplacement = -rimGrad * (((u_dispersion * 38.0) * u_dpr) / u_resolution) * flameFactor;

    // Smooth continuous optical curve: bending starts at borders and arches smoothly across the middle
    float uNorm = clamp(p.x / max(u_lensHalfSize.x, 1.0), -1.0, 1.0);
    float archCurve = cos(uNorm * 1.5707963); // smooth cosine arc: steep slope at edges, perfectly smooth round crest in middle
    float edgeContact = smoothstep(0.0, 5.0 * u_dpr, distInside);
    float smoothLineBend = archCurve * edgeContact;

    // Apply IOR ONLY to the border lines: icons sit in center (|p.y| < 16px), borders sit at (|p.y| > 24px)
    float borderZone = smoothstep(16.0 * u_dpr, 24.0 * u_dpr, abs(p.y));
    float lineBendStrength = (activeIOR - 1.0) * 16.0 * u_dpr * smoothLineBend * borderZone * smoothstep(0.1, 0.9, u_activeProgress);
    // Symmetrical optical refraction: bottom border bends upward (-), top border bends downward (+) toward center
    float vertDir = clamp(p.y / (10.0 * u_dpr), -1.0, 1.0);
    vec2 lineBendOffset = vec2(0.0, (vertDir * lineBendStrength) / u_resolution.y);

    // Bevel optics use stable base glass refraction so the IOR slider is exclusively for the border line bending
    float baseGlassIOR = 1.46;

    for (int i = 0; i < 6; i++) {
      float fi = (float(i) - 2.5) / 2.5; // -1.0 (Red) to +1.0 (Violet)
      float lambdaIOR = max(1.06, baseGlassIOR + fi * safeDispersion);

      vec3 refractedRay = refract(incidentRay, normal, 1.0 / lambdaIOR);
      if (length(refractedRay) < 0.01) {
        refractedRay = baseRefractedRay;
      }
      vec2 rayOffset = (refractedRay.xy / abs(refractedRay.z + 1e-4)) * (totalDepth / u_resolution);
      vec2 finalRayOffset = rayOffset + spectralDisplacement * fi + attractOffset + lineBendOffset;
      vec2 sampleUV = clamp(v_uv + finalRayOffset, vec2(0.002), vec2(0.998));

      vec3 spectralSample = texture2D(u_background, sampleUV).rgb;
      vec3 weight = getSpectralWeight(i);
      totalRefractedColor += spectralSample * weight;
    }

    // Pure optical liquid refraction: icons and text retain authentic dark color (no blue tinting)
    vec3 tintedRefraction = totalRefractedColor;

    // Schlick Fresnel Grazing Reflection
    float cosTheta = max(0.0, dot(normal, viewDir));
    float R0 = pow(max((activeIOR - 1.0) / (activeIOR + 1.0), 0.0), 2.0);
    float fresnel = (R0 + (1.0 - R0) * pow(1.0 - cosTheta, 4.0)) * smoothstep(0.1, 0.9, u_activeProgress);

    // Grazing Fresnel ambient glint
    vec3 ambientGlint = vec3(0.95, 0.98, 1.0) * fresnel * 0.25;

    // Final Composite Color (Pure Refracted Liquid Glass Optical Lens)
    vec3 finalFluidColor = (tintedRefraction * (1.0 - fresnel * 0.5)) + ambientGlint;

    // 1. Diagonal Dark Border: Right-Top (rimGrad.x > 0, rimGrad.y > 0) & Left-Bottom (rimGrad.x < 0, rimGrad.y < 0)
    float darkDiag = max(0.0, 2.0 * rimGrad.x * rimGrad.y);
    float darkTaper = smoothstep(0.06, 0.85, darkDiag);
    darkTaper = darkTaper * darkTaper; // smooth curve so tips merge seamlessly into the rest line
    float darkWidth = 0.65 * u_dpr;    // strictly subpixel < 1px
    float blackLine = exp(-pow(distInside / darkWidth, 2.0) * 2.5) * darkTaper * 0.65;

    // 2. Opposing Diagonal Pure White Specular Edge: Top-Left & Bottom-Right
    float whiteDiag = max(0.0, -2.0 * rimGrad.x * rimGrad.y);
    float whiteTaper = smoothstep(0.06, 0.85, whiteDiag);
    whiteTaper = whiteTaper * whiteTaper;
    float whiteWidth = 0.60 * u_dpr;   // strictly subpixel < 1px
    float whiteLine = exp(-pow(distInside / whiteWidth, 2.0) * 2.8) * whiteTaper * 0.80;

    // Apply diagonal borders to active fluid lens
    finalFluidColor = mix(finalFluidColor, vec3(0.05, 0.06, 0.08), blackLine);
    finalFluidColor = finalFluidColor + vec3(1.0) * whiteLine;

    // Resting Static Lens: Pure soft grey pill that cleanly displays the tab text and filled icon
    vec3 pureGrey = vec3(0.895, 0.905, 0.925);
    float staticEdgeAA = smoothstep(0.0, 1.4 * u_dpr, distInside);
    float restingDark = 1.0 - smoothstep(0.12, 0.65, dot(bgDirect, vec3(0.299, 0.587, 0.114)));
    vec3 restingContent = mix(pureGrey, bgDirect, restingDark);
    vec3 staticPillColor = mix(bgDirect, restingContent, staticEdgeAA);
    staticPillColor = mix(staticPillColor, vec3(0.08, 0.09, 0.11), blackLine * 0.55 * staticEdgeAA);
    staticPillColor = staticPillColor + vec3(1.0) * (whiteLine * 0.65 * staticEdgeAA);

    // Smooth physical ease curve for seamless metamorphosis (Static Grey Pill <-> Liquid Glass Lens)
    float easeProgress = smoothstep(0.0, 1.0, u_activeProgress);
    vec3 finalComposite = mix(staticPillColor, finalFluidColor, easeProgress);

    gl_FragColor = vec4(finalComposite, 1.0);
  }
`;

if (typeof window !== 'undefined') {
  window.lensFragmentShader = lensFragmentShader;
}
