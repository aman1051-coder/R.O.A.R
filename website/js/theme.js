// Light / dark theme. Loaded in <head> on every page so the right theme shows before anything paints.
// Follows the device setting until the visitor picks one with a sun/moon button ([data-theme-toggle]).
(function () {
  var KEY = 'roar-theme';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function apply(t) {
    root.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = t === 'light' ? '#f5f2ec' : '#070c18';
  }
  var s = saved();
  apply(s === 'light' || s === 'dark' ? s : (mq && mq.matches ? 'light' : 'dark'));

  if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { if (!saved()) apply(e.matches ? 'light' : 'dark'); });

  window.ROAR_THEME = {
    get: function () { return root.getAttribute('data-theme'); },
    set: function (t) { apply(t); try { localStorage.setItem(KEY, t); } catch (e) { /* private mode */ } },
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (!b) return;
    window.ROAR_THEME.set(window.ROAR_THEME.get() === 'light' ? 'dark' : 'light');
  });
})();
