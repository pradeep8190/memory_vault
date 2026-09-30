/**
 * ============================================================================
 * WEBGL CONTEXT & RENDERER PIPELINE
 * ============================================================================
 * 
 * Sets up WebGL resources, shaders, uniforms, textures, and triggers
 * the raytracer draw call. Shaders are modularly located in ./shaders/
 */

import { lensVertexShader } from './shaders/lens.vert.js';
import { lensFragmentShader } from './shaders/lens.frag.js';

export const vsSource = lensVertexShader;
export const fsSource = lensFragmentShader;

/**
 * Compiles a GLSL shader.
 * @param {WebGLRenderingContext} gl
 * @param {number} type
 * @param {string} src
 * @returns {WebGLShader|null}
 */
export function createShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
    }
    return s;
}

/**
 * Initializes WebGL program, shaders, quad buffer, uniform locations, and texture.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ gl: WebGLRenderingContext, prog: WebGLProgram, uniforms: Object, bgTex: WebGLTexture }|null}
 */
export function initWebGL(canvas) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
    if (!gl) {
        console.error('WebGL not supported');
        return null;
    }

    const prog = gl.createProgram();
    const vs = createShader(gl, gl.VERTEX_SHADER, lensVertexShader);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, lensFragmentShader);
    if (!vs || !fs) return null;

    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(prog));
        return null;
    }
    gl.useProgram(prog);

    // Quad Buffer
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Uniform Locations
    const uniforms = {
        u_background: gl.getUniformLocation(prog, 'u_background'),
        u_resolution: gl.getUniformLocation(prog, 'u_resolution'),
        u_lensPos: gl.getUniformLocation(prog, 'u_lensPos'),
        u_lensHalfSize: gl.getUniformLocation(prog, 'u_lensHalfSize'),
        u_lensRadius: gl.getUniformLocation(prog, 'u_lensRadius'),
        u_velocity: gl.getUniformLocation(prog, 'u_velocity'),
        u_fluidWave: gl.getUniformLocation(prog, 'u_fluidWave'),
        u_splashHeight: gl.getUniformLocation(prog, 'u_splashHeight'),
        u_ior: gl.getUniformLocation(prog, 'u_ior'),
        u_dispersion: gl.getUniformLocation(prog, 'u_dispersion'),
        u_dpr: gl.getUniformLocation(prog, 'u_dpr'),
        u_activeProgress: gl.getUniformLocation(prog, 'u_activeProgress'),
        u_attraction: gl.getUniformLocation(prog, 'u_attraction'),
        u_time: gl.getUniformLocation(prog, 'u_time'),
    };

    const bgTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    return { gl, prog, uniforms, bgTex };
}

/**
 * Uploads 2D canvas composite image to the WebGL background texture.
 * @param {WebGLRenderingContext} gl
 * @param {WebGLTexture} bgTex
 * @param {HTMLCanvasElement} bgCanvas
 */
export function updateWebGLTexture(gl, bgTex, bgCanvas) {
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgCanvas);
}

/**
 * Executes the WebGL ray-tracer draw pass for the liquid droplet lens.
 * @param {WebGLRenderingContext} gl
 * @param {WebGLProgram} prog
 * @param {Object} uniforms
 * @param {WebGLTexture} bgTex
 * @param {Object} params
 */
export function renderWebGLLens(gl, prog, uniforms, bgTex, params) {
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.uniform1i(uniforms.u_background, 0);

    gl.uniform2f(uniforms.u_resolution, params.resolution[0], params.resolution[1]);
    gl.uniform2f(uniforms.u_lensPos, params.lensPos[0], params.lensPos[1]);
    gl.uniform2f(uniforms.u_lensHalfSize, params.lensHalfSize[0], params.lensHalfSize[1]);
    gl.uniform1f(uniforms.u_lensRadius, params.lensRadius);
    gl.uniform2f(uniforms.u_velocity, params.velocity[0], params.velocity[1]);
    gl.uniform1f(uniforms.u_fluidWave, params.fluidWave);
    gl.uniform1f(uniforms.u_splashHeight, params.splashHeight);
    gl.uniform1f(uniforms.u_ior, params.ior);
    gl.uniform1f(uniforms.u_dispersion, params.dispersion);
    gl.uniform1f(uniforms.u_dpr, params.dpr);
    gl.uniform1f(uniforms.u_activeProgress, params.activeProgress);
    gl.uniform1f(uniforms.u_attraction, params.attraction !== undefined ? params.attraction : 0.75);
    gl.uniform1f(uniforms.u_time, params.time);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// Global fallback for script tag usage
if (typeof window !== 'undefined') {
    window.vsSource = vsSource;
    window.fsSource = fsSource;
    window.createShader = createShader;
    window.initWebGL = initWebGL;
    window.updateWebGLTexture = updateWebGLTexture;
    window.renderWebGLLens = renderWebGLLens;
}
