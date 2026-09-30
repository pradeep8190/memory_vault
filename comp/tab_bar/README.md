# Liquid Glass Optical Tab Bar

A high-performance, hydrodynamic optical liquid glass navigation bar component powered by WebGL, 3D Snell's Law convex ray-tracing, Cauchy 6-band chromatic dispersion, and fluid volume conservation physics.

---

## 📁 File & Architecture Structure

```text
atronix/
├── index.html              # Demo / Integration host page
├── style.css               # Container and stage CSS styling
├── script.js               # Application bootstrap (mounts LiquidTabBar)
├── README.md               # Quickstart & integration guide for other developers
│
└── src/                    # 📦 Core Reusable Library
    ├── index.js            # Main package entry point (ESM exports)
    ├── LiquidTabBar.js     # Master Component class (orchestrates rendering, physics, and gestures)
    ├── config.js           # 🎯 Central configuration (default tabs, sizes, physics, IOR, dispersion)
    ├── geometry.js         # Layout math (pill dimensions, tab slot spacing, center coordinates)
    ├── physics.js          # Fluid physics engine (volume conservation, springs, splash, squash)
    ├── gestures.js         # Pointer tracker (rubber-band resistance, magnetic detents, flick momentum)
    ├── renderer.js         # 2D substrate compositor (icons, typography, spatial optical clipping)
    ├── controls.js         # Live parameter sliders (IOR, Dispersion, Attraction) & Telemetry HUD
    ├── icons.js            # Vector SVG icon library (with registerIcon API for custom icons)
    ├── pill.js             # LiquidGlassPill: WebGL frosted glass background component
    ├── webgl.js            # WebGL renderer pipeline & shader uniform binding
    └── shaders/
        ├── lens.vert.js    # GLSL Vertex Shader (quad pass)
        └── lens.frag.js    # GLSL Fragment Shader (Snell's Law, dispersion, SDF, specular edges)
```

---

## 🚀 Quickstart

### 1. Zero-Config Default Usage
Drop into any container element with the built-in defaults (5 tabs: Home, Cart, Bag, Save, Call):

```html
<div id="navbar"></div>

<script type="module">
  import { LiquidTabBar } from './src/index.js';

  const tabBar = new LiquidTabBar('#navbar');
</script>
```

### 2. Custom Tabs, Dimensions & Callbacks
```javascript
import { LiquidTabBar } from './src/index.js';

const tabBar = new LiquidTabBar('#navbar', {
  pill: {
    width: 380,
    height: 58
  },
  tabs: [
    { id: 'home', label: 'Home', type: 'home', href: '/home' },
    { id: 'cart', label: 'Cart', type: 'cart', href: '/cart' },
    { id: 'bag',  label: 'Bag',  type: 'bag',  href: '/bag'  }
  ],
  defaultTabIndex: 0,
  onChange: (tab, index) => {
    console.log('Switched to tab:', tab.label, 'at index:', index);
  }
});
```

### 3. Programmatic Navigation
```javascript
// Smoothly animate fluid lens to tab index 1
tabBar.setTab(1);
```

### 4. Adding Custom Icons
```javascript
import { registerIcon } from './index.js';

registerIcon('search', {
  viewBox: 24,
  strokeWidth: 1.7,
  outline: {
    stroke: [ new Path2D('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35') ]
  },
  filled: {
    fill: [ new Path2D('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z') ],
    stroke: [ new Path2D('M21 21l-4.35-4.35') ]
  }
});
```
