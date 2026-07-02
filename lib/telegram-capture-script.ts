/**
 * Inline bootstrap for Telegram Mini App auth.
 * Keep in sync with lib/telegram-launch-params.ts (validated by scripts/check-capture-script.mjs).
 */
export function installTelegramCaptureScript(): string {
  return `(function(){
    function isTg(){
      try{
        if(window.Telegram&&window.Telegram.WebApp)return true;
        if(/Telegram/i.test(navigator.userAgent))return true;
        if(location.hash.indexOf('tgWebApp')>=0||location.search.indexOf('tgWebApp')>=0)return true;
        var n=performance.getEntriesByType('navigation')[0];
        if(n&&n.name&&n.name.indexOf('tgWebApp')>=0)return true;
      }catch(e){}
      return false;
    }
    function purgeSw(){
      if(!('serviceWorker'in navigator))return;
      navigator.serviceWorker.getRegistrations().then(function(regs){
        regs.forEach(function(r){r.unregister();});
      }).catch(function(){});
      if('caches'in window){
        caches.keys().then(function(keys){
          keys.forEach(function(k){caches.delete(k);});
        }).catch(function(){});
      }
    }
    if(isTg())purgeSw();
    function parseUser(d){try{var u=new URLSearchParams(d).get('user');return u?JSON.parse(u):null;}catch(e){return null;}}
    function fromUrl(src){
      try{
        if(!src||src.indexOf('tgWebApp')<0)return null;
        var q=src.indexOf('?')>=0?src.slice(src.indexOf('?')+1):src.indexOf('#')>=0?src.slice(src.indexOf('#')+1):src;
        var p=new URLSearchParams(q.replace(/^#/,''));
        var d=p.get('tgWebAppData');if(!d)return null;
        try{d=decodeURIComponent(d);}catch(e){}
        var u=parseUser(d);return u?{initData:d,user:u}:null;
      }catch(e){return null;}
    }
    function fromHash(){return fromUrl(location.href)||fromUrl(location.hash)||fromUrl(location.search);}
    function fromNav(){try{var n=performance.getEntriesByType('navigation')[0];return n?fromUrl(n.name):null;}catch(e){return null;}}
    function fromTg(){try{var tg=window.Telegram&&window.Telegram.WebApp;if(!tg||!tg.initData)return null;var u=tg.initDataUnsafe&&tg.initDataUnsafe.user;if(!u){u=parseUser(tg.initData);}return u&&u.id?{initData:tg.initData,user:u}:null;}catch(e){return null;}}
    function persist(x){if(!x)return false;window.__EATSAVE_TG__=x;try{sessionStorage.setItem('eatsave_tg_init',x.initData);sessionStorage.setItem('eatsave_tg_user',JSON.stringify(x.user));localStorage.setItem('eatsave_tg_init',x.initData);localStorage.setItem('eatsave_tg_user',JSON.stringify(x.user));sessionStorage.setItem('launchParams',JSON.stringify({initDataRaw:x.initData,initData:{user:{id:x.user.id,firstName:x.user.first_name,username:x.user.username,isPremium:!!x.user.is_premium}},platform:'unknown',themeParams:{},version:'0'}));}catch(e){}return true;}
    function capture(){return persist(fromTg())||persist(fromHash())||persist(fromNav());}
    window.__EATSAVE_CAPTURE_TG__=capture;
    capture();
  })();`;
}
