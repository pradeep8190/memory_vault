/**
 * Liquid Glass Search Bar — Core Physics & WebGL Optics Engine
 * Zero Dead Code — Clean Modular Architecture
 * 
 * Implements:
 * - Analytical pill capsule geometry
 * - Exact uniform bindings for left/right black edge and top/bottom white reflections
 * - Tactile spring physics & focus dynamics
 * - High-precision studio card background rasterizer with engineering grid
 */

(function () {
  'use strict';

  // DOM Elements
  const stage = document.getElementById('stageContainer');
  const glCanvas = document.getElementById('glcanvas');
  const bgCanvas = document.getElementById('bgCanvas');
  const searchUIContainer = document.getElementById('searchUIContainer');
  const searchBarFrame = document.getElementById('searchBarFrame');
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');
  const shortcutBadge = document.getElementById('shortcutBadge');

  // Device Pixel Ratio
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Optical Constants
  const OPTICAL_IOR = 1.530;
  const OPTICAL_DISPERSION = 0.048;
  const BASE_LENS_HEIGHT = 14.5;
  let pillWidthCss = 440.0;
  const PILL_HEIGHT_CSS = 56.0;
  const PILL_RADIUS_CSS = PILL_HEIGHT_CSS * 0.5; // True capsule

  // Pill Position in Stage Coordinates
  let pillCenterX = 0;
  let pillCenterY = 0;

  // Spring & Dynamic Interaction Physics
  let pressScale = 1.0;
  let targetPressScale = 1.0;
  let pressVelocity = 0.0;

  let focusProgress = 0.0;
  let targetFocusProgress = 0.0;

  let lastFrameTime = performance.now();

  // WebGL State
  let gl, program;
  let bgTexture;
  let uniforms = {};
  let bgCtx;

  // Initialize WebGL
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

    const vs = compileShader(gl.VERTEX_SHADER, searchVsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, searchFsSource);

    if (!vs || !fs) {
      console.error('Failed to compile shaders');
      return false;
    }

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return false;
    }

    gl.useProgram(program);

    // Fullscreen Quad Geometry
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
      'u_pillPos',
      'u_pillHalfSize',
      'u_pillRadius',
      'u_pressScale',
      'u_focusProgress',
      'u_ior',
      'u_dispersion',
      'u_lensHeight',
    ];

    uniformNames.forEach((name) => {
      uniforms[name] = gl.getUniformLocation(program, name);
    });

    // Create 2D Background Texture
    bgTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

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

  /**
   * Render High-Precision 2D Studio Background:
   * - Studio card surface with soft ambient lighting gradient
   * - Subtle engineering grid lines (soft whiteness-grey)
   */
  function renderBackground() {
    const w = bgCanvas.width;
    const h = bgCanvas.height;

    // Pure solid white fill — no grid, no lines, no gradients
    bgCtx.fillStyle = '#ffffff';
    bgCtx.fillRect(0, 0, w, h);

    // Upload to WebGL texture
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgCanvas);
  }

  // Handle Resize & Align Glass Pill with DOM Overlay
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = stage ? stage.getBoundingClientRect() : { width: 360, height: 60 };
    const width = Math.round(rect.width) || 360;
    const height = Math.round(rect.height) || 60;

    // Mobile-adaptive width: scale down on small screens, clamp to max 440px
    pillWidthCss = Math.min(440.0, Math.max(260.0, width - 24));
    if (searchBarFrame) {
      searchBarFrame.style.width = `${pillWidthCss}px`;
    }

    glCanvas.width = width * dpr;
    glCanvas.height = height * dpr;
    bgCanvas.width = width * dpr;
    bgCanvas.height = height * dpr;

    gl.viewport(0, 0, glCanvas.width, glCanvas.height);

    // Pill optical center
    pillCenterX = width * 0.5;
    pillCenterY = height * 0.5;

    // Position the DOM overlay precisely over the WebGL pill
    if (searchUIContainer) {
      searchUIContainer.style.left = `${pillCenterX - pillWidthCss * 0.5}px`;
      searchUIContainer.style.top = `${pillCenterY - PILL_HEIGHT_CSS * 0.5}px`;
    }

    renderBackground();
  }

  // Setup UI and Physics Interactions
  function initInteractions() {
    // Detect OS for shortcut display (Mac: ⌘K, Windows/Linux: Ctrl K)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (shortcutBadge) {
      shortcutBadge.textContent = isMac ? '⌘K' : 'Ctrl K';
    }

    // Input Events
    searchInput.addEventListener('focus', () => {
      targetFocusProgress = 1.0;
      searchBarFrame.classList.add('focused');
    });

    searchInput.addEventListener('blur', () => {
      targetFocusProgress = 0.0;
      searchBarFrame.classList.remove('focused');
    });

    searchInput.addEventListener('input', () => {
      if (searchInput.value.length > 0) {
        clearBtn.classList.add('visible');
      } else {
        clearBtn.classList.remove('visible');
      }
    });

    // Clear Button
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      searchInput.value = '';
      clearBtn.classList.remove('visible');
      searchInput.focus();
      // Tactile spring recoil
      pressVelocity = -0.015;
    });

    // Tactile Pointer Feedback on Glass Search Bar
    searchBarFrame.addEventListener('pointerdown', () => {
      targetPressScale = 0.982;
      searchBarFrame.classList.add('pressed');
    });

    window.addEventListener('pointerup', () => {
      targetPressScale = 1.0;
      searchBarFrame.classList.remove('pressed');
    });

    // Keyboard Shortcuts (⌘K or Ctrl+K to focus, Escape to dismiss)
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        // Subtle spring pulse
        pressVelocity = -0.02;
      } else if (e.key === 'Escape') {
        searchInput.blur();
        targetFocusProgress = 0.0;
      }
    });
  }

  // Animation & Physics Tick
  function updatePhysics(dt) {
    // Spring physics for pressScale (mass = 1, stiffness = 320, damping = 22)
    const k = 320.0;
    const d = 22.0;
    const force = -k * (pressScale - targetPressScale) - d * pressVelocity;
    pressVelocity += force * dt;
    pressScale += pressVelocity * dt;

    // Smooth lerp for focus progress
    focusProgress += (targetFocusProgress - focusProgress) * Math.min(1.0, dt * 14.0);
  }

  // Main Render Loop
  function render(time) {
    const dt = Math.min((time - lastFrameTime) / 1000.0, 0.1);
    lastFrameTime = time;

    updatePhysics(dt);

    gl.useProgram(program);

    // Convert coordinates: WebGL Y is 0 at bottom, height at top
    const webglPillX = pillCenterX * dpr;
    const webglPillY = (glCanvas.height / dpr - pillCenterY) * dpr;

    const halfW = (pillWidthCss * 0.5) * dpr;
    const halfH = (PILL_HEIGHT_CSS * 0.5) * dpr;
    const radius = PILL_RADIUS_CSS * dpr;

    // Bind Uniforms
    gl.uniform1i(uniforms.u_background, 0);
    gl.uniform2f(uniforms.u_resolution, glCanvas.width, glCanvas.height);
    gl.uniform2f(uniforms.u_pillPos, webglPillX, webglPillY);
    gl.uniform2f(uniforms.u_pillHalfSize, halfW, halfH);
    gl.uniform1f(uniforms.u_pillRadius, radius);
    gl.uniform1f(uniforms.u_pressScale, pressScale);
    gl.uniform1f(uniforms.u_focusProgress, focusProgress);
    gl.uniform1f(uniforms.u_ior, OPTICAL_IOR);
    gl.uniform1f(uniforms.u_dispersion, OPTICAL_DISPERSION);
    gl.uniform1f(uniforms.u_lensHeight, BASE_LENS_HEIGHT * dpr);

    // Bind Background Texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);

    // Draw Quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  }

  // Initialization
  function init() {
    if (!initWebGL()) return;
    initInteractions();
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
