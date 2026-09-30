/**
 * ============================================================================
 * LIQUID GLASS TAB BAR — APPLICATION BOOTSTRAP
 * ============================================================================
 * 
 * Initializes the Liquid Glass Navigation Bar with default configurations,
 * binding to the stage, live physics sliders, and telemetry HUD.
 */

import { LiquidTabBar } from './src/index.js';

// Mount the Liquid Tab Bar onto the stage element
const tabBar = new LiquidTabBar('#demoStage', {
    // Uses DEFAULT_CONFIG by default (Home, Cart, Bag, Save, Call)
    // Custom callback when the active tab changes:
    onChange: (tab, index) => {
        // console.log(`Active navigation tab switched to: ${tab.label} (Index: ${index})`);
    }
});

// Expose instance globally for browser console exploration or debugging
window.tabBar = tabBar;
