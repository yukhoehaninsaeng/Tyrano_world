

// ══════════════════════════════════════════
// renderRooms: 카테고리 헤더 (참여중 / 미참여)
// ══════════════════════════════════════════
function renderRooms(){
  const q=document.getElementById('searchInp').value.trim().toLowerCase();
  const joined=loadJoined();
  const joinedRooms=rooms.filter(r=>joined.includes(r.id)&&r.name.toLowerCase().includes(q));
  const otherRooms=rooms.filter(r=>!joined.includes(r.id)&&r.name.toLowerCase().includes(q));

  function roomItemHtml(r){
    return `
      <div class="room-item${activeRoom===r.id?' active':''}" onclick="openRoom('${r.id}')">
        <div class="room-item-body">
          <div class="ri-top"><span class="ri-name">${r.visibility==='secret'?'🔒 ':''}${r.name}</span></div>
          <div class="ri-preview">${r.preview}</div>
        </div>
        <button class="room-kebab" onclick="openRoomDropdown(event,'${r.id}')" title="메뉴">⋮</button>
      </div>`;
  }

  let html='';

  // ── 참여중인 놀이터 ──
  html+=`<div class="sb-cat-header">
    <span class="sb-cat-icon">🏠</span>
    <span class="sb-cat-name">참여중인 놀이터</span>
    <span class="sb-cat-cnt">${joinedRooms.length}</span>
  </div>`;
  if(joinedRooms.length){
    html+=joinedRooms.map(roomItemHtml).join('');
  }else{
    html+=`<div class="sb-cat-empty">아직 참여한 방이 없어요</div>`;
  }

  // ── 재밌는 놀이터 ──
  html+=`<div class="sb-cat-header sb-cat-header--gap">
    <span class="sb-cat-icon">🌐</span>
    <span class="sb-cat-name">재밌는 놀이터</span>
    <span class="sb-cat-cnt">${otherRooms.length}</span>
  </div>`;
  if(otherRooms.length){
    html+=otherRooms.map(roomItemHtml).join('');
  }else{
    html+=`<div class="sb-cat-empty">모든 방에 참여 중이에요 🎉</div>`;
  }

  document.getElementById('roomList').innerHTML=html;
}

function renderXlSheets(){
  document.getElementById('xlSheets').innerHTML=rooms.map(r=>`
    <div class="xl-sheet-item${activeRoom===r.id?' active':''}" onclick="openRoom('${r.id}')">
      <span class="xl-sheet-dot" style="background:${ac(r.name)}"></span>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${r.name}</span>
    </div>`).join('');
}
function renderNpSide(){
  document.getElementById('npSideList').innerHTML=rooms.map(r=>`
    <div class="np-sb-item${activeRoom===r.id?' active':''}" onclick="openRoom('${r.id}')">
      <span class="np-sb-item-dot" style="background:${ac(r.name)}"></span># ${r.name}
    </div>`).join('');
}

function openBrowseModal(){
  const joined=loadJoined();
  const others=rooms.filter(r=>!joined.includes(r.id));
  const overlay=document.createElement('div');
  overlay.className='browse-overlay';overlay.id='browseModal';
  overlay.onclick=e=>{if(e.target===overlay)closeBrowseModal();};
  let cardsHtml='';
  if(!others.length){
    cardsHtml=`<div class="browse-empty">🎉 모든 방에 이미 참여 중이에요!<br>새 방을 만들어보세요.</div>`;
  }else{
    cardsHtml=`<div class="browse-grid">${others.map(r=>`
      <div class="browse-card">
        <div class="browse-card-name">
          ${r.visibility==='secret'?'🔒':'🌐'} ${r.name}
          <span class="browse-card-badge ${r.visibility==='secret'?'secret':'open'}">${r.visibility==='secret'?'비밀':'오픈'}</span>
        </div>
        <div class="browse-card-preview">${r.preview}</div>
        <div class="browse-card-owner">
          <div class="browse-card-owner-av" style="background:${ac(r.owner_name||'?')}">${ini(r.owner_name||'?')}</div>
          👑 ${r.owner_name||'알 수 없음'}
        </div>
        <button class="browse-card-enter" onclick="closeBrowseModal();openRoom('${r.id}')">입장하기 →</button>
      </div>`).join('')}</div>`;
  }
  overlay.innerHTML=`
    <div class="browse-modal">
      <div class="browse-header">
        <h2>🌐 재밌는 놀이터</h2>
        <button class="browse-close" onclick="closeBrowseModal()">✕</button>
      </div>
      <div class="browse-body">${cardsHtml}</div>
    </div>`;
  document.body.appendChild(overlay);
}
function closeBrowseModal(){const el=document.getElementById('browseModal');if(el)el.remove();}

async function openRoom(id,skipCheck=false){
  const r=rooms.find(x=>x.id===id);if(!r)return;
  if(!skipCheck&&r.visibility==='secret'){
    const {data}=await sb.from('rooms').select('passcode').eq('id',id).single();
    if(data&&data.passcode&&getPasscode(id)!==data.passcode){
      pendingRoomId=id;
      document.getElementById('passcodeModalSub').textContent=`"${r.name}" 방은 암호가 설정되어 있습니다.`;
      document.getElementById('passcodeCheckInp').value='';
      document.getElementById('passcodeErr').style.display='none';
      document.getElementById('passcodeModal').style.display='flex';
      setTimeout(()=>document.getElementById('passcodeCheckInp').focus(),100);
      return;
    }
  }
  activeRoom=id;
  addJoined(id);
  localStorage.setItem(LAST_ROOM_KEY,id);
  if(window.innerWidth<=768)closeSidebar();
  document.getElementById('welcomeScreen').style.display='none';
  document.getElementById('chatScreen').style.display='flex';
  document.getElementById('roomTitle').textContent=r.name;
  const sub=document.getElementById('roomSub');sub.textContent=r.visibility==='secret'?'🔒 비밀방':'오픈방';sub.style.display='';
  document.getElementById('xlTitle').textContent='SpreadChat — '+r.name+'.xlsx';
  document.getElementById('xlStatRoom').textContent='시트: '+r.name;
  const atab=document.getElementById('xlActiveTab');if(atab)atab.textContent=r.name;
  document.getElementById('npTitleText').textContent='*'+r.name+' - TyranoPad';
  document.getElementById('npTabLabel').textContent=r.name.replace(/\s/g,'_')+'.log';
  document.getElementById('npStatRoom').textContent=r.name;
  renderAllSides();
  await loadMessages(id);
  subscribeRoom(id);
  await sendMsg(`${myNick}님이 채팅방에 입장하셨습니다 👋`,true);
}

function closePasscodeModal(){document.getElementById('passcodeModal').style.display='none';document.getElementById('passcodeCheckInp').value='';document.getElementById('passcodeErr').style.display='none';pendingRoomId=null;}
async function confirmPasscode(){
  const entered=document.getElementById('passcodeCheckInp').value.trim();if(!pendingRoomId)return;
  const {data}=await sb.from('rooms').select('passcode').eq('id',pendingRoomId).single();
  if(!data||data.passcode!==entered){document.getElementById('passcodeErr').style.display='block';document.getElementById('passcodeCheckInp').value='';document.getElementById('passcodeCheckInp').focus();return;}
  savePasscode(pendingRoomId,entered);
  const rid=pendingRoomId;closePasscodeModal();openRoom(rid,true);
}
document.getElementById('passcodeCheckInp').addEventListener('keydown',e=>{if(e.key==='Enter')confirmPasscode()});

function renderCurrentLayout(){
  if(!activeRoom)return;
  if(currentLayout==='bubble')renderBubble(activeRoom);
  else if(currentLayout==='excel')renderExcel(activeRoom);
  else if(currentLayout==='notepad')renderNotepad(activeRoom);
}

function renderBubble(id){
  const list=msgsData[id]||[];
  const room=rooms.find(x=>x.id===id);
  const owner=room?.owner_name||'';
  const el=document.getElementById('msgs');if(!el)return;
  let h='<div class="day-sep">오늘</div><div class="sys-notice">모든 채팅 내용은 밤 12시가 되면 초기화됩니다.</div>';
  list.forEach((m,i)=>{
    if(m.sys||m.u==='SYSTEM'){h+=`<div style="display:flex;justify-content:center;margin:6px 0"><span class="sys-join">${m.msg}</span></div>`;return;}
    const me=m.u===myNick,prev=list[i-1],next=list[i+1];
    const pReal=prev&&(prev.sys||prev.u==='SYSTEM')?null:prev;
    const nReal=next&&(next.sys||next.u==='SYSTEM')?null:next;
    const first=!pReal||pReal.u!==m.u,last=!nReal||nReal.u!==m.u;
    const isOwner=owner&&m.u===owner;
    let cls=me?'m':'o';
    if(!first&&!last)cls+=' mid';else if(!first&&last)cls+=' bot';
    const bStyle=me?`style="background:${myBubbleColor}"`:'';
    const crownHtml=isOwner?`<span class="av-crown">👑</span>`:'';
    const avWrap=`<div class="av-wrap${last?'':' h'}"><div class="av" style="background:${ac(m.u)}">${ini(m.u)}</div>${crownHtml}</div>`;
    const snCrown=isOwner?` <span style="font-size:10px">👑</span>`:'';
    const sn=(!me&&first)?`<div class="sname" style="color:${ac(m.u)}">${m.u}${snCrown}</div>`:'';
    const bm=`<div class="bmeta"><div class="bubble ${cls}" ${bStyle}>${m.msg}</div><div class="mc">${last?`<div class="ts">${m.t}</div>`:''}</div></div>`;
    const bw=`<div class="bwrap">${sn}${bm}</div>`;
    h+=`<div class="msg-row${first?' first':''}${me?' me':''}">${me?`${bw}${avWrap}`:`${avWrap}${bw}`}</div>`;
  });
  el.innerHTML=h;el.scrollTop=el.scrollHeight;
}

function renderExcel(id){
  const list=(msgsData[id]||[]).filter(m=>!m.sys&&m.u!=='SYSTEM');
  document.getElementById('xlRowNums').innerHTML=list.map((_,i)=>`<div class="xl-rn">${i+1}</div>`).join('');
  document.getElementById('xlRows').innerHTML=list.map((m,i)=>`
    <div class="xl-row${m.u===myNick?' selected':''}" onclick="document.getElementById('xlCellRef').textContent='D${i+1}';document.getElementById('xlFval').textContent='${m.msg.replace(/'/g,"\\'").replace(/</g,'&lt;')}'">
      <div class="xl-cell a">${m.u===myNick?'●':'○'}</div>
      <div class="xl-cell b" style="color:${ac(m.u)}">${m.u}</div>
      <div class="xl-cell c">${m.t}</div>
      <div class="xl-cell d">${m.msg}</div>
      <div class="xl-cell e">${i+1}행</div>
      <div class="xl-cell f">${i+1}</div>
    </div>`).join('');
  document.getElementById('xlStatCount').textContent='행: '+list.length;
  document.getElementById('xlRows').scrollTop=999999;
}

function uCls(u){if(u===myNick)return'c-me';const h=u.split('').reduce((a,c)=>a+c.charCodeAt(0),0);return['c-u1','c-u2','c-u3','c-u4'][h%4]}
function renderNotepad(id){
  const list=msgsData[id]||[];
  const real=list.filter(m=>!m.sys&&m.u!=='SYSTEM');
  document.getElementById('npLnum').innerHTML=real.map((_,i)=>`<div class="np-ln">${i+1}</div>`).join('');
  document.getElementById('npEditor').innerHTML=list.length===0
    ?'<div class="np-line"><span class="c-comment">// 메시지가 없습니다</span></div>'
    :list.map(m=>{
      if(m.sys||m.u==='SYSTEM')return`<div class="np-line"><span class="c-comment">// ${m.msg}</span></div>`;
      return`<div class="np-line"><span class="c-bracket">[</span><span class="c-time">${m.t}</span><span class="c-bracket">]</span>&nbsp;<span class="${uCls(m.u)}">${m.u}</span><span class="c-arrow"> → </span><span class="${m.u===myNick?'c-me-msg':'c-msg'}">${m.msg}</span></div>`;
    }).join('');
  document.getElementById('npEditor').scrollTop=999999;
  document.getElementById('npNextLn').textContent=real.length+1;
  document.getElementById('npStatCount').textContent=real.length+' lines';
  document.getElementById('npStatLn').textContent='Ln: '+(real.length+1)+'  Col: 1';
}

async function doSend(inputId){
  const inp=document.getElementById(inputId);
  if(!inp)return;
  const v=inp.value.trim();
  if(!v)return;
  inp.value='';
  await sendMsg(v,false);
}
document.getElementById('sendBtn').onclick=()=>doSend('msgInp');
document.getElementById('xlSendBtn').onclick=()=>doSend('xlInp');
document.getElementById('npSendBtn').onclick=()=>doSend('npInp');
document.getElementById('msgInp').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend('msgInp');}});
document.getElementById('xlInp').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend('xlInp');}});
document.getElementById('npInp').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend('npInp');}});

function showDialog(){document.getElementById('dialog').style.display='flex'}
function hideDialog(){
  document.getElementById('dialog').style.display='none';
  document.getElementById('roomNameInp').value='';document.getElementById('passcodeInp').value='';
  document.getElementById('passcodeWrap').style.display='none';
  visMode='open';document.getElementById('visOpen').classList.add('sel');document.getElementById('visSecret').classList.remove('sel');
}
async function createRoom(){
  const n=document.getElementById('roomNameInp').value.trim();if(!n)return;
  const pw=visMode==='secret'?document.getElementById('passcodeInp').value.trim():'';
  if(visMode==='secret'&&pw.length<4){alert('암호는 최소 4자 이상이어야 합니다.');return;}
  const btn=document.getElementById('dCreate');btn.textContent='생성 중...';btn.disabled=true;
  const {data,error}=await sb.from('rooms').insert({title:n,visibility:visMode,passcode:pw||null,owner_name:myNick}).select().single();
  btn.textContent='만들기';btn.disabled=false;
  if(error){alert('방 생성 실패: '+error.message);return;}
  if(data.passcode)savePasscode(data.id,data.passcode);
  hideDialog();
  if(!rooms.some(r=>r.id===data.id))
    rooms.unshift({id:data.id,name:data.title,visibility:data.visibility,passcode:data.passcode||null,owner_name:data.owner_name||myNick,preview:'방이 생성되었어요!',cnt:0});
  renderAllSides();
  openRoom(data.id,true);
}
document.getElementById('addBtn').onclick=showDialog;
document.getElementById('wCreate').onclick=showDialog;
document.getElementById('wBrowse').onclick=openBrowseModal;
document.getElementById('dCancel').onclick=hideDialog;
document.getElementById('dCreate').onclick=createRoom;
document.getElementById('roomNameInp').addEventListener('keydown',e=>{if(e.key==='Enter')createRoom()});
document.getElementById('searchInp').addEventListener('input',renderRooms);
document.getElementById('visOpen').onclick=function(){visMode='open';this.classList.add('sel');document.getElementById('visSecret').classList.remove('sel');document.getElementById('passcodeWrap').style.display='none';document.getElementById('passcodeInp').value='';};
document.getElementById('visSecret').onclick=function(){visMode='secret';this.classList.add('sel');document.getElementById('visOpen').classList.remove('sel');document.getElementById('passcodeWrap').style.display='block';setTimeout(()=>document.getElementById('passcodeInp').focus(),50);};

function selectLayout(layout){
  currentLayout=layout;localStorage.setItem(LAYOUT_KEY,layout);
  document.getElementById('appBubble').style.display=layout==='bubble'?'flex':'none';
  document.getElementById('appExcel').style.display=layout==='excel'?'flex':'none';
  document.getElementById('appNotepad').style.display=layout==='notepad'?'flex':'none';
  ['bubble','notepad','excel'].forEach(l=>{
    const card=document.getElementById('card'+l[0].toUpperCase()+l.slice(1));
    const badge=document.getElementById('badge'+l[0].toUpperCase()+l.slice(1));
    if(card)card.classList.toggle('active',l===layout);
    if(badge)badge.style.display=l===layout?'':'none';
  });
  ['Bubble','Notepad','Excel'].forEach(l=>{const b=document.getElementById('lmBadge'+l);if(b)b.style.display=l.toLowerCase()===layout?'inline':'none';});
  const names={bubble:'말풍선',notepad:'메모장',excel:'엑셀'};
  const lb=document.getElementById('layoutBadge');if(lb)lb.textContent=names[layout]||layout;
  if(activeRoom)renderCurrentLayout();closeSettings();
}

function openSettings(tab='layout'){document.getElementById('settingsModal').style.display='flex';switchSettingsTab(tab,null);}
function closeSettings(){document.getElementById('settingsModal').style.display='none'}
function switchSettingsTab(tab,el){
  document.querySelectorAll('.settings-nav-item').forEach(x=>x.classList.remove('active'));
  if(el)el.classList.add('active');
  else{const items=document.querySelectorAll('.settings-nav-item');if(tab==='layout'&&items[0])items[0].classList.add('active');else if(tab==='color'&&items[1])items[1].classList.add('active');}
  document.getElementById('tabLayout').style.display=tab==='layout'?'block':'none';
  document.getElementById('tabColor').style.display=tab==='color'?'block':'none';
}
document.getElementById('settingsBtn').onclick=()=>openSettings('layout');
document.getElementById('settingsBtn2').onclick=()=>openSettings('layout');
document.getElementById('layoutSettingsBtn').onclick=()=>openSettings('layout');
document.getElementById('settingsClose').onclick=closeSettings;
document.getElementById('settingsModal').onclick=function(e){if(e.target===this)closeSettings()};
function openLayoutModal(){document.getElementById('layoutModal').style.display='flex'}
function closeLayoutModal(){document.getElementById('layoutModal').style.display='none'}
document.getElementById('layoutModal').onclick=function(e){if(e.target===this)closeLayoutModal()}

function renderSwatches(){
  document.getElementById('bubbleSwatches').innerHTML=BUBBLE_PALETTE.map(c=>`
    <div style="width:26px;height:26px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${c===myBubbleColor?'#fff':'transparent'};transition:transform .15s"
      onclick="setBubbleColor('${c}')" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform=''"></div>`).join('');
}
function setBubbleColor(c){myBubbleColor=c;localStorage.setItem(BUBBLE_COLOR_KEY,c);document.querySelectorAll('.bubble.m').forEach(el=>el.style.background=c);renderSwatches();}
renderSwatches();

if(isLight)document.getElementById('appBubble').classList.add('light');
const themeBtn=document.getElementById('themeToggleBtn');
themeBtn.textContent=isLight?'🌙':'☀️';
themeBtn.onclick=function(){
  isLight=!isLight;
  document.getElementById('appBubble').classList.toggle('light',isLight);
  localStorage.setItem(THEME_KEY,isLight?'light':'dark');
  this.textContent=isLight?'🌙':'☀️';
  this.style.transform='scale(1.35)';
  setTimeout(()=>{this.style.transform='';},180);
};

selectLayout(currentLayout);
(async()=>{
  await loadRooms();
  const lastId=localStorage.getItem(LAST_ROOM_KEY);
  if(lastId&&rooms.some(r=>r.id===lastId))await openRoom(lastId,false);
})();
