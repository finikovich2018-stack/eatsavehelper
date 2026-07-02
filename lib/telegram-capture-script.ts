/** Inline script source for layout (server-safe, no window access). */
export function installTelegramCaptureScript(): string {
  return `(function(){
    function parseUser(d){try{var u=new URLSearchParams(d).get('user');return u?JSON.parse(u):null;}catch(e){return null;}}
    function fromHash(){try{var h=location.hash.replace(/^#/,'');if(!h)return null;var p=new URLSearchParams(h);var d=p.get('tgWebAppData');if(!d)return null;try{d=decodeURIComponent(d);}catch(e){}var u=parseUser(d);return u?{initData:d,user:u}:null;}catch(e){return null;}}
    function fromTg(){try{var tg=window.Telegram&&window.Telegram.WebApp;if(!tg||!tg.initData)return null;var u=tg.initDataUnsafe&&tg.initDataUnsafe.user;if(!u){u=parseUser(tg.initData);}return u&&u.id?{initData:tg.initData,user:u}:null;}catch(e){return null;}}
    function persist(x){if(!x)return false;window.__EATSAVE_TG__=x;try{sessionStorage.setItem('eatsave_tg_init',x.initData);sessionStorage.setItem('eatsave_tg_user',JSON.stringify(x.user));localStorage.setItem('eatsave_tg_init',x.initData);localStorage.setItem('eatsave_tg_user',JSON.stringify(x.user));}catch(e){}return true;}
    function capture(){return persist(fromTg())||persist(fromHash());}
    window.__EATSAVE_CAPTURE_TG__=capture;
    capture();
  })();`;
}
