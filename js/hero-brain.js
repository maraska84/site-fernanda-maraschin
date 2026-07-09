// hero-brain.js
// ─────────────────────────────────────────────────────────────────────────────
// Cérebro 3D como FUNDO do hero da home (versão "ambiente": sem scroll-gate).
// Reaproveita os módulos da experiência (brain/neurons/particles) mas roda um
// loop contínuo e suave, dimensionado ao próprio hero. Degrada com elegância:
// se o WebGL falhar ou for mobile fraco, o hero continua com seu fundo/partículas.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';

import { createBrain, createBrainFromPoints } from './brain.js';
import { createNeurons }   from './neurons.js';
import { createParticles } from './particles.js';

export function initHeroBrain(canvas) {
  const host = canvas.parentElement; // #hero
  const isMobile =
    window.matchMedia('(max-width: 820px)').matches ||
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const N_BRAIN     = isMobile ? 4000 : 11000;
  const N_NEURONS   = isMobile ? 500  : 1700;
  const N_PARTICLES = isMobile ? 700  : 2400;

  function dims() {
    return { w: host.clientWidth || window.innerWidth, h: host.clientHeight || window.innerHeight };
  }
  let { w, h } = dims();

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0); // transparente — o fundo do hero aparece
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  camera.position.set(0, 0, 5.4);

  const group = new THREE.Group();
  scene.add(group);

  const mouse = { x: 0, y: 0 }, ms = { x: 0, y: 0 };
  if (!isMobile) {
    window.addEventListener('pointermove', (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.7, 0.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.setSize(w, h);

  const P = 0.22;    // "abertura" ambiente — cérebro coeso e brilhando
  const GAP = 0.14;  // hemisférios quase juntos (não divide como na experiência)

  let brain = null, neurons = null, particles = null, revealed = false;

  function build(brainObj) {
    brain = brainObj;
    neurons = createNeurons(brain.positions, brain.sides, N_NEURONS);
    particles = createParticles(N_PARTICLES, isMobile);
    group.add(brain.points);
    group.add(neurons.lines);
    scene.add(particles.points);

    brain.uniforms.uOpen.value = P;
    brain.uniforms.uGap.value = GAP;
    brain.uniforms.uBrightness.value = 0.72;
    brain.uniforms.uPulse.value = 2.4;
    neurons.uniforms.uProgress.value = P;
    neurons.uniforms.uOpen.value = P;
    neurons.uniforms.uGap.value = GAP;
    neurons.uniforms.uBrightness.value = 0.85;
    particles.uniforms.uProgress.value = P;
  }

  fetch('assets/brain-points.json')
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((pts) => build(createBrainFromPoints(pts, N_BRAIN, isMobile)))
    .catch(() => build(createBrain(N_BRAIN, isMobile)));

  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    ms.x += (mouse.x - ms.x) * 0.05;
    ms.y += (mouse.y - ms.y) * 0.05;

    if (brain) {
      brain.uniforms.uTime.value = t;
      neurons.uniforms.uTime.value = t;
      particles.uniforms.uTime.value = t;

      const breathe = P + Math.sin(t * 0.5) * 0.05; // respiração leve
      brain.uniforms.uOpen.value = breathe;
      neurons.uniforms.uOpen.value = breathe;

      group.rotation.y = t * 0.06 + ms.x * 0.35;
      group.rotation.x = Math.sin(t * 0.1) * 0.05 + ms.y * 0.2;
      particles.points.rotation.y = -t * 0.02 + ms.x * 0.05;

      if (!revealed) { revealed = true; canvas.classList.add('on'); } // fade-in no 1º frame com cérebro
    }

    composer.render();
    requestAnimationFrame(tick);
  }
  tick();

  window.addEventListener('resize', () => {
    const d = dims(); w = d.w; h = d.h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    const pr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
    if (brain) brain.uniforms.uPixelRatio.value = pr;
    if (particles) particles.uniforms.uPixelRatio.value = pr;
  }, { passive: true });
}
