/**
 * Liquid Glass Slider — Pure WebGL Physical Optics Engine
 * Surgical Pixel-Level Calculations & Real-time Snell's Law Refraction
 * Balanced Fluid Jelly Spring Physics & Tactile Bounce (Golden Middle Ground)
 */

(function () {
  'use strict';

  // DOM Elements
  const stage = document.getElementById('sliderStage');
  const glCanvas = document.getElementById('sliderGlCanvas') || (stage ? stage.querySelector('canvas') : document.getElementById('glcanvas'));
  const bgCanvas = document.getElementById('sliderBgCanvas') || document.getElementById('bgCanvas');
  const overlay = document.getElementById('sliderOverlay');
  const valueReadout = document.getElementById('valueReadout');

  // State
  let sliderValue = 0.72;        // 0.0 to 1.0
  let targetSliderValue = 0.72;  // Target value under pointer or keyboard
  let sliderVelocity = 0.0;      // Value per second for tap/release bounce
  let isDragging = false;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Balanced Jelly Spring Physics State
  let prevThumbX = null;
  let jellyStretchX = 1.0;
  let jellyStretchY = 1.0;
  let jellyVelocityX = 0.0;
  let jellyVelocityY = 0.0;
  let currentPressScale = 1.0;
  let wobbleIntensity = 0.0;
  let lastFrameTime = performance.now();

  // Geometric Constants (in CSS pixels)
  const THUMB_HALF_WIDTH = 54.0;
  const THUMB_HALF_HEIGHT = 30.0;
  const THUMB_RADIUS = 30.0;
  const TRACK_HEIGHT = 10.0;
  const TRACK_PADDING = 54.0; // Margin so thumb stays within stage bounds

  // Optical Constants
  const OPTICAL_IOR = 1.52;          // High-grade optical glass (Crown glass)
  const OPTICAL_DISPERSION = 0.038;  // Abbe chromatic dispersion
  const OPTICAL_LENS_HEIGHT = 14.0;  // Dome lens height

  // WebGL Pipeline
  let gl, program;
  let bgTexture;
  let uniforms = {};
  let bgCtx;

  // Initialize WebGL Context
  function initWebGL() {
    gl = glCanvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      console.error('WebGL not supported');
      return false;
    }

    // Compile Shaders
    const vs = compileShader(gl.VERTEX_SHADER, sliderVsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, sliderFsSource);

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return false;
    }

    gl.useProgram(program);

    // Fullscreen Quad Buffer
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

    const aPosition = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    // Cache Uniform Locations
    const uniformNames = [
      'u_background',
      'u_resolution',
      'u_thumbPos',
      'u_thumbHalfSize',
      'u_thumbRadius',
      'u_time',
      'u_sliderVal',
      'u_dragActive',
      'u_ior',
      'u_dispersion',
      'u_lensHeight',
      'u_wobble',
    ];

    uniformNames.forEach((name) => {
      uniforms[name] = gl.getUniformLocation(program, name);
    });

    // Create Background Texture
    bgTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    bgCtx = bgCanvas.getContext('2d', { alpha: false });

    return true;
  }

  function compileShader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  // Calculate Thumb X in CSS pixels
  function getThumbX(val) {
    const stageWidth = stage.clientWidth;
    const trackStart = TRACK_PADDING;
    const trackEnd = stageWidth - TRACK_PADDING;
    return trackStart + val * (trackEnd - trackStart);
  }

  // Calculate Value from Client X (clamped cleanly to [0.0, 1.0])
  function getValueFromClientX(clientX) {
    const rect = stage.getBoundingClientRect();
    const x = clientX - rect.left;
    const trackStart = TRACK_PADDING;
    const trackEnd = rect.width - TRACK_PADDING;
    const trackLength = Math.max(1, trackEnd - trackStart);
    const clamped = Math.max(trackStart, Math.min(trackEnd, x));
    return (clamped - trackStart) / trackLength;
  }

  // Render Crisp 2D Background Track
  function renderBackgroundTrack(thumbX) {
    const w = bgCanvas.width;
    const h = bgCanvas.height;
    const centerY = h * 0.5;

    // Pure Solid White Background Fill
    bgCtx.fillStyle = '#ffffff';
    bgCtx.fillRect(0, 0, w, h);

    const trackStart = TRACK_PADDING * dpr;
    const trackEnd = w - TRACK_PADDING * dpr;
    const trackH = TRACK_HEIGHT * dpr;
    const trackR = trackH * 0.5;
    const thumbXDev = thumbX * dpr;

    // 1. Inactive Track (Full track base in frosted grey)
    bgCtx.beginPath();
    bgCtx.roundRect(trackStart, centerY - trackR, trackEnd - trackStart, trackH, trackR);
    bgCtx.fillStyle = '#e2e8f0';
    bgCtx.fill();

    // 2. Active Track (Luxurious Apple Crimson Rose / Ruby gradient with smooth rounded dome tip)
    const activeEndX = thumbXDev + 6.0 * dpr;
    const activeWidth = Math.max(0, Math.min(trackEnd - trackStart, activeEndX - trackStart));
    if (activeWidth > 0) {
      bgCtx.save();
      bgCtx.beginPath();
      bgCtx.roundRect(trackStart, centerY - trackR, activeWidth, trackH, trackR);
      
      const redGrad = bgCtx.createLinearGradient(trackStart, 0, Math.min(trackEnd, activeEndX), 0);
      redGrad.addColorStop(0, '#be123c');   // Deep rich carmine ruby
      redGrad.addColorStop(0.5, '#e11d48'); // Luxurious Apple rose-ruby
      redGrad.addColorStop(1, '#f43f5e');   // Luminous soft coral rose
      bgCtx.fillStyle = redGrad;
      bgCtx.fill();
      bgCtx.restore();
    }

    // Upload rendered canvas to WebGL texture
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgCanvas);
  }

  // Resize Handler
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = stage.getBoundingClientRect();
    const width = Math.floor(rect.width * dpr);
    const height = Math.floor(rect.height * dpr);

    if (glCanvas.width !== width || glCanvas.height !== height) {
      glCanvas.width = width;
      glCanvas.height = height;
      bgCanvas.width = width;
      bgCanvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  // Main Render Loop
  let startTime = performance.now();

  function render() {
    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) * 0.001, 0.033);
    lastFrameTime = now;

    // --- 1. BALANCED POSITION TRACKING & TACTILE SPRING BOUNCE ---
    if (isDragging) {
      // During active drag: smooth, silky fluid follower
      // Tracks cursor closely (no mushy lag), with just enough elastic cushion to feel liquid
      const dragResponsiveness = Math.min(dt * 32.0, 0.65);
      const prevVal = sliderValue;
      sliderValue += (targetSliderValue - sliderValue) * dragResponsiveness;
      sliderVelocity = (sliderValue - prevVal) / Math.max(dt, 0.001);
    } else {
      // When released or tapped on track: sweet, clean spring bounce
      // stiffness = 280, damping = 22 (zeta ~ 0.66: 1 soft, satisfying micro-overshoot and immediate rest)
      const springK = 280.0;
      const springDamp = 22.0;
      const displacement = sliderValue - targetSliderValue;
      const springForce = -springK * displacement - springDamp * sliderVelocity;
      sliderVelocity += springForce * dt;
      sliderValue += sliderVelocity * dt;

      // Rest snap when practical motion ceases
      if (Math.abs(displacement) < 0.0003 && Math.abs(sliderVelocity) < 0.003) {
        sliderValue = targetSliderValue;
        sliderVelocity = 0.0;
      }
    }

    // Strict boundary safety [0.0, 1.0]
    sliderValue = Math.max(0.0, Math.min(1.0, sliderValue));

    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const currentThumbX = getThumbX(sliderValue);
    const currentThumbY = stageHeight * 0.5;

    // --- 2. BALANCED JELLY SQUASH, STRETCH & WOBBLE ---
    if (prevThumbX === null) prevThumbX = currentThumbX;
    const thumbSpeed = (currentThumbX - prevThumbX) / Math.max(dt, 0.001); // px/sec
    prevThumbX = currentThumbX;

    const absThumbSpeed = Math.abs(thumbSpeed);

    // Golden middle stretch: up to 12% elongation at brisk drag
    // Clearly visible deformation without warping or distorting the capsule silhouette
    const maxStretch = 0.12;
    const dynamicStretch = Math.min(absThumbSpeed * 0.00032, maxStretch);
    const baseTargetSx = 1.0 + dynamicStretch;
    // Volume preservation in cross-axis
    const baseTargetSy = 1.0 - dynamicStretch * 0.50;

    // Gentle tactile press-down squish
    const pressSpreadX = isDragging ? 0.02 : 0.0;
    const pressSquashY = isDragging ? 0.02 : 0.0;

    const targetStretchX = baseTargetSx + pressSpreadX;
    const targetStretchY = baseTargetSy - pressSquashY;

    // Tuned harmonic oscillator for jelly bounce:
    // zeta = 20.0 / (2 * sqrt(290)) ~ 0.59
    // Gives exactly ONE juicy, elastic rebound cycle when stopping, then settles smoothly!
    const jellyK = 290.0;
    const jellyDamp = 20.0;

    const forceX = -jellyK * (jellyStretchX - targetStretchX) - jellyDamp * jellyVelocityX;
    jellyVelocityX += forceX * dt;
    jellyStretchX += jellyVelocityX * dt;

    const forceY = -jellyK * (jellyStretchY - targetStretchY) - jellyDamp * jellyVelocityY;
    jellyVelocityY += forceY * dt;
    jellyStretchY += jellyVelocityY * dt;

    // Safe bounds
    jellyStretchX = Math.max(0.85, Math.min(1.18, jellyStretchX));
    jellyStretchY = Math.max(0.85, Math.min(1.18, jellyStretchY));

    // Smooth press scale
    const targetPressScale = isDragging ? 1.015 : 1.0;
    currentPressScale += (targetPressScale - currentPressScale) * Math.min(dt * 20.0, 1.0);

    // Dynamic fluid thumb dimensions
    const dynamicHalfW = THUMB_HALF_WIDTH * jellyStretchX * currentPressScale;
    const dynamicHalfH = THUMB_HALF_HEIGHT * jellyStretchY * currentPressScale;
    const dynamicRadius = Math.min(dynamicHalfW, dynamicHalfH);

    // Optical dome lens height modulation (coupled volume preservation)
    const fluidThickness = 1.0 / Math.max(0.80, Math.sqrt(jellyStretchX * jellyStretchY));
    const dynamicLensHeight = OPTICAL_LENS_HEIGHT * fluidThickness * dpr;

    // Subtle meniscus breathing intensity
    wobbleIntensity = Math.min((Math.abs(jellyVelocityX) + Math.abs(jellyVelocityY)) * 0.02, 0.15);

    // Draw Crisp Track into 2D Background Canvas & update texture
    renderBackgroundTrack(currentThumbX);

    // Update WebGL Uniforms
    gl.useProgram(program);
    gl.uniform1i(uniforms.u_background, 0);
    gl.uniform2f(uniforms.u_resolution, glCanvas.width, glCanvas.height);

    // Thumb position in WebGL pixel coordinates (Y flipped for GL texture coords)
    const glThumbX = currentThumbX * dpr;
    const glThumbY = (stageHeight - currentThumbY) * dpr;
    gl.uniform2f(uniforms.u_thumbPos, glThumbX, glThumbY);

    gl.uniform2f(uniforms.u_thumbHalfSize, dynamicHalfW * dpr, dynamicHalfH * dpr);
    gl.uniform1f(uniforms.u_thumbRadius, dynamicRadius * dpr);

    const time = (performance.now() - startTime) * 0.001;
    gl.uniform1f(uniforms.u_time, time);
    gl.uniform1f(uniforms.u_sliderVal, sliderValue);
    gl.uniform1f(uniforms.u_dragActive, isDragging ? 1.0 : 0.0);

    gl.uniform1f(uniforms.u_ior, OPTICAL_IOR);
    gl.uniform1f(uniforms.u_dispersion, OPTICAL_DISPERSION);
    gl.uniform1f(uniforms.u_lensHeight, dynamicLensHeight);
    gl.uniform1f(uniforms.u_wobble, wobbleIntensity);

    // Draw Quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Update UI Readout
    const displayVal = Math.round(sliderValue * 100);
    valueReadout.textContent = `${displayVal}%`;
    overlay.setAttribute('aria-valuenow', displayVal);

    requestAnimationFrame(render);
  }

  // Event Listeners for Drag and Touch
  function onPointerDown(e) {
    isDragging = true;
    overlay.setPointerCapture(e.pointerId);
    targetSliderValue = getValueFromClientX(e.clientX);

    // Gentle tactile cushion on press
    jellyVelocityY -= 1.0;
    jellyVelocityX += 0.8;
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    targetSliderValue = getValueFromClientX(e.clientX);
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    try {
      overlay.releasePointerCapture(e.pointerId);
    } catch (_) {}

    targetSliderValue = getValueFromClientX(e.clientX);

    // Gentle elastic pop on release
    jellyVelocityY += 1.0;
    jellyVelocityX -= 0.6;
  }

  // Keyboard accessibility
  overlay.addEventListener('keydown', (e) => {
    let delta = 0;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -0.05;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 0.05;
    if (e.key === 'Home') targetSliderValue = 0;
    if (e.key === 'End') targetSliderValue = 1;

    if (delta !== 0) {
      e.preventDefault();
      targetSliderValue = Math.max(0.0, Math.min(1.0, targetSliderValue + delta));
      sliderVelocity += delta * 2.0; // Gentle spring nudge
      jellyVelocityX += (delta > 0 ? 1.2 : -1.2);
    }
  });

  overlay.addEventListener('pointerdown', onPointerDown);
  overlay.addEventListener('pointermove', onPointerMove);
  overlay.addEventListener('pointerup', onPointerUp);
  overlay.addEventListener('pointercancel', onPointerUp);

  window.addEventListener('resize', resize);

  // Initialize
  if (initWebGL()) {
    resize();
    requestAnimationFrame(render);
  }
})();
