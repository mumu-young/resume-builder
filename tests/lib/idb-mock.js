'use strict';
function createIndexedDBMock(){
  const stores = new Map();
  const meta = new Map();
  const names = [];
  function keyOf(name, obj){ const kp = meta.get(name); return kp ? obj[kp] : obj; }
  function makeRequest(){
    return { result: undefined, error: null, onsuccess: null, onerror: null,
      fire(){
        if (this.error){ if (this.onerror) this.onerror({ target: this }); }
        else if (this.onsuccess) this.onsuccess({ target: this });
      } };
  }
  function makeStore(name){
    if (!stores.has(name)){ stores.set(name, new Map()); meta.set(name, null); }
    const map = stores.get(name);
    return {
      put(obj){ const req = makeRequest(); setTimeout(function(){ map.set(keyOf(name, obj), obj); req.fire(); }, 0); return req; },
      get(key){ const req = makeRequest(); setTimeout(function(){ req.result = map.has(key) ? map.get(key) : undefined; req.fire(); }, 0); return req; },
      getAll(){ const req = makeRequest(); setTimeout(function(){ req.result = Array.from(map.values()); req.fire(); }, 0); return req; },
      delete(key){ const req = makeRequest(); setTimeout(function(){ map.delete(key); req.fire(); }, 0); return req; },
      clear(){ const req = makeRequest(); setTimeout(function(){ map.clear(); req.fire(); }, 0); return req; }
    };
  }
  const db = {
    objectStoreNames: { contains(name){ return names.indexOf(name) >= 0; } },
    createObjectStore(name, opts){
      stores.set(name, new Map());
      meta.set(name, (opts && opts.keyPath) || null);
      if (names.indexOf(name) < 0) names.push(name);
      return makeStore(name);
    },
    transaction(storeNames){
      const arr = Array.isArray(storeNames) ? storeNames : [storeNames];
      const t = { _pending: 0, oncomplete: null, onerror: null, onabort: null };
      t.objectStore = function(name){
        const base = makeStore(name);
        const wrapped = {};
        ['put', 'get', 'getAll', 'delete', 'clear'].forEach(function(m){
          wrapped[m] = function(){
            t._pending++;
            const req = base[m].apply(base, arguments);
            const origFire = req.fire.bind(req);
            req.fire = function(){
              origFire();
              t._pending--;
              if (t._pending === 0) setTimeout(function(){ if (t.oncomplete) t.oncomplete({ target: t }); }, 0);
            };
            return req;
          };
        });
        return wrapped;
      };
      const _ = arr;
      setTimeout(function(){ if (t._pending === 0 && t.oncomplete) t.oncomplete({ target: t }); }, 0);
      return t;
    },
    close(){}
  };
  return {
    open(){
      const req = makeRequest();
      setTimeout(function(){
        req.result = db;
        if (req.onupgradeneeded) req.onupgradeneeded({ target: req, oldVersion: 0, newVersion: 1 });
        req.fire();
      }, 0);
      return req;
    }
  };
}
module.exports = { createIndexedDBMock };