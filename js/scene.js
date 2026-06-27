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
import { createFigure }    from './figure.js';
import { initScroll }      from './scroll.js';

const GAP = 0.85; // distância de abertura dos hemisférios (divisão clara no fim)

export function initExperience() {
  const canvas = document.getElementById('webgl');

  // ─── Detecção de mobile (reduz custo gráfico) ───
  const isMobile =
    window.matchMedia('(max-width: 820px)').matches ||
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const N_BRAIN     = isMobile ? 6000 : 14000;
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

  // Silhueta humana luminosa no centro — fora do grupo (não gira), revelada pelo scroll.
  const figure = createFigure();
  scene.add(figure.mesh);

  // ─── Parallax do mouse: o cérebro segue o cursor (desktop) ───
  const mouse = { x: 0, y: 0 };
  const mouseSmooth = { x: 0, y: 0 };
  if (!isMobile) {
    window.addEventListener('pointermove', (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;   // -1 (esq) .. 1 (dir)
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;  // -1 (topo) .. 1 (base)
    }, { passive: true });
  }

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

    // Silhueta: surge entre ~35% e ~75% do scroll e cresce levemente.
    const reveal = Math.min(1, Math.max(0, (progress - 0.35) / 0.4));
    figure.uniforms.uReveal.value = reveal;
    const fs = 0.9 + 0.1 * reveal;
    figure.mesh.scale.set(fs, fs, fs);

    if (!brain) return;

    // Cérebro
    brain.uniforms.uOpen.value       = progress;
    brain.uniforms.uGap.value        = GAP;
    brain.uniforms.uBrightness.value = 0.45 + 0.5 * progress;
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

    // Silhueta: tempo (pulso) + billboard (sempre de frente p/ a câmera).
    figure.uniforms.uTime.value = t;
    figure.mesh.lookAt(camera.position);

    if (brain) {
      brain.uniforms.uTime.value     = t;
      neurons.uniforms.uTime.value   = t;
      particles.uniforms.uTime.value = t;
      // A rotação "acalma" conforme chega ao fim: no 100% o cérebro fica de
      // FRENTE, com a divisão dos hemisférios centralizada na tela.
      // Suaviza a posição do mouse (segue com um leve atraso elegante).
      mouseSmooth.x += (mouse.x - mouseSmooth.x) * 0.05;
      mouseSmooth.y += (mouse.y - mouseSmooth.y) * 0.05;

      const calm = 1.0 - smoothProgress;
      // O parallax do mouse reduz no clímax pra divisão final ficar centralizada.
      const tilt = 0.45 + 0.55 * calm;
      group.rotation.y = Math.sin(t * 0.15) * 0.28 * calm + mouseSmooth.x * 0.45 * tilt;
      group.rotation.x = Math.sin(t * 0.10) * 0.05 * calm + mouseSmooth.y * 0.30 * tilt;
      particles.points.rotation.y = -t * 0.02 + mouseSmooth.x * 0.06;
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
