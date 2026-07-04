// neurons.js
// ─────────────────────────────────────────────────────────────────────────────
// Conexões neurais ORGÂNICAS (não retas): cada fibra é uma curva (Bézier) entre
// dois pontos próximos do cérebro, com leve ruído — parece dendrito/axônio.
// Um IMPULSO elétrico (cabeça de luz) percorre cada fibra (atributo aLineT no shader).
// Além das fibras, criamos SPARKS/raios curtos saindo da superfície ("raios em volta").
// Tudo num único LineSegments para performance.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { neuronVertexShader, neuronFragmentShader } from './shaders.js';

const PALETTE = [
  new THREE.Color('#C9A25C'),
  new THREE.Color('#E8CE93'),
  new THREE.Color('#7FA8C9'),
];

/**
 * @param {Float32Array} brainPositions
 * @param {Float32Array} brainSides
 * @param {number} nFibers  nº de fibras curvas (sparks ≈ 30% disso)
 */
export function createNeurons(brainPositions, brainSides, nFibers) {
  const nSparks = Math.round(nFibers * 0.3);

  // Arrays dinâmicos (convertidos em Float32Array no fim).
  const P = [], SIDE = [], SEED = [], THR = [], LT = [], COL = [];
  const pushSeg = (p1, p2, side, seed, thr, col, t1, t2) => {
    P.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    SIDE.push(side, side);
    SEED.push(seed, seed);
    THR.push(thr, thr);
    LT.push(t1, t2);
    COL.push(col.r, col.g, col.b, col.r, col.g, col.b);
  };

  const n = brainPositions.length / 3;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
  const mid = new THREE.Vector3(), ctrl = new THREE.Vector3(), perp = new THREE.Vector3();
  const up = new THREE.Vector3(), prev = new THREE.Vector3(), cur = new THREE.Vector3();

  const robustPerp = (d) => {
    up.set(0, 1, 0);
    perp.crossVectors(d, up);
    if (perp.lengthSq() < 1e-6) { up.set(1, 0, 0); perp.crossVectors(d, up); }
    return perp.normalize();
  };

  // ── Fibras curvas (neurônios se ligando) ──
  const K = 6;
  let made = 0, attempts = 0;
  while (made < nFibers && attempts < nFibers * 40) {
    attempts++;
    const i = (Math.random() * n) | 0, j = (Math.random() * n) | 0;
    if (i === j || brainSides[i] !== brainSides[j]) continue;
    a.set(brainPositions[i * 3], brainPositions[i * 3 + 1], brainPositions[i * 3 + 2]);
    b.set(brainPositions[j * 3], brainPositions[j * 3 + 1], brainPositions[j * 3 + 2]);
    const len = a.distanceTo(b);
    if (len < 0.08 || len > 0.5) continue;

    dir.subVectors(b, a);
    robustPerp(dir);
    mid.addVectors(a, b).multiplyScalar(0.5);
    const arc = (Math.random() * 2 - 1) * 0.28 * len;     // curvatura do arco
    ctrl.copy(mid).addScaledVector(perp, arc);

    const seed = Math.random(), thr = Math.random(), col = PALETTE[(Math.random() * 3) | 0];
    const side = brainSides[i];

    prev.set(0, 0, 0);
    for (let k = 0; k <= K; k++) {
      const t = k / K, mt = 1 - t;
      cur.set(
        mt * mt * a.x + 2 * mt * t * ctrl.x + t * t * b.x,
        mt * mt * a.y + 2 * mt * t * ctrl.y + t * t * b.y,
        mt * mt * a.z + 2 * mt * t * ctrl.z + t * t * b.z
      );
      cur.x += (Math.random() - 0.5) * 0.015; // wiggle orgânico
      cur.y += (Math.random() - 0.5) * 0.015;
      cur.z += (Math.random() - 0.5) * 0.015;
      if (k > 0) pushSeg(prev, cur, side, seed, thr, col, (k - 1) / K, k / K);
      prev.copy(cur);
    }
    made++;
  }

  // ── Sparks / raios saindo da superfície ("raios em volta") ──
  const KS = 3;
  for (let s = 0; s < nSparks; s++) {
    const i = (Math.random() * n) | 0;
    a.set(brainPositions[i * 3], brainPositions[i * 3 + 1], brainPositions[i * 3 + 2]);
    dir.copy(a).normalize();        // pra fora (cérebro centrado na origem)
    robustPerp(dir);
    const L = 0.12 + Math.random() * 0.22;
    const seed = Math.random(), thr = Math.random() * 0.6, col = PALETTE[(Math.random() * 3) | 0];
    const side = a.x >= 0 ? 1 : -1;

    prev.copy(a);
    for (let k = 1; k <= KS; k++) {
      const t = k / KS;
      cur.copy(a).addScaledVector(dir, L * t);
      cur.addScaledVector(perp, (Math.random() - 0.5) * 0.05); // zigue-zague de raio
      pushSeg(prev, cur, side, seed, thr, col, (k - 1) / KS, k / KS);
      prev.copy(cur);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',   new THREE.BufferAttribute(new Float32Array(P), 3));
  geometry.setAttribute('aSide',      new THREE.BufferAttribute(new Float32Array(SIDE), 1));
  geometry.setAttribute('aSeed',      new THREE.BufferAttribute(new Float32Array(SEED), 1));
  geometry.setAttribute('aThreshold', new THREE.BufferAttribute(new Float32Array(THR), 1));
  geometry.setAttribute('aLineT',     new THREE.BufferAttribute(new Float32Array(LT), 1));
  geometry.setAttribute('aColor',     new THREE.BufferAttribute(new Float32Array(COL), 3));

  const uniforms = {
    uTime:       { value: 0 },
    uProgress:   { value: 0 },
    uBrightness: { value: 1.0 },
    uOpen:       { value: 0 },
    uGap:        { value: 0.7 },
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
