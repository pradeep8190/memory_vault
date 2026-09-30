/**
 * Memory Detail WebGL Optical Shaders — Pure High-Fidelity Image
 * 
 * Features:
 * - 100% Pure, crystal-clear photo rendering (Zero artificial tint, zero color aberration)
 * - Analytical 2D Rounded Box SDF with sub-pixel antialiased edges
 * - True object-fit cover UV mapping preserving exact native aspect ratio
 * - Silky smooth elevated ambient drop shadow
 * - Clean translucent backdrop scrim
 */

const detailVsSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const detailFsSource = `
  precision highp float;

  varying vec2 v_uv;

  uniform sampler2D u_image;
  uniform vec2 u_resolution;       // Viewport resolution in device pixels
  uniform vec4 u_currentRect;      // [x, y, width, height] in viewport coordinates (top-left origin)
  uniform float u_progress;        // 0.0 (closed) to 1.0 (fully expanded)
  uniform float u_imgAspect;       // Image width / height
  uniform float u_cornerRadius;    // Smooth rounded corner radius in pixels

  // 2D Signed Distance Field for Rounded Box
  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    // fragCoord in pixels, top-left origin (0,0) matching DOM coordinates
    vec2 fragCoord = vec2(v_uv.x * u_resolution.x, (1.0 - v_uv.y) * u_resolution.y);

    float t = clamp(u_progress, 0.0, 1.0);

    // 1. Clean Dark Backdrop Scrim
    float scrimAlpha = t * 0.76;

    // 2. Card Optical Center and Extents
    vec2 rectCenter = u_currentRect.xy + u_currentRect.zw * 0.5;
    vec2 halfSize = u_currentRect.zw * 0.5;
    vec2 p = fragCoord - rectCenter;

    // 3. Multi-tier Natural Elevated Drop Shadow (Silky, diffuse, zero harshness)
    float shadowContactDist = sdRoundedBox(p - vec2(0.0, 4.0 + 8.0 * t), halfSize, u_cornerRadius);
    float shadowContact = 1.0 - smoothstep(-4.0, 22.0 + 16.0 * t, shadowContactDist);

    float shadowDeepDist = sdRoundedBox(p - vec2(0.0, 8.0 + 26.0 * t), halfSize, u_cornerRadius);
    float shadowDeep = 1.0 - smoothstep(-2.0, 42.0 + 36.0 * t, shadowDeepDist);

    float combinedShadow = (shadowContact * 0.20 + shadowDeep * 0.36) * t;

    // 4. Analytical SDF Rounded Card Boundary
    float dist = sdRoundedBox(p, halfSize, u_cornerRadius);
    float cardMask = 1.0 - smoothstep(-0.6, 0.6, dist);

    // 5. Image UV with object-fit: cover mapping (Zero distortion)
    vec2 localUV = (p + halfSize) / max(u_currentRect.zw, vec2(1.0));
    float cardAspect = u_currentRect.z / max(u_currentRect.w, 1.0);

    vec2 imageUV = localUV;
    if (u_imgAspect > cardAspect) {
      float scale = cardAspect / max(u_imgAspect, 0.001);
      imageUV.x = (localUV.x - 0.5) * scale + 0.5;
    } else {
      float scale = u_imgAspect / max(cardAspect, 0.001);
      imageUV.y = (localUV.y - 0.5) * scale + 0.5;
    }

    // 6. 100% Pure, Untouched Image Sampling (Zero chromatic split, zero false colors)
    vec3 col = texture2D(u_image, clamp(imageUV, 0.0, 1.0)).rgb;

    // 7. Layer Compositing
    if (dist > 0.0) {
      // Outside of card: clean scrim + drop shadow
      float outAlpha = max(scrimAlpha, combinedShadow);
      gl_FragColor = vec4(vec3(0.0), outAlpha);
    } else {
      // Inside card: sharp, pure photo with sub-pixel antialiasing
      float finalAlpha = max(scrimAlpha, cardMask);
      gl_FragColor = vec4(col, finalAlpha);
    }
  }
`;
