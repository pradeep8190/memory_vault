/**
 * ============================================================================
 * CONTROLS & TELEMETRY HUD BINDINGS
 * ============================================================================
 * 
 * Synchronizes parameter sliders (IOR, Dispersion, Border Attraction)
 * and real-time physical telemetry HUD stats (Velocity, Stretch, Thinning, Splash).
 */

export class ControlsManager {
    /**
     * @param {Object} config - Central configuration
     * @param {Function} onParamChange - Callback when a parameter slider is adjusted
     */
    constructor(config, onParamChange) {
        this.config = config;
        this.onParamChange = onParamChange;

        // Active parameter state
        this.ior = config.lens.ior || 1.46;
        this.dispersion = config.lens.dispersion || 0.25;
        this.borderAttraction = config.lens.borderAttraction || 0.75;

        // DOM elements
        this.ctrlIor = document.getElementById('ctrlIor');
        this.ctrlDisp = document.getElementById('ctrlDisp');
        this.ctrlAttract = document.getElementById('ctrlAttract');

        this.txtIor = document.getElementById('txtIor');
        this.txtDisp = document.getElementById('txtDisp');
        this.txtAttract = document.getElementById('txtAttract');

        this.valVelocity = document.getElementById('valVelocity');
        this.valStretch = document.getElementById('valStretch');
        this.valThinning = document.getElementById('valThinning');
        this.valSplash = document.getElementById('valSplash');

        this.bindEvents();
    }

    bindEvents() {
        if (this.ctrlIor) {
            this.ctrlIor.value = this.ior;
            if (this.txtIor) this.txtIor.textContent = this.ior.toFixed(2);
            this.ctrlIor.addEventListener('input', (e) => {
                this.ior = parseFloat(e.target.value);
                if (this.txtIor) this.txtIor.textContent = this.ior.toFixed(2);
                if (this.onParamChange) this.onParamChange('ior', this.ior);
            });
        }

        if (this.ctrlDisp) {
            this.ctrlDisp.value = this.dispersion;
            if (this.txtDisp) this.txtDisp.textContent = this.dispersion.toFixed(2);
            this.ctrlDisp.addEventListener('input', (e) => {
                this.dispersion = parseFloat(e.target.value);
                if (this.txtDisp) this.txtDisp.textContent = this.dispersion.toFixed(2);
                if (this.onParamChange) this.onParamChange('dispersion', this.dispersion);
            });
        }

        if (this.ctrlAttract) {
            this.ctrlAttract.value = this.borderAttraction;
            if (this.txtAttract) this.txtAttract.textContent = this.borderAttraction.toFixed(2);
            this.ctrlAttract.addEventListener('input', (e) => {
                this.borderAttraction = parseFloat(e.target.value);
                if (this.txtAttract) this.txtAttract.textContent = this.borderAttraction.toFixed(2);
                if (this.onParamChange) this.onParamChange('borderAttraction', this.borderAttraction);
            });
        }
    }

    /**
     * Updates real-time telemetry HUD display values.
     * 
     * @param {Object} stats
     * @param {number} stats.velocity - Current X velocity in px/s
     * @param {number} stats.stretch - X stretch ratio
     * @param {number} stats.thinning - Y thinning ratio
     * @param {number} stats.splash - Splash surge height in px
     */
    updateTelemetry(stats) {
        if (this.valVelocity) {
            this.valVelocity.innerHTML = `${stats.velocity.toFixed(1)} <span class="hud-unit">px/s</span>`;
        }
        if (this.valStretch) {
            this.valStretch.innerHTML = `${stats.stretch.toFixed(3)}<span class="hud-unit">×</span>`;
        }
        if (this.valThinning) {
            this.valThinning.innerHTML = `${stats.thinning.toFixed(3)}<span class="hud-unit">×</span>`;
        }
        if (this.valSplash) {
            this.valSplash.innerHTML = `${stats.splash.toFixed(2)} <span class="hud-unit">px</span>`;
        }
    }
}

// Global fallback for script tag usage
if (typeof window !== 'undefined') {
    window.ControlsManager = ControlsManager;
}
