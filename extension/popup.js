'use strict';

const DEFAULTS = Object.freeze({
  liteEnabled:true, cinemaMode:true, hardReloadVideos:true,
  showHomeFeed:false, showRelated:false, showComments:false,
  showShorts:false, showMixPanel:true, showDescription:false
});

const captureButton=document.getElementById('capture');
const nativeButton=document.getElementById('native');
const status=document.getElementById('status');
const inputs=Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,document.getElementById(k)]));

function setStatus(text,kind){status.textContent=text;status.className=kind||''}

async function loadSettings(){
  const saved=await chrome.storage.sync.get(DEFAULTS);
  for(const [key,input] of Object.entries(inputs)) input.checked=Boolean(saved[key]);
}

for(const [key,input] of Object.entries(inputs)){
  input.addEventListener('change',async()=>{
    await chrome.storage.sync.set({[key]:input.checked});
    setStatus('Settings updated.','ok');
  });
}

async function activeTab(){
  const tabs=await chrome.tabs.query({active:true,currentWindow:true});
  return tabs&&tabs[0]?tabs[0]:null;
}

function desktopUrl(raw){
  try{
    const u=new URL(raw);
    const v=u.searchParams.get('v')||'';
    if(u.pathname!=='/watch'||!/^[A-Za-z0-9_-]{11}$/.test(v)) return null;
    u.hostname='www.youtube.com';
    u.searchParams.delete('app');
    u.searchParams.delete('aero_mobile');
    u.searchParams.set('aero_native','1');
    return u;
  }catch(_){return null}
}

function scrapeMix(){
  let u;
  try{u=new URL(location.href)}catch(_){return{error:'Invalid YouTube page.'}}
  if(u.pathname!=='/watch') return{error:'Open a YouTube Mix/watch page first.'};

  const seedId=u.searchParams.get('v')||'';
  const listId=u.searchParams.get('list')||'';
  if(!seedId||!listId) return{error:'This page is not a Mix/playlist.'};

  const ids=[];
  const anchors=Array.from(document.querySelectorAll('a[href*="/watch?"]'));
  for(const a of anchors){
    try{
      const x=new URL(a.href||a.getAttribute('href'),location.origin);
      if(x.searchParams.get('list')&&/^[A-Za-z0-9_-]{11}$/.test(x.searchParams.get('v')||'')){
        ids.push(x.searchParams.get('v'));
      }
    }catch(_){}
    if(ids.length>=100) break;
  }

  if(ids.length<2){
    const html=document.documentElement?document.documentElement.innerHTML:'';
    const re=/"playlistPanelVideoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"/g;
    let m;
    while((m=re.exec(html))&&ids.length<100) ids.push(m[1]);
  }

  if(ids.length<2) return{error:'Mix order is not available yet. Let the playlist load, then try again.'};
  return{snapshot:{seedId,listId,ids}};
}

nativeButton.addEventListener('click',async()=>{
  try{
    const tab=await activeTab();
    if(!tab||!tab.id) throw new Error('No active tab found.');
    const target=desktopUrl(String(tab.url||''));
    if(!target) throw new Error('Open a YouTube video first.');
    await chrome.tabs.update(tab.id,{url:target.toString()});
    window.close();
  }catch(e){setStatus(e.message||'Could not open desktop YouTube.','err')}
});

captureButton.addEventListener('click',async()=>{
  captureButton.disabled=true;
  setStatus('Reading the current Mix…');
  try{
    const tab=await activeTab();
    if(!tab||!tab.id) throw new Error('No active tab found.');
    const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:scrapeMix});
    const result=results&&results[0]&&results[0].result;
    if(!result) throw new Error('The Mix could not be read.');
    if(result.error) throw new Error(result.error);

    const compact={v:1,listId:result.snapshot.listId,seedId:result.snapshot.seedId,ids:result.snapshot.ids};
    const encoded=btoa(JSON.stringify(compact)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
    setStatus('Captured '+compact.ids.length+' songs. Opening Aero…','ok');
    await chrome.tabs.create({url:'https://aero-x-ive.pages.dev/#aeroMix='+encoded});
  }catch(e){setStatus(e.message||'Capture failed.','err')}
  finally{captureButton.disabled=false}
});

loadSettings().catch(()=>setStatus('Could not load extension settings.','err'));
