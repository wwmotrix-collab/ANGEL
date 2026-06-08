/**
 * modulos/inteligencia-eleitoral.js
 * DEPRECATED.
 *
 * O módulo eleitoral oficial é:
 *   modulos/inteligencia-eleitoral-firebase.js
 *
 * Este arquivo permanece apenas como compatibilidade para links antigos.
 */
(function(global){
  'use strict';

  function ensureFirebaseModule(cb){
    if (typeof global.intelInit === 'function' && global.WWMX?.IntelEleitoral) {
      cb();
      return;
    }
    const old = document.getElementById('script-eleitoral-firebase-compat');
    if (old) { old.addEventListener('load', cb, { once:true }); return; }
    const s = document.createElement('script');
    s.id = 'script-eleitoral-firebase-compat';
    s.src = 'modulos/inteligencia-eleitoral-firebase.js?v=oficial';
    s.onload = cb;
    s.onerror = () => {
      const c = document.getElementById('appView');
      if (c) c.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div>Falha ao carregar inteligência eleitoral oficial.</div>';
    };
    document.head.appendChild(s);
  }

  const oldInit = global.intelInit;
  global.intelInit = function(campanhaId){
    if (oldInit && global.WWMX?.IntelEleitoral) return oldInit(campanhaId);
    ensureFirebaseModule(() => {
      if (typeof global.intelInit === 'function' && global.intelInit !== arguments.callee) {
        global.intelInit(campanhaId);
      }
    });
  };

  global.intelDestroy = function(){
    try { global.WWMX?.IntelEleitoral?.destroy?.(); } catch(_) {}
  };
})(window);
