// shaders.js
// ─────────────────────────────────────────────────────────────────────────────
// GLSL de todos os elementos (cérebro, neurônios e partículas).
// Estratégia de performance: a FORMA do cérebro é gerada na CPU (geometria),
// e os shaders cuidam apenas de abertura, pulso, brilho, névoa e visibilidade
// progressiva. Assim os shaders ficam baratos e estáveis em mobile.
//
// Importante: como usamos THREE.ShaderMaterial, o Three.js já injeta
// automaticamente `position`, `modelViewMatrix` e `projectionMatrix`.
// Só declaramos os atributos/uniforms CUSTOMIZADOS.
// ─────────────────────────────────────────────────────────────────────────────

// ───────────────────────── CÉREBRO (point cloud) ────────────────────────────
export const brainVertexShader = /* glsl */`
  attribute float aSide;     // -1.0 = hemisfério esquerdo, +1.0 = direito
  attribute float aSeed;     // semente aleatória por ponto (pulso/cintilação)
  attribute vec3  aColor;    // cor base do ponto (paleta)

  uniform float uTime;
  uniform float uOpen;       // 0..1 — quanto os hemisférios se afastam
  uniform float uGap;        // distância máxima da abertura
  uniform float uPulse;      // velocidade do pulso
  uniform float uBrightness; // 0..1 — brilho global
  uniform float uSize;       // tamanho base do ponto
  uniform float uPixelRatio;

  varying vec3  vColor;
  varying float vTwinkle;
  varying float vFog;

  void main() {
    vec3 pos = position;

    // Abertura: afasta cada hemisfério ao longo do eixo X.
    pos.x += aSide * uOpen * uGap;

    // Pulso orgânico: "respiração" sutil do volume.
    float pulse = sin(uTime * uPulse + aSeed * 6.2831853);
    pos *= 1.0 + 0.015 * pulse;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Tamanho com atenuação por profundidade.
    gl_PointSize = uSize * uPixelRatio * (6.0 / -mvPosition.z);

    vColor   = aColor;
    vTwinkle = (0.55 + 0.45 * pulse) * uBrightness;   // cintilação modulada pelo brilho
    vFog     = smoothstep(2.0, 9.0, -mvPosition.z);   // névoa por profundidade
  }
`;

export const brainFragmentShader = /* glsl */`
  varying vec3  vColor;
  varying float vTwinkle;
  varying float vFog;

  void main() {
    // Recorta o ponto num disco macio.
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d);

    vec3 color = vColor * vTwinkle * 1.0;
    color *= (1.0 - 0.55 * vFog);   // escurece ao fundo = sensação de névoa
    gl_FragColor = vec4(color, alpha);
  }
`;

// ─────────────────────────── NEURÔNIOS (linhas) ─────────────────────────────
export const neuronVertexShader = /* glsl */`
  attribute float aSide;
  attribute float aSeed;
  attribute float aThreshold; // 0..1 — a conexão "nasce" quando uProgress passa daqui
  attribute vec3  aColor;

  uniform float uTime;
  uniform float uProgress;
  uniform float uBrightness;
  uniform float uOpen;
  uniform float uGap;

  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec3 pos = position;
    pos.x += aSide * uOpen * uGap;  // acompanha a abertura do cérebro

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

    // Visibilidade progressiva: a conexão aparece conforme o scroll avança.
    float born = smoothstep(aThreshold, aThreshold + 0.08, uProgress);

    // Impulso elétrico: acende e apaga, com fase própria por conexão.
    float wave  = 0.5 + 0.5 * sin(uTime * (2.0 + aSeed * 3.0) + aSeed * 6.2831853);
    float pulse = 0.35 + 0.65 * pow(wave, 3.0);

    // Algumas conexões "piscam" (somem e voltam) de forma orgânica.
    float flicker = step(0.12, 0.5 + 0.5 * sin(uTime * 0.7 + aSeed * 20.0));

    vAlpha = born * pulse * flicker * uBrightness;
    vColor = aColor;
  }
`;

export const neuronFragmentShader = /* glsl */`
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    gl_FragColor = vec4(vColor * (1.0 + vAlpha), vAlpha);
  }
`;

// ─────────────────────────── PARTÍCULAS (point cloud) ───────────────────────
export const particleVertexShader = /* glsl */`
  attribute float aSeed;
  attribute float aThreshold; // controla a "quantidade" que aparece por progresso
  attribute vec3  aColor;

  uniform float uTime;
  uniform float uProgress;
  uniform float uSize;
  uniform float uPixelRatio;

  varying vec3  vColor;
  varying float vAlpha;
  varying float vFog;

  void main() {
    vec3 pos = position;

    // Flutuação e giro lento (drift orgânico).
    float t = uTime * 0.15;
    pos.x += sin(t + aSeed * 6.2831853) * 0.25;
    pos.y += cos(t * 0.8 + aSeed * 4.0) * 0.25;
    pos.z += sin(t * 0.6 + aSeed * 8.0) * 0.25;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * uPixelRatio * (6.0 / -mvPosition.z);

    vAlpha = smoothstep(aThreshold, aThreshold + 0.1, uProgress); // mais partículas conforme avança
    vColor = aColor;
    vFog   = smoothstep(3.0, 12.0, -mvPosition.z);
  }
`;

export const particleFragmentShader = /* glsl */`
  varying vec3  vColor;
  varying float vAlpha;
  varying float vFog;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * vAlpha * (1.0 - 0.6 * vFog);
    gl_FragColor = vec4(vColor, a);
  }
`;
