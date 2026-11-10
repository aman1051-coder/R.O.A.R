// ROAR site configuration.
// Paste your Supabase project's URL and "anon public" key here (Supabase -> Project Settings -> API).
// The anon key is designed to be public; the database's security rules protect the data.
// While these are empty, the website uses Netlify Forms and the Founders' console runs in DEMO mode.
window.ROAR_CONFIG = {
  supabaseUrl: 'https://yngnekccjfhgtpbaifdl.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluZ25la2NjamZoZ3RwYmFpZmRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMzQ4MjUsImV4cCI6MjEwOTkxMDgyNX0.ktEhUS_AqMNJY2U0CusSeNLZ0WrgRlJAKPfJlUx1Y58',
  // Founders sign in with a username; this is the domain of their Supabase login address (see SETUP.md)
  founderLoginDomain: 'founders.roar.invalid'
};

// Demo mode (sample data kept in the browser) runs only on your own computer, or on the hosted site
// when someone opens a page with ?demo in the address, e.g. https://…/council/?demo
// Ordinary visitors to the public site never see the demo console or portal.
window.ROAR_DEMO_OK = (function () {
  try {
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return true;
    if (new URLSearchParams(location.search).has('demo')) sessionStorage.setItem('roar-demo', '1');
    return sessionStorage.getItem('roar-demo') === '1';
  } catch (e) { return false; }
})();
