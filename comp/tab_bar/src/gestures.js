/**
 * ============================================================================
 * GESTURE TRACKER & POINTER INTERACTION CONTROLLER
 * ============================================================================
 * 
 * Handles touch and mouse interactions:
 * - Rubber-band overscroll resistance beyond pill edges
 * - Magnetic detents with soft quadratic attraction near tab centers
 * - Direct tap flow launch with silky cubic transit
 * - High-speed flick momentum and 1-tab directional swipe nudges
 * - Restoring bounce when released from overscroll
 * - Seamless tab navigation callbacks (onChange, href, onClick)
 */

import { getTabIndexAt, getTabCenterX } from './geometry.js';

export class GestureTracker {
    /**
     * @param {HTMLElement} stage - Interactive container element
     * @param {FluidPhysicsEngine} physics - Fluid physics engine instance
     * @param {Object} config - Central configuration object
     * @param {Function} getGeometryFn - Returns current layout geometry
     * @param {Function} onTabChange - Callback invoked when active tab changes
     */
    constructor(stage, physics, config, getGeometryFn, onTabChange) {
        this.stage = stage;
        this.physics = physics;
        this.config = config;
        this.getGeometry = getGeometryFn;
        this.onTabChange = onTabChange;

        this.pointerX = 0;
        this.pointerDownX = 0;
        this.pointerDownTime = 0;
        this.hasDragged = false;
        this.pointerHistory = [];
        this.currentTabIdx = config.defaultTabIndex !== undefined ? config.defaultTabIndex : 2;

        this.boundPointerDown = this.onPointerDown.bind(this);
        this.boundPointerMove = this.onPointerMove.bind(this);
        this.boundPointerUp = this.onPointerUp.bind(this);

        this.bindEvents();
    }

    bindEvents() {
        this.stage.addEventListener('pointerdown', this.boundPointerDown);
        this.stage.addEventListener('pointermove', this.boundPointerMove);
        this.stage.addEventListener('pointerup', this.boundPointerUp);
        this.stage.addEventListener('pointercancel', this.boundPointerUp);
    }

    destroy() {
        this.stage.removeEventListener('pointerdown', this.boundPointerDown);
        this.stage.removeEventListener('pointermove', this.boundPointerMove);
        this.stage.removeEventListener('pointerup', this.boundPointerUp);
        this.stage.removeEventListener('pointercancel', this.boundPointerUp);
    }

    onPointerDown(e) {
        this.physics.isDragging = true;
        this.hasDragged = false;
        this.physics.isTapTransit = false;
        
        try { this.stage.setPointerCapture(e.pointerId); } catch (_) {}

        const rect = this.stage.getBoundingClientRect();
        this.pointerX = e.clientX - rect.left;
        this.pointerDownX = this.pointerX;
        this.pointerDownTime = performance.now();
        this.pointerHistory = [{ x: this.pointerX, t: this.pointerDownTime }];
    }

    onPointerMove(e) {
        if (!this.physics.isDragging) return;
        const rect = this.stage.getBoundingClientRect();
        this.pointerX = e.clientX - rect.left;

        const now = performance.now();
        this.pointerHistory.push({ x: this.pointerX, t: now });
        while (this.pointerHistory.length > 1 && now - this.pointerHistory[0].t > 100) {
            this.pointerHistory.shift();
        }

        if (Math.abs(this.pointerX - this.pointerDownX) > 4) {
            this.hasDragged = true;
        }

        const geom = this.getGeometry();
        const pConf = this.config.physics;
        const maxOverscroll = pConf.maxOverscroll || 20.0;
        const tension = pConf.tension || 40.0;

        // 1. Rubber-band overscroll resistance beyond pill ends
        if (this.pointerX < geom.minTabX) {
            const overscroll = geom.minTabX - this.pointerX;
            this.physics.targetLensX = geom.minTabX - (overscroll * maxOverscroll) / (overscroll + tension);
        } else if (this.pointerX > geom.maxTabX) {
            const overscroll = this.pointerX - geom.maxTabX;
            this.physics.targetLensX = geom.maxTabX + (overscroll * maxOverscroll) / (overscroll + tension);
        } else {
            // 2. Magnetic Detents when gliding near tab centers
            let closestX = geom.minTabX;
            let minDist = Infinity;
            for (let i = 0; i < this.config.tabs.length; i++) {
                const cx = getTabCenterX(i, geom);
                const dist = Math.abs(this.pointerX - cx);
                if (dist < minDist) {
                    minDist = dist;
                    closestX = cx;
                }
            }

            const detentRadius = pConf.detentRadius || 24.0;
            if (minDist < detentRadius) {
                const strength = Math.pow(1.0 - minDist / detentRadius, 2.0) * 0.32;
                this.physics.targetLensX = this.pointerX + (closestX - this.pointerX) * strength;
            } else {
                this.physics.targetLensX = this.pointerX;
            }
        }
    }

    onPointerUp(e) {
        if (!this.physics.isDragging) return;
        this.physics.isDragging = false;

        const now = performance.now();
        const duration = now - this.pointerDownTime;
        const geom = this.getGeometry();
        const tabs = this.config.tabs;

        // 1. Direct Tap on Tab (Quick release with minimal movement)
        if (!this.hasDragged || (Math.abs(this.pointerX - this.pointerDownX) < 8 && duration < 300)) {
            const tappedIdx = getTabIndexAt(this.pointerX, geom, tabs.length);
            const prevIdx = this.currentTabIdx;
            this.currentTabIdx = tappedIdx;
            const targetX = getTabCenterX(tappedIdx, geom);
            this.physics.targetLensX = targetX;

            const jumpDist = targetX - this.physics.lensX;
            if (Math.abs(jumpDist) > 5.0) {
                this.physics.isTapTransit = true;
                this.physics.tapStartX = this.physics.lensX;
                this.physics.tapTargetX = targetX;
                this.physics.tapTotalDist = Math.abs(jumpDist);

                // Gentle directional nudge for silky launch
                this.physics.lensVelocityX = Math.sign(jumpDist) * Math.min(Math.abs(jumpDist) * 2.8, 300.0);
                this.physics.activeVelocity = 0.0;
                this.physics.splashVelocity = 0.0;
            } else {
                // Tapped already active tab: subtle tactile pulse
                this.physics.landingSquashVelocity += 0.5;
            }

            if (tappedIdx !== prevIdx) {
                this.triggerTabAction(tappedIdx);
            }
        } else {
            // 2. Flick / Drag Momentum Calculation
            let releaseVel = 0;
            if (this.pointerHistory.length >= 2) {
                const pFirst = this.pointerHistory[0];
                const pLast = this.pointerHistory[this.pointerHistory.length - 1];
                const dt = (pLast.t - pFirst.t) / 1000;
                if (dt > 0.008) {
                    releaseVel = (pLast.x - pFirst.x) / dt;
                }
            }

            // Snap directly to the tab nearest to where lens was dropped
            let bestIdx = 0;
            let bestDist = Infinity;
            for (let i = 0; i < tabs.length; i++) {
                const cx = getTabCenterX(i, geom);
                const dist = Math.abs(this.physics.lensX - cx);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = i;
                }
            }

            // Swipe / flick directional nudge
            if (Math.abs(releaseVel) > 700 && duration < 300) {
                const flickDir = Math.sign(releaseVel);
                bestIdx = Math.max(0, Math.min(tabs.length - 1, bestIdx + flickDir));
            }

            const prevIdx = this.currentTabIdx;
            this.currentTabIdx = bestIdx;
            this.physics.targetLensX = getTabCenterX(bestIdx, geom);

            // Opposite negative bounce when released from overscroll outside pill
            if (this.physics.lensX > geom.maxTabX + 1.0) {
                const overDist = this.physics.lensX - geom.maxTabX;
                this.physics.lensVelocityX = -Math.min(overDist * 16.0 + 130.0, 520.0);
                this.physics.splashVelocity += Math.min(overDist * 0.08 + 1.0, 3.0);
                this.physics.landingSquashVelocity += 1.3;
            } else if (this.physics.lensX < geom.minTabX - 1.0) {
                const overDist = geom.minTabX - this.physics.lensX;
                this.physics.lensVelocityX = Math.min(overDist * 16.0 + 130.0, 520.0);
                this.physics.splashVelocity += Math.min(overDist * 0.08 + 1.0, 3.0);
                this.physics.landingSquashVelocity += 1.3;
            } else {
                // Smooth residual velocity into dropped tab without overshooting
                this.physics.lensVelocityX = Math.max(-350, Math.min(350, this.physics.lensVelocityX * 0.35));
            }

            if (bestIdx === 2) {
                this.physics.activeHalfWVelocity += 35.0; // Horizontal bounce on landing over Explore / Bag
            }

            if (Math.abs(releaseVel) > 400) {
                this.physics.splashVelocity += Math.min(Math.abs(releaseVel) * 0.003, 3.5);
            }

            if (bestIdx !== prevIdx) {
                this.triggerTabAction(bestIdx);
            }
        }

        try { this.stage.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    triggerTabAction(idx) {
        const tab = this.config.tabs[idx];
        if (!tab) return;

        if (typeof tab.onClick === 'function') {
            tab.onClick(tab, idx);
        }

        if (typeof this.onTabChange === 'function') {
            this.onTabChange(tab, idx);
        }
    }
}

// Global fallback for script tag usage
if (typeof window !== 'undefined') {
    window.GestureTracker = GestureTracker;
}
