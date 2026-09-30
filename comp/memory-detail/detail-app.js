/**
 * Memory Detail WebGL App Controller
 * Ultra-Smooth Spring-Driven WebGL Expansion Engine
 * 
 * Features:
 * - Direct GPU texture upload with zero CORS delay
 * - Analytical Second-Order Damped Spring Physics (no linear easing, no sudden stops)
 * - Interruptible state transitions at any millisecond
 * - Interactive swipe/drag-to-dismiss gesture with spring snapping
 * - Automatic sleep state when idle (0% CPU/GPU overhead at rest)
 */

(function () {
  'use strict';

  // DOM Elements
  const viewport = document.querySelector('.phone-viewport');
  const memoryCard = document.getElementById('memoryCard');
  const canvas = document.getElementById('memoryDetailCanvas');
  const detailUI = document.getElementById('memoryDetailUI');
  const closeBtn = document.getElementById('detailCloseBtn');

  if (!viewport || !memoryCard || !canvas) return;

  // WebGL State
  let gl = null;
  let program = null;
  let imageTexture = null;
  let positionBuffer = null;
  let uniforms = {};

  // Device Pixel Ratio
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Layout Dimensions (CSS Pixels relative to viewport)
  let originRect = { x: 0, y: 0, w: 360, h: 310 };
  let targetRect = { x: 12, y: 54, w: 390, h: 480 };
  let currentRect = { ...originRect };

  // Aspect ratio of active image
  let imageAspect = 1.0;

  // Physics Spring Dynamics (Ultra-smooth, critically damped, velvety soft)
  const SPRING_CONFIG = {
    stiffness: 180.0, // Soft natural frequency
    damping: 27.0     // Perfect critical damping: zero jerk, zero oscillation
  };

  let progress = 0.0;        // 0.0 (resting in card) to 1.0 (fully expanded above)
  let targetProgress = 0.0;  // 0.0 or 1.0
  let velocity = 0.0;
  let isExpanded = false;
  let isAnimating = false;
  let lastFrameTime = performance.now();

  // Drag-to-dismiss Interactive Gesture Tracking
  let isDraggingDown = false;
  let dragStartY = 0;
  let dragCurrentY = 0;
  let dragVelocityY = 0;
  let lastDragTime = 0;

  /**
   * Compiles GLSL Shader
   */
  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * Initializes WebGL Context and Fullscreen Quad
   */
  function initWebGL() {
    gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false
    });

    if (!gl) {
      console.warn('WebGL detail view not supported');
      return false;
    }

    const vs = compileShader(gl.VERTEX_SHADER, detailVsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, detailFsSource);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return false;
    }

    gl.useProgram(program);

    // Quad geometry covering NDC [-1, 1]
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0
      ]),
      gl.STATIC_DRAW
    );

    const aPosition = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    uniforms = {
      u_image: gl.getUniformLocation(program, 'u_image'),
      u_resolution: gl.getUniformLocation(program, 'u_resolution'),
      u_currentRect: gl.getUniformLocation(program, 'u_currentRect'),
      u_progress: gl.getUniformLocation(program, 'u_progress'),
      u_imgAspect: gl.getUniformLocation(program, 'u_imgAspect'),
      u_cornerRadius: gl.getUniformLocation(program, 'u_cornerRadius')
    };

    // Create persistent image texture unit
    imageTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Blending mode for transparent backdrop compositing
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    return true;
  }

  /**
   * Updates WebGL Canvas Resolution to match phone viewport
   */
  function resizeCanvas() {
    if (!gl) return;
    const vpRect = viewport.getBoundingClientRect();
    const w = vpRect.width || 390;
    const h = vpRect.height || 844;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  /**
   * Uploads Active Image into WebGL Texture
   */
  function uploadActiveImage() {
    if (!gl) return;
    const activeImg = memoryCard.querySelector('.layer-active') || memoryCard.querySelector('img');
    if (!activeImg || !activeImg.complete || !activeImg.naturalWidth) return;

    imageAspect = (activeImg.naturalWidth / activeImg.naturalHeight) || 1.0;

    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    // Directly upload DOM Image object into GPU memory
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, activeImg);
  }

  /**
   * Computes Origin and Target Rectangles relative to phone viewport
   */
  function updateRects() {
    const vpRect = viewport.getBoundingClientRect();
    const cardRect = memoryCard.getBoundingClientRect();

    // Origin: Exact coordinates of card within viewport
    originRect = {
      x: cardRect.left - vpRect.left,
      y: cardRect.top - vpRect.top,
      w: cardRect.width,
      h: cardRect.height
    };

    // Target: Elevated slightly above + bigger size
    const targetW = Math.min(vpRect.width - 24, 404);
    // Calculate balanced portrait height based on viewport
    const targetH = Math.min(vpRect.height * 0.64, 520);
    const targetX = (vpRect.width - targetW) * 0.5;
    // Elevate upwards slightly towards the header area
    const targetY = Math.max(34, vpRect.height * 0.12);

    targetRect = {
      x: targetX,
      y: targetY,
      w: targetW,
      h: targetH
    };
  }

  /**
   * Render Loop (Runs only when active or animating)
   */
  function render(now) {
    if (!isAnimating) return;

    const dt = Math.min(24, Math.max(1, now - lastFrameTime)) / 1000;
    lastFrameTime = now;

    // 1. Multi-Substep Spring Integration (Buttery 60/120/144Hz consistency)
    const substeps = 2;
    const subDt = dt / substeps;

    for (let s = 0; s < substeps; s++) {
      let currentTarget = targetProgress;

      // If dragging down, pull target downwards with rubber-band
      if (isDraggingDown) {
        const dragOffset = Math.max(0, dragCurrentY - dragStartY);
        const dragFactor = Math.max(0, 1.0 - (dragOffset / 420));
        currentTarget = dragFactor;
      }

      const displacement = progress - currentTarget;
      const springForce = -SPRING_CONFIG.stiffness * displacement - SPRING_CONFIG.damping * velocity;
      velocity += springForce * subDt;
      progress += velocity * subDt;
    }

    // Boundary snap and sleep detection
    if (Math.abs(progress - targetProgress) < 0.0006 && Math.abs(velocity) < 0.0015 && !isDraggingDown) {
      progress = targetProgress;
      velocity = 0.0;

      // Rested at closed (0.0): sleep animation loop
      if (progress <= 0.001) {
        progress = 0.0;
        isAnimating = false;
        canvas.style.pointerEvents = 'none';
        canvas.classList.remove('active');
        if (detailUI) detailUI.classList.remove('visible');
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
    }

    // 2. Pure Natural Spring Progress Mapping (No artificial curve distortion)
    const t = Math.max(0, Math.min(1.0, progress));

    currentRect.x = originRect.x + (targetRect.x - originRect.x) * t;
    currentRect.y = originRect.y + (targetRect.y - originRect.y) * t;
    currentRect.w = originRect.w + (targetRect.w - originRect.w) * t;
    currentRect.h = originRect.h + (targetRect.h - originRect.h) * t;

    // Corner radius smoothly scales from 30px (resting card) to 34px (elevated view)
    const cornerRadius = (30.0 + 4.0 * t) * dpr;

    // 3. WebGL Draw Call
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Uniforms in device pixels
    gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
    gl.uniform4f(
      uniforms.u_currentRect,
      currentRect.x * dpr,
      currentRect.y * dpr,
      currentRect.w * dpr,
      currentRect.h * dpr
    );
    gl.uniform1f(uniforms.u_progress, t);
    gl.uniform1f(uniforms.u_imgAspect, imageAspect);
    gl.uniform1f(uniforms.u_cornerRadius, cornerRadius);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.uniform1i(uniforms.u_image, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  }

  /**
   * Starts Smooth WebGL Expansion
   */
  function openDetail() {
    if (!gl && !initWebGL()) return;

    resizeCanvas();
    updateRects();
    uploadActiveImage();

    targetProgress = 1.0;
    isExpanded = true;
    canvas.style.pointerEvents = 'auto';
    canvas.classList.add('active');
    if (detailUI) detailUI.classList.add('visible');

    if (!isAnimating) {
      isAnimating = true;
      lastFrameTime = performance.now();
      requestAnimationFrame(render);
    }
  }

  /**
   * Smoothly Glides Back to Resting Card
   */
  function closeDetail() {
    if (!isExpanded && targetProgress === 0.0) return;

    targetProgress = 0.0;
    isExpanded = false;
    isDraggingDown = false;
    if (detailUI) detailUI.classList.remove('visible');

    if (!isAnimating) {
      isAnimating = true;
      lastFrameTime = performance.now();
      requestAnimationFrame(render);
    }
  }

  // --- Interaction Event Listeners ---

  // 1. Click on Memory Photo Card triggers open
  memoryCard.addEventListener('click', (e) => {
    // Only open if not already expanded
    if (!isExpanded) {
      openDetail();
    }
  });

  // 2. Click on WebGL canvas or close button triggers close
  canvas.addEventListener('click', (e) => {
    if (isDraggingDown) return;
    closeDetail();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDetail();
    });
  }

  // 3. Fluid Drag / Swipe-to-dismiss gesture on canvas
  canvas.addEventListener('pointerdown', (e) => {
    if (!isExpanded) return;
    isDraggingDown = true;
    dragStartY = e.clientY;
    dragCurrentY = e.clientY;
    lastDragTime = performance.now();
    dragVelocityY = 0;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDraggingDown) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastDragTime) / 1000;
    const dy = e.clientY - dragCurrentY;
    dragVelocityY = dy / dt;
    dragCurrentY = e.clientY;
    lastDragTime = now;
  });

  function endPointerDrag(e) {
    if (!isDraggingDown) return;
    isDraggingDown = false;
    try {
      if (e && e.pointerId) canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}

    const totalDragY = dragCurrentY - dragStartY;

    // If dragged down > 64px or flicked down with velocity, dismiss smoothly
    if (totalDragY > 64 || dragVelocityY > 380) {
      velocity = -Math.min(3.5, Math.abs(dragVelocityY) * 0.003);
      closeDetail();
    } else {
      // Otherwise spring back open cleanly
      targetProgress = 1.0;
      if (!isAnimating) {
        isAnimating = true;
        lastFrameTime = performance.now();
        requestAnimationFrame(render);
      }
    }
  }

  canvas.addEventListener('pointerup', endPointerDrag);
  canvas.addEventListener('pointercancel', endPointerDrag);

  // 4. Keyboard Escape key to dismiss
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isExpanded) {
      closeDetail();
    }
  });

  // 5. Update canvas sizing on window resize
  window.addEventListener('resize', () => {
    if (isExpanded) {
      resizeCanvas();
      updateRects();
    }
  });

  // Initialize WebGL context early on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    initWebGL();
  });
})();
