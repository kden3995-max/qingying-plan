(function (root) {
  'use strict';
  const aliases = {'#plan':'#/profile/basic','#week':'#/plan/week','#record':'#/plan/records'};
  function resolve(value) {
    const hash = aliases[value] || value;
    const match = typeof hash === 'string' && hash.match(/^#\/(home|profile|plan)(?:\/(basic|habits|health|overview|week|records))?$/);
    if (match) {
      const [,screen,part] = match;
      if (screen === 'home' && !part) return {screen,step:null,panel:null,hash:'#/home'};
      if (screen === 'profile' && ['basic','habits','health'].includes(part)) return {screen,step:part,panel:null,hash};
      if (screen === 'plan' && ['overview','week','records'].includes(part)) return {screen,step:null,panel:part,hash};
    }
    return {screen:'home',step:null,panel:null,hash:'#/home'};
  }
  function start(onChange) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    let appliedHash=null;
    function apply() {
      const route = resolve(location.hash);
      if (location.hash !== route.hash) history.replaceState(null,'',route.hash);
      if(appliedHash===route.hash)return;
      appliedHash=route.hash;
      onChange(route);
    }
    function go(hash,{replace=false}={}) {
      const route = resolve(hash);
      if (location.hash === route.hash) return;
      history[replace?'replaceState':'pushState'](null,'',route.hash);
      apply();
    }
    window.addEventListener('hashchange',apply);
    window.addEventListener('popstate',apply);
    apply();
    return {go,stop:()=>{window.removeEventListener('hashchange',apply);window.removeEventListener('popstate',apply);}};
  }
  root.QingyingRouter = {resolve,start};
})(globalThis);
