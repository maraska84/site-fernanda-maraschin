// figure.js
// ─────────────────────────────────────────────────────────────────────────────
// Silhueta humana LUMINOSA no centro do cérebro (o "ser interior").
// Carrega a imagem real do usuário (assets/silhueta.png) se existir; caso
// contrário usa um desenho de reserva (pessoa em pé, braços ao lado).
//
// Truque do shader: a silhueta é PRETA (em fundo branco ou transparente).
// Convertendo com mask = (1 - luminância) * alpha, qualquer silhueta preta
// vira uma máscara branca que brilha (aditivo + bloom). Funciona para PNG
// transparente OU preto-no-branco.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

// Desenho de reserva: pessoa em pé, braços ligeiramente afastados (PRETO/transparente).
function makeFallbackTexture() {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const cx = 256;

  ctx.beginPath(); ctx.arc(cx, 74, 30, 0, Math.PI * 2); ctx.fill();          // cabeça
  ctx.beginPath();                                                            // tronco
  ctx.moveTo(cx - 36, 122); ctx.lineTo(cx + 36, 122);
  ctx.lineTo(cx + 26, 300); ctx.lineTo(cx - 26, 300); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 22;                                                         // braços (ao lado)
  ctx.beginPath(); ctx.moveTo(cx - 30, 132); ctx.lineTo(cx - 70, 300); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 30, 132); ctx.lineTo(cx + 70, 300); ctx.stroke();
  ctx.lineWidth = 28;                                                         // pernas
  ctx.beginPath(); ctx.moveTo(cx - 16, 298); ctx.lineTo(cx - 26, 478); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 16, 298); ctx.lineTo(cx + 26, 478); ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFigure() {
  const uniforms = {
    uMap:    { value: makeFallbackTexture() },           // começa com o fallback
    uReveal: { value: 0 },
    uTime:   { value: 0 },
    uColor:  { value: new THREE.Color(1.0, 0.96, 1.0) },
  };

  // Tenta carregar a silhueta real do usuário; se existir, substitui a textura.
  new THREE.TextureLoader().load(
    'assets/silhueta.png',
    (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; uniforms.uMap.value = tex; console.log('[figure] silhueta.png carregada'); },
    undefined,
    () => { console.warn('[figure] assets/silhueta.png ausente — usando desenho de reserva'); }
  );

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uReveal;
      uniform float uTime;
      uniform vec3  uColor;
      varying vec2  vUv;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        float lum  = dot(t.rgb, vec3(0.299, 0.587, 0.114));
        float mask = (1.0 - lum) * t.a;                 // silhueta preta -> máscara branca
        float pulse = 0.85 + 0.15 * sin(uTime * 1.5);   // respiração do brilho
        // 0.85 = brilho um pouco menos intenso (a pedido)
        gl_FragColor = vec4(uColor * pulse * 0.85, mask * uReveal);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), material);
  mesh.renderOrder = 10;
  return { mesh, uniforms };
}
