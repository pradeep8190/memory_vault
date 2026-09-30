/**
 * ============================================================================
 * HYDRODYNAMIC FLUID PHYSICS ENGINE
 * ============================================================================
 * 
 * Simulates real-time fluid dynamics:
 * - Incompressible volume conservation ($S_x \cdot S_y^2 = \text{const}$)
 * - Surface tension and viscous damping
 * - Hydraulic braking shockwaves and splash surges
 * - Organic metamorphosis between resting capsule and active liquid droplet
 * - Content-adaptive width oscillator with horizontal kinetic bounce
 * - Smooth tap transit flight curves and landing squash rebound
 */

export class FluidPhysicsEngine {
    constructor(config) {
        this.config = config;

        // Position & Kinetics
        this.lensX = 400;
        this.targetLensX = 400;
        this.lensVelocityX = 0.0;
        this.prevLensVelocityX = 0.0;
        this.lensAccelerationX = 0.0;

        // Metamorphosis physical transition: 0.0 (Static Pill) -> 1.0 (Liquid Lens)
        this.activeProgress = 0.0;
        this.activeVelocity = 0.0;
        this.landingSquash = 0.0;
        this.landingSquashVelocity = 0.0;

        // Incompressible Volume Conservation (Sx * Sy^2 = 1.0)
        this.fluidStretchX = 1.0;
        this.fluidStretchY = 1.0;
        this.stretchVelocityX = 0.0;
        this.stretchVelocityY = 0.0;

        // Hydraulic Braking Shockwaves & Splash
        this.splashImpulse = 0.0;
        this.splashVelocity = 0.0;
        this.fluidWave = 0.0;

        // Dynamic Content-Adaptive Active Width
        this.activeBaseHalfW = config.lens.activeBaseHalfW || 46.5;
        this.currentDynamicActiveHalfW = this.activeBaseHalfW;
        this.activeHalfWVelocity = 0.0;

        // Whole Pill Scale State (Slight tactile swell on hold/drag)
        this.pillScale = 1.0;
        this.pillScaleVelocity = 0.0;

        // State flags
        this.isDragging = false;
        this.isTapTransit = false;
        this.tapStartX = 0;
        this.tapTargetX = 0;
        this.tapTotalDist = 0;

        // Active half widths per tab
        this.tabActiveHalfWidths = config.tabs.map(t => t.activeHalfW || this.activeBaseHalfW);
    }

    /**
     * Advances the fluid physics simulation by dt seconds.
     * 
     * @param {number} dt - Time delta in seconds
     * @param {Object} geom - Current layout geometry from calculatePillGeometry()
     * @param {Function} getTabCenterXFn - Helper function returning center X for a tab index
     */
    update(dt, geom, getTabCenterXFn) {
        const pConf = this.config.physics;

        // 0. Smooth Physical Expansion of Whole Pill while Holding or Dragging
        const targetPillScale = this.isDragging ? pConf.pillScaleHold : 1.0;
        const kPillScale = this.isDragging ? pConf.kPillScaleDrag : pConf.kPillScaleRest;
        const dPillScale = this.isDragging ? pConf.dPillScaleDrag : pConf.dPillScaleRest;
        const fPillScale = -kPillScale * (this.pillScale - targetPillScale) - dPillScale * this.pillScaleVelocity;
        this.pillScaleVelocity += fPillScale * dt;
        this.pillScale += this.pillScaleVelocity * dt;
        this.pillScale = Math.max(1.0, Math.min(1.03, this.pillScale));

        // 1. Metamorphosis Transition (Static Grey Pill <-> Liquid Glass Lens)
        if (this.isTapTransit) {
            const distRemaining = Math.abs(this.tapTargetX - this.lensX);
            const rawProgress = Math.max(0.0, Math.min(1.0, 1.0 - distRemaining / Math.max(this.tapTotalDist, 1.0)));

            if (distRemaining < 1.0 && rawProgress > 0.96 && Math.abs(this.lensVelocityX) < 45.0) {
                this.isTapTransit = false;
                this.activeProgress = 0.0;
                this.activeVelocity = 0.0;
                this.landingSquashVelocity += 0.4; // Soft, elegant landing touch
            } else {
                // Smooth continuous cubic flow curve
                const smoothFlow = rawProgress * rawProgress * (3.0 - 2.0 * rawProgress);
                const flowEnvelope = Math.sin(smoothFlow * Math.PI);
                const targetFlowActive = Math.pow(flowEnvelope, 1.15);

                // Silky continuous filter: zero jumps, velvety smooth optical bloom and fade
                this.activeProgress += (targetFlowActive - this.activeProgress) * Math.min(1.0, dt * 14.0);
                this.activeVelocity = 0.0;
            }
        } else {
            const targetActive = this.isDragging ? 1.0 : 0.0;
            const springKActive = this.isDragging ? pConf.springKActiveDrag : pConf.springKActiveRest;
            const springDampActive = this.isDragging ? pConf.springDampActiveDrag : pConf.springDampActiveRest;
            const activeForce = -springKActive * (this.activeProgress - targetActive) - springDampActive * this.activeVelocity;
            this.activeVelocity += activeForce * dt;
            this.activeProgress += this.activeVelocity * dt;
            this.activeProgress = Math.max(0.0, Math.min(1.0, this.activeProgress));

            // Landing squash & stretch impulse when glass lens descends back into the resting pill
            if (!this.isDragging && this.activeProgress < 0.35 && this.activeVelocity < -0.15) {
                this.landingSquashVelocity += Math.abs(this.activeVelocity) * 0.45;
            }
        }

        // Landing Squash Oscillator
        const kSquash = pConf.kSquash || 150.0;
        const dSquash = pConf.dSquash || 8.8; // Underdamped for visible horizontal landing rebound
        const fSquash = -kSquash * this.landingSquash - dSquash * this.landingSquashVelocity;
        this.landingSquashVelocity += fSquash * dt;
        this.landingSquash += this.landingSquashVelocity * dt;

        // 2. Fluid Translation Spring
        const springK = this.isDragging ? pConf.springKDrag : (this.isTapTransit ? pConf.springKTap : pConf.springKGlide);
        const springDamp = this.isDragging ? pConf.springDampDrag : (this.isTapTransit ? pConf.springDampTap : pConf.springDampGlide);
        const displacement = this.lensX - this.targetLensX;
        const springForce = -springK * displacement - springDamp * this.lensVelocityX;

        this.lensVelocityX += springForce * dt;
        this.lensX += this.lensVelocityX * dt;

        // 3. Acceleration & Deceleration
        this.lensAccelerationX = (this.lensVelocityX - this.prevLensVelocityX) / Math.max(dt, 0.001);
        this.prevLensVelocityX = this.lensVelocityX;

        const speed = Math.abs(this.lensVelocityX);

        // 4. Hydrodynamic Stretch & Incompressible Volume Conservation (Sx * Sy^2 = const)
        const elongation = Math.min(speed * 0.00042, 0.48);
        const brakingCompression = Math.max(0.0, -Math.sign(this.lensVelocityX) * this.lensAccelerationX * 0.000095);
        const targetSx = Math.max(0.70, 1.0 + elongation - brakingCompression);

        const breathingWave = Math.sin(performance.now() * 0.0035) * 0.015;
        const targetSy = (1.0 / Math.max(0.6, Math.sqrt(targetSx))) + breathingWave;

        const surfaceTensionK = pConf.surfaceTensionK || 320.0;
        const fluidViscosityDamp = pConf.fluidViscosityDamp || 14.0;

        const forceX = -surfaceTensionK * (this.fluidStretchX - targetSx) - fluidViscosityDamp * this.stretchVelocityX;
        this.stretchVelocityX += forceX * dt;
        this.fluidStretchX += this.stretchVelocityX * dt;

        const forceY = -surfaceTensionK * (this.fluidStretchY - targetSy) - fluidViscosityDamp * this.stretchVelocityY;
        this.stretchVelocityY += forceY * dt;
        this.fluidStretchY += this.stretchVelocityY * dt;

        this.fluidStretchX = Math.max(0.68, Math.min(1.50, this.fluidStretchX));
        this.fluidStretchY = Math.max(0.68, Math.min(1.45, this.fluidStretchY));

        // 5. Hydraulic Shockwave on Deceleration / Landing
        const isDecelerating = (this.lensVelocityX * this.lensAccelerationX < -1000.0);
        if (isDecelerating) {
            const shock = Math.min(Math.abs(this.lensAccelerationX) * 0.00018, 4.0);
            this.splashVelocity += shock * 40.0 * dt;
        }

        const splashSpringK = pConf.splashSpringK || 220.0;
        const splashSpringDamp = pConf.splashSpringDamp || 18.0;
        const splashForce = -splashSpringK * this.splashImpulse - splashSpringDamp * this.splashVelocity;
        this.splashVelocity += splashForce * dt;
        this.splashImpulse += this.splashVelocity * dt;
        this.splashImpulse = Math.max(0.0, Math.min(5.0, this.splashImpulse));

        this.fluidWave = Math.min((Math.abs(this.stretchVelocityX) + Math.abs(this.stretchVelocityY)) * 0.022, 0.22);

        // 6. Speed-Gated Content-Adaptive Active Width with Kinetic Horizontal Bounce
        const tabCount = this.config.tabs.length;
        const tabSpacing = geom.tabSpacing;
        const firstTabCenter = getTabCenterXFn(0);

        const relX = (this.lensX - firstTabCenter) / tabSpacing;
        const leftIdx = Math.max(0, Math.min(tabCount - 1, Math.floor(relX)));
        const rightIdx = Math.max(0, Math.min(tabCount - 1, Math.ceil(relX)));
        const frac = Math.max(0, Math.min(1.0, relX - leftIdx));
        const smoothFrac = frac * frac * (3.0 - 2.0 * frac);
        const targetContentHalfW = this.tabActiveHalfWidths[leftIdx] * (1.0 - smoothFrac) + this.tabActiveHalfWidths[rightIdx] * smoothFrac;

        // Speed gate: adapts smoothly when moving slowly (< 140 px/s), stays uniform at high speeds (> 350 px/s)
        const speedGate = 1.0 - Math.min(1.0, Math.max(0.0, (speed - 90.0) / 260.0));
        const targetActiveHalfW = this.activeBaseHalfW + (targetContentHalfW - this.activeBaseHalfW) * speedGate;

        // Kinetic horizontal bounce coupling: amplify horizontal spring oscillation when gliding into Tab 2 (Bag / Explore)
        const bagCenterX = getTabCenterXFn(2);
        const distToBag = Math.abs(this.lensX - bagCenterX);
        if (distToBag < tabSpacing * 0.65 && speed > 20.0) {
            const approachSign = Math.sign(targetActiveHalfW - this.currentDynamicActiveHalfW);
            this.activeHalfWVelocity += approachSign * Math.min(speed * 0.09, 32.0) * dt * 60.0;
        }

        // Horizontal spring oscillator producing distinct tactile bounce
        const kWidth = pConf.kWidth || 200.0;
        const dWidth = pConf.dWidth || 7.5; // Underdamped for satisfying horizontal bounce
        const fWidth = -kWidth * (this.currentDynamicActiveHalfW - targetActiveHalfW) - dWidth * this.activeHalfWVelocity;
        this.activeHalfWVelocity += fWidth * dt;
        this.currentDynamicActiveHalfW += this.activeHalfWVelocity * dt;
    }
}

// Global fallback for script tag usage
if (typeof window !== 'undefined') {
    window.FluidPhysicsEngine = FluidPhysicsEngine;
}
