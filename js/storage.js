'use strict';
var Storage = (function(){
  var DB_NAME = 'resume_workshop_db', DB_VER = 1, LS_KEY = 'resume_workshop_backup';
  var db = null, useIdb = false;

  function prom(r){
    return new Promise(function(res, rej){
      r.onsuccess = function(){ res(r.result); };
      r.onerror = function(){ rej(r.error); };
    });
  }
  function txDone(t){
    return new Promise(function(res, rej){
      t.oncomplete = function(){ res(); };
      t.onerror = function(){ rej(t.error); };
      t.onabort = function(){ rej(t.error); };
    });
  }
  function store(name, mode){ return db.transaction(name, mode).objectStore(name); }

  function lsRead(){
    try {
      var v = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      return v && typeof v === 'object' ? v : { resumes: [], settings: null };
    } catch (e) { return { resumes: [], settings: null }; }
  }
  function lsWrite(obj){ localStorage.setItem(LS_KEY, JSON.stringify(obj)); }

  function init(){
    return new Promise(function(resolve){
      if (!('indexedDB' in window)) { useIdb = false; resolve(); return; }
      try {
        var req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = function(e){
          var d = e.target.result;
          if (!d.objectStoreNames.contains('resumes')) d.createObjectStore('resumes', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
        };
        req.onsuccess = function(e){ db = e.target.result; useIdb = true; resolve(); };
        req.onerror = function(){ useIdb = false; resolve(); };
        req.onblocked = function(){ useIdb = false; resolve(); };
      } catch (err) { useIdb = false; resolve(); }
    });
  }
  function mode(){ return useIdb ? 'idb' : 'local'; }

  function saveResume(r){
    if (useIdb) return prom(store('resumes', 'readwrite').put(r));
    return Promise.resolve().then(function(){
      var all = lsRead();
      all.resumes = all.resumes.filter(function(x){ return x.id !== r.id; });
      all.resumes.push(r);
      lsWrite(all);
    });
  }
  function saveResumes(list){
    if (useIdb){
      var t = db.transaction('resumes', 'readwrite');
      var s = t.objectStore('resumes');
      s.clear();
      list.forEach(function(r){ s.put(r); });
      return txDone(t);
    }
    return Promise.resolve().then(function(){
      var all = lsRead();
      all.resumes = list;
      lsWrite(all);
    });
  }
  function deleteResume(id){
    if (useIdb) return prom(store('resumes', 'readwrite').delete(id));
    return Promise.resolve().then(function(){
      var all = lsRead();
      all.resumes = all.resumes.filter(function(x){ return x.id !== id; });
      lsWrite(all);
    });
  }
  function loadResumes(){
    if (useIdb) return prom(store('resumes', 'readonly').getAll()).catch(function(){ return []; });
    return Promise.resolve(lsRead().resumes || []);
  }
  function saveSettings(s){
    if (useIdb) return prom(store('settings', 'readwrite').put({ key: 'global', value: s }));
    return Promise.resolve().then(function(){
      var all = lsRead();
      all.settings = s;
      lsWrite(all);
    });
  }
  function loadSettings(){
    if (useIdb) return prom(store('settings', 'readonly').get('global')).then(function(rec){ return rec ? rec.value : null; }).catch(function(){ return null; });
    return Promise.resolve(lsRead().settings || null);
  }
  function clearAll(){
    if (useIdb){
      var t = db.transaction(['resumes', 'settings'], 'readwrite');
      t.objectStore('resumes').clear();
      t.objectStore('settings').clear();
      return txDone(t);
    }
    return Promise.resolve().then(function(){ lsWrite({ resumes: [], settings: null }); });
  }

  return {
    init: init, mode: mode, saveResume: saveResume, saveResumes: saveResumes,
    deleteResume: deleteResume, loadResumes: loadResumes,
    saveSettings: saveSettings, loadSettings: loadSettings, clearAll: clearAll
  };
})();