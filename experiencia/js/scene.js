// scene.js
// ─────────────────────────────────────────────────────────────────────────────
// Orquestra TODA a experiência: renderer, cena, câmera, pós-processamento (Bloom),
// loop de animação e a função central updateBrain(progress).
//
// O cérebro vem da NUVEM DE PONTOS REAL assada do modelo .glb
// (assets/brain-points.json, ~300 KB). Se o arquivo falhar, cai no cérebro
// procedural — a experiência nunca quebra.
//
// PERFORMANCE: detecta mobile e reduz contagens, pixel ratio e antialias.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';

import { createBrain, createBrainFromPoints } from './brain.js';
import { createNeurons }   from './neurons.js';
import { createParticles } from './particles.js';
import { initScroll }      from './scroll.js';

const GAP = 0.7; // distância de abertura dos hemisférios (ajustada para o modelo real)

export function initExperience() {
  const canvas = document.getElementById('webgl');

  // ─── Detecção de mobile (reduz custo gráfico) ───
  const isMobile =
    window.matchMedia('(max-width: 820px)').matches ||
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const N_BRAIN     = isMobile ? 5000 : 12000;
  const N_NEURONS   = isMobile ? 800  : 2600;
  const N_PARTICLES = isMobile ? 1200 : 4200;
  const PIXEL_RATIO = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);

  // ─── Renderer ───
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !isMobile, powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(PIXEL_RATIO);
  renderer.setClearColor(0x050505, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // roll-off de brilho (não estoura)
  renderer.toneMappingExposure = 1.05;

  // ─── Cena e câmera ───
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 6);

  const group = new THREE.Group(); // recebe a rotação contínua do cérebro
  scene.add(group);

  // ─── Pós-processamento: Bloom ───
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.4,  // strength — animado por progresso
    0.7,  // radius
    0.25  // threshold — preserva preto e estrutura
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // OPCIONAL (desktop): DOF real com BokehPass — desligado por padrão (perf).
  // import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
  // if (!isMobile) composer.insertPass(new BokehPass(scene, camera,
  //   { focus: 6.0, aperture: 0.00025, maxblur: 0.006 }), 2);

  // ─── Conteúdo 3D (preenchido após carregar a nuvem de pontos) ───
  let brain = null, neurons = null, particles = null;

  function buildContent(brainObj, source) {
    brain     = brainObj;
    neurons   = createNeurons(brain.positions, brain.sides, N_NEURONS);
    particles = createParticles(N_PARTICLES, isMobile);
    group.add(brain.points);
    group.add(neurons.lines);
    scene.add(particles.points);
    console.log(`[brain] pronto via ${source} — ${brain.positions.length / 3} pontos`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FUNÇÃO CENTRAL — todo o progresso da animação passa por aqui.
  // progress = ScrollTrigger.progress (0..1)
  // ─────────────────────────────────────────────────────────────────────────
  function applyProgress(progress) {
    // Bloom e câmera funcionam mesmo antes do cérebro carregar.
    bloom.strength = 0.35 + 0.65 * progress;
    bloom.radius   = 0.65 + 0.25 * progress;
    camera.position.z = 6.0 - 1.8 * progress;
    camera.position.y = Math.sin(progress * Math.PI) * 0.4;
    camera.lookAt(0, 0, 0);

    if (!brain) return;

    // Cérebro
    brain.uniforms.uOpen.value       = progress;
    brain.uniforms.uGap.value        = GAP;
    brain.uniforms.uBrightness.value = 0.2 + 0.7 * progress;
    brain.uniforms.uPulse.value      = 1.0 + 4.0 * progress;
    // Conexões
    neurons.uniforms.uProgress.value   = progress;
    neurons.uniforms.uOpen.value       = progress;
    neurons.uniforms.uGap.value        = GAP;
    neurons.uniforms.uBrightness.value = 0.6 + 0.6 * progress;
    // Partículas
    particles.uniforms.uProgress.value = progress;
  }

  // Alvo vindo do scroll; suavizado no loop (movimento cinematográfico).
  let targetProgress = 0;
  let smoothProgress = 0;
  function updateBrain(progress) { targetProgress = progress; }

  // ─── Loop ───
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    smoothProgress += (targetProgress - smoothProgress) * 0.08;
    applyProgress(smoothProgress);

    if (brain) {
      brain.uniforms.uTime.value     = t;
      neurons.uniforms.uTime.value   = t;
      particles.uniforms.uTime.value = t;
      group.rotation.y = t * 0.08 + smoothProgress * 0.6;
      group.rotation.x = Math.sin(t * 0.1) * 0.05;
      particles.points.rotation.y = -t * 0.02;
    }

    composer.render();
    requestAnimationFrame(tick);
  }

  // ─── Resize responsivo ───
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    const pr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
    if (brain) brain.uniforms.uPixelRatio.value = pr;
    if (particles) particles.uniforms.uPixelRatio.value = pr;
  }, { passive: true });

  // ─── Liga o scroll e inicia o loop (renderiza enquanto carrega) ───
  initScroll(updateBrain);
  tick();

  // ─── Carrega a nuvem de pontos REAL do modelo .glb (assada) ───
  fetch('assets/brain-points.json')
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((pts) => buildContent(createBrainFromPoints(pts, N_BRAIN, isMobile), 'modelo .glb'))
    .catch((err) => {
      console.warn('[brain] falha ao carregar nuvem real, usando procedural:', err.message);
      buildContent(createBrain(N_BRAIN, isMobile), 'procedural (fallback)');
    });
}
