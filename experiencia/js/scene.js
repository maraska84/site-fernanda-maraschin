// scene.js
// ─────────────────────────────────────────────────────────────────────────────
// Orquestra TODA a experiência: renderer, cena, câmera, pós-processamento (Bloom),
// loop de animação e a função central updateBrain(progress).
//
// PERFORMANCE: detecta mobile e reduz contagens, pixel ratio e antialias.
// O progresso do scroll é suavizado (lerp) para um movimento cinematográfico.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

import { createBrain }     from './brain.js';
import { createNeurons }   from './neurons.js';
import { createParticles } from './particles.js';
import { initScroll }      from './scroll.js';

export function initExperience() {
  const canvas = document.getElementById('webgl');

  // ─── Detecção de mobile (reduz custo gráfico) ───
  const isMobile =
    window.matchMedia('(max-width: 820px)').matches ||
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  // Contagens — bem menores no mobile para manter os FPS.
  const N_BRAIN     = isMobile ? 5000 : 12000;
  const N_NEURONS   = isMobile ? 800  : 2600;
  const N_PARTICLES = isMobile ? 1200 : 4200;
  const PIXEL_RATIO = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);

  // ─── Renderer ───
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(PIXEL_RATIO);
  renderer.setClearColor(0x050505, 1);
  // Tone mapping cinematográfico: faz o "roll-off" dos brilhos em vez de estourar pra branco.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // ─── Cena e câmera ───
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 6);

  // Grupo que recebe a rotação contínua do cérebro.
  const group = new THREE.Group();
  scene.add(group);

  // ─── Conteúdo 3D ───
  const brain     = createBrain(N_BRAIN, isMobile);
  const neurons   = createNeurons(brain.positions, brain.sides, N_NEURONS);
  const particles = createParticles(N_PARTICLES, isMobile);

  group.add(brain.points);
  group.add(neurons.lines);
  scene.add(particles.points); // partículas no espaço (giro independente)

  // ─── Pós-processamento: Bloom (glow) ───
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.4,   // strength (intensidade) — animado por progresso
    0.7,   // radius
    0.25   // threshold — só o que é realmente brilhante floresce (preserva preto e estrutura)
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // OPCIONAL (desktop): profundidade de campo real com BokehPass.
  // Mantido desligado por padrão para proteger performance/estabilidade.
  // import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
  // if (!isMobile) composer.insertPass(new BokehPass(scene, camera,
  //   { focus: 6.0, aperture: 0.00025, maxblur: 0.006 }), 2);

  // ─────────────────────────────────────────────────────────────────────────
  // FUNÇÃO CENTRAL — todo o progresso da animação passa por aqui.
  // progress = ScrollTrigger.progress (0..1)
  // ─────────────────────────────────────────────────────────────────────────
  function applyProgress(progress) {
    const gap = 0.9;

    // 1) Abertura, brilho e velocidade de pulso do cérebro.
    brain.uniforms.uOpen.value       = progress;
    brain.uniforms.uGap.value        = gap;
    brain.uniforms.uBrightness.value = 0.2 + 0.7 * progress;
    brain.uniforms.uPulse.value      = 1.0 + 4.0 * progress;

    // 2) Conexões: quantidade visível, brilho e abertura acompanhando o cérebro.
    neurons.uniforms.uProgress.value   = progress;
    neurons.uniforms.uOpen.value       = progress;
    neurons.uniforms.uGap.value        = gap;
    neurons.uniforms.uBrightness.value = 0.6 + 0.6 * progress;

    // 3) Partículas: mais partículas conforme avança.
    particles.uniforms.uProgress.value = progress;

    // 4) Intensidade do Bloom.
    bloom.strength = 0.35 + 0.65 * progress;
    bloom.radius   = 0.65 + 0.25 * progress;

    // 5) Câmera: aproxima (dolly) e faz leve arco vertical.
    camera.position.z = 6.0 - 1.8 * progress;
    camera.position.y = Math.sin(progress * Math.PI) * 0.4;
    camera.lookAt(0, 0, 0);
  }

  // Alvo vindo do scroll; suavizado no loop para um movimento cinematográfico.
  let targetProgress = 0;
  let smoothProgress = 0;
  function updateBrain(progress) { targetProgress = progress; }

  // ─── Loop ───
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();

    // Suavização do progresso (lerp) — evita "saltos".
    smoothProgress += (targetProgress - smoothProgress) * 0.08;
    applyProgress(smoothProgress);

    // Tempo nos shaders (pulsos/flutuação).
    brain.uniforms.uTime.value     = t;
    neurons.uniforms.uTime.value   = t;
    particles.uniforms.uTime.value = t;

    // Rotação contínua + influência do progresso.
    group.rotation.y = t * 0.08 + smoothProgress * 0.6;
    group.rotation.x = Math.sin(t * 0.1) * 0.05;
    particles.points.rotation.y = -t * 0.02;

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
    brain.uniforms.uPixelRatio.value     = pr;
    particles.uniforms.uPixelRatio.value = pr;
  }, { passive: true });

  // ─── Liga o scroll e inicia ───
  initScroll(updateBrain);
  applyProgress(0);
  tick();
}
