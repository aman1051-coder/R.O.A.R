// ROAR background shader: a slow, flowing "dose cloud" with faint isodose rings
// around a focal point that drifts toward the pointer.
// Falls back to the CSS gradient on <body> if WebGL is unavailable.
(function () {
  const canvas = document.getElementById('bg-shader');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { canvas.remove(); return; }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const vert = `
    attribute vec2 p;
    void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

  const frag = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uFocus;     // 0..1, pointer-driven
    uniform float uScroll;   // 0..1 page progress
    uniform float uLight;    // 0 = dark theme, 1 = light theme (eased)

    float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
    }
    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++){ v += a*noise(p); p = p*2.02 + vec2(1.7, 9.2); a *= 0.5; }
      return v;
    }

    void main(){
      vec2 uv = gl_FragCoord.xy / uRes;
      float aspect = uRes.x / uRes.y;
      vec2 p = vec2(uv.x*aspect, uv.y);
      float t = uTime * 0.045;

      // Domain-warped flow field
      vec2 q = vec2(fbm(p*1.6 + t), fbm(p*1.6 - t + 3.1));
      vec2 r = vec2(fbm(p*1.4 + 2.0*q + vec2(1.7, 9.2) + t*1.3), fbm(p*1.4 + 2.0*q + vec2(8.3, 2.8) - t));
      float f = fbm(p*1.2 + 2.2*r);

      // Palette: midnight navy -> beam blue -> amber dose
      vec3 navy  = vec3(0.027, 0.047, 0.098);
      vec3 deep  = vec3(0.063, 0.118, 0.231);
      vec3 beam  = vec3(0.184, 0.435, 0.702);
      vec3 amber = vec3(0.910, 0.475, 0.169);

      vec3 col = mix(navy, deep, smoothstep(0.15, 0.85, f));
      col = mix(col, beam, smoothstep(0.55, 1.0, length(q)) * 0.45);

      // Dose hotspot around the focal point
      vec2 focus = vec2(uFocus.x*aspect, uFocus.y);
      float d = length(p - focus + (r - 0.5)*0.18);
      float hot = exp(-d*d*5.5);
      col = mix(col, amber, hot * (0.55 + 0.25*sin(uTime*0.6)) * (1.0 - uScroll*0.5));

      // Isodose rings: thin contour lines, warped by the flow
      float rings = abs(fract(d*7.0 - uTime*0.06) - 0.5);
      float line = smoothstep(0.03, 0.0, rings) * exp(-d*1.6);
      col += mix(beam, amber, hot) * line * 0.35;

      // Vignette
      col *= 1.0 - 0.45*pow(length(uv - 0.5)*1.25, 2.0);

      // Light theme: warm paper, sky-blue mist, a peach dose cloud and fine contour lines
      vec3 paper = vec3(0.965, 0.950, 0.925);
      vec3 mist  = vec3(0.850, 0.905, 0.965);
      vec3 peach = vec3(0.985, 0.820, 0.660);
      vec3 lc = mix(paper, mist, smoothstep(0.25, 0.95, f) * 0.75);
      lc = mix(lc, vec3(0.78, 0.86, 0.96), smoothstep(0.55, 1.0, length(q)) * 0.30);
      lc = mix(lc, peach, hot * (0.65 + 0.2*sin(uTime*0.6)) * (1.0 - uScroll*0.5));
      lc = mix(lc, mix(vec3(0.30, 0.50, 0.75), vec3(0.90, 0.55, 0.30), hot), line * 0.28);
      lc *= 1.0 - 0.06*pow(length(uv - 0.5)*1.25, 2.0);
      col = mix(col, lc, uLight);

      // Gentle grain
      col += (hash(gl_FragCoord.xy + uTime) - 0.5) * mix(0.018, 0.010, uLight);

      gl_FragColor = vec4(col, 1.0);
    }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, vert), fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) { canvas.remove(); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uFocus = gl.getUniformLocation(prog, 'uFocus');
  const uScroll = gl.getUniformLocation(prog, 'uScroll');
  const uLight = gl.getUniformLocation(prog, 'uLight');
  const isLight = () => document.documentElement.getAttribute('data-theme') === 'light' ? 1 : 0;
  let light = isLight(), lightTarget = light;
  // Re-render when the theme changes (also needed when motion is reduced and nothing animates)
  new MutationObserver(() => {
    lightTarget = isLight();
    if (reduceMotion) { light = lightTarget; requestAnimationFrame(frame); }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Render below native resolution: the field is soft, so this is invisible and cheap.
  const SCALE = 0.5;
  function resize() {
    const w = Math.max(1, Math.floor(innerWidth * SCALE));
    const h = Math.max(1, Math.floor(innerHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }
  }
  resize();
  addEventListener('resize', resize);

  const target = { x: 0.72, y: 0.62 }, focus = { x: 0.72, y: 0.62 };
  addEventListener('pointermove', e => {
    target.x = 0.55 + (e.clientX / innerWidth - 0.5) * 0.5;
    target.y = 0.6 - (e.clientY / innerHeight - 0.5) * 0.4;
  }, { passive: true });

  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running && !reduceMotion) requestAnimationFrame(frame);
  });

  const start = performance.now();
  function frame(now) {
    focus.x += (target.x - focus.x) * 0.03;
    focus.y += (target.y - focus.y) * 0.03;
    const max = document.documentElement.scrollHeight - innerHeight;
    gl.uniform1f(uTime, reduceMotion ? 12.0 : (now - start) / 1000);
    gl.uniform2f(uFocus, focus.x, focus.y);
    gl.uniform1f(uScroll, max > 0 ? scrollY / max : 0);
    light += (lightTarget - light) * (reduceMotion ? 1 : 0.08);   // smooth cross-fade between themes
    gl.uniform1f(uLight, light);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (running && !reduceMotion) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.documentElement.classList.add('has-shader');
})();
