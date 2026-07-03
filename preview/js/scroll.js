// scroll.js
// ─────────────────────────────────────────────────────────────────────────────
// Conecta o PROGRESSO DO SCROLL (0→1) à animação 3D.
// GSAP + ScrollTrigger são carregados via <script> no HTML (globais window.gsap
// e window.ScrollTrigger). Se por algum motivo não carregarem, há um fallback
// usando o scroll nativo — a experiência continua funcionando.
// ─────────────────────────────────────────────────────────────────────────────

export function initScroll(onProgress) {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  // Fallback: scroll nativo.
  if (!gsap || !ScrollTrigger) {
    console.warn('[scroll] GSAP/ScrollTrigger ausentes — usando scroll nativo.');
    const handler = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      onProgress(max > 0 ? window.scrollY / max : 0);
    };
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Progresso global da experiência (0 no topo, 1 no fim do container alto).
  ScrollTrigger.create({
    trigger: '#experience',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,                       // suaviza o acompanhamento do scroll
    onUpdate: (self) => onProgress(self.progress),
  });

  // Aparição/saída das legendas por etapa (0/25/50/75/100%).
  gsap.utils.toArray('.stage').forEach((el) => {
    gsap.fromTo(
      el.querySelector('.stage-inner'),
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 80%', end: 'top 45%', scrub: true },
      }
    );
    gsap.to(el.querySelector('.stage-inner'), {
      opacity: 0, y: -40, ease: 'power2.in',
      scrollTrigger: { trigger: el, start: 'bottom 55%', end: 'bottom 20%', scrub: true },
    });
  });
}
