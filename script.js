/* ============================================================
   WAZUH · ARCHITECTURE & COMPONENTS
   Interactions & scroll-triggered animations
============================================================ */

(() => {
  'use strict';

  // Detect reduced motion / IO-failure: we provide multiple fallbacks so the
  // page is never blank if IntersectionObserver doesn't fire for in-viewport
  // elements.
  const prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Side-rail active section ---------- */
  const sectionTargets = document.querySelectorAll('section[id]');
  const railLinks = document.querySelectorAll('.rail-nav a');

  const railObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        railLinks.forEach((a) => {
          a.classList.toggle('active', a.dataset.section === id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

  sectionTargets.forEach((s) => railObserver.observe(s));

  /* ---------- 2. Reveal on scroll ---------- */
  const reveals = document.querySelectorAll('.reveal');
  reveals.forEach((el) => {
    const delay = parseInt(el.dataset.delay || '0', 10);
    el.style.transitionDelay = delay + 'ms';
  });

  // Mark elements already in viewport on load — they should NOT animate,
  // because some iframe contexts stall the animation pipeline at frame 0.
  // Default `.reveal` styles render them visible already; skipping `.in`
  // is the safest path.
  const inInitialViewport = new WeakSet();
  reveals.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 1.1 && r.bottom > -50) {
      inInitialViewport.add(el);
    }
  });

  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        if (!inInitialViewport.has(entry.target)) {
          entry.target.classList.add('in');
        }
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  reveals.forEach((el) => revealObs.observe(el));

  /* ---------- 3. Counter animation ---------- */
  const counters = document.querySelectorAll('.counter');
  const runCounter = (el) => {
    if (el.dataset.ran === '1') return;
    el.dataset.ran = '1';
    const to = parseInt(el.dataset.to, 10);
    const suffix = el.dataset.suffix || '';
    const dur = 1400;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.floor(eased * to);
      el.textContent = val.toLocaleString() + (t === 1 ? suffix : '');
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = to.toLocaleString() + suffix;
    };
    requestAnimationFrame(tick);
  };
  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      runCounter(entry.target);
      counterObs.unobserve(entry.target);
    });
  }, { threshold: 0.4 });
  counters.forEach((c) => counterObs.observe(c));
  // Fallback: run any counter currently visible on load
  const runVisibleCounters = () => {
    counters.forEach((c) => {
      if (c.dataset.ran === '1') return;
      const r = c.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) runCounter(c);
    });
  };
  setTimeout(runVisibleCounters, 400);

  /* ---------- 4. Stack diagram — interactive node highlighting ---------- */
  const stackNodes = document.querySelectorAll('.stack-node');
  const stackLinks = document.querySelectorAll('.stack-link');

  const linksByNode = {
    suricata: ['suricata-wazuh'],
    wazuh: ['suricata-wazuh', 'wazuh-thehive', 'misp-wazuh'],
    thehive: ['wazuh-thehive', 'thehive-cortex'],
    cortex: ['thehive-cortex', 'cortex-misp'],
    misp: ['cortex-misp', 'misp-wazuh']
  };

  function setStackFocus(node) {
    if (!node) {
      stackNodes.forEach((n) => n.classList.remove('active', 'dim'));
      stackLinks.forEach((l) => l.classList.remove('active'));
      return;
    }
    const active = linksByNode[node] || [];
    stackNodes.forEach((n) => {
      n.classList.toggle('active', n.dataset.node === node);
      n.classList.toggle('dim', n.dataset.node !== node && !isNeighbour(node, n.dataset.node));
    });
    stackLinks.forEach((l) => {
      l.classList.toggle('active', active.includes(l.dataset.pair));
    });
  }
  function isNeighbour(a, b) {
    const map = { suricata: ['wazuh'], wazuh: ['suricata','thehive','misp'], thehive: ['wazuh','cortex'], cortex: ['thehive','misp'], misp: ['cortex','wazuh'] };
    return (map[a] || []).includes(b);
  }
  stackNodes.forEach((n) => {
    n.addEventListener('mouseenter', () => setStackFocus(n.dataset.node));
    n.addEventListener('mouseleave', () => setStackFocus(null));
    n.addEventListener('focus', () => setStackFocus(n.dataset.node));
    n.addEventListener('blur', () => setStackFocus(null));
    n.addEventListener('click', () => setStackFocus(n.dataset.node));
  });

  // Auto-cycle stack diagram nodes on first viewport entry
  const stack = document.querySelector('.stack-diagram');
  if (stack) {
    const cycleObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        cycleObs.unobserve(entry.target);
        const order = ['suricata', 'wazuh', 'thehive', 'cortex', 'misp'];
        let i = 0;
        const interval = setInterval(() => {
          setStackFocus(order[i]);
          i++;
          if (i >= order.length) {
            clearInterval(interval);
            setTimeout(() => setStackFocus(null), 800);
          }
        }, 700);
      });
    }, { threshold: 0.3 });
    cycleObs.observe(stack);
  }

  /* ---------- 5. Architecture step highlight on hover ---------- */
  const archNodes = document.querySelectorAll('.arch-node');
  const archSteps = document.querySelectorAll('.arch-steps li');
  archNodes.forEach((node) => {
    node.addEventListener('mouseenter', () => {
      const s = node.dataset.step;
      archNodes.forEach((n) => n.classList.toggle('active', n.dataset.step === s));
      archSteps.forEach((step) => step.classList.toggle('highlight', step.dataset.step === s || step.dataset.step.includes(s + '-') || step.dataset.step.includes('-' + s)));
    });
    node.addEventListener('mouseleave', () => {
      archNodes.forEach((n) => n.classList.remove('active'));
      archSteps.forEach((step) => step.classList.remove('highlight'));
    });
  });

  /* ---------- 6. Pipeline auto-cycle ---------- */
  const pipeSteps = document.querySelectorAll('.pipe-step');
  const pipeline = document.querySelector('.pipeline');
  if (pipeline) {
    let pipeInterval = null;
    const startPipe = () => {
      let i = 0;
      const tick = () => {
        pipeSteps.forEach((s, idx) => s.classList.toggle('active', idx === i));
        i = (i + 1) % pipeSteps.length;
      };
      tick();
      pipeInterval = setInterval(tick, 1100);
    };
    const pipeObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !pipeInterval) startPipe();
        else if (!entry.isIntersecting && pipeInterval) {
          clearInterval(pipeInterval); pipeInterval = null;
          pipeSteps.forEach((s) => s.classList.remove('active'));
        }
      });
    }, { threshold: 0.4 });
    pipeObs.observe(pipeline);
  }

  /* ---------- 7. Terminal (SSH brute force) demo ---------- */
  function playTerminal() {
    const lines = document.querySelectorAll('.terminal[data-demo="ssh"] .term-line');
    lines.forEach((l) => { l.classList.remove('in'); l.classList.add('pending'); });
    lines.forEach((l, i) => {
      setTimeout(() => { l.classList.remove('pending'); l.classList.add('in'); }, 350 + i * 550);
    });
  }
  const term = document.querySelector('.terminal[data-demo="ssh"]');
  if (term) {
    let termPlayed = false;
    const tryPlayTerm = () => { if (!termPlayed) { termPlayed = true; playTerminal(); } };
    const termObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { tryPlayTerm(); termObs.unobserve(entry.target); } });
    }, { threshold: 0.4 });
    termObs.observe(term);
    setTimeout(() => {
      const r = term.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) tryPlayTerm();
    }, 600);
  }

  /* ---------- 8. FIM demo ---------- */
  function playFim() {
    const steps = document.querySelectorAll('.fim-demo .demo-step');
    const alert = document.querySelector('.fim-demo .demo-alert');
    steps.forEach((s) => { s.classList.remove('in', 'done'); });
    if (alert) alert.classList.remove('in');

    steps.forEach((s, i) => {
      setTimeout(() => {
        s.classList.add('in');
        if (i > 0) steps[i - 1].classList.add('done');
      }, 400 + i * 800);
    });
    setTimeout(() => {
      if (steps.length) steps[steps.length - 1].classList.add('done');
      if (alert) alert.classList.add('in');
    }, 400 + steps.length * 800);
  }
  const fim = document.querySelector('.fim-demo');
  if (fim) {
    let fimPlayed = false;
    const tryPlayFim = () => { if (!fimPlayed) { fimPlayed = true; playFim(); } };
    const fimObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { tryPlayFim(); fimObs.unobserve(entry.target); } });
    }, { threshold: 0.35 });
    fimObs.observe(fim);
    setTimeout(() => {
      const r = fim.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) tryPlayFim();
    }, 600);
  }

  /* ---------- 9. Replay buttons ---------- */
  document.querySelectorAll('[data-replay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const which = btn.dataset.replay;
      if (which === 'ssh') playTerminal();
      if (which === 'fim') playFim();
    });
  });

  /* ---------- 10. AR chain auto-cycle ---------- */
  const arItems = document.querySelectorAll('.ar-chain li');
  const arChain = document.querySelector('.ar-chain');
  if (arChain) {
    let arInterval = null;
    const startAr = () => {
      let i = 0;
      const tick = () => {
        arItems.forEach((s, idx) => s.classList.toggle('active', idx === i));
        i = (i + 1) % arItems.length;
      };
      tick();
      arInterval = setInterval(tick, 900);
    };
    const arObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !arInterval) startAr();
        else if (!entry.isIntersecting && arInterval) {
          clearInterval(arInterval); arInterval = null;
          arItems.forEach((s) => s.classList.remove('active'));
        }
      });
    }, { threshold: 0.4 });
    arObs.observe(arChain);
  }

  /* ---------- 11. SCA bench bar ---------- */
  const benchSegs = document.querySelectorAll('.bench-bar .seg');
  const bench = document.querySelector('.bench-bar');
  if (bench) {
    let benchSet = false;
    const setBench = () => {
      if (benchSet) return; benchSet = true;
      benchSegs.forEach((seg) => seg.style.setProperty('--pct', seg.dataset.pct + '%'));
    };
    const benchObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { setBench(); benchObs.unobserve(entry.target); } });
    }, { threshold: 0.4 });
    benchObs.observe(bench);
    setTimeout(() => {
      const r = bench.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) setBench();
    }, 600);
  }

  /* ---------- 12. Generic in-view animation ---------- */
  const animObs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        animObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('[data-anim]').forEach((el) => animObs.observe(el));

  /* ---------- 13. Stat-row + capability fade-in ---------- */
  const fadeObs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.transitionDelay = (i * 60) + 'ms';
        entry.target.classList.add('in');
        fadeObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });
  document.querySelectorAll('.stat-card, .capability, .module, .dep-model, .sca-card, .summary-list li, .ta-area').forEach((el) => {
    el.classList.add('reveal');
    fadeObs.observe(el);
  });

})();
