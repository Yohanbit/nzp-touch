// NZP Touch Field Kit — experimental, unofficial controls extension.
// SPDX-License-Identifier: GPL-2.0-or-later
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const defaults = { layoutVersion:5, sensitivity: 1, adsSensitivity: .45, scale: 1, opacity: .65, leftHand: false, invertY: false, toggleAds: true, autoSprint:true, labels:false, haptics: false, positions: {} };
  const storageKey = 'nzp-touch-fieldkit-v2';
  let cfg = structuredClone(defaults), canSave = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      for (const key of ['sensitivity','adsSensitivity','scale','opacity']) {
        const ranges = {sensitivity:[.35,2], adsSensitivity:[.2,1], scale:[.8,1.4], opacity:[.3,1]};
        if (Number.isFinite(saved[key])) cfg[key] = Math.max(ranges[key][0],Math.min(ranges[key][1],saved[key]));
      }
      for (const key of ['leftHand','invertY','toggleAds','labels','haptics']) if (typeof saved[key] === 'boolean') cfg[key] = saved[key];
      if ((saved.layoutVersion===defaults.layoutVersion||saved.layoutVersion===4) && saved.positions && typeof saved.positions === 'object') for (const [key, value] of Object.entries(saved.positions)) {
        if(saved.layoutVersion===4&&(key==='jump'||key==='crouch'))continue;
        if (Array.isArray(value) && value.length === 2 && value.every(v=>Number.isFinite(v)&&v>=0&&v<=1)) cfg.positions[key] = value;
      }
    }
  } catch { canSave = false; }

  const state = {version:'3.2.3',ready:false,started:false,previewOnly:false,mode:'loading',settings:false,editing:false,texting:false,ads:false,sprintRequested:false,autoRun:false,axes:[0,0],movementRoute:'analog',movementKeys:[],resumeAfterSettings:false,commands:[],error:null};
  const buttons = [...document.querySelectorAll('[data-action]')];
  const pointers = new Map(), held = new Map(), menuTimers = new Map();
  const actionIds = {fire:710,ads:711,reload:712,use:713,weapon:714,melee:715,grenade:716};
  const holdCommands = {fire:'attack',ads:'button8',reload:'button5',use:'button7',weapon:'button4',melee:'button6',grenade:'button3'};
  let look = null, move = null, menuPointer = null, sprintOwner = null, editPointer = null, adsLatch = false, lastAxes = [null,null], toastTimer, dismissedPortrait = false;
  let sprintTimer=null,resizeQueued=false;
  let pendingMove=null,knobPosition='';
  function positionKnob(x,y){
    const value=`translate(${Math.round(x)}px,${Math.round(y)}px)`;
    if(value===knobPosition)return;
    knobPosition=value;$('knob').style.transform=value;
  }
  const movementKeys=new Set();
  const movementBindings={87:'forward',83:'back',65:'moveleft',68:'moveright'};
  function movementKey(code,on) {
    if(movementKeys.has(code)===on)return;
    if(on)movementKeys.add(code);else movementKeys.delete(code);
    key(code,on);record(`Movimiento: ${on?'+':'-'}${movementBindings[code]}`);
    state.movementKeys=[...movementKeys];
  }
  function syncMovement(force=false) {
    const [x,y]=state.axes,magnitude=Math.hypot(x,y);
    // Hysteresis at the outer ring: full movement uses the game's native WASD
    // route. Never add it on top of the analog controller's contribution.
    // Diagonals must use native WASD even inside the outer ring. Otherwise a
    // shorter diagonal drag silently returns to the problematic analog route.
    const diagonalThreshold=state.movementRoute==='keys'?.14:.20;
    const diagonal=Math.abs(x)>=diagonalThreshold&&Math.abs(y)>=diagonalThreshold;
    const digital=diagonal||magnitude>=(state.movementRoute==='keys'?.76:.90);
    if(digital){
      if(state.movementRoute!=='keys'||force){axis(0,0);axis(1,0);lastAxes=[0,0];}
      state.movementRoute='keys';
      const has=(code,value)=>value>(movementKeys.has(code)?.12:.18);
      const wanted=new Set();
      if(has(68,x))wanted.add(68);if(has(65,-x))wanted.add(65);
      if(has(83,y))wanted.add(83);if(has(87,-y))wanted.add(87);
      // Release opposite directions before applying the next combination.
      for(const code of [...movementKeys])if(!wanted.has(code))movementKey(code,false);
      for(const code of wanted)movementKey(code,true);
    }else{
      for(const code of [...movementKeys])movementKey(code,false);
      state.movementRoute='analog';
      for(let i=0;i<2;i++)if(force||Math.abs(state.axes[i]-lastAxes[i])>.0001){axis(i,state.axes[i]);lastAxes[i]=state.axes[i];}
    }
  }

  function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{$('toast').hidden=true;},3200); }
  function save() {
    try { localStorage.setItem(storageKey,JSON.stringify(cfg)); canSave=true; }
    catch { canSave=false; }
    $('save-status').textContent=canSave?'Guardado en este navegador':'No se pudo guardar: ajustes de esta sesión';
  }
  function record(command) { state.commands.push({command,time:performance.now()}); if(state.commands.length>80)state.commands.shift();if(state.previewOnly)$('preview-action').textContent=command; }
  function engine() { return typeof FTEC !== 'undefined' && typeof getWasmTableEntry === 'function' && FTEC.evcb?.key && FTEC.evcb?.mouse && FTEC.evcb?.cbufaddtext; }
  function command(text) {
    if(state.previewOnly){record(text);return true;}
    if (!state.ready || !engine()) return false;
    FTEC.cbufadd(text+'\n'); record(text); return true;
  }
  function key(code,down) { if(state.previewOnly){if(down)record('Tecla de menú: '+code);return;}if(!state.ready||!engine())return; getWasmTableEntry(FTEC.evcb.key)(0,down?1:0,code,0); }
  function tapKey(code) { key(code,true); key(code,false); }
  function axis(index,value) { if(state.previewOnly){if(value!==0)record(`Movimiento ${index===0?'horizontal':'vertical'}: ${value.toFixed(2)}`);return;}if(engine()&&FTEC.evcb.jaxis)getWasmTableEntry(FTEC.evcb.jaxis)(0,index,value,1); }
  function camera(dx,dy) {
    if(state.previewOnly&&!state.settings&&!state.editing){record(`Mirada: ${dx.toFixed(0)}, ${dy.toFixed(0)} · ${state.ads?'mira activa':'normal'}`);return;}
    if (!state.ready || state.mode!=='game' || state.settings || state.editing || !engine()) return;
    const gain = cfg.sensitivity * 6 * (state.ads ? cfg.adsSensitivity : 1);
    getWasmTableEntry(FTEC.evcb.mouse)(0,0,Math.max(-90,Math.min(90,dx))*gain,Math.max(-90,Math.min(90,dy))*gain*(cfg.invertY?-1:1),0,0);
  }
  function vibrate() { if(cfg.haptics && navigator.vibrate)navigator.vibrate(10); }
  function visual(action,on) {
    if(action==='sprint'){$('stick').classList.toggle('sprinting',on);state.sprintRequested=on;return;}
    document.querySelector(`[data-action="${action}"]`)?.classList.toggle('active',on);
  }
  function stopSprint() {
    clearTimeout(sprintTimer);sprintTimer=null;
    if(sprintOwner!==null){command('impulse 24');sprintOwner=null;}
    visual('sprint',false);
  }
  function cancelAutoRun() {
    state.autoRun=false;$('stick').classList.remove('locked');
    stopSprint();
    if(!move){state.axes=[0,0];syncMovement(true);positionKnob(0,0);}
  }
  function updateSprint() {
    const forward=-state.axes[1],side=Math.abs(state.axes[0]);
    const permitted=isPlaying()&&!state.ads&&(move!==null||state.autoRun);
    if(!permitted||forward<.80||side>.45){cancelAutoRun();return;}
    if(forward<.92||side>.38||sprintOwner!==null||sprintTimer!==null)return;
    // Commit analog movement before requesting sprint. NZP rejects impulse 23
    // when it has not yet received a forward usercmd. A short delay avoids that race.
    syncMovement(true);
    sprintTimer=setTimeout(()=>{
      sprintTimer=null;
      if(isPlaying()&&!state.ads&&move&&-state.axes[1]>=.92&&Math.abs(state.axes[0])<=.38){
        state.autoRun=true;$('stick').classList.add('locked');
        sprintOwner='auto';command('impulse 23');visual('sprint',true);
      }
    },120);
  }
  function hold(action,owner,on) {
    if (!holdCommands[action]) return;
    const owners = held.get(action)||new Set();
    const before = owners.size;
    if(on)owners.add(owner);else owners.delete(owner);
    held.set(action,owners);
    if(!before && owners.size){if(action==='use'){key(69,true);record('Interacción: pulsar');}else command(`+${holdCommands[action]} ${actionIds[action]}`);}
    if(before && !owners.size){if(action==='use'){key(69,false);record('Interacción: soltar');}else command(`-${holdCommands[action]} ${actionIds[action]}`);}
    visual(action,owners.size>0);
    if(action==='ads'){
      state.ads=owners.size>0;
      if(state.ads)cancelAutoRun();else updateSprint();
    }
  }
  // Use the engine's native key-event path for discrete weapon actions, as
  // movement already does. No per-tap command-string allocation or overlapping
  // pulse owners. Key releases also run when the page loses focus.
  const pulseKeys = {reload:82,melee:86,weapon:49};
  const pulseTimers = new Map();
  function pulse(action) {
    const code=pulseKeys[action];
    if(!code||pulseTimers.has(action))return;
    key(code,true);record(`Acción: ${action}`);visual(action,true);
    pulseTimers.set(action,setTimeout(()=>{
      key(code,false);pulseTimers.delete(action);visual(action,false);
    },100));
  }
  function releaseAll() {
    pendingMove=null;
    for(const [action,timer] of pulseTimers){clearTimeout(timer);key(pulseKeys[action],false);visual(action,false);}
    pulseTimers.clear();
    cancelAutoRun();
    if(menuPointer!==null&&engine())getWasmTableEntry(FTEC.evcb.button)(0,0,0);
    menuPointer=null;
    for(const [action,owners] of held) if(owners.size) { if(action==='use')key(69,false);else command(`-${holdCommands[action]} ${actionIds[action]}`); owners.clear(); visual(action,false); }
    for(const code of menuTimers.keys())key(code,false);
    for(const timer of menuTimers.values())clearTimeout(timer);
    menuTimers.clear(); pointers.clear(); look=null;move=null;editPointer=null;adsLatch=false;state.ads=false;state.axes=[0,0];
    syncMovement(true);
    document.querySelector('[data-action="ads"]').classList.remove('latched');
    positionKnob(0,0);
    resetStick();
  }
  function resetStick() { const el=$('stick');el.style.left=cfg.leftHand?'56%':'44%';el.style.top='57%'; }
  function apply() {
    document.body.classList.toggle('left-handed',cfg.leftHand);
    document.body.classList.toggle('show-labels',cfg.labels);
    const r=$('stage').getBoundingClientRect();
    const base=Math.max(48,Math.min(64,r.height*.135));
    document.documentElement.style.setProperty('--button-size',(base*cfg.scale)+'px');
    document.documentElement.style.setProperty('--control-opacity',cfg.opacity);
    for(const button of buttons) {
      const a=button.dataset.action, p=cfg.positions[a]||button.dataset.pos.split(',').map(Number);
      const half=(a==='ads'?base*1.12:base)*cfg.scale/2+10;
      let x=(cfg.leftHand?1-p[0]:p[0])*r.width,y=p[1]*r.height;
      x=Math.max(half,Math.min(r.width-half,x)); y=Math.max(74,Math.min(r.height-half,y));
      button.style.left=x+'px';button.style.top=y+'px';
    }
    for(const name of ['sensitivity','adsSensitivity','scale','opacity']) {
      $(name).value=cfg[name]; $(name+'-out').textContent=Math.round(cfg[name]*100)+'%';
    }
    for(const name of ['leftHand','invertY','toggleAds','labels','haptics'])$(name).checked=cfg[name];
    resetStick();
  }
  function showMode(mode) {
    $('stage').dataset.mode=mode;
    if(state.mode!==mode){releaseAll();state.mode=mode;}
    $('game-controls').hidden=mode!=='game'&&!state.editing;
    $('look-zone').hidden=mode!=='game'||state.settings||state.editing;
    $('menu-controls').hidden=mode!=='menu'||state.settings||state.editing;
    $('scores').hidden=mode!=='game';
    $('text-open').hidden=mode!=='menu';
    $('native-menu').querySelector('span').textContent=mode==='game'?'MENÚ':'CERRAR';
  }
  function stopEvent(e) { e.preventDefault(); e.stopPropagation(); }
  function capture(el,e) { try{el.setPointerCapture(e.pointerId);}catch{} }
  function isPlaying() { return state.ready&&state.mode==='game'&&!state.settings&&!state.editing&&!state.texting; }

  for(const button of buttons) {
    button.addEventListener('pointerdown',e=>{
      stopEvent(e); if(e.button!==0)return;
      capture(button,e);
      if(state.editing) { editPointer={id:e.pointerId,button}; button.classList.add('active'); return; }
      if(!isPlaying())return;
      const action=button.dataset.action; pointers.set(e.pointerId,{action,x:e.clientX,y:e.clientY}); vibrate();
      if(['fire','crouch','melee','reload','weapon','use','grenade'].includes(action))cancelAutoRun();
      if(action==='ads'&&cfg.toggleAds) {
        adsLatch=!adsLatch;hold('ads','latch',adsLatch);button.classList.toggle('latched',adsLatch);
      } else if(action==='jump')command('impulse 10');
      else if(action==='crouch')command('impulse 30');
      else if(action==='weapon'||action==='reload'||action==='melee')pulse(action);
      else hold(action,e.pointerId,true);
      if(!holdCommands[action])visual(action,true);
    });
    button.addEventListener('pointermove',e=>{
      stopEvent(e);
      if(state.editing&&editPointer?.id===e.pointerId) {
        const r=$('stage').getBoundingClientRect();
        let x=Math.max(.04,Math.min(.96,(e.clientX-r.left)/r.width)),y=Math.max(.17,Math.min(.92,(e.clientY-r.top)/r.height));
        cfg.positions[button.dataset.action]=[cfg.leftHand?1-x:x,y];apply();return;
      }
      const p=pointers.get(e.pointerId);
      if(p && (p.action==='fire'||p.action==='ads')) { camera(e.clientX-p.x,e.clientY-p.y);p.x=e.clientX;p.y=e.clientY; }
    });
    const end=e=>{
      stopEvent(e);
      if(editPointer?.id===e.pointerId){editPointer=null;button.classList.remove('active');save();return;}
      const p=pointers.get(e.pointerId);if(!p)return;
      if(!(p.action==='ads'&&cfg.toggleAds))hold(p.action,e.pointerId,false);
      if(!holdCommands[p.action])visual(p.action,false);
      pointers.delete(e.pointerId);
    };
    button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);button.addEventListener('lostpointercapture',end);
  }

  $('look-zone').addEventListener('pointerdown',e=>{
    stopEvent(e);if(!isPlaying()||look||e.button!==0)return;capture($('look-zone'),e);look={id:e.pointerId,x:e.clientX,y:e.clientY};
  });
  $('look-zone').addEventListener('pointermove',e=>{
    stopEvent(e);if(look?.id!==e.pointerId)return;camera(e.clientX-look.x,e.clientY-look.y);look.x=e.clientX;look.y=e.clientY;
  });
  const endLook=e=>{stopEvent(e);if(look?.id===e.pointerId)look=null;};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$('look-zone').addEventListener(event,endLook);

  function updateMove(e) {
    if(!move||move.id!==e.pointerId)return;
    const dx=e.clientX-move.x,dy=e.clientY-move.y,radius=52*cfg.scale;
    const length=Math.hypot(dx,dy),magnitude=Math.min(1,length/radius),dead=.12;
    const power=magnitude<=dead?0:(magnitude-dead)/(1-dead);
    state.axes=length>0?[dx/length*power,dy/length*power]:[0,0];
    // Remove incidental drift near each cardinal axis. A radial deadzone alone
    // still reports tiny sideways/backward values, changing native speed rules.
    state.axes=state.axes.map(v=>Math.abs(v)<.08?0:Math.round(v*400)/400);
    syncMovement();
    updateSprint();
    positionKnob(length?dx/length*Math.min(length,radius):0,length?dy/length*Math.min(length,radius):0);
  }
  $('move-zone').addEventListener('pointerdown',e=>{
    stopEvent(e);if(!isPlaying()||move||e.button!==0)return;capture($('move-zone'),e);
    // Touching the joystick takes manual control, even after releasing a locked run.
    cancelAutoRun();
    const zone=$('move-zone').getBoundingClientRect(),pad=58*cfg.scale;
    const x=Math.max(zone.left+pad,Math.min(zone.right-pad,e.clientX)),y=Math.max(zone.top+pad,Math.min(zone.bottom-pad,e.clientY));
    move={id:e.pointerId,x,y};$('stick').style.left=(x-zone.left)+'px';$('stick').style.top=(y-zone.top)+'px';updateMove(e);
  });
  // Touch delivery can exceed display refresh. Process the latest joystick
  // sample once per frame instead of rebuilding movement and repainting the
  // overlay for every sub-frame finger tremor. Other touch controls stay direct.
  $('move-zone').addEventListener('pointermove',e=>{
    stopEvent(e);
    if(move?.id===e.pointerId)pendingMove={pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY};
  });
  const endMove=e=>{stopEvent(e);if(move?.id===e.pointerId){
    pendingMove=null;
    move=null;
    if(e.type==='pointerup'&&state.autoRun&&isPlaying()&&!state.ads){
      state.axes=[0,-1];syncMovement();resetStick();
      positionKnob(0,-52*cfg.scale);
    }else{cancelAutoRun();resetStick();}
  }};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$('move-zone').addEventListener(event,endMove);

  function menuPosition(e) {
    if(!engine())return;const r=$('canvas').getBoundingClientRect();
    getWasmTableEntry(FTEC.evcb.mouse)(0,1,(e.clientX-r.left)*$('canvas').width/r.width,(e.clientY-r.top)*$('canvas').height/r.height,0,0);
  }
  $('menu-hit-area').addEventListener('pointerdown',e=>{
    stopEvent(e);if(!state.ready||state.mode!=='menu'||state.settings||state.texting||menuPointer!==null)return;
    capture($('menu-hit-area'),e);menuPointer=e.pointerId;menuPosition(e);if(engine())getWasmTableEntry(FTEC.evcb.button)(0,1,0);else if(state.previewOnly)record('Toque de menú (prueba, sin motor)');
  });
  $('menu-hit-area').addEventListener('pointermove',e=>{stopEvent(e);if(menuPointer===e.pointerId)menuPosition(e);});
  const endMenu=e=>{stopEvent(e);if(menuPointer!==e.pointerId)return;menuPosition(e);if(engine())getWasmTableEntry(FTEC.evcb.button)(0,0,0);menuPointer=null;};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$('menu-hit-area').addEventListener(event,endMenu);

  for(const button of document.querySelectorAll('[data-key]')) {
    button.addEventListener('pointerdown',e=>{
      stopEvent(e);if(!state.ready||state.settings||state.editing)return;capture(button,e);
      const code=Number(button.dataset.key);tapKey(code);vibrate();
      if(code>=37&&code<=40) {
        const repeat=()=>{if(!menuTimers.has(code))return;tapKey(code);menuTimers.set(code,setTimeout(repeat,130));};
        menuTimers.set(code,setTimeout(repeat,380));
      }
    });
    const end=e=>{stopEvent(e);const code=Number(button.dataset.key);clearTimeout(menuTimers.get(code));menuTimers.delete(code);};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,end);
  }
  $('native-menu').onclick=()=>{if(!state.ready)return;releaseAll();if(state.previewOnly){showMode(state.mode==='game'?'menu':'game');return;}tapKey(27);};
  $('scores').onclick=()=>{if(isPlaying())command('showscores');};
  $('text-open').onclick=()=>{releaseAll();state.texting=true;$('text-entry').hidden=false;$('text-value').value='';$('text-value').focus();};
  const closeText=()=>{state.texting=false;$('text-entry').hidden=true;$('text-value').blur();};
  $('text-close').onclick=closeText;
  $('text-backspace').onclick=()=>tapKey(8);
  $('text-send').onclick=()=>{
    const value=$('text-value').value;
    if(engine())for(const character of value){const code=character.codePointAt(0);getWasmTableEntry(FTEC.evcb.key)(0,1,0,code);getWasmTableEntry(FTEC.evcb.key)(0,0,0,code);}
    closeText();
  };

  function openSettings() {
    if(!state.ready)return;
    state.resumeAfterSettings=state.mode==='game';releaseAll();
    if(state.resumeAfterSettings){if(state.previewOnly)showMode('menu');else tapKey(27);}
    state.settings=true;$('settings').hidden=false;apply();showMode(state.mode);
  }
  function closeSettings() {
    if(!state.settings)return;save();releaseAll();state.settings=false;$('settings').hidden=true;
    if(state.resumeAfterSettings){if(state.previewOnly)showMode('game');else tapKey(27);}state.resumeAfterSettings=false;showMode(state.mode);
  }
  $('settings-open').onclick=openSettings;$('settings-close').onclick=closeSettings;$('settings-done').onclick=closeSettings;
  for(const name of ['sensitivity','adsSensitivity','scale','opacity'])$(name).oninput=()=>{cfg[name]=Number($(name).value);apply();save();};
  for(const name of ['leftHand','invertY','toggleAds','labels','haptics'])$(name).onchange=()=>{releaseAll();cfg[name]=$(name).checked;apply();save();};
  $('reset').onclick=()=>{releaseAll();cfg=structuredClone(defaults);apply();save();toast('Distribución y sensibilidad restablecidas');};
  $('edit-layout').onclick=()=>{
    releaseAll();state.editing=true;$('settings').hidden=true;$('stage').classList.add('editing');$('edit-banner').hidden=false;
    $('game-controls').hidden=false;$('menu-controls').hidden=true;$('look-zone').hidden=true;apply();
  };
  $('edit-done').onclick=()=>{
    releaseAll();state.editing=false;$('stage').classList.remove('editing');$('edit-banner').hidden=true;$('settings').hidden=false;save();showMode(state.mode);
  };

  function syncCanvas() {
    if(!state.ready||state.previewOnly||!engine())return;
    const canvas=$('canvas'),r=$('stage').getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    const width=Math.max(1,Math.round(r.width*dpr)),height=Math.max(1,Math.round(r.height*dpr));
    // Bypass Emscripten's fullscreen screen.width/screen.height fit: Android
    // can report those in the previous orientation and add a bottom strip.
    canvas.style.setProperty('width','100%','important');canvas.style.setProperty('height','100%','important');
    const changed=canvas.width!==width||canvas.height!==height;
    canvas.widthNative=width;canvas.heightNative=height;
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    if(changed&&FTEC.evcb.resize)getWasmTableEntry(FTEC.evcb.resize)(width,height,dpr);
  }
  function queueResize() {
    if(resizeQueued)return;resizeQueued=true;
    requestAnimationFrame(()=>{resizeQueued=false;syncCanvas();apply();orientation();});
  }
  $('fullscreen').onclick=async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else {await $('stage').requestFullscreen({navigationUI:'hide'});try{await screen.orientation.lock('landscape');}catch{}}
      queueResize();
    }catch{toast('Pantalla completa no disponible en este navegador.');}
  };
  function orientation() { const r=$('stage').getBoundingClientRect();$('orientation-hint').hidden=!state.ready||r.width>=r.height||dismissedPortrait||state.settings; }
  $('orientation-dismiss').onclick=()=>{dismissedPortrait=true;orientation();};
  window.addEventListener('resize',()=>{releaseAll();queueResize();});
  window.visualViewport?.addEventListener('resize',queueResize);
  document.addEventListener('fullscreenchange',()=>{releaseAll();queueResize();setTimeout(queueResize,180);});
  window.addEventListener('orientationchange',()=>{releaseAll();queueResize();setTimeout(queueResize,250);});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(queueResize).observe($('stage'));
  // Loading is automatic. Sound still requires the browser's first real user gesture.
  document.addEventListener('pointerdown',()=>{
    if(typeof AL!=='undefined')for(const context of Object.values(AL.contexts||{})){
      if(context.audioCtx?.state==='suspended')context.audioCtx.resume().catch(()=>{});
    }
  },true);
  window.addEventListener('blur',releaseAll);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){const wasGame=isPlaying();releaseAll();if(wasGame)tapKey(27);}
  });
  // Stop native touch/mouse handling on the overlay; no duplicate attacks or pointer lock requests.
  for(const event of ['touchstart','touchmove','touchend','touchcancel','mousedown','mouseup','mousemove','contextmenu']) {
    $('input-layer').addEventListener(event,e=>{e.stopPropagation();if(event==='contextmenu')e.preventDefault();},{passive:false});
  }
  for(const event of ['keydown','keyup','keypress'])window.addEventListener(event,e=>{
    if(state.settings||state.texting){e.stopImmediatePropagation();if(e.key==='Escape'&&event==='keydown'){e.preventDefault();if(state.texting)closeText();else if(state.editing)$('edit-done').click();else closeSettings();}}
  },true);

  // The shipped configuration disables vsync and permits 500 engine frames/s.
  // On web, vid_vsync=1 selects requestAnimationFrame instead of setTimeout(0).
  // Keep native resolution/assets; avoid rendering several unseen frames per refresh.
  const startupCommands = 'vid_vsync 1; cl_maxfps 0; in_windowed_mouse 1; sensitivity 3; m_filter 0; joyadvaxisx moveright; joyadvaxisy moveback; joyforwardsensitivity 1; joysidesensitivity 1; joyforwardthreshold 0; joysidethreshold 0; joyexponent 1; bind r +button5; bind v +button6; bind 1 +button4; bind e +button7';
  function fail(text) {
    state.error=String(text);state.ready=false;releaseAll();$('welcome').hidden=false;$('welcome').classList.add('failed');$('start').hidden=false;$('start').disabled=false;$('start').textContent='Reintentar';$('start').onclick=()=>location.reload();
    $('boot-status').textContent='No se pudo iniciar: '+String(text).slice(0,240);$('input-layer').hidden=true;
  }
  const logs=[];
  window.Module={
    files:{'default.fmf':'default.fmf','nzp/game.pk3':'nzp/game.pk3','nzp/progs.pk3':'nzp/progs.pk3'},
    canvas:$('canvas'),
    print:message=>{console.log(message);logs.push(String(message));if(logs.length>100)logs.shift();},
    printErr:message=>{console.error(message);logs.push(String(message));if(logs.length>100)logs.shift();},
    setStatus:text=>{
      if(!text)return;
      $('boot-status').textContent=text;
      const m=String(text).match(/([^(]+)\((\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\)/);
      if(m){$('progress').hidden=false;$('progress').value=Number(m[2])*100/Math.max(1,Number(m[3]));}
    },
    totalDependencies:0,
    monitorRunDependencies(left){this.totalDependencies=Math.max(this.totalDependencies,left);this.setStatus(left?`Preparando (${this.totalDependencies-left}/${this.totalDependencies})`:'Iniciando motor…');},
    onAbort:reason=>fail(reason),
    postRun:[()=>{
      let tries=0;
      const wait=setInterval(()=>{
        if(engine()){
          clearInterval(wait);
          // This published FTE artifact references _free but exports only the builtin free alias.
          // Restore the public alias without changing the WASM or leaking every command buffer.
          if(typeof _free==='undefined'&&typeof Module._emscripten_builtin_free==='function')window._free=Module._emscripten_builtin_free;
          state.ready=true;command(startupCommands);
          // Allocate the virtual controller; FTE allocates on the first extreme value, discarding that event.
          axis(0,1);axis(0,0);axis(1,0);
          // Replace the engine's screen-fit resize hook with viewport sizing.
          window.onresize=syncCanvas;
          $('welcome').hidden=true;$('input-layer').hidden=false;showMode(FTEC.pointerwantlock?'game':'menu');syncCanvas();apply();orientation();
        }else if(++tries>100){clearInterval(wait);fail('El motor no registró sus entradas.');}
      },100);
    }]
  };
  function previewControls() {
    state.previewOnly=true;state.ready=true;state.error=null;$('welcome').hidden=true;$('input-layer').hidden=false;$('preview-status').hidden=false;$('stage').classList.add('preview-only');
    showMode('game');apply();orientation();
  }
  $('start').onclick=async()=>{
    if(state.started)return;state.started=true;$('start').hidden=true;$('start').disabled=true;$('boot-status').textContent='Cargando…';
    // Probe support BEFORE downloading/starting FTE, so the restricted preview cannot crash.
    try { await WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0])); }
    catch {
      state.started=false;$('welcome').classList.add('failed');$('start').hidden=false;$('start').disabled=false;$('start').textContent='Probar botones';$('start').onclick=previewControls;
      $('boot-status').textContent='El visor no permite ejecutar el motor. Abre la web pública para jugar.';
      return;
    }
    const script=document.createElement('script');script.src='ftewebgl.js';script.onerror=()=>fail('No se pudo cargar ftewebgl.js.');document.head.appendChild(script);
  };
  window.addEventListener('error',event=>{if(state.started&&!state.ready)fail(event.message||'Error del motor');});
  function frame() {
    if(pendingMove){const sample=pendingMove;pendingMove=null;if(isPlaying())updateMove(sample);}
    if(state.ready&&engine()) {
      const mode=FTEC.pointerwantlock?'game':'menu';
      if(state.mode!==mode)showMode(mode);
      // Native held keys persist until release; do not rebuild an unchanged
      // diagonal on every frame. Movement is committed by joystick events.
    }
    requestAnimationFrame(frame);
  }
  apply();save();frame();
  // Exposed for diagnostics and reproducible input tests; does not invent gameplay state.
  window.NZPTouch={state,logs,releaseAll,getConfig:()=>structuredClone(cfg),engineAvailable:()=>!!engine(),openSettings,closeSettings,syncCanvas};
  $('start').onclick();
})();
