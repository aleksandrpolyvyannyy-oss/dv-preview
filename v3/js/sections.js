(function(){
  var t = null;
  window.dvRefresh = function(){ if (!window.ScrollTrigger) return; clearTimeout(t); t = setTimeout(function(){ var run = function(){ ScrollTrigger.refresh(); }; (window.requestIdleCallback || setTimeout)(run, { timeout: 1200 }); }, 250); };
})();
(function(){
  "use strict";
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && !/[?&]motion=1/.test(location.search);

  /* ===================== anchor smooth-scroll (header/mobile nav, footer, "↓ дальше") ===================== */
  function scrollToEl(el){
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.scrollY - 16;
    if (window.lenis){ window.lenis.scrollTo(top, { duration: reduce ? 0 : 1.15 }); }
    else { window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' }); }
  }
  document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(function(a){
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    a.addEventListener('click', function(e){
      var el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      scrollToEl(el);
      var mobileNav = document.getElementById('mobileNav');
      if (mobileNav){ mobileNav.classList.remove('open'); document.body.style.overflow = ''; }
    });
  });
  document.querySelectorAll('.js-go-request').forEach(function(b){
    b.addEventListener('click', function(e){ e.preventDefault(); scrollToEl(document.getElementById('request')); });
  });

  /* ===================== urgent modal ===================== */
  var modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay){
    var openModal = function(){ modalOverlay.classList.add('open'); document.body.style.overflow = 'hidden'; };
    var closeModal = function(){ modalOverlay.classList.remove('open'); document.body.style.overflow = ''; };
    document.querySelectorAll('.js-open-modal').forEach(function(b){ b.addEventListener('click', function(e){ e.preventDefault(); openModal(); }); });
    document.querySelectorAll('.js-close-modal').forEach(function(b){ b.addEventListener('click', closeModal); });
    modalOverlay.addEventListener('click', function(e){ if (e.target === modalOverlay) closeModal(); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeModal(); });
  }

  /* ===================== cookie banner ===================== */
  var cookieBanner = document.getElementById('cookieBanner');
  if (cookieBanner){
    var showCookie = function(){ var chosen = null; try { chosen = localStorage.getItem('dv_cookie_choice'); } catch(e){} if (chosen) return; var shown=false; var show=function(){ if(shown) return; shown=true; cookieBanner.classList.remove('hidden'); ['scroll','pointerdown','keydown','touchstart'].forEach(function(ev){ window.removeEventListener(ev, show); }); }; ['scroll','pointerdown','keydown','touchstart'].forEach(function(ev){ window.addEventListener(ev, show, { passive:true }); }); setTimeout(show, 6000); };
    if (document.readyState === 'complete') showCookie(); else window.addEventListener('load', showCookie);
    function setCookieChoice(v){ try { localStorage.setItem('dv_cookie_choice', v); } catch(e){} cookieBanner.classList.add('hidden'); }
    var cA = document.getElementById('cookieAccept'), cD = document.getElementById('cookieDecline');
    if (cA) cA.addEventListener('click', function(){ setCookieChoice('accepted'); });
    if (cD) cD.addEventListener('click', function(){ setCookieChoice('declined'); });
  }

  /* ===================== map embed: fetch shared SVG and inject ===================== */
  var mapEls = document.querySelectorAll('.js-map-embed');
  var loadMap = function(){
    fetch('assets/map-dv.svg').then(function(r){ return r.text(); }).then(function(svg){
      mapEls.forEach(function(el){ el.innerHTML = svg; });
      if (window.dvRefresh) window.dvRefresh();
    }).catch(function(){});
  };
  if (mapEls.length){
    if ('IntersectionObserver' in window){ var mio = new IntersectionObserver(function(es){ if (es.some(function(e){ return e.isIntersecting; })){ mio.disconnect(); loadMap(); } }, { rootMargin: '800px 0px' }); mapEls.forEach(function(el){ mio.observe(el); }); } else loadMap();
  }

  /* ===================== phone mask ===================== */
  function maskPhone(input){
    input.addEventListener('input', function(){
      var digits = input.value.replace(/\D/g,'');
      if (digits.charAt(0) === '7') digits = digits.slice(1);
      if (digits.charAt(0) === '8') digits = digits.slice(1);
      digits = digits.slice(0,10);
      var out = '+7';
      if (digits.length) out += ' (' + digits.slice(0,3);
      if (digits.length >= 3) out += ')';
      if (digits.length > 3) out += ' ' + digits.slice(3,6);
      if (digits.length > 6) out += '-' + digits.slice(6,8);
      if (digits.length > 8) out += '-' + digits.slice(8,10);
      input.value = out;
    });
  }
  document.querySelectorAll('input[type=tel]').forEach(maskPhone);

  /* ===================== form validation + success state ===================== */
  function fieldValue(el){ var input = el.querySelector('input,select'); return input ? input.value.trim() : ''; }
  function validateForm(form){
    var ok = true;
    form.querySelectorAll('[data-field]').forEach(function(f){
      var v = fieldValue(f);
      if (!v){ f.classList.add('error'); ok = false; } else { f.classList.remove('error'); }
    });
    var checkbox = form.querySelector('.check input');
    var checkErr = form.querySelector('.check-error');
    if (checkbox && !checkbox.checked){ if (checkErr) checkErr.classList.add('show'); ok = false; }
    else if (checkErr){ checkErr.classList.remove('show'); }
    return ok;
  }
  function successElFor(form){
    var name = form.dataset.form;
    if (name === 'modal') return document.getElementById('modalSuccess');
    if (name === 'full') return document.getElementById('fullSuccess');
    return null;
  }
  document.querySelectorAll('form[data-form]').forEach(function(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      form.classList.add('submitted');
      var ok = validateForm(form);
      if (ok){
        var phoneField = form.querySelector('[data-field=phone] input');
        var phoneVal = phoneField ? phoneField.value : '';
        var s = successElFor(form);
        form.style.display = 'none';
        if (s){ s.classList.add('show'); var span = s.querySelector('.js-success-phone'); if (span) span.textContent = phoneVal || 'указанному'; }
      }
    });
  });
  document.querySelectorAll('.js-reset-form').forEach(function(btn){
    btn.addEventListener('click', function(){
      var name = btn.dataset.form;
      var form = document.querySelector('form[data-form="' + name + '"]');
      var success = successElFor(form);
      if (form){
        form.reset(); form.style.display = ''; form.classList.remove('submitted');
        form.querySelectorAll('.field').forEach(function(f){ f.classList.remove('error'); });
        var ce = form.querySelector('.check-error'); if (ce) ce.classList.remove('show');
      }
      if (success) success.classList.remove('show');
    });
  });

  /* ===================== reveal on scroll ([data-reveal]) ===================== */
  if (!reduce && 'IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('[data-reveal]').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('[data-reveal]').forEach(function(el){ el.classList.add('in'); });
  }

  /* ===================== underwater gallery shutter reveal ===================== */
  if (!reduce && 'IntersectionObserver' in window){
    var ioG = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting){ en.target.classList.add('revealed'); ioG.unobserve(en.target); } });
    }, { threshold: 0.3 });
    document.querySelectorAll('.gallery-item').forEach(function(el){ ioG.observe(el); });
  } else {
    document.querySelectorAll('.gallery-item').forEach(function(el){ el.classList.add('revealed'); });
  }

  /* ===================== ship scheme: zone switching (tabs/click + scroll-driven below) ===================== */
  window.dvSetShipZone = function(zone){
    document.querySelectorAll('.ship-zone').forEach(function(z){ z.classList.toggle('active', z.dataset.zone === zone); });
    document.querySelectorAll('.ship-zone-nav button').forEach(function(b){ b.classList.toggle('active', b.dataset.zone === zone); });
    document.querySelectorAll('.js-ship-img').forEach(function(img){ img.classList.toggle('active', img.dataset.zone === zone); });
    document.querySelectorAll('.ship-photo-pin').forEach(function(p){ p.classList.toggle('active', p.dataset.zone === zone); });
    document.querySelectorAll('.ship-list-item-plain').forEach(function(li){ li.classList.toggle('active', li.dataset.zone === zone); });
    var names = { hull:'Корпус', bottom:'Днище', seachest:'Кингстоны и решётки', rudder:'Руль', propeller:'Винт', protectors:'Протекторы' };
    var descs = {
      hull:'Общий осмотр обшивки, сварных швов и мест возможных повреждений по всей длине корпуса.',
      bottom:'Проверка днища на обрастание и коррозию, замер толщины обшивки при необходимости.',
      seachest:'Очистка кингстонных решёток и забортных отверстий от обрастания.',
      rudder:'Осмотр пера руля, баллера и страховочных креплений.',
      propeller:'Осмотр и полировка лопастей гребного винта, проверка кромок.',
      protectors:'Проверка протекторной защиты корпуса и её замена при износе.'
    };
    var nameEl = document.querySelector('.js-ship-name'), descEl = document.querySelector('.js-ship-desc');
    if (nameEl) nameEl.textContent = names[zone] || '';
    if (descEl) descEl.textContent = descs[zone] || '';
  };
  document.querySelectorAll('.ship-zone-nav button, .ship-zone, .ship-photo-pin, .ship-list-item-plain').forEach(function(el){
    el.addEventListener('click', function(){ window.dvSetShipZone(el.dataset.zone); });
    el.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); window.dvSetShipZone(el.dataset.zone); } });
  });

  /* ===================== floating CTA: hidden near request form / port list / footer ===================== */
  (function(){
    var fab = document.querySelector('.desktop-fab');
    if (!fab || !('IntersectionObserver' in window)) return;
    var seen = new Set();
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ e.isIntersecting ? seen.add(e.target) : seen.delete(e.target); });
      fab.classList.toggle('is-hidden', seen.size > 0);
    }, { threshold: 0.01 });
    ['#request', 'footer.site-footer', '#geography .port-list', '#story .story-panel'].forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(el){ io.observe(el); });
    });
  })();

  /* ===================== reduced motion: static fallbacks (no scroll-linked GSAP below) ===================== */
  if (reduce){
    window.dvSetShipZone('hull');
    var fillStatic = document.getElementById('processFill');
    if (fillStatic) fillStatic.style.width = '100%';
    if (document.readyState === 'complete'){ if (window.ScrollTrigger) ScrollTrigger.refresh(); } else window.addEventListener('load', function(){ if (window.ScrollTrigger) ScrollTrigger.refresh(); });
    return; /* дальше — только scroll-driven GSAP-анимации, их не грузим */
  }

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- схема судна: зоны подсвечиваются по прокрутке панели, БЕЗ pin
     (вложенный pin поверх sticky-фона #story ломает прокрутку) ---------- */
  ScrollTrigger.matchMedia({
    "(min-width: 900px)": function(){
      var panel = document.querySelector('.ship-panel');
      if (!panel) return;
      var zones = ['hull','bottom','seachest','rudder','propeller','protectors'];
      var current = -1;
      ScrollTrigger.create({
        trigger: panel,
        start: 'top 78%',
        end: 'bottom 32%',
        scrub: true,
        onUpdate: function(self){
          var idx = Math.min(zones.length - 1, Math.floor(self.progress * zones.length));
          if (idx !== current){ current = idx; window.dvSetShipZone(zones[idx]); }
        }
      });
    }
  });

  /* ---------- process line fill ---------- */
  var fill = document.getElementById('processFill');
  if (fill){
    gsap.to(fill, {
      width: '100%', ease: 'none',
      scrollTrigger: { trigger: '.process-track', start: 'top 75%', end: 'bottom 65%', scrub: true }
    });
  }

  /* ---------- refresh once layout settles (lazy images, webfonts, injected map svg) ---------- */
  if (document.fonts && document.fonts.ready){ document.fonts.ready.then(function(){ window.dvRefresh(); }); }
  if (document.readyState === 'complete') window.dvRefresh(); else window.addEventListener('load', function(){ window.dvRefresh(); });
})();
