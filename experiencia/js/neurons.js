// neurons.js
// ─────────────────────────────────────────────────────────────────────────────
// Cria as CONEXÕES NEURAIS como THREE.LineSegments entre pontos reais do cérebro.
// Cada conexão tem: lado (para acompanhar a abertura), semente (fase do pulso) e
// limiar (aparece conforme o progresso do scroll). O shader faz pulsar/piscar,
// dando a sensação de impulsos elétricos que nascem e desaparecem.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { neuronVertexShader, neuronFragmentShader } from './shaders.js';

const PALETTE = [
  new THREE.Color('#a855f7'),
  new THREE.Color('#ff00ff'),
  new THREE.Color('#00d4ff'),
];

/**
 * @param {Float32Array} brainPositions  posições dos pontos do cérebro
 * @param {Float32Array} brainSides      lado (-1/+1) de cada ponto
 * @param {number} count                 nº de conexões desejadas
 */
export function createNeurons(brainPositions, brainSides, count) {
  const positions  = new Float32Array(count * 2 * 3);
  const sides      = new Float32Array(count * 2);
  const seeds      = new Float32Array(count * 2);
  const thresholds = new Float32Array(count * 2);
  const colors     = new Float32Array(count * 2 * 3);

  const n = brainPositions.length / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  let s = 0;          // conexões criadas
  let attempts = 0;   // trava de segurança
  while (s < count && attempts < count * 40) {
    attempts++;
    const i = (Math.random() * n) | 0;
    const j = (Math.random() * n) | 0;
    if (i === j) continue;
    if (brainSides[i] !== brainSides[j]) continue; // mesmo hemisfério

    a.set(brainPositions[i * 3], brainPositions[i * 3 + 1], brainPositions[i * 3 + 2]);
    b.set(brainPositions[j * 3], brainPositions[j * 3 + 1], brainPositions[j * 3 + 2]);
    const dist = a.distanceTo(b);
    if (dist < 0.08 || dist > 0.55) continue; // só conexões curtas/médias

    const seed = Math.random();
    const thr  = Math.random();
    const col  = PALETTE[(Math.random() * PALETTE.length) | 0];

    const p = s * 6;
    positions[p]     = a.x; positions[p + 1] = a.y; positions[p + 2] = a.z;
    positions[p + 3] = b.x; positions[p + 4] = b.y; positions[p + 5] = b.z;

    for (const k of [0, 1]) {
      const v = s * 2 + k;
      sides[v]      = brainSides[i];
      seeds[v]      = seed;
      thresholds[v] = thr;
      colors[v * 3]     = col.r;
      colors[v * 3 + 1] = col.g;
      colors[v * 3 + 2] = col.b;
    }
    s++;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',   new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSide',      new THREE.BufferAttribute(sides, 1));
  geometry.setAttribute('aSeed',      new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aThreshold', new THREE.BufferAttribute(thresholds, 1));
  geometry.setAttribute('aColor',     new THREE.BufferAttribute(colors, 3));

  const uniforms = {
    uTime:       { value: 0 },
    uProgress:   { value: 0 },
    uBrightness: { value: 1.0 },
    uOpen:       { value: 0 },
    uGap:        { value: 0.9 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: neuronVertexShader,
    fragmentShader: neuronFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  return { lines, uniforms };
}
