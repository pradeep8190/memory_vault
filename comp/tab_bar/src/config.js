/**
 * ============================================================================
 * LIQUID GLASS TAB BAR — CENTRAL CONFIGURATION
 * ============================================================================
 * 
 * This file contains all default dimensions, tab configurations, optical parameters,
 * and physics coefficients for the Liquid Glass Tab Bar.
 * 
 * Developers can customize any parameter here or pass overrides into the
 * LiquidTabBar constructor options.
 */

export const DEFAULT_CONFIG = {
    // ------------------------------------------------------------------------
    // Geometry & Layout (Sized for iPhone 17 Pro floating pill capsule)
    // ------------------------------------------------------------------------
    pill: {
        width: 388,          // Base floating pill width in CSS pixels (slight increase for edge clearance)
        height: 58,          // Pill height in CSS pixels
        padding: 8.0,        // Balanced 8px gap between resting static lens and outer pill border
        ior: 1.540,          // Background glass Index of Refraction (Crown Glass)
        dispersion: 0.040,   // Abbe chromatic dispersion of the pill background
        lensHeight: 14.0,    // Convex dome height in pixels
        frostBlur: 14.0,     // Frosted glass blur diffusion spread
        alpha: 1.0,          // Opacity of pill background
        color: '#1d1d1f'     // Default text and icon stroke/fill color
    },

    // ------------------------------------------------------------------------
    // Lens Sizing (Static resting pill vs Active fluid droplet)
    // ------------------------------------------------------------------------
    lens: {
        // 1. Static Resting Lens (concentric horizontal pill capsule inside tab slot)
        staticHalfH: 25.0,        // Height = 50px (uniform 4px margin inside 58px pill)
        staticRadius: 25.0,       // Corner radius concentric with 29px pill cap: (29 - 4 = 25px)
        
        // 2. Active Fluid Droplet Lens
        activeBaseHalfW: 46.5,    // Base width = 93px (46.5 * 2)
        activeHalfH: 34.0,        // Height = 68px (34 * 2) - expands 5px above and 5px below pill

        // Optical Refraction Parameters
        ior: 1.46,                // Active lens Index of Refraction (3D Snell's Law)
        dispersion: 0.25,         // Cauchy spectral chromatic dispersion (0.0 to 1.0)
        borderAttraction: 0.75,   // Optical border attraction pulling graphics to boundary
    },

    // ------------------------------------------------------------------------
    // Navigation Tabs Configuration (5 Tabs: Home, Cart, Bag, Save, Call)
    // ------------------------------------------------------------------------
    tabs: [
        {
            id: 'home',
            label: 'Home',
            type: 'home',
            activeHalfW: 46.5,    // Width when active = 93px
            href: '#home',
            onClick: null
        },
        {
            id: 'cart',
            label: 'Cart',
            type: 'cart',
            activeHalfW: 46.5,    // Width when active = 93px
            href: '#cart',
            onClick: null
        },
        {
            id: 'bag',
            label: 'Bag',
            type: 'bag',
            activeHalfW: 48.0,    // Content-aware wider active lens width = 96px
            href: '#bag',
            onClick: null
        },
        {
            id: 'save',
            label: 'Save',
            type: 'mark',
            activeHalfW: 46.5,    // Width when active = 93px
            href: '#save',
            onClick: null
        },
        {
            id: 'call',
            label: 'Call',
            type: 'call',
            activeHalfW: 46.5,    // Width when active = 93px
            href: '#call',
            onClick: null
        }
    ],

    // Default active tab index on initial load (Tab 2: Bag / Explore)
    defaultTabIndex: 2,

    // ------------------------------------------------------------------------
    // Hydrodynamic Fluid Dynamics & Spring Constants
    // ------------------------------------------------------------------------
    physics: {
        // Translation springs
        springKDrag: 320.0,
        springDampDrag: 26.0,
        springKTap: 115.0,
        springDampTap: 17.5,
        springKGlide: 145.0,
        springDampGlide: 16.5,

        // Whole pill tactile swell when holding / dragging
        pillScaleHold: 1.018,
        kPillScaleDrag: 140.0,
        dPillScaleDrag: 16.0,
        kPillScaleRest: 160.0,
        dPillScaleRest: 18.0,

        // Metamorphosis physical transition: 0.0 (Static Pill) -> 1.0 (Liquid Lens)
        springKActiveDrag: 100.0,
        springDampActiveDrag: 15.0,
        springKActiveRest: 80.0,
        springDampActiveRest: 13.5,

        // Landing squash rebound
        kSquash: 150.0,
        dSquash: 8.8,

        // Incompressible volume conservation (Sx * Sy^2 = const)
        surfaceTensionK: 320.0,
        fluidViscosityDamp: 14.0,

        // Hydraulic braking shockwaves & splash
        splashSpringK: 220.0,
        splashSpringDamp: 18.0,

        // Content-adaptive active width spring oscillator
        kWidth: 200.0,
        dWidth: 7.5,

        // Magnetic detents & overscroll
        detentRadius: 24.0,
        maxOverscroll: 20.0,
        tension: 40.0
    },

    // ------------------------------------------------------------------------
    // UI Controls & Telemetry HUD Bindings (Optional)
    // ------------------------------------------------------------------------
    ui: {
        bindControls: true,       // Auto-bind to ctrlIor, ctrlDisp, ctrlAttract if found in DOM
        bindTelemetry: true       // Auto-bind to valVelocity, valStretch, valThinning, valSplash
    }
};

// Global fallback for script tag usage
if (typeof window !== 'undefined') {
    window.DEFAULT_CONFIG = DEFAULT_CONFIG;
}
