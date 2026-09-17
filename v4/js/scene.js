(function(){
  "use strict";
  if (typeof gsap === 'undefined') return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && !/[?&]motion=1/.test(location.search);

  gsap.registerPlugin(ScrollTrigger);
  if (reduce) return; /* статичная раскладка целиком отдана CSS, sequence вообще не грузится */

  /* ---------- Lenis smooth scroll, synced with ScrollTrigger ---------- */
  if (typeof Lenis !== 'undefined'){
    var lenis = new Lenis({ duration: 1.0, smoothWheel: true });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function debounce(fn, ms){ var t; return function(){ clearTimeout(t); var a = arguments; t = setTimeout(function(){ fn.apply(null, a); }, ms); }; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function smoothstep(edge0, edge1, x){ var t = clamp((x - edge0) / (edge1 - edge0), 0, 1); return t * t * (3 - 2 * t); }
  var ric = window.requestIdleCallback || function(cb){ return setTimeout(function(){ cb({ didTimeout:false, timeRemaining:function(){ return 50; } }); }, 300); };

  /* ---------- story elements ---------- */
  var wrap = document.getElementById('story');          /* весь путь прокрутки истории */
  var stage = document.getElementById('storyBg');        /* sticky-фон: столб кадров + видео */
  var col = document.getElementById('shaftCol');
  var tint = document.getElementById('shaftTint');
  var heroCopy = document.getElementById('heroCopy');
  var heroCue = document.getElementById('heroScrollCue');
  var endFade = document.getElementById('storyEndFade');
  var videoCanvas = document.getElementById('shaftVideoCanvas');
  var videoCtx = videoCanvas && videoCanvas.getContext ? videoCanvas.getContext('2d') : null;

  /* маркеры разметки: по их реальному положению внутри #story вычисляем прогресс-точки сцены */
  var heroEl = document.querySelector('.story-hero');
  var tasksEl = document.getElementById('tasks');
  var captionEl = document.getElementById('storyCaption') || document.getElementById('process');
  /* видео должно дойти до финального подводного кадра к концу последней текстовой панели истории (География) —
     дальше в документе идут уже крупные фотоблоки на статичном фоне (.deep-photos), не часть скраба */
  var galleryEl = document.getElementById('yearround') || document.getElementById('underwater');

  if (!wrap || !stage || !col) return;

  var isDesktop = window.matchMedia('(min-width:900px)').matches;
  window.addEventListener('resize', debounce(function(){ isDesktop = window.matchMedia('(min-width:900px)').matches; }, 200));

  /* ===================== progress breakpoints: считаются от реальных высот блоков истории ===================== */
  var P_TEXT_END = 0.10, P_CUE_END = 0.07, P_DESCEND_START = 0.05, P_VIDEO_START = 0.30, P_VIDEO_END = 0.90;

  function fracOfTop(el){
    if (!el) return 0;
    var total = Math.max(1, wrap.offsetHeight - window.innerHeight);
    var wrapTop = wrap.getBoundingClientRect().top + window.pageYOffset;
    var elTop = el.getBoundingClientRect().top + window.pageYOffset;
    return clamp((elTop - wrapTop) / total, 0, 1);
  }
  function fracOfBottom(el){
    if (!el) return 0;
    var total = Math.max(1, wrap.offsetHeight - window.innerHeight);
    var wrapTop = wrap.getBoundingClientRect().top + window.pageYOffset;
    var elBottom = el.getBoundingClientRect().bottom + window.pageYOffset;
    return clamp((elBottom - wrapTop) / total, 0, 1);
  }

  function computeBreakpoints(){
    var heroBottom = fracOfBottom(heroEl);
    P_TEXT_END = Math.max(0.04, heroBottom * 0.92);
    P_CUE_END = Math.max(0.03, heroBottom * 0.6);
    P_DESCEND_START = Math.max(0.02, fracOfTop(tasksEl) * 0.5);
    /* пересечение поверхности / старт видео — начало короткой подписи перед "Схемой судна" */
    var videoStart = fracOfTop(captionEl);
    P_VIDEO_START = videoStart > P_DESCEND_START + 0.02 ? videoStart : clamp(P_DESCEND_START + 0.14, 0.15, 0.6);
    /* финальный подводный кадр — к концу галереи "Обрастание, коррозия, повреждения" */
    var videoEnd = fracOfBottom(galleryEl);
    P_VIDEO_END = videoEnd > P_VIDEO_START + 0.05 ? videoEnd : clamp(P_VIDEO_START + 0.4, P_VIDEO_START + 0.2, 0.97);
    if (isDesktop){
      /* ПК: без столба склеенных кадров — первый экран растворяется в видео, пока уходит текст первого экрана */
      var total = Math.max(1, wrap.offsetHeight - window.innerHeight), vh = window.innerHeight;
      P_DESCEND_START = clamp(0.22 * vh / total, 0.005, 0.2);
      P_VIDEO_START = clamp(0.48 * vh / total, P_DESCEND_START + 0.02, 0.35);
      /* последний кадр видео — в момент, когда снизу начинает наезжать статичный фон нижней части (тот же кадр) */
      /* последний кадр видео — когда центр панели «Работаем круглый год» доходит до центра экрана;
         дальше тот же кадр стоит до стыка с нижней частью */
      var yr = document.getElementById('yearround'), yrEnd = (total - vh) / total;
      if (yr){
        var wrapTop = wrap.getBoundingClientRect().top + window.pageYOffset;
        var yb = yr.getBoundingClientRect();
        yrEnd = (yb.top + window.pageYOffset - wrapTop + yb.height / 2 - vh / 2) / total;
      }
      P_VIDEO_END = clamp(yrEnd, P_VIDEO_START + 0.2, 1);
    }
  }

  /* ---------- overlays driven by scene progress ---------- */
  function updateOverlays(p){
    /* hero text: уходит вверх и растворяется по мере того, как первый экран покидает вьюпорт */
    var heroP = clamp(p / P_TEXT_END, 0, 1);
    gsap.set(heroCopy, { opacity: 1 - heroP, y: -46 * heroP });
    heroCopy.style.pointerEvents = heroP > 0.6 ? 'none' : 'auto';
    var cueP = clamp(p / P_CUE_END, 0, 1);
    gsap.set(heroCue, { opacity: 1 - cueP });

    /* цветовой грейд к бирюзово-тёмному — выходит на плато к началу видео-участка (пересечение поверхности) */
    gsap.set(tint, { opacity: smoothstep(P_DESCEND_START, P_VIDEO_START, p) * 0.30 });

    /* пузырьки — только ниже ватерлинии, редкие */
    var bubbleStart = P_VIDEO_START * 0.9, bubbleEnd = P_VIDEO_START * 1.15;
    gsap.set(bubblesCanvasEl, { opacity: smoothstep(bubbleStart, bubbleEnd, p) });

    /* canvas-последовательность проявляется поверх столба точно в момент пересечения поверхности —
       узкая зона кроссфейда без шва */
    var videoOpacity = isDesktop ? smoothstep(P_DESCEND_START, P_VIDEO_START, p) : smoothstep(P_VIDEO_START - 0.02, P_VIDEO_START + 0.015, p);
    gsap.set(videoCanvas, { opacity: videoOpacity });
    videoTargetProgress = clamp((p - P_VIDEO_START) / (P_VIDEO_END - P_VIDEO_START), 0, 1);

    /* отладочное состояние для автоматической проверки (Playwright): какой фоновый кадр сейчас показан */
    var __fr = frameForProgress(p);
    window.__dvFrame = __fr.kind === 'seq' ? __fr.idx : __fr.key;
    window.__dvFrameKind = __fr.kind;
    window.__dvFramePlatform = __fr.platform;

    /* затухание в сплошной цвет к концу истории — бесшовный переход к следующей секции */
    if (endFade) gsap.set(endFade, { opacity: 0 });
  }

  var bubblesCanvasEl = document.getElementById('bubblesCanvas');
  var videoTargetProgress = 0;

  /* ===================== какой фоновый кадр показан при прогрессе p (общая логика для __dvFrame и раскладки панелей) ===================== */
  function frameForProgress(p){
    if (p < P_VIDEO_START){
      if (isDesktop){
        var mid = (P_DESCEND_START + P_VIDEO_START) / 2;
        return { platform: 'd', kind: 'shaft', key: 'g2' };
      }
      var span = Math.max(0.0001, P_VIDEO_START - P_DESCEND_START);
      var t = clamp((p - P_DESCEND_START) / span, 0, 1);
      var key = t < 0.34 ? 'g3' : (t < 0.67 ? 'g1' : 'g4');
      return { platform: 'm', kind: 'shaft', key: key };
    }
    var vp = clamp((p - P_VIDEO_START) / Math.max(0.0001, P_VIDEO_END - P_VIDEO_START), 0, 1);
    var count = isDesktop ? 72 : 60;
    var keys = isDesktop ? [1, 24, 48, 72] : [1, 20, 40, 60];
    var idx = keys[clamp(Math.round(vp * (keys.length - 1)), 0, keys.length - 1)];
    return { platform: isDesktop ? 'd' : 'm', kind: 'seq', idx: idx };
  }
  function zoneForFrame(fr){
    var z = window.DV_ZONES && window.DV_ZONES[fr.platform];
    if (!z) return null;
    if (fr.kind === 'shaft') return z.shaft && z.shaft[fr.key];
    return z.seq && z.seq[fr.idx - 1];
  }

  /* ===================== раскладка текстовых панелей истории по свободной зоне кадра ===================== */
  /* object-position каждого фонового кадра (совпадает с css/style.css .sf- правилами и с drawCover ниже) —
     нужно, чтобы перевести доли кадра (из window.DV_ZONES) в пиксели экрана при object-fit:cover */
  var OBJPOS = {
    d: { g2: [0.66, 0.40], g4: [0.58, 0.46], g5: [0.52, 0.52], seq: [0.50, 0.50] },
    m: { g3: [0.56, 0.32], g1: [0.46, 0.46], g4: [0.50, 0.50], g5: [0.50, 0.50], seq: [0.50, 0.50] }
  };
  var IMG_AR = { d: 1280 / 720, m: 540 / 960 };

  function coverRect(boxW, boxH, fr){
    var ar = IMG_AR[fr.platform];
    var imgW = 1000, imgH = 1000 / ar;
    var scale = Math.max(boxW / imgW, boxH / imgH);
    var dispW = imgW * scale, dispH = imgH * scale;
    var pos = OBJPOS[fr.platform][fr.kind === 'shaft' ? fr.key : 'seq'] || [0.5, 0.5];
    return { dispW: dispW, dispH: dispH, offX: (boxW - dispW) * pos[0], offY: (boxH - dispH) * pos[1] };
  }

  /* сэмплируем свободную ширину/высоту (в пикселях экрана, обрезано по видимой области — часть кадра может
     уходить за пределы вьюпорта из-за object-position) в нескольких точках всего периода "дожития" блока,
     берём МИНИМУМ — чтобы панель не выходила на занятую зону ни в одной точке своего sticky-периода */
  function sampleFreeExtent(blockTop, blockBottom, wrapTop, total, boxW, boxH, wantDesktop){
    var samples = 7, minExtent = Infinity, anySide2 = false, sideVote = { 0: 0, 1: 0 };
    for (var i = 0; i < samples; i++){
      var frac = i / (samples - 1);
      var y = blockTop + frac * (blockBottom - blockTop);
      var p = clamp((y - wrapTop) / total, 0, 1);
      var fr = frameForProgress(p);
      var z = zoneForFrame(fr);
      if (!z) continue;
      if (z[0] === 2){ anySide2 = true; continue; }
      sideVote[z[0]] = (sideVote[z[0]] || 0) + 1;
      var cr = coverRect(boxW, boxH, fr);
      var ext;
      if (wantDesktop){
        var x0px = Math.max(0, cr.offX + z[1] * cr.dispW);
        var x1px = Math.min(boxW, cr.offX + z[2] * cr.dispW);
        ext = Math.max(0, x1px - x0px);
      } else {
        var y0px = Math.max(0, cr.offY + z[1] * cr.dispH);
        var y1px = Math.min(boxH, cr.offY + z[2] * cr.dispH);
        ext = Math.max(0, y1px - y0px);
      }
      if (ext < minExtent) minExtent = ext;
    }
    var side = sideVote[1] > sideVote[0] ? 1 : 0;
    return { extent: minExtent === Infinity ? 0 : minExtent, side: side, anyCompact: anySide2 && sideVote[0] === 0 && sideVote[1] === 0 };
  }

  function layoutPanels(){
    if (!window.DV_ZONES) return;
    var blocks = document.querySelectorAll('.story-block');
    if (!blocks.length) return;
    var wrapTop = wrap.getBoundingClientRect().top + window.pageYOffset;
    var total = Math.max(1, wrap.offsetHeight - window.innerHeight);
    var boxW = stage.clientWidth, boxH = stage.clientHeight;
    blocks.forEach(function(block){
      var panel = block.querySelector('.story-panel');
      if (!panel) return;
      var r = block.getBoundingClientRect();
      var blockTop = r.top + window.pageYOffset;
      var blockBottom = blockTop + r.height;
      panel.classList.remove('is-left', 'is-right', 'is-top', 'is-bottom', 'is-compact', 'is-narrow');
      panel.style.maxWidth = '';
      panel.style.maxHeight = '';
      var sample = sampleFreeExtent(blockTop, blockBottom, wrapTop, total, boxW, boxH, isDesktop);
      /* ширина/высота панели считается от РЕАЛЬНОГО минимума свободной полосы за весь sticky-период (не от
         фиксированных 420px "компактного" варианта) — иначе панель шире свободной воды перекроет водолаза */
      if (isDesktop){
        panel.classList.add(sample.side === 0 ? 'is-left' : 'is-right');
        if (sample.anyCompact) panel.classList.add('is-compact');
        /* на компьютере фон сдвинут вправо (водолаз и борт уходят в правую часть), слева стабильно вода —
           панель фиксированной комфортной ширины */
        panel.classList.remove('is-right'); panel.classList.add('is-left');
        panel.style.maxWidth = Math.round(Math.min(560, Math.max(480, window.innerWidth * 0.36))) + 'px';
      } else {
        panel.classList.add(sample.side === 0 ? 'is-top' : 'is-bottom');
        if (sample.anyCompact) panel.classList.add('is-compact');
        /* на телефоне панель не обрезаем: весь текст виден, водолаз остаётся в противоположной половине */
        panel.style.maxHeight = '';
      }
    });
  }

  /* ---------- build / rebuild the scrubbed dive timeline ---------- */
  var currentST = null;
  function build(){
    if (currentST){ currentST.kill(); currentST = null; }
    gsap.set(col, { y: 0, scale: 1.06, filter: 'none' });
    computeBreakpoints();
    var dist = Math.max(0, col.scrollHeight - stage.clientHeight);

    /* индекс "водного" кадра (предпоследний кадр столба, тот что совпадает с кадром 1 последовательности) среди
       N кадров столба текущей платформы: компьютер — g2,g4,g5 (N=3, индекс1=g4); телефон — g3,g1,g4-m,g5-m (N=4, индекс2=g4-m).
       Последний кадр (g5 / g5-m) остаётся в столбе как фолбэк-цель на конец видео-участка (p=P_VIDEO_END). */
    var frameCount = col.querySelectorAll(isDesktop ? '.shaft-frame.d-only' : '.shaft-frame.m-only').length || 1;
    var waterFrameIdx = Math.max(0, frameCount - 2);
    var waterFrac = frameCount > 1 ? waterFrameIdx / (frameCount - 1) : 0;

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: wrap,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.9,
        onUpdate: function(self){ updateOverlays(self.progress); },
        onRefresh: function(self){ updateOverlays(self.progress); }
      }
    });
    if (isDesktop) tl.to(col, { scale: 1, ease: 'none', duration: 1 }, 0);
    else tl.to(col, { y: -dist * waterFrac, ease: 'power1.inOut', duration: Math.max(0.01, P_VIDEO_START - P_DESCEND_START) }, P_DESCEND_START)
      .to(col, { y: -dist, ease: 'none', duration: Math.max(0.01, P_VIDEO_END - P_VIDEO_START) }, P_VIDEO_START)
      .to(col, { scale: 1, ease: 'none', duration: 1 }, 0);

    currentST = tl.scrollTrigger;
    updateOverlays(currentST.progress || 0);
    layoutPanels();
  }
  build();

  /* ПК: статичный фон нижней части показываем только когда он закрепился сверху — до этого под ним тот же кадр видео,
     иначе при выезде снизу он виден сдвинутым и даёт шов */
  var deepBg = document.getElementById('deepBg'), deepSec = document.querySelector('.deep-photos');
  if (deepBg && deepSec && isDesktop){
    deepBg.style.visibility = 'hidden';
    ScrollTrigger.create({ trigger: deepSec, start: 'top top', end: 'max',
      onEnter: function(){ deepBg.style.visibility = 'visible'; },
      onLeaveBack: function(){ deepBg.style.visibility = 'hidden'; } });
  }
  window.addEventListener('resize', debounce(function(){ build(); ScrollTrigger.refresh(); }, 250));
  var onLoadBuild = function(){ ric(function(){ build(); ScrollTrigger.refresh(); }); };
  if (document.readyState === 'complete') onLoadBuild(); else window.addEventListener('load', onLoadBuild);
  if (document.fonts && document.fonts.ready){ document.fonts.ready.then(function(){ build(); ScrollTrigger.refresh(); }); }

  /* ===================== image-sequence scrubbing (Apple-style canvas scrub) ===================== */
  (function initSequence(){
    if (!videoCanvas || !videoCtx) return;

    var CONFIG = {
      d: { dir: 'seq/d/', count: 72, keys: [1, 24, 48, 72], maxW: 1600, maxH: 900 },
      m: { dir: 'seq/m/', count: 60, keys: [1, 20, 40, 60], maxW: 1080, maxH: 1920 }
    };
    var cfg = isDesktop ? CONFIG.d : CONFIG.m;

    var AVIF_PROBE = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';

    function supportsAvif(cb){
      try {
        var img = new Image();
        img.onload = function(){ cb(img.width > 0 && img.height > 0); };
        img.onerror = function(){ cb(false); };
        img.src = AVIF_PROBE;
      } catch (e) { cb(false); }
    }

    var ext = 'webp';
    var cache = {};        /* idx(number) -> HTMLImageElement (decoded) */
    var loadedIndexes = [];/* sorted list of loaded idx for nearest-neighbour lookup */
    var drawnIndex = 0;    /* последний реально нарисованный индекс, 0 = ничего не рисовали */
    var drawnFloat = 1;    /* сглаженный текущий индекс (плавающая точка), стартует на первом кадре */
    var rafId = null;
    var running = false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function frameUrl(idx){
      var n = ('0000' + idx).slice(-4);
      return cfg.dir + n + '.' + ext;
    }

    function nearestLoaded(target){
      if (!loadedIndexes.length) return 0;
      var best = loadedIndexes[0], bestD = Math.abs(best - target);
      for (var i = 1; i < loadedIndexes.length; i++){
        var d = Math.abs(loadedIndexes[i] - target);
        if (d < bestD){ best = loadedIndexes[i]; bestD = d; }
      }
      return best;
    }

    function resizeCanvas(){
      var w = Math.min(Math.round(stage.clientWidth * dpr), cfg.maxW);
      var h = Math.min(Math.round(stage.clientHeight * dpr), cfg.maxH);
      if (videoCanvas.width !== w || videoCanvas.height !== h){
        videoCanvas.width = w;
        videoCanvas.height = h;
      }
      videoCanvas.style.width = stage.clientWidth + 'px';
      videoCanvas.style.height = stage.clientHeight + 'px';
      drawnIndex = (drawnIndex || 0) + 1000; /* форсируем перерисовку после ресайза */
    }

    function drawCover(img){
      var cw = videoCanvas.width, ch = videoCanvas.height;
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      if (!cw || !ch || !iw || !ih) return;
      var scale = Math.max(cw / iw, ch / ih);
      var desk = window.innerWidth >= 900;
      if (desk) scale *= 1.3;               /* компьютер: крупнее и прижато влево — водолаз и борт смещаются вправо */
      var dw = iw * scale, dh = ih * scale;
      var dx = desk ? 0 : (cw - dw) / 2, dy = (ch - dh) / 2;
      videoCtx.clearRect(0, 0, cw, ch);
      videoCtx.drawImage(img, dx, dy, dw, dh);
    }

    function drawCoverNoClear(img){
      var cw = videoCanvas.width, ch = videoCanvas.height;
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      var scale = Math.max(cw / iw, ch / ih);
      var desk = window.innerWidth >= 900;
      if (desk) scale *= 1.3;
      var dw = iw * scale, dh = ih * scale;
      videoCtx.drawImage(img, desk ? 0 : (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }
    function draw(idx){
      var srcIdx = cache[idx] ? idx : nearestLoaded(idx);
      if (!srcIdx || !cache[srcIdx]) return; /* ничего не загружено — canvas остаётся пустым, виден фолбэк-столб */
      drawCover(cache[srcIdx]);
      drawnIndex = idx;
    }

    /* ---------- rAF loop: сглаживает целевой индекс, рисует не чаще кадра экрана, только при смене ---------- */
    /* вариант без видео: 4 картинки с водолазом, каждая стоит, между ними короткий наплыв */
    var drawnKey = '';
    function tick(){
      var K = cfg.keys.length;
      var targetFloat = videoTargetProgress * (K - 1);
      drawnFloat += (targetFloat - drawnFloat) * 0.25;
      if (Math.abs(targetFloat - drawnFloat) < 0.002) drawnFloat = targetFloat;
      var i = clamp(Math.floor(drawnFloat), 0, K - 1), f = drawnFloat - i;
      var a = smoothstep(0.38, 0.62, f);
      var ia = cfg.keys[i], ib = cfg.keys[Math.min(K - 1, i + 1)];
      var key = ia + ':' + ib + ':' + Math.round(a * 100) + ':' + drawnIndex;
      if (key !== drawnKey && cache[ia]){
        var cw = videoCanvas.width, ch = videoCanvas.height;
        videoCtx.globalAlpha = 1; drawCover(cache[ia]);
        if (a > 0 && cache[ib] && ib !== ia){ videoCtx.globalAlpha = a; drawCoverNoClear(cache[ib]); videoCtx.globalAlpha = 1; }
        drawnKey = key;
      }
      if (running) rafId = requestAnimationFrame(tick);
    }
    function start(){ if (running) return; running = true; rafId = requestAnimationFrame(tick); }
    function stop(){ running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; }

    if ('IntersectionObserver' in window){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){ en.isIntersecting ? start() : stop(); });
      }, { threshold: 0 });
      io.observe(wrap);
    } else {
      start();
    }

    resizeCanvas();
    window.addEventListener('resize', debounce(resizeCanvas, 200));

    /* ---------- progressive loading: после load, опорные кадры (каждый 6-й) сначала, остальные потом ---------- */
    function loadOne(idx){
      return new Promise(function(resolve){
        var img = new Image();
        img.decoding = 'async';
        img.onload = function(){
          var done = function(){
            cache[idx] = img;
            loadedIndexes.push(idx);
            resolve();
          };
          var fired=false; var once=function(){ if(!fired){ fired=true; done(); } };
          if (img.decode){ img.decode().then(once).catch(once); setTimeout(once, 1000); } else { once(); }
        };
        img.onerror = function(){ resolve(); };
        img.src = frameUrl(idx);
      });
    }

    function buildLoadOrder(){
      return cfg.keys.slice();
    }

    function loadSequence(){
      var order = buildLoadOrder();
      var CONCURRENCY = 6;
      var next = 0;
      function pump(){
        if (next >= order.length) return;
        var idx = order[next++];
        loadOne(idx).then(function(){
          /* как только появился первый загруженный кадр — форсируем перерисовку, чтобы не ждать rAF-сглаживания с нуля */
          if (loadedIndexes.length === 1) draw(nearestLoaded(Math.round(drawnFloat)));
          pump();
        });
      }
      for (var c = 0; c < CONCURRENCY; c++) pump();
    }

    function afterLoad(){
      ric(function(){ loadSequence(); });
    }
    /* формат определяем ДО старта очереди загрузки, чтобы frameUrl() всегда строил правильное расширение */
    supportsAvif(function(avifOk){
      ext = avifOk ? 'avif' : 'webp';
      if (document.readyState === 'complete') afterLoad();
      else window.addEventListener('load', afterLoad);
    });
  })();

  /* ---------- bubbles: canvas 2D, только ниже ватерлинии, редкие частицы, останавливаются вне экрана ---------- */
  (function initBubbles(){
    var canvas = document.getElementById('bubblesCanvas');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var particles = [];
    var running = false;
    var raf = null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function spawn(w, h, initial){
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + Math.random() * 40,
        r: 1.3 + Math.random() * 3,
        vy: 0.35 + Math.random() * 0.85,
        vx: (Math.random() - 0.5) * 0.22,
        a: 0.22 + Math.random() * 0.4,
        wob: Math.random() * Math.PI * 2
      };
    }
    function resize(){
      var w = stage.clientWidth, h = stage.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = 15 + Math.round(Math.random() * 5); /* 15–20 редких частиц */
      particles = [];
      for (var i = 0; i < count; i++) particles.push(spawn(w, h, true));
    }
    function tick(){
      var w = stage.clientWidth, h = stage.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#EAF9FB';
      for (var i = 0; i < particles.length; i++){
        var pt = particles[i];
        pt.y -= pt.vy;
        pt.wob += 0.02;
        pt.x += pt.vx + Math.sin(pt.wob) * 0.15;
        if (pt.y < -10){ particles[i] = spawn(w, h, false); continue; }
        ctx.globalAlpha = pt.a;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (running) raf = requestAnimationFrame(tick);
    }
    function start(){ if (running) return; running = true; raf = requestAnimationFrame(tick); }
    function stop(){ running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    resize();
    window.addEventListener('resize', debounce(resize, 200));

    if ('IntersectionObserver' in window){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){ en.isIntersecting ? start() : stop(); });
      }, { threshold: 0 });
      io.observe(wrap);
    } else {
      start();
    }
  })();
})();
