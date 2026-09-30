/**
 * ============================================================================
 * GEOMETRY & LAYOUT CALCULATIONS
 * ============================================================================
 * 
 * Computes exact physical geometry, responsive sizing, tab spacing, and
 * tab center coordinates for the Liquid Glass Tab Bar.
 */

/**
 * Computes pill and tab layout metrics based on stage dimensions and pill scale.
 * 
 * @param {HTMLElement} stage - The container DOM element
 * @param {Object} config - Configuration object
 * @param {number} pillScale - Physical swell scale factor (1.0 to 1.03)
 * @param {number} dpr - Device Pixel Ratio
 * @param {Object|null} bgPill - LiquidGlassPill instance if available
 * @returns {Object} Layout metrics
 */
export function calculatePillGeometry(stage, config, pillScale = 1.0, dpr = 1, bgPill = null) {
    const stageW = (stage && stage.clientWidth) ? stage.clientWidth : 800;
    const basePillW = bgPill 
        ? (bgPill.pillHalfWidth * 2.0 / dpr) 
        : Math.min(config.pill.width || 370, stageW - 32);
    
    const pillW = basePillW * pillScale;
    const pillX = (stageW - pillW) * 0.5;
    const pillPadding = config.pill.padding || 4.0; // Uniform 4px space: (58 - 50) / 2 = 4px
    const availW = pillW - pillPadding * 2.0;
    const tabSpacing = availW / config.tabs.length;
    const minTabX = pillX + pillPadding + 0.5 * tabSpacing;
    const maxTabX = pillX + pillW - pillPadding - 0.5 * tabSpacing;

    return { 
        stageW, 
        pillW, 
        pillX, 
        pillPadding, 
        tabSpacing, 
        minTabX, 
        maxTabX 
    };
}

/**
 * Gets the X coordinate in CSS pixels for the center of a given tab.
 * 
 * @param {number} idx - Tab index
 * @param {Object} geom - Metrics from calculatePillGeometry()
 * @returns {number} Center X in CSS pixels
 */
export function getTabCenterX(idx, geom) {
    return geom.pillX + geom.pillPadding + (idx + 0.5) * geom.tabSpacing;
}

/**
 * Determines which tab index corresponds to a given X coordinate in CSS pixels.
 * 
 * @param {number} x - Pointer X coordinate in CSS pixels relative to stage
 * @param {Object} geom - Metrics from calculatePillGeometry()
 * @param {number} tabCount - Total number of tabs
 * @returns {number} Tab index (clamped between 0 and tabCount - 1)
 */
export function getTabIndexAt(x, geom, tabCount) {
    const idx = Math.floor((x - (geom.pillX + geom.pillPadding)) / geom.tabSpacing);
    return Math.max(0, Math.min(tabCount - 1, idx));
}

// Global fallback for script tag usage
if (typeof window !== 'undefined') {
    window.calculatePillGeometry = calculatePillGeometry;
    window.getTabCenterX = getTabCenterX;
    window.getTabIndexAt = getTabIndexAt;
}
