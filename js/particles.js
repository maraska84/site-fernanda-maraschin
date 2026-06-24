// particles.js
// ─────────────────────────────────────────────────────────────────────────────
// Partículas volumétricas flutuando ao redor do cérebro. Giram lentamente,
// fazem drift orgânico e AUMENTAM em quantidade conforme o progresso do scroll
// (via limiar por partícula comparado a uProgress).
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { particleVertexShader, particleFragmentShader } from './shaders.js';

const PALETTE = [
  new THREE.Color('#a855f7'),
  new THREE.Color('#ff00ff'),
  new THREE.Color('#00d4ff'),
];

export function createParticles(count, isMobile) {
  const positions  = new Float32Array(count * 3);
  const seeds      = new Float32Array(count);
  const thresholds = new Float32Array(count);
  const colors     = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Distribuídas numa casca esférica em volta do cérebro.
    const r  = 1.6 + Math.random() * 2.8;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    positions[i * 3]     = r * Math.sin(ph) * Math.cos(th);
    positions[i * 3 + 1] = r * Math.cos(ph) * 0.8;
    positions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);

    seeds[i]      = Math.random();
    thresholds[i] = Math.random(); // quanto maior, mais tarde aparece

    const col = PALETTE[(Math.random() * PALETTE.length) | 0];
    colors[i * 3]     = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',   new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed',      new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aThreshold', new THREE.BufferAttribute(thresholds, 1));
  geometry.setAttribute('aColor',     new THREE.BufferAttribute(colors, 3));

  const uniforms = {
    uTime:       { value: 0 },
    uProgress:   { value: 0 },
    uSize:       { value: isMobile ? 1.3 : 1.6 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, uniforms };
}
