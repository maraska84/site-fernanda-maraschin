// brain.js
// ─────────────────────────────────────────────────────────────────────────────
// Gera o "cérebro" como uma NUVEM DE PONTOS (procedural, sem precisar de .glb).
// Dois hemisférios (esquerdo/direito) que se afastam no scroll via uOpen.
// Retorna também o array de posições, reaproveitado por neurons.js para criar
// as conexões entre pontos reais do cérebro.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { brainVertexShader, brainFragmentShader } from './shaders.js';

// Paleta do projeto.
const PALETTE = [
  new THREE.Color('#C9A25C'), // roxo
  new THREE.Color('#E8CE93'), // magenta
  new THREE.Color('#7FA8C9'), // azul elétrico
];

// Ruído barato baseado em senos — suficiente para simular "rugas" (gyri/sulci).
function ridgeNoise(x, y, z) {
  return (
    Math.sin(x * 1.7 + y * 2.3 + z * 3.1) * 0.5 +
    Math.sin(x * 4.1 + z * 1.3) * 0.25 +
    Math.sin(y * 3.3 + z * 2.7) * 0.25
  );
}

/**
 * Cria o cérebro de partículas.
 * @param {number} count  Número de pontos (reduzido no mobile).
 * @param {boolean} isMobile
 */
export function createBrain(count, isMobile) {
  const positions = new Float32Array(count * 3);
  const sides     = new Float32Array(count);
  const seeds     = new Float32Array(count);
  const colors    = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const side = (i % 2 === 0) ? -1 : 1; // alterna hemisférios

    // Direção aleatória uniforme; forçamos o sinal de X para o hemisfério certo.
    let x, y, z, len;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      len = Math.hypot(x, y, z);
    } while (len < 0.2 || len > 1.0);
    x /= len; y /= len; z /= len;
    x = Math.abs(x) * side;

    // Elipsoide com proporção de cérebro: alongado em Z, achatado em Y.
    const rx = 1.0, ry = 0.82, rz = 1.22;
    const bump = 0.10 * ridgeNoise(x * 3.0, y * 3.0, z * 3.0); // rugas do córtex
    // ~22% dos pontos ficam no "miolo" (volume interno / conexões internas).
    const shell = (Math.random() < 0.22) ? (0.45 + Math.random() * 0.4) : (0.92 + bump);

    let px = x * rx * shell;
    let py = y * ry * shell;
    let pz = z * rz * shell;
    py *= 1.0 - 0.15 * Math.max(0.0, pz); // leve queda frontal (mais orgânico)
    px += side * 0.04;                     // pequeno sulco central inicial

    positions[i * 3]     = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;
    sides[i] = side;
    seeds[i] = Math.random();

    // Cor: gradiente da paleta conforme a altura (y).
    const t = (py + 1.0) / 2.0;
    const col = (t < 0.5)
      ? PALETTE[0].clone().lerp(PALETTE[1], t * 2.0)
      : PALETTE[1].clone().lerp(PALETTE[2], (t - 0.5) * 2.0);
    colors[i * 3]     = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSide',    new THREE.BufferAttribute(sides, 1));
  geometry.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));

  const uniforms = {
    uTime:       { value: 0 },
    uOpen:       { value: 0 },
    uGap:        { value: 0.9 },
    uPulse:      { value: 1.0 },
    uBrightness: { value: 0.3 },
    uSize:       { value: isMobile ? 1.2 : 1.4 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: brainVertexShader,
    fragmentShader: brainFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; // evita sumiço ao abrir os hemisférios

  // Expomos positions/sides para os neurônios reaproveitarem.
  return { points, uniforms, positions, sides };
}

/**
 * Cria o cérebro a partir de uma NUVEM DE PONTOS REAL (assada do modelo .glb).
 * Recebe um array plano [x,y,z, x,y,z, ...] já centralizado e escalado.
 * Mantém exatamente o mesmo material/shader do cérebro procedural, então
 * abertura, brilho, pulso e bloom continuam funcionando igual.
 * @param {number[]|Float32Array} src  posições assadas
 * @param {number} count               nº de pontos a usar (subamostra se preciso)
 * @param {boolean} isMobile
 */
export function createBrainFromPoints(src, count, isMobile) {
  const available = Math.floor(src.length / 3);
  const n = Math.min(count, available);

  // Subamostragem aleatória (ex.: mobile usa menos pontos do mesmo modelo).
  let indices;
  if (n < available) {
    indices = Array.from({ length: available }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = indices[i]; indices[i] = indices[j]; indices[j] = t;
    }
    indices = indices.slice(0, n);
  } else {
    indices = Array.from({ length: n }, (_, i) => i);
  }

  const positions = new Float32Array(n * 3);
  const sides     = new Float32Array(n);
  const seeds     = new Float32Array(n);
  const colors    = new Float32Array(n * 3);

  // Faixa de altura (y) para o gradiente de cor.
  let minY = Infinity, maxY = -Infinity;
  for (const idx of indices) {
    const y = src[idx * 3 + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanY = Math.max(0.0001, maxY - minY);

  for (let k = 0; k < n; k++) {
    const idx = indices[k];
    const x = src[idx * 3], y = src[idx * 3 + 1], z = src[idx * 3 + 2];
    positions[k * 3] = x;
    positions[k * 3 + 1] = y;
    positions[k * 3 + 2] = z;

    sides[k] = (x >= 0) ? 1 : -1;   // hemisfério pelo sinal de X
    seeds[k] = Math.random();

    const t = (y - minY) / spanY;
    const col = (t < 0.5)
      ? PALETTE[0].clone().lerp(PALETTE[1], t * 2.0)
      : PALETTE[1].clone().lerp(PALETTE[2], (t - 0.5) * 2.0);
    colors[k * 3] = col.r; colors[k * 3 + 1] = col.g; colors[k * 3 + 2] = col.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSide',    new THREE.BufferAttribute(sides, 1));
  geometry.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));

  const uniforms = {
    uTime:       { value: 0 },
    uOpen:       { value: 0 },
    uGap:        { value: 0.7 },
    uPulse:      { value: 1.0 },
    uBrightness: { value: 0.3 },
    uSize:       { value: isMobile ? 1.7 : 2.1 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: brainVertexShader,
    fragmentShader: brainFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, uniforms, positions, sides };
}
