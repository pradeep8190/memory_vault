/**
 * ============================================================================
 * 2D SUBSTRATE RENDERER & SPATIAL OPTICAL CLIPPING
 * ============================================================================
 * 
 * Composites the 2D background substrate layer:
 * 1. Renders the WebGL LiquidGlassPill navbar background.
 * 2. Draws vector icons in OUTLINE state with proximity lift and typography labels.
 * 3. Performs real-time spatial lens clipping: dynamically fills whatever fraction
 *    of each icon is physically covered by the moving liquid glass lens.
 * 4. Uploads composite canvas directly to WebGL background texture.
 */

import { drawTabVectorIcon } from './icons.js';
import { updateWebGLTexture } from './webgl.js';
import { getTabCenterX } from './geometry.js';

export class SubstrateRenderer {
    /**
     * @param {Object} config - Central configuration object
     * @param {LiquidGlassPill} bgPill - LiquidGlassPill component instance
     */
    constructor(config, bgPill) {
        this.config = config;
        this.bgPill = bgPill;

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
    }

    /**
     * Resizes the substrate composite canvas.
     * @param {number} width - Device pixel width
     * @param {number} height - Device pixel height
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Draws the entire substrate canvas and uploads to WebGL texture.
     * 
     * @param {WebGLRenderingContext} gl - WebGL context
     * @param {WebGLTexture} bgTex - Target background texture
     * @param {Object} lensParams - Current lens physical boundary parameters
     * @param {number} lensX - Lens center X in CSS pixels
     * @param {Object} geom - Pill geometry metrics
     * @param {number} dpr - Device pixel ratio
     */
    render(gl, bgTex, lensParams, lensX, geom, dpr) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cy = h * 0.5;
        const ctx = this.ctx;
        const tabs = this.config.tabs;
        const tabCount = tabs.length;
        const tabColor = this.config.pill.color || '#1d1d1f';
        const tabSpacingDevice = geom.tabSpacing * dpr;

        // 1. Render the WebGL LiquidGlassPill navbar background
        if (this.bgPill) {
            this.bgPill.render();
            // 2. Composite the glass pill navbar onto the 2D stage canvas
            ctx.drawImage(this.bgPill.canvas, 0, 0);
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
        }

        // 3. Draw OUTLINE state for all navigation tab icons & typography
        for (let i = 0; i < tabCount; i++) {
            const tabCenterX = getTabCenterX(i, geom) * dpr;
            const distFromLens = Math.abs((lensX * dpr) - tabCenterX);

            // Proximity scaling
            const prox = Math.max(0.0, 1.0 - distFromLens / (tabSpacingDevice * 0.85));
            const smoothProx = prox * prox * (3.0 - 2.0 * prox);

            const iconScale = 1.0 + smoothProx * 0.08;
            const iconLift = smoothProx * 1.5 * dpr;
            const iconY = cy - 7.5 * dpr - iconLift;

            // Base outline icon (from icons.js)
            drawTabVectorIcon(ctx, tabs[i].type, tabCenterX, iconY, 19 * dpr * iconScale, tabColor, 'outline');

            // Typography label
            const fontSize = (10.5 + smoothProx * 0.5) * dpr;
            ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
            ctx.fillStyle = tabColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tabs[i].label, tabCenterX, cy + 13.5 * dpr - (iconLift * 0.4));
        }

        // 4. Real-time Spatial Lens Clipping:
        // Strictly fills whatever fraction of each icon is physically under the glass lens
        if (lensParams) {
            ctx.save();
            ctx.beginPath();
            const lx = lensParams.x - lensParams.halfW;
            const ly = lensParams.y - lensParams.halfH;
            const lw = lensParams.halfW * 2.0;
            const lh = lensParams.halfH * 2.0;
            const lr = lensParams.radius;

            if (ctx.roundRect) {
                ctx.roundRect(lx, ly, lw, lh, lr);
            } else {
                ctx.rect(lx, ly, lw, lh);
            }
            ctx.clip();

            // Draw FILLED state for icons inside the clipped glass boundary
            for (let i = 0; i < tabCount; i++) {
                const tabCenterX = getTabCenterX(i, geom) * dpr;
                const distFromLens = Math.abs((lensX * dpr) - tabCenterX);
                const prox = Math.max(0.0, 1.0 - distFromLens / (tabSpacingDevice * 0.85));
                const smoothProx = prox * prox * (3.0 - 2.0 * prox);

                const iconScale = 1.0 + smoothProx * 0.08;
                const iconLift = smoothProx * 1.5 * dpr;
                const iconY = cy - 7.5 * dpr - iconLift;

                drawTabVectorIcon(ctx, tabs[i].type, tabCenterX, iconY, 19 * dpr * iconScale, tabColor, 'filled');
            }

            ctx.restore();
        }

        // 5. Upload composite substrate to WebGL background texture
        updateWebGLTexture(gl, bgTex, this.canvas);
    }
}

// Global fallback for script tag usage
if (typeof window !== 'undefined') {
    window.SubstrateRenderer = SubstrateRenderer;
}
