/* ==========================================================================
   DIVERVLK — anim.js
   Lenis + GSAP/ScrollTrigger только в трёх местах (первый экран, карта, лента
   кейсов), CSS scroll-driven reveal с IntersectionObserver fallback,
   полное отключение при prefers-reduced-motion. Ванильный JS, без фреймворков.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supportsScrollTimeline = CSS && CSS.supports && CSS.supports('animation-timeline: view()');

  /* ---------------------------------------------------------------------
     1. Reveal-фолбэк для секций (CSS scroll-driven анимаций нет в браузере)
     --------------------------------------------------------------------- */
  function initRevealFallback() {
    var items = document.querySelectorAll('.reveal');
    if (reduceMotion) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    if (supportsScrollTimeline) return; // CSS сам всё анимирует

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------------
     2. Lenis — плавный скролл на весь сайт
     --------------------------------------------------------------------- */
  var lenis = null;
  function initLenis() {
    if (reduceMotion || typeof Lenis === 'undefined') return;
    lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    if (window.gsap && window.gsap.ticker) {
      lenis.on('scroll', ScrollTrigger && ScrollTrigger.update);
    }
  }

  /* ---------------------------------------------------------------------
     3. GSAP: первый экран, карта, лента кейсов
     --------------------------------------------------------------------- */
  function initGsap() {
    if (reduceMotion || typeof gsap === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    /* --- Первый экран: заголовок построчно + кнопки с задержкой --- */
    var lines = document.querySelectorAll('#heroTitle .line span');
    gsap.set(lines, { yPercent: 110, opacity: 0 });
    gsap.set('.hero-badges, .hero-geo, .hero-lead', { opacity: 0, y: 16 });
    gsap.set('#heroCta .btn', { opacity: 0, y: 16 });

    var heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    heroTl.to(lines, { yPercent: 0, opacity: 1, duration: 0.7, stagger: 0.12 });
    heroTl.to('.hero-badges, .hero-geo, .hero-lead', { opacity: 1, y: 0, duration: 0.5 }, '-=0.35');
    heroTl.to('#heroCta .btn', { opacity: 1, y: 0, duration: 0.45, stagger: 0.15 }, '-=0.25');

    /* --- Карта: точки появляются последовательно при скролле --- */
    var dots = gsap.utils.toArray('.port-dot');
    if (dots.length) {
      gsap.set(dots, { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' });
      ScrollTrigger.create({
        trigger: '#mapFrame',
        start: 'top 75%',
        once: true,
        onEnter: function () {
          gsap.to(dots, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.12, ease: 'back.out(2)' });
        }
      });
    }

    /* --- Лента кейсов: лёгкий сдвиг карточек при скролле --- */
    var cases = gsap.utils.toArray('#casesTrack .case-card');
    cases.forEach(function (card, i) {
      gsap.fromTo(card,
        { y: 28, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.5, ease: 'power2.out',
          scrollTrigger: { trigger: card, start: 'top 88%' },
          delay: i * 0.05
        }
      );
    });
  }

  /* ---------------------------------------------------------------------
     4. Карта: пульсация активной точки + подсказка + мобильный список
     --------------------------------------------------------------------- */
  function initMap() {
    var dots = document.querySelectorAll('.port-dot');
    var listBtns = document.querySelectorAll('.geo-port-list button');

    function setActive(name) {
      dots.forEach(function (d) {
        d.classList.toggle('is-active', d.getAttribute('data-name') === name || d.getAttribute('data-name') === name + ' (о-в)');
      });
      listBtns.forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-name') === name);
      });
    }

    dots.forEach(function (dot) {
      var name = dot.getAttribute('data-name');
      var pulse = dot.querySelector('.pulse');

      function activate() {
        setActive(name);
        if (!reduceMotion && window.gsap && pulse) {
          gsap.fromTo(pulse, { opacity: 0.6, scale: 1, transformOrigin: '50% 50%' },
            { opacity: 0, scale: 2.4, duration: 0.9, ease: 'power1.out' });
        }
      }
      dot.addEventListener('click', activate);
      dot.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
      dot.addEventListener('mouseenter', function () { dot.classList.add('is-hover'); });
      dot.addEventListener('mouseleave', function () { dot.classList.remove('is-hover'); });
    });

    listBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { setActive(btn.getAttribute('data-name')); });
    });
  }

  /* ---------------------------------------------------------------------
     5. Мобильное меню
     --------------------------------------------------------------------- */
  function initMobileNav() {
    var burger = document.getElementById('burgerBtn');
    var closeBtn = document.getElementById('closeNavBtn');
    var panel = document.getElementById('mobileNav');
    if (!burger || !panel) return;

    function open() {
      panel.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      panel.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    burger.addEventListener('click', open);
    closeBtn && closeBtn.addEventListener('click', close);
    panel.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
  }

  /* ---------------------------------------------------------------------
     6. Cookie-баннер (152-ФЗ)
     --------------------------------------------------------------------- */
  function initCookieBar() {
    var bar = document.getElementById('cookieBar');
    if (!bar) return;
    var KEY = 'divervlk_cookie_choice';
    var saved;
    try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
    if (!saved) bar.hidden = false;

    function choose(value) {
      try { localStorage.setItem(KEY, value); } catch (e) {}
      bar.hidden = true;
    }
    var accept = document.getElementById('cookieAccept');
    var decline = document.getElementById('cookieDecline');
    accept && accept.addEventListener('click', function () { choose('accepted'); });
    decline && decline.addEventListener('click', function () { choose('declined'); });
  }

  /* ---------------------------------------------------------------------
     7. Видео по клику (без автоплея, без внешних источников)
     --------------------------------------------------------------------- */
  function initVideo() {
    var playBtn = document.getElementById('videoPlayBtn');
    var frame = document.getElementById('videoFrame');
    if (!playBtn || !frame) return;

    function trigger() {
      var note = document.createElement('p');
      note.className = 'video-caption';
      note.style.marginTop = '10px';
      note.textContent = 'Видео появится на сайте после получения материалов от заказчика.';
      if (!frame.nextElementSibling || !frame.nextElementSibling.classList.contains('video-note')) {
        note.classList.add('video-note');
        frame.insertAdjacentElement('afterend', note);
      }
    }
    playBtn.addEventListener('click', trigger);
    playBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); }
    });
  }

  /* ---------------------------------------------------------------------
     8. Сертификаты — "Открыть PDF" (заглушка)
     --------------------------------------------------------------------- */
  function initCertButtons() {
    document.querySelectorAll('[data-pdf]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var prev = btn.nextElementSibling;
        if (prev && prev.classList.contains('pdf-note')) return;
        var note = document.createElement('p');
        note.className = 'pdf-note section-note';
        note.style.marginTop = '8px';
        note.textContent = 'PDF появится после получения скана документа от заказчика.';
        btn.insertAdjacentElement('afterend', note);
      });
    });
  }

  /* ---------------------------------------------------------------------
     9. Форма срочной заявки — валидация и мок-отправка
     --------------------------------------------------------------------- */
  function initForm() {
    var form = document.getElementById('requestForm');
    if (!form) return;
    var status = document.getElementById('formStatus');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      form.querySelectorAll('[required]').forEach(function (field) {
        var wrap = field.closest('.form-field');
        var ok = field.type === 'checkbox' ? field.checked : field.value.trim().length > 0;
        if (wrap) wrap.classList.toggle('has-error', !ok);
        if (!ok) valid = false;
      });
      if (!valid) return;
      status.classList.add('is-visible');
      form.reset();
    });
  }

  /* ---------------------------------------------------------------------
     Инициализация
     --------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.classList.toggle('reduced-motion', reduceMotion);
    initRevealFallback();
    initLenis();
    initGsap();
    initMap();
    initMobileNav();
    initCookieBar();
    initVideo();
    initCertButtons();
    initForm();
  });
})();
