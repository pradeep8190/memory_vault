/**
 * ============================================================================
 * LIQUID TAB BAR — MAIN PACKAGE ENTRY POINT
 * ============================================================================
 * 
 * Provides clean exports for ESM, Next.js, Vite, and Webpack integration,
 * as well as direct browser script support.
 */

export { LiquidTabBar } from './LiquidTabBar.js';
export { DEFAULT_CONFIG } from './config.js';
export { registerIcon, drawTabVectorIcon, svgIconDefinitions } from './icons.js';
export { FluidPhysicsEngine } from './physics.js';
export { GestureTracker } from './gestures.js';
export { SubstrateRenderer } from './renderer.js';
export { ControlsManager } from './controls.js';
export { LiquidGlassPill } from './pill.js';
export { initWebGL, renderWebGLLens } from './webgl.js';
export { calculatePillGeometry, getTabCenterX, getTabIndexAt } from './geometry.js';
