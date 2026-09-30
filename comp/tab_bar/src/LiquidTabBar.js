/**
 * ============================================================================
 * LIQUID TAB BAR — MAIN CONTROLLER COMPONENT
 * ============================================================================
 * 
 * Reusable, framework-agnostic Liquid Glass Navigation Bar.
 * Encapsulates WebGL rendering, 2D substrate compositing, hydrodynamic fluid
 * kinetics, and pointer interactions into a single, clean API.
 * 
 * Usage:
 * const tabBar = new LiquidTabBar('#my-container', {
 *   tabs: [ ... ],
 *   onChange: (tab, index) => console.log(tab)
 * });
 */

import { DEFAULT_CONFIG } from './config.js';
import { calculatePillGeometry, getTabCenterX } from './geometry.js';
import { FluidPhysicsEngine } from './physics.js';
import { GestureTracker } from './gestures.js';
import { SubstrateRenderer } from './renderer.js';
import { ControlsManager } from './controls.js';
import { LiquidGlassPill } from './pill.js';
import { initWebGL, renderWebGLLens } from './webgl.js';

export class LiquidTabBar {
    /**
     * @param {string|HTMLElement} container - DOM element or CSS selector
     * @param {Object} options - Custom options (merged with DEFAULT_CONFIG)
     */
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) {
            throw new Error(`[LiquidTabBar] Container "${container}" not found in DOM.`);
        }

        // Deep merge user options with default config
        this.config = this.mergeConfig(DEFAULT_CONFIG, options);

        // Active parameter state
        this.ior = this.config.lens.ior;
        this.dispersion = this.config.lens.dispersion;
        this.borderAttraction = this.config.lens.borderAttraction;

        // Display parameters
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        // Find or create canvas
        this.canvas = this.container.querySelector('canvas') || document.createElement('canvas');
        if (!this.canvas.parentElement) {
            this.container.appendChild(this.canvas);
        }

        // Initialize WebGL for optical lens raytracer
        this.webglState = initWebGL(this.canvas);
        if (!this.webglState) {
            throw new Error('[LiquidTabBar] WebGL initialization failed.');
        }

        // Initialize LiquidGlassPill background component
        this.pillCanvas = document.createElement('canvas');
        this.bgPill = new LiquidGlassPill(this.pillCanvas, {
            width: this.container.clientWidth || 800,
            height: this.container.clientHeight || 300,
            pillWidth: this.config.pill.width,
            pillHeight: this.config.pill.height,
            ior: this.config.pill.ior,
            dispersion: this.config.pill.dispersion,
            lensHeight: this.config.pill.lensHeight,
            frostBlur: this.config.pill.frostBlur,
            alpha: this.config.pill.alpha,
            preserveDrawingBuffer: true,
            bgRenderer: (ctx, w, h) => {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
            }
        });

        // Initialize Substrate 2D Renderer
        this.renderer = new SubstrateRenderer(this.config, this.bgPill);

        // Initialize Fluid Physics Engine
        this.physics = new FluidPhysicsEngine(this.config);

        // Initialize Gesture Tracker
        this.gestures = new GestureTracker(
            this.container,
            this.physics,
            this.config,
            () => this.getGeometry(),
            (tab, idx) => {
                if (typeof this.config.onChange === 'function') {
                    this.config.onChange(tab, idx);
                }
            }
        );

        // Initialize Controls & Telemetry HUD manager
        this.controls = new ControlsManager(this.config, (param, val) => {
            if (param === 'ior') this.ior = val;
            if (param === 'dispersion') this.dispersion = val;
            if (param === 'borderAttraction') this.borderAttraction = val;
        });

        // Dynamic tab static slot sizing
        this.tabStaticHalfWidths = this.config.tabs.map(() => 36.2);
        this.updateDynamicTabSizes();

        // Bind resize event
        this.boundResize = this.resize.bind(this);
        window.addEventListener('resize', this.boundResize);

        // Animation loop state
        this.lastTime = performance.now();
        this.animationFrameId = null;

        // Initial setup
        this.resize();

        // Center on default tab
        const defaultIdx = this.config.defaultTabIndex !== undefined ? this.config.defaultTabIndex : 2;
        const initCenter = getTabCenterX(defaultIdx, this.getGeometry());
        this.physics.lensX = initCenter;
        this.physics.targetLensX = initCenter;
        this.physics.currentDynamicActiveHalfW = this.physics.tabActiveHalfWidths[defaultIdx] || 46.5;

        // Start render loop
        this.start();
    }

    mergeConfig(defaults, overrides) {
        const result = { ...defaults, ...overrides };
        result.pill = { ...defaults.pill, ...(overrides.pill || {}) };
        result.lens = { ...defaults.lens, ...(overrides.lens || {}) };
        result.physics = { ...defaults.physics, ...(overrides.physics || {}) };
        result.ui = { ...defaults.ui, ...(overrides.ui || {}) };
        if (overrides.tabs) result.tabs = overrides.tabs;
        return result;
    }

    getGeometry() {
        return calculatePillGeometry(
            this.container,
            this.config,
            this.physics.pillScale,
            this.dpr,
            this.bgPill
        );
    }

    updateDynamicTabSizes() {
        const { tabSpacing } = this.getGeometry();
        const slotHalfW = tabSpacing * 0.5;
        this.tabStaticHalfWidths = this.config.tabs.map(() => slotHalfW);
    }

    resize() {
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        const stageW = this.container.clientWidth || 800;
        const stageH = this.container.clientHeight || 300;
        const w = Math.round(stageW * this.dpr);
        const h = Math.round(stageH * this.dpr);

        this.canvas.width = w;
        this.canvas.height = h;
        this.renderer.resize(w, h);
        this.webglState.gl.viewport(0, 0, w, h);

        if (this.bgPill) {
            this.bgPill.width = stageW;
            this.bgPill.height = stageH;
            this.bgPill.pillWidth = Math.min(this.config.pill.width, stageW - 32);
            this.bgPill.pillHeight = this.config.pill.height;
            this.bgPill.resize();
        }

        this.updateDynamicTabSizes();

        if (!this.physics.isDragging) {
            const center = getTabCenterX(this.gestures.currentTabIdx, this.getGeometry());
            this.physics.lensX = center;
            this.physics.targetLensX = center;
        }
    }

    /**
     * Programmatically switches to a target tab.
     * @param {number} idx - Target tab index
     */
    setTab(idx) {
        if (idx < 0 || idx >= this.config.tabs.length) return;
        const geom = this.getGeometry();
        this.gestures.currentTabIdx = idx;
        const targetX = getTabCenterX(idx, geom);
        this.physics.targetLensX = targetX;

        const jumpDist = targetX - this.physics.lensX;
        if (Math.abs(jumpDist) > 5.0) {
            this.physics.isTapTransit = true;
            this.physics.tapStartX = this.physics.lensX;
            this.physics.tapTargetX = targetX;
            this.physics.tapTotalDist = Math.abs(jumpDist);
            this.physics.lensVelocityX = Math.sign(jumpDist) * Math.min(Math.abs(jumpDist) * 2.8, 300.0);
            this.physics.activeVelocity = 0.0;
            this.physics.splashVelocity = 0.0;
        }

        this.gestures.triggerTabAction(idx);
    }

    start() {
        if (this.animationFrameId) return;
        const loop = (time) => {
            const dt = Math.min((time - this.lastTime) * 0.001, 0.033);
            this.lastTime = time;

            this.render(dt, time);
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    destroy() {
        this.stop();
        window.removeEventListener('resize', this.boundResize);
        if (this.gestures) this.gestures.destroy();
    }

    render(dt, time) {
        const geom = this.getGeometry();
        const tabCount = this.config.tabs.length;
        const { staticHalfH, staticRadius, activeHalfH } = this.config.lens;

        // 1. Advance fluid physics simulation
        this.physics.update(dt, geom, (idx) => getTabCenterX(idx, geom));

        if (this.bgPill) {
            this.bgPill.pressScale = this.physics.pillScale;
        }

        // 2. Optical Metamorphosis Easing
        const easedP = this.physics.activeProgress * this.physics.activeProgress * (3.0 - 2.0 * this.physics.activeProgress);
        const currentLensY = this.canvas.height * 0.5;

        // Interpolate resting static width based on current position
        const relX = (this.physics.lensX - getTabCenterX(0, geom)) / geom.tabSpacing;
        const leftIdx = Math.max(0, Math.min(tabCount - 1, Math.floor(relX)));
        const rightIdx = Math.max(0, Math.min(tabCount - 1, Math.ceil(relX)));
        const frac = Math.max(0, Math.min(1.0, relX - leftIdx));
        const smoothFrac = frac * frac * (3.0 - 2.0 * frac);
        const dynamicStaticHalfW = this.tabStaticHalfWidths[leftIdx] * (1.0 - smoothFrac) + this.tabStaticHalfWidths[rightIdx] * smoothFrac;

        // Base width and height with metamorphosis and whole-pill expansion
        const currentBaseW = (dynamicStaticHalfW + (this.physics.currentDynamicActiveHalfW - dynamicStaticHalfW) * easedP) * this.physics.pillScale;
        const currentBaseH = (staticHalfH + (activeHalfH - staticHalfH) * easedP) * this.physics.pillScale;

        const effectiveStretchX = 1.0 + (this.physics.fluidStretchX - 1.0) * easedP;
        const effectiveStretchY = 1.0 + (this.physics.fluidStretchY - 1.0) * easedP;

        // Organic landing squash & stretch (damped near pill corners to preserve 4px gap)
        const cornerDist = Math.min(Math.abs(this.physics.lensX - geom.minTabX), Math.abs(this.physics.lensX - geom.maxTabX));
        const cornerProximity = Math.max(0.0, 1.0 - cornerDist / Math.max(geom.tabSpacing, 1.0));
        const effectiveSquash = this.physics.landingSquash * (1.0 - cornerProximity * 0.75);
        const squashFactorX = 1.0 + (effectiveSquash * 0.12);

        // Tap transit flow narrowing
        let transitWidthFactor = 1.0;
        if (this.physics.isTapTransit) {
            const rawProgress = Math.max(0.0, Math.min(1.0, 1.0 - Math.abs(this.physics.tapTargetX - this.physics.lensX) / Math.max(this.physics.tapTotalDist, 1.0)));
            const flowEnvelope = Math.sin(rawProgress * Math.PI);
            transitWidthFactor = 1.0 - flowEnvelope * 0.16; // Gently narrows by ~16% mid-flight
        }

        const currentHalfW = currentBaseW * effectiveStretchX * squashFactorX * transitWidthFactor * this.dpr;
        const currentHalfH = currentBaseH * this.dpr;
        const activeRadius = Math.min(currentHalfW, currentHalfH);
        const currentRadius = (staticRadius * (1.0 - easedP) * this.physics.pillScale * this.dpr) + (activeRadius * easedP);
        const currentSplash = this.physics.splashImpulse * easedP * this.dpr;
        const renderedLensX = this.physics.lensX * this.dpr;

        const lensParams = {
            x: renderedLensX,
            y: currentLensY,
            halfW: currentHalfW,
            halfH: currentHalfH,
            radius: currentRadius
        };

        // 3. Render substrate background with spatial optical clipping
        this.renderer.render(
            this.webglState.gl,
            this.webglState.bgTex,
            lensParams,
            this.physics.lensX,
            geom,
            this.dpr
        );

        // 4. Render WebGL 3D convex optical lens pass
        renderWebGLLens(
            this.webglState.gl,
            this.webglState.prog,
            this.webglState.uniforms,
            this.webglState.bgTex,
            {
                resolution: [this.canvas.width, this.canvas.height],
                lensPos: [renderedLensX, currentLensY],
                lensHalfSize: [currentHalfW, currentHalfH],
                lensRadius: currentRadius,
                velocity: [this.physics.lensVelocityX * this.physics.activeProgress * this.dpr, 0.0],
                fluidWave: this.physics.fluidWave * this.physics.activeProgress,
                splashHeight: currentSplash,
                ior: this.ior,
                dispersion: this.dispersion,
                dpr: this.dpr,
                activeProgress: this.physics.activeProgress,
                attraction: this.borderAttraction,
                time: time * 0.001
            }
        );

        // 5. Update Telemetry HUD
        this.controls.updateTelemetry({
            velocity: this.physics.lensVelocityX,
            stretch: effectiveStretchX,
            thinning: effectiveStretchY,
            splash: currentSplash
        });
    }
}

// Global fallback for script tag usage
if (typeof window !== 'undefined') {
    window.LiquidTabBar = LiquidTabBar;
}
