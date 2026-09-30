/**
 * Bottom Tab Bar Component Controller
 * Imports and mounts the Liquid Glass Navigation Bar onto the bottom stage
 */

import { LiquidTabBar } from '../comp/tab_bar/src/index.js';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('tabBarStage');
  if (!container) return;

  try {
    const tabBar = new LiquidTabBar('#tabBarStage', {
      defaultTabIndex: 0, // Default to Home
      onChange: (tab, index) => {
        // Active navigation tab switched
      }
    });

    window.bottomTabBar = tabBar;
  } catch (err) {
    console.error('Failed to initialize Liquid Glass Tab Bar:', err);
  }
});
