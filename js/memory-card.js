/**
 * Memory Showcase Card Controller — Kinetic Motion Blur, 3D Parallax & Optical Bloom
 * Directly couples physical drag velocity, 3D perspective tilt, and spring overshoot bounce
 */

(function () {
  'use strict';

  // Available local Pinterest images in assets/images/
  const localImages = [
    'assets/images/photo-01.png',
    'assets/images/photo-02.png',
    'assets/images/photo-03.png',
    'assets/images/photo-04.png',
    'assets/images/photo-05.png',
    'assets/images/photo-06.png',
    'assets/images/photo-07.png',
    'assets/images/photo-08.png',
    'assets/images/photo-09.png',
    'assets/images/photo-10.png',
    'assets/images/photo-11.png',
    'assets/images/photo-12.png',
    'assets/images/photo-13.png',
    'assets/images/photo-14.png',
    'assets/images/photo-15.png',
    'assets/images/photo-16.png',
    'assets/images/photo-17.png',
    'assets/images/photo-18.png'
  ];

  const editorialThemes = {
    2008: "Pacific Coastline",
    2009: "Midnight Rain",
    2010: "Vintage Lenses",
    2011: "Campus Days",
    2012: "Corner Cafés",
    2013: "High Peaks",
    2014: "Late Workspaces",
    2015: "Summer Tide",
    2016: "City Horizons",
    2017: "Wild Pines",
    2018: "Desert Canyon",
    2019: "Tokyo Evenings",
    2020: "Quiet Living",
    2021: "Reunion Walks",
    2022: "Open Highway",
    2023: "Amber Twilight",
    2024: "Studio Sessions",
    2025: "Emerald Valley",
    2026: "Future Horizon"
  };

  /**
   * Fisher-Yates array shuffle for non-sequential, random distribution
   */
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Generate randomized mapping across the timeline
  const shuffledImages = shuffle(localImages);
  // Total 19 timeline years: 18 unique images + 1 non-repeating wrap image
  const extraPool = localImages.filter(img => img !== shuffledImages[shuffledImages.length - 1]);
  const finalImagePool = [...shuffledImages, extraPool[Math.floor(Math.random() * extraPool.length)]];

  const memoryVault = {};
  const years = Object.keys(editorialThemes).map(Number);
  years.forEach((yr, idx) => {
    memoryVault[yr] = {
      image: finalImagePool[idx],
      title: `${yr}  ·  ${editorialThemes[yr]}`
    };
  });

  let currentYear = 2024;

  document.addEventListener('DOMContentLoaded', () => {
    const memoryCard = document.getElementById('memoryCard');
    const shutterFlash = document.getElementById('shutterFlash');
    const metaLine = document.getElementById('memoryMetaLine');
    let activeLayer = document.getElementById('imgLayerA');
    let bufferLayer = document.getElementById('imgLayerB');
    let activeGlow = document.getElementById('glowLayerA');
    let bufferGlow = document.getElementById('glowLayerB');
    if (!activeLayer || !bufferLayer) return;

    // Preload all vault images into browser memory
    Object.values(memoryVault).forEach(m => {
      const img = new Image();
      img.src = m.image;
    });

    /**
     * Updates quiet single-line text with smooth, soft crossfade
     * @param {Object} data - Year metadata
     */
    function updateEditorialText(data) {
      if (!metaLine || !data) return;

      metaLine.classList.add('memory-meta-fade');

      setTimeout(() => {
        metaLine.textContent = data.title || '';
        metaLine.classList.remove('memory-meta-fade');
      }, 120);
    }

    /**
     * Executes Optical Blur Dissolve, Ambient Glow Crossfade & Editorial Text Swap
     * @param {number} nextYear - Target year
     */
    function transitionToYear(nextYear) {
      const yr = Math.max(2008, Math.min(2026, Math.round(nextYear)));
      if (yr === currentYear) return;

      currentYear = yr;

      const data = memoryVault[yr];
      if (!data || !data.image) return;

      // 1. Smooth Editorial Text Update
      updateEditorialText(data);

      // 2. Optical Bloom / Shutter Flash Sheen
      if (shutterFlash) {
        shutterFlash.classList.add('flashing');
        setTimeout(() => {
          shutterFlash.classList.remove('flashing');
        }, 140);
      }

      // 3. Synchronize Reactive Ambient Light Glow (YouTube Ambient Mode)
      if (activeGlow && bufferGlow) {
        bufferGlow.src = data.image;
        activeGlow.classList.remove('glow-active');
        bufferGlow.classList.add('glow-active');
        const tempGlow = activeGlow;
        activeGlow = bufferGlow;
        bufferGlow = tempGlow;
      }

      // 4. Prepare Buffer Layer with Optical De-blur Bloom (Full-Bleed, Zero Gaps)
      bufferLayer.src = data.image;
      bufferLayer.className = 'memory-layer layer-incoming';

      // Force synchronous reflow to register starting blur & scale state
      void bufferLayer.offsetWidth;

      // 5. Seamless Rack-Focus Dissolve: Old layer sinks & blurs, New layer de-blurs on top
      activeLayer.className = 'memory-layer layer-outgoing';
      bufferLayer.className = 'memory-layer layer-active';

      // 6. Swap active layer references
      const temp = activeLayer;
      activeLayer = bufferLayer;
      bufferLayer = temp;
    }

    // Active Year Scrub Listener
    window.addEventListener('memoryYearChange', (e) => {
      if (!e.detail || !e.detail.year) return;
      transitionToYear(e.detail.year);
    });

    // Initial setup with 2024 active state
    if (memoryVault[2024]) {
      activeLayer.src = memoryVault[2024].image;
      if (activeGlow) activeGlow.src = memoryVault[2024].image;
      if (metaLine) metaLine.textContent = memoryVault[2024].title;
    }
  });
})();
