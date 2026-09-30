/**
 * Ultra-Fluid Scrolling Timeline Ruler (2008 - 2026)
 * 
 * Features:
 * - Continuous infinite scrollable tape timeline
 * - Fixed center optical needle with bilateral mirror symmetry
 * - Coupled Liquid Wave amplitude swell as ticks pass through the center
 * - Magnetic soft detent snaps & inertial flick momentum
 * - Dual-tone ASMR procedural mechanical click synthesizer
 * - Year broadcast event for real-time memory photo synchronization
 */

(function () {
  'use strict';

  const container = document.getElementById('rulerContainer');
  const canvas = document.getElementById('rulerCanvas');
  if (!container || !canvas) return;
  const ctx = canvas.getContext('2d');

  // Dual-Tone ASMR Mechanical Synthesizer
  let audioCtx = null;
  let lastClickTime = 0;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playMicroClick(speedRatio = 1, isMajor = false) {
    const nowMs = performance.now();
    const minInterval = Math.max(14, 28 - speedRatio * 14);
    if (nowMs - lastClickTime < minInterval) return;
    lastClickTime = nowMs;

    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;

      // 1. Crisp Metallic Transient
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      const highFreq = isMajor ? 2400 : 3100;
      osc1.frequency.setValueAtTime(highFreq + speedRatio * 300, now);
      osc1.frequency.exponentialRampToValueAtTime(1100, now + 0.005);

      const highVol = Math.min(0.045, (isMajor ? 0.038 : 0.022) + speedRatio * 0.015);
      gain1.gain.setValueAtTime(highVol, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.005);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.005);

      // 2. Warm Mechanical Body Thud
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      const lowFreq = isMajor ? 720 : 940;
      osc2.frequency.setValueAtTime(lowFreq, now);
      osc2.frequency.exponentialRampToValueAtTime(260, now + 0.008);

      const lowVol = Math.min(0.03, (isMajor ? 0.025 : 0.014) + speedRatio * 0.01);
      gain2.gain.setValueAtTime(lowVol, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now);
      osc2.stop(now + 0.008);
    } catch (_) {}
  }

  // Component Configuration
  const CONFIG = {
    minYear: 2008,
    maxYear: 2026,
    initialValue: 2024,
    pixelsPerYear: 92.0,    // Generous horizontal spacing per year for comfortable scrolling
    ticksPerYear: 4,        // 4 divisions per year (quarterly ticks: 23px apart)
    minTickHeight: 6.0,     // Resting height of edge ticks
    baseMaxTickHeight: 38,  // Peak height at center needle
    speedAmpBonus: 8,       // Dynamic swell with kinetic energy
    baseBellSpread: 40,     // Wave spread in pixels around center needle
    speedSpreadBonus: 8,    // Spread expansion with speed
    needleWidth: 2.2,       // Crisp center needle width
    needleColor: '#ff3b30', // Vibrant Precision Red Pointer
    tickWidth: 1.15,
    labelSpread: 56,
    baselineOffset: 38,
    labelOffset: 16
  };

  const totalYears = CONFIG.maxYear - CONFIG.minYear;
  const step = 1 / CONFIG.ticksPerYear;

  // Pointer Motion Constants
  const POINTER_SNAP_SPRING = 320;
  const POINTER_DAMPING = 28;

  // State Management
  let currentValue = CONFIG.initialValue;
  let targetValue = CONFIG.initialValue;
  let pointerVelocity = 0;
  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerTime = 0;
  let lastNotifiedYear = Math.round(CONFIG.initialValue);
  let activeDisplayYear = Math.round(CONFIG.initialValue);
  let lastYearSwitchTime = 0;

  /**
   * Direction-Aware Hysteresis Year Resolver
   * Eliminates rapid back-and-forth image flickering when resting near the 0.50 midpoint
   * @param {number} val - Continuous ruler position
   * @param {number} vel - Scroll velocity (positive = scrolling forward, negative = scrolling backward)
   * @param {number} now - High-res timestamp
   */
  function resolveStableYear(val, vel, now) {
    const floorYear = Math.floor(val);
    const fraction = val - floorYear; // 0.0 to 1.0 (position between floorYear and floorYear + 1)

    let candidateYear = activeDisplayYear;

    if (activeDisplayYear === floorYear) {
      // Currently locked on the lower year:
      // If moving forward (vel > 0.03), commit to next year as soon as fraction >= 0.44
      // If resting or moving backward, require a deeper commitment (>= 0.56) to avoid jitter
      const threshold = (vel > 0.03) ? 0.44 : 0.56;
      if (fraction >= threshold) {
        candidateYear = floorYear + 1;
      }
    } else if (activeDisplayYear === floorYear + 1) {
      // Currently locked on the higher year:
      // If moving backward (vel < -0.03), commit to lower year as soon as fraction <= 0.56
      // If resting or moving forward, require a deeper commitment (<= 0.44) to avoid jitter
      const threshold = (vel < -0.03) ? 0.56 : 0.44;
      if (fraction <= threshold) {
        candidateYear = floorYear;
      }
    } else {
      // Fast long-distance flick/jump: resolve closest, breaking exact ties with velocity
      if (Math.abs(fraction - 0.5) < 0.03) {
        candidateYear = vel >= 0 ? floorYear + 1 : floorYear;
      } else {
        candidateYear = Math.round(val);
      }
    }

    candidateYear = Math.max(CONFIG.minYear, Math.min(CONFIG.maxYear, candidateYear));

    // Time-debouncing: prevent switching faster than 65ms during rapid mechanical vibration
    if (candidateYear !== activeDisplayYear && (now - lastYearSwitchTime < 65)) {
      return activeDisplayYear;
    }

    return candidateYear;
  }

  // Dynamic Amplitude & Wave State
  let currentMaxHeight = CONFIG.baseMaxTickHeight;
  let currentBellSpread = CONFIG.baseBellSpread;

  // Canvas Resizing with High-DPI support
  let width = 0;
  let height = 0;
  let dpr = 1;
  let lastFrameTime = performance.now();

  function resize() {
    const rect = container.getBoundingClientRect();
    width = rect.width || 360;
    height = rect.height || 105;
    dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.resetTransform();
    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', resize);
  resize();

  function getBellFactor(dist, sigma) {
    return Math.exp(-0.5 * Math.pow(dist / sigma, 2));
  }

  // Render Frame
  function render() {
    ctx.clearRect(0, 0, width, height);

    const centerX = width * 0.5;
    const baselineY = height - CONFIG.baselineOffset;

    // Calculate visible year range with padding
    const halfVisibleSpan = (width * 0.5) / CONFIG.pixelsPerYear + 1.5;
    const minVisYear = Math.max(CONFIG.minYear, Math.floor(currentValue - halfVisibleSpan));
    const maxVisYear = Math.min(CONFIG.maxYear, Math.ceil(currentValue + halfVisibleSpan));

    const minTickIndex = (minVisYear - CONFIG.minYear) * CONFIG.ticksPerYear;
    const maxTickIndex = (maxVisYear - CONFIG.minYear) * CONFIG.ticksPerYear;

    // 1. Draw Scrolling Ticks with Dynamic Wave Heights
    for (let i = minTickIndex; i <= maxTickIndex; i++) {
      const val = CONFIG.minYear + i * step;
      // Position on scrolling tape relative to center needle
      const x = centerX + (val - currentValue) * CONFIG.pixelsPerYear;

      if (x < -20 || x > width + 20) continue;

      const distFromCenter = Math.abs(x - centerX);
      const isIntegerYear = (i % CONFIG.ticksPerYear === 0);

      const bell = getBellFactor(distFromCenter, currentBellSpread);
      const tickH = CONFIG.minTickHeight + (currentMaxHeight - CONFIG.minTickHeight) * bell;
      const alpha = isIntegerYear ? (0.35 + 0.65 * bell) : (0.15 + 0.55 * bell);

      ctx.beginPath();
      ctx.lineWidth = isIntegerYear ? 1.4 : CONFIG.tickWidth;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha.toFixed(3)})`;
      ctx.moveTo(x, baselineY);
      ctx.lineTo(x, baselineY - tickH);
      ctx.stroke();

      // 2. Draw Year Labels for Every Year (Ample 92px spacing prevents any overlap!)
      if (isIntegerYear) {
        const yearVal = Math.round(val);
        const labelBell = getBellFactor(distFromCenter, CONFIG.labelSpread);
        const labelAlpha = 0.25 + 0.75 * labelBell;
        const isNearCenter = distFromCenter < 18;

        const scale = 1 + 0.16 * Math.pow(labelBell, 2.0);
        const fontSize = 11.0 * scale;

        ctx.save();
        ctx.translate(x, baselineY + CONFIG.labelOffset);
        ctx.font = `${isNearCenter ? '700' : '500'} ${fontSize.toFixed(1)}px 'Inter', -apple-system, sans-serif`;
        ctx.fillStyle = isNearCenter ? '#000000' : `rgba(0, 0, 0, ${labelAlpha.toFixed(3)})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(yearVal.toString(), 0, 0);
        ctx.restore();
      }
    }

    // 3. Draw Fixed Center Pointer Needle (Locked at center, tactile Apple-style)
    ctx.beginPath();
    ctx.lineWidth = CONFIG.needleWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = CONFIG.needleColor; // Red Center Needle
    ctx.moveTo(centerX, baselineY + 2);
    ctx.lineTo(centerX, baselineY - (currentMaxHeight + 4));
    ctx.stroke();

    // Center Needle Tip Dot
    ctx.beginPath();
    ctx.arc(centerX, baselineY - (currentMaxHeight + 5), 2.2, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.needleColor;
    ctx.fill();

    // Accessibility
    container.setAttribute('aria-valuenow', (Math.round(currentValue * 100) / 100).toFixed(2));
  }

  // Animation Loop with Fluid Inertia & Snap
  function animate(now) {
    const dt = Math.min(24, Math.max(1, now - lastFrameTime)) / 1000;
    lastFrameTime = now;

    // 1. Pointer Motion & Inertial Momentum
    if (!isDragging) {
      if (targetValue < CONFIG.minYear) {
        const pull = (CONFIG.minYear - targetValue) * 16;
        pointerVelocity += pull * dt;
        pointerVelocity *= Math.pow(0.80, dt * 60);
        targetValue += pointerVelocity * dt;
      } else if (targetValue > CONFIG.maxYear) {
        const pull = (CONFIG.maxYear - targetValue) * 16;
        pointerVelocity += pull * dt;
        pointerVelocity *= Math.pow(0.80, dt * 60);
        targetValue += pointerVelocity * dt;
      } else {
        pointerVelocity *= Math.pow(0.92, dt * 60);
        targetValue += pointerVelocity * dt;

        // Magnetic soft snap into nearest quarter tick
        if (Math.abs(pointerVelocity) < 0.22) {
          const nearest = Math.round(targetValue / step) * step;
          const snapForce = (nearest - targetValue) * POINTER_SNAP_SPRING;
          pointerVelocity += snapForce * dt;
        }
      }
    }

    // Fluid interpolation toward targetValue
    const catchupRate = isDragging ? 30 : 24;
    currentValue += (targetValue - currentValue) * (1 - Math.exp(-catchupRate * dt));

    // Dynamic Kinetic Amplitude Swell
    const speedRatio = Math.min(1.2, Math.abs(pointerVelocity) / 2.5);
    const targetMaxH = CONFIG.baseMaxTickHeight + speedRatio * CONFIG.speedAmpBonus;
    const targetSpread = CONFIG.baseBellSpread + speedRatio * CONFIG.speedSpreadBonus;
    currentMaxHeight += (targetMaxH - currentMaxHeight) * (1 - Math.exp(-12 * dt));
    currentBellSpread += (targetSpread - currentBellSpread) * (1 - Math.exp(-12 * dt));

    // Acoustic Micro-Clicks & Active Year Notification with Hysteresis Stability
    const stableYear = resolveStableYear(currentValue, pointerVelocity, now);

    if (stableYear !== activeDisplayYear) {
      const speedRatioClick = Math.min(2.5, Math.abs(pointerVelocity) / 2.8);
      playMicroClick(speedRatioClick, true);

      if (navigator.vibrate && Math.abs(pointerVelocity) > 1.2) {
        navigator.vibrate(2);
      }
      activeDisplayYear = stableYear;
      lastNotifiedYear = stableYear;
      lastYearSwitchTime = now;

      // Broadcast active year change to memory card
      window.dispatchEvent(new CustomEvent('memoryYearChange', { detail: { year: stableYear } }));
    }

    render();
    requestAnimationFrame(animate);
  }

  // Pointer Interaction: Scrolling Tape Drag
  container.addEventListener('pointerdown', (e) => {
    initAudio();
    isDragging = true;
    lastPointerX = e.clientX;
    lastPointerTime = performance.now();
    pointerVelocity = 0;
    container.setPointerCapture(e.pointerId);
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;

    const now = performance.now();
    const dx = e.clientX - lastPointerX;
    const dt = Math.max(1, now - lastPointerTime) / 1000;

    // Scrolling tape: drag right moves timeline left (past years), drag left moves timeline right (future years)
    const deltaVal = -dx / CONFIG.pixelsPerYear;
    targetValue = Math.max(CONFIG.minYear - 0.25, Math.min(CONFIG.maxYear + 0.25, targetValue + deltaVal));

    const instantVel = deltaVal / dt;
    pointerVelocity = 0.55 * pointerVelocity + 0.45 * instantVel;

    lastPointerX = e.clientX;
    lastPointerTime = now;
  });

  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    try {
      if (e && e.pointerId) container.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }

  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // Wheel interaction with momentum
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    initAudio();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const deltaVal = (delta * 0.003);
    targetValue = Math.max(CONFIG.minYear - 0.25, Math.min(CONFIG.maxYear + 0.25, targetValue + deltaVal));
    pointerVelocity += deltaVal * 10;
  }, { passive: false });

  // Keyboard navigation
  container.addEventListener('keydown', (e) => {
    initAudio();
    if (e.key === 'ArrowLeft') {
      targetValue = Math.max(CONFIG.minYear, targetValue - 1);
      pointerVelocity = -1.8;
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      targetValue = Math.min(CONFIG.maxYear, targetValue + 1);
      pointerVelocity = 1.8;
      e.preventDefault();
    }
  });

  // Start Animation Loop
  requestAnimationFrame(animate);

  // Immediate initial notification
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('memoryYearChange', { detail: { year: Math.round(CONFIG.initialValue) } }));
  }, 100);
})();
