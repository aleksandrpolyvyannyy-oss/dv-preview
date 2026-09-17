(function(){
  "use strict";
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && !/[?&]motion=1/.test(location.search);

  /* header compact on scroll */
  var header = document.getElementById('siteHeader');
  function onScroll(){
    if (window.scrollY > 40) header.classList.add('compact'); else header.classList.remove('compact');
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* mobile nav drawer */
  var burgerBtn = document.querySelector('.js-burger');
  var mobileNav = document.getElementById('mobileNav');
  var closeNavBtn = document.getElementById('closeNavBtn');
  if (burgerBtn) burgerBtn.addEventListener('click', function(){ mobileNav.classList.add('open'); document.body.style.overflow='hidden'; });
  if (closeNavBtn) closeNavBtn.addEventListener('click', function(){ mobileNav.classList.remove('open'); document.body.style.overflow=''; });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape'){ mobileNav.classList.remove('open'); document.body.style.overflow=''; }
  });

  /* stub links: href="#" do nothing (no other sections built yet in this preview) */
  document.querySelectorAll('a[href="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  /* кадры столба спуска: грузим после события load в простое, чтобы не конкурировать с первым экраном */
  var lazyEls = document.querySelectorAll('.js-lazy');
  function reveal(el){
    el.querySelectorAll('source[data-srcset]').forEach(function(s){ s.srcset = s.dataset.srcset; s.removeAttribute('data-srcset'); });
    var img = el.querySelector('img[data-src]');
    if (img){ img.src = img.dataset.src; img.removeAttribute('data-src'); }
  }
  if (lazyEls.length){
    var started = false;
    var start = function(){ if (started) return; started = true; lazyEls.forEach(reveal); };
    var idle = window.requestIdleCallback || function(cb){ return setTimeout(cb, 400); };
    var afterLoad = function(){ setTimeout(function(){ idle(start, { timeout: 1500 }); }, 5000); };
    ['touchstart','pointerdown','wheel','keydown'].forEach(function(ev){ window.addEventListener(ev, start, { once: true, passive: true }); });
    if (document.readyState === 'complete') afterLoad(); else window.addEventListener('load', afterLoad);
    /* если человек начал прокрутку раньше — грузим сразу */
    window.addEventListener('scroll', start, { once: true, passive: true });
  }
})();
