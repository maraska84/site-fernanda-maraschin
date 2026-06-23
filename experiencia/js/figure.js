// figure.js
// ─────────────────────────────────────────────────────────────────────────────
// Silhueta humana LUMINOSA no centro do cérebro (o "ser interior" que desperta).
// Pose de expansão (braços erguidos). É um billboard (sempre de frente p/ a câmera),
// desenhado num canvas (silhueta + halo) e renderizado com blending aditivo —
// o UnrealBloom transforma isso num brilho intenso.
// Aparece conforme o scroll (uReveal) e pulsa suavemente.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

// Desenha a silhueta + halo num canvas e devolve como textura.
function makeSilhouetteTexture() {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');

  // Halo radial (brilho de fundo).
  const g = ctx.createRadialGradient(s / 2, s * 0.5, 8, s / 2, s * 0.5, s * 0.5);
  g.addColorStop(0.0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.12)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  // Figura humana (branca), pose de expansão.
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const cx = 256;

  // Cabeça
  ctx.beginPath();
  ctx.arc(cx, 98, 32, 0, Math.PI * 2);
  ctx.fill();

  // Tronco
  ctx.beginPath();
  ctx.moveTo(cx - 34, 150);
  ctx.lineTo(cx + 34, 150);
  ctx.lineTo(cx + 24, 300);
  ctx.lineTo(cx - 24, 300);
  ctx.closePath();
  ctx.fill();

  // Braços erguidos (V) — expansão
  ctx.lineWidth = 24;
  ctx.beginPath(); ctx.moveTo(cx - 28, 158); ctx.lineTo(150, 48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 28, 158); ctx.lineTo(362, 48); ctx.stroke();

  // Pernas
  ctx.lineWidth = 28;
  ctx.beginPath(); ctx.moveTo(cx - 16, 298); ctx.lineTo(cx - 42, 474); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 16, 298); ctx.lineTo(cx + 42, 474); ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createFigure() {
  const uniforms = {
    uMap:    { value: makeSilhouetteTexture() },
    uReveal: { value: 0 },                       // 0..1 — controlado pelo scroll
    uTime:   { value: 0 },
    uColor:  { value: new THREE.Color(1.0, 0.96, 1.0) }, // branco com leve violeta
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uReveal;
      uniform float uTime;
      uniform vec3  uColor;
      varying vec2  vUv;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        float pulse = 0.85 + 0.15 * sin(uTime * 1.5);   // respiração do brilho
        gl_FragColor = vec4(uColor * pulse * 1.15, t.a * uReveal);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,           // sempre visível no centro (brilha "através" do cérebro)
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), material);
  mesh.renderOrder = 10;
  return { mesh, uniforms };
}
