const SUPABASE_URL='https://kycisbrdvjmqgciwhhvo.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y2lzYnJkdmptcWdjaXdoaHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDQzNjQsImV4cCI6MjA4OTE4MDM2NH0.zyXAAwtMf6KMVwCyk9OB_7ytsQtOK2jDd8fTSmevvEA';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false}});

// ── localStorage 키 ──
const STORAGE_KEY        ='tyrano_visited_v1';
const NICK_KEY           ='tyrano_nickname_v1';
const LAYOUT_KEY         ='tyrano_layout_v1';
const BUBBLE_COLOR_KEY   ='tyrano_bubblecolor_v1';
const THEME_KEY          ='tyrano_theme_v1';
const LAST_ROOM_KEY      ='tyrano_last_room_v1';
const ROOM_PASSCODES_KEY ='tyrano_room_passcodes_v1';
const JOINED_ROOMS_KEY   ='tyrano_joined_rooms_v1';

const AV_COLORS=['#e8734a','#4a9ee8','#4ac674','#c64ab8','#e8c44a','#4ab8c6','#9f3060','#7a4ac6'];
const BUBBLE_PALETTE=['#9f3060','#217346','#1565c0','#6a1b9a','#e65100','#4a148c','#1b5e20','#37474f'];

function ac(n){let h=0;for(let i=0;i<n.length;i++)h=n.charCodeAt(i)+((h<<5)-h);return AV_COLORS[Math.abs(h)%AV_COLORS.length]}
function ini(n){return(n||'?').trim()[0].toUpperCase()}
function fmtTime(iso){return new Date(iso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}
function rnd(){const a=['졸린','배고픈','신나는','수줍은','당당한'],b=['티라노','공룡','스테고','프테라'];return a[~~(Math.random()*a.length)]+b[~~(Math.random()*b.length)]+(~~(Math.random()*900)+100)}

let myNick='';
let myBubbleColor=localStorage.getItem(BUBBLE_COLOR_KEY)||'#9f3060';
let currentLayout=localStorage.getItem(LAYOUT_KEY)||'bubble';
let isLight=localStorage.getItem(THEME_KEY)==='light';
let activeRoom=null, visMode='open';
let rooms=[], msgsData={}, msgChannel=null, pendingRoomId=null;
let currentDropdownRoomId=null;

// ── 암호 저장 ──
function loadPasscodes(){try{return JSON.parse(localStorage.getItem(ROOM_PASSCODES_KEY))||{};}catch{return{}}}
function savePasscode(id,pw){const m=loadPasscodes();m[id]=pw;localStorage.setItem(ROOM_PASSCODES_KEY,JSON.stringify(m))}
function getPasscode(id){return loadPasscodes()[id]||null}

// ── 참여 방 저장 ──
function loadJoined(){try{return JSON.parse(localStorage.getItem(JOINED_ROOMS_KEY))||[];}catch{return[]}}
function saveJoined(ids){localStorage.setItem(JOINED_ROOMS_KEY,JSON.stringify(ids))}
function addJoined(id){const j=loadJoined();if(!j.includes(id)){j.unshift(id);saveJoined(j)}}
function removeJoined(id){saveJoined(loadJoined().filter(x=>x!==id))}
function isJoined(id){return loadJoined().includes(id)}

// ── 닉네임 ──
function applyNick(nick){
  myNick=nick||rnd();
  localStorage.setItem(NICK_KEY,myNick);
  const c=ac(myNick),i=ini(myNick);
  ['myAv','inpAv','xlMyAv','npMyAv'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent=i;el.style.background=c;}});
  ['myName','xlMyName','npMyName'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=myNick;});
  document.getElementById('xlInpName').textContent=myNick;
  document.getElementById('npPrefix').textContent='['+myNick+'] → ';
}

// ── 초대장 ──
const invScreen=document.getElementById('inviteScreen');
function enterApp(){invScreen.classList.add('fading');setTimeout(()=>invScreen.style.display='none',400)}
(async()=>{
  const {count}=await sb.from('rooms').select('*',{count:'exact',head:true});
  const el=document.getElementById('invRoomCnt');if(el&&count!=null)el.textContent=count;
})();
if(localStorage.getItem(STORAGE_KEY)){
  invScreen.style.display='none';applyNick(localStorage.getItem(NICK_KEY)||'');
}else{
  applyNick('');
  document.getElementById('invNextBtn').onclick=()=>{
    document.getElementById('invMain').classList.add('hide');
    document.getElementById('invNick').classList.add('show');
    setTimeout(()=>document.getElementById('nickInput').focus(),100);
  };
  function doEnter(){applyNick(document.getElementById('nickInput').value.trim());localStorage.setItem(STORAGE_KEY,'1');enterApp();}
  document.getElementById('invEnterBtn').onclick=doEnter;
  document.getElementById('nickInput').addEventListener('keydown',e=>{if(e.key==='Enter')doEnter()});
  document.getElementById('nickSkip').onclick=()=>{applyNick('');localStorage.setItem(STORAGE_KEY,'1');enterApp()};
}

// ── 모바일 사이드바 ──
function openSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('sbDimmer').classList.add('show');document.getElementById('sidebarCloseBtn').style.display='';}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sbDimmer').classList.remove('show');}
window.addEventListener('resize',()=>{if(window.innerWidth>768)closeSidebar();document.getElementById('sidebarCloseBtn').style.display=window.innerWidth<=768?'':'none';});

// ── 드롭다운 (⋮) ──
function openRoomDropdown(e,roomId){
  e.stopPropagation();
  closeDropdown();
  const r=rooms.find(x=>x.id===roomId);if(!r)return;
  currentDropdownRoomId=roomId;
  const isOwner=myNick===r.owner_name;
  const dd=document.createElement('div');
  dd.className='room-dropdown';dd.id='roomDropdown';
  const ownerAv=`<div class="dd-owner-av" style="background:${ac(r.owner_name||'?')}"><span class="dd-crown">👑</span>${ini(r.owner_name||'?')}</div>`;
  dd.innerHTML=`
    <div class="dd-owner-row">${ownerAv}<span>방장: <b>${r.owner_name||'알 수 없음'}</b></span></div>
    <div class="dd-sep"></div>
    <div class="dd-item" onclick="leaveRoom()"><span>🚪</span> 방 나가기</div>
    ${isOwner?`<div class="dd-item danger" onclick="deleteRoom('${roomId}')"><span>🗑️</span> 방 삭제하기</div>`:''}
  `;
  document.body.appendChild(dd);
  const btn=e.currentTarget;
  const rect=btn.getBoundingClientRect();
  const ddW=170,ddH=dd.offsetHeight||120;
  let top=rect.bottom+4,left=rect.left-ddW+rect.width;
  if(top+ddH>window.innerHeight-8)top=rect.top-ddH-4;
  if(left<8)left=8;
  dd.style.top=top+'px';dd.style.left=left+'px';
}
function closeDropdown(){const el=document.getElementById('roomDropdown');if(el)el.remove();currentDropdownRoomId=null;}
document.addEventListener('click',e=>{if(!e.target.closest('#roomDropdown')&&!e.target.closest('.room-kebab'))closeDropdown();});

// ── 방 나가기 ──
function leaveRoom(){
  closeDropdown();if(!activeRoom)return;
  removeJoined(activeRoom);
  activeRoom=null;localStorage.removeItem(LAST_ROOM_KEY);
  if(msgChannel){sb.removeChannel(msgChannel);msgChannel=null;}
  document.getElementById('welcomeScreen').style.display='flex';
  document.getElementById('chatScreen').style.display='none';
  document.getElementById('roomTitle').textContent='방을 선택하세요';
  document.getElementById('roomSub').style.display='none';
  renderAllSides();
}

// ── 방 삭제 ──
async function deleteRoom(roomId){
  closeDropdown();
  const r=rooms.find(x=>x.id===roomId);
  if(!r||myNick!==r.owner_name){alert('방장만 삭제할 수 있습니다.');return;}
  if(!confirm(`"${r.name}" 방을 삭제할까요?\n모든 메시지가 사라집니다.`))return;
  if(activeRoom===roomId)leaveRoom();
  await sb.from('messages').delete().eq('room_id',roomId);
  const {error}=await sb.from('rooms').delete().eq('id',roomId);
  if(error){alert('삭제 실패: '+error.message);return;}
  rooms=rooms.filter(x=>x.id!==roomId);
  removeJoined(roomId);
  renderAllSides();
}

// ── Supabase: 방 목록 ──
async function loadRooms(){
  const {data,error}=await sb.from('rooms').select('*').order('created_at',{ascending:false});
  if(error||!data)return;
  rooms=data.map(r=>({id:r.id,name:r.title,visibility:r.visibility,passcode:r.passcode||null,owner_name:r.owner_name||'',preview:'방에 입장해 대화하세요',cnt:0}));
  renderAllSides();
  for(const room of rooms){
    const {data:last}=await sb.from('messages').select('content,sender_name').eq('room_id',room.id).order('created_at',{ascending:false}).limit(1);
    if(last&&last[0])room.preview=last[0].sender_name+': '+last[0].content;
  }
  renderAllSides();
}

// ── Supabase: 메시지 ──
async function loadMessages(roomId){
  const {data,error}=await sb.from('messages').select('*').eq('room_id',roomId).order('created_at',{ascending:true});
  if(error)return;
  msgsData[roomId]=(data||[]).map(m=>({id:m.id,u:m.sender_name,t:fmtTime(m.created_at),msg:m.content,sys:m.is_system||false}));
  renderCurrentLayout();
}
async function sendMsg(v,isSys=false){
  if(!activeRoom)return;
  await sb.from('messages').insert({room_id:activeRoom,sender_name:isSys?'SYSTEM':myNick,content:v,is_system:isSys});
}

// ── Supabase: Realtime ──
function subscribeRoom(roomId){
  if(msgChannel)sb.removeChannel(msgChannel);
  msgChannel=sb.channel('room-'+roomId)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'room_id=eq.'+roomId},payload=>{
      const m=payload.new;
      if(!msgsData[roomId])msgsData[roomId]=[];
      if(!msgsData[roomId].some(x=>x.id===m.id)){
        msgsData[roomId].push({id:m.id,u:m.sender_name,t:fmtTime(m.created_at),msg:m.content,sys:m.is_system||false});
        renderCurrentLayout();
        const r=rooms.find(x=>x.id===roomId);
        if(r&&!m.is_system){r.preview=m.sender_name+': '+m.content;renderAllSides();}
      }
    })
    .subscribe(status=>{
      const dot=document.getElementById('connDot');
      if(dot)dot.style.background=status==='SUBSCRIBED'?'var(--green)':'#888';
    });
}
sb.channel('rooms-global')
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'rooms'},payload=>{
    const r=payload.new;
    if(!rooms.some(x=>x.id===r.id)){
      rooms.unshift({id:r.id,name:r.title,visibility:r.visibility,passcode:r.passcode||null,owner_name:r.owner_name||'',preview:'새 방이 열렸어요!',cnt:0});
      renderAllSides();
    }
  })
  .on('postgres_changes',{event:'DELETE',schema:'public',table:'rooms'},payload=>{
    const id=payload.old.id;
    rooms=rooms.filter(x=>x.id!==id);
    if(activeRoom===id)leaveRoom();
    renderAllSides();
  }).subscribe();

// ── 렌더 ──
function renderAllSides(){renderRooms();renderXlSheets();renderNpSide();}

function renderRooms(){
  const q=document.getElementById('searchInp').value.trim().toLowerCase();
  const joined=loadJoined();
  const joinedRooms=rooms.filter(r=>joined.includes(r.id)&&r.name.toLowerCase().includes(q));
  const otherRooms=rooms.filter(r=>!joined.includes(r.id)&&r.name.toLowerCase().includes(q));

  let html='';

  // ── 참여중인 놀이터 ──
  html+=`<div class="sb-section-label"><span>🏠 참여중인 놀이터</span><span class="sb-section-cnt">${joinedRooms.length}</span></div>`;
  if(joinedRooms.length){
    html+=joinedRooms.map(r=>`
      <div class="room-item${activeRoom===r.id?' active':''}" onclick="openRoom('${r.id}')">
        <div class="room-item-body">
          <div class="ri-top"><span class="ri-name">${r.visibility==='secret'?'🔒 ':''}${r.name}</span></div>
          <div class="ri-preview">${r.preview}</div>
        </div>
        <button class="room-kebab" onclick="openRoomDropdown(event,'${r.id}')" title="메뉴">⋮</button>
      </div>`).join('');
  }else{
    html+=`<div class="empty-state" style="font-size:11px;padding:12px">아직 참여한 방이 없어요</div>`;
  }

  // ── 구분선 ──
  html+=`<div class="sb-section-divider"></div>`;

  // ── 재밌는 놀이터 ──
  html+=`<div class="sb-section-label"><span>🌐 재밌는 놀이터</span><span class="sb-section-cnt">${otherRooms.length}</span></div>`;
  if(otherRooms.length){
    html+=otherRooms.map(r=>`
      <div class="room-item${activeRoom===r.id?' active':''}" onclick="openRoom('${r.id}')">
        <div class="room-item-body">
          <div class="ri-top"><span class="ri-name">${r.visibility==='secret'?'🔒 ':''}${r.name}</span></div>
          <div class="ri-preview">${r.preview}</div>
        </div>
        <button class="room-kebab" onclick="openRoomDropdown(event,'${r.id}')" title="메뉴">⋮</button>
      </div>`).join('');
  }else{
    html+=`<div class="empty-state" style="font-size:11px;padding:12px">모든 방에 참여 중이에요 🎉</div>`;
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

// ── 방 둘러보기 팝업 ──
function openBrowseModal(){
  const joined=loadJoined();
  const others=rooms.filter(r=>!joined.includes(r.id));

  const overlay=document.createElement('div');
  overlay.className='browse-overlay';
  overlay.id='browseModal';
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

// ── 방 열기 ──
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
  addJoined(id); // 참여 목록에 추가
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

// ── 비밀방 암호 ──
function closePasscodeModal(){document.getElementById('passcodeModal').style.display='none';document.getElementById('passcodeCheckInp').value='';document.getElementById('passcodeErr').style.display='none';pendingRoomId=null;}
async function confirmPasscode(){
  const entered=document.getElementById('passcodeCheckInp').value.trim();if(!pendingRoomId)return;
  const {data}=await sb.from('rooms').select('passcode').eq('id',pendingRoomId).single();
  if(!data||data.passcode!==entered){document.getElementById('passcodeErr').style.display='block';document.getElementById('passcodeCheckInp').value='';document.getElementById('passcodeCheckInp').focus();return;}
  savePasscode(pendingRoomId,entered);
  const rid=pendingRoomId;closePasscodeModal();openRoom(rid,true);
}
document.getElementById('passcodeCheckInp').addEventListener('keydown',e=>{if(e.key==='Enter')confirmPasscode()});

// ── 렌더 함수 ──
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

// ── 전송 ──
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

// ── 방 만들기 ──
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
document.getElementById('wBrowse').onclick=openBrowseModal; // 팝업으로 변경
document.getElementById('dCancel').onclick=hideDialog;
document.getElementById('dCreate').onclick=createRoom;
document.getElementById('roomNameInp').addEventListener('keydown',e=>{if(e.key==='Enter')createRoom()});
document.getElementById('searchInp').addEventListener('input',renderRooms);
document.getElementById('visOpen').onclick=function(){visMode='open';this.classList.add('sel');document.getElementById('visSecret').classList.remove('sel');document.getElementById('passcodeWrap').style.display='none';document.getElementById('passcodeInp').value='';};
document.getElementById('visSecret').onclick=function(){visMode='secret';this.classList.add('sel');document.getElementById('visOpen').classList.remove('sel');document.getElementById('passcodeWrap').style.display='block';setTimeout(()=>document.getElementById('passcodeInp').focus(),50);};

// ── 레이아웃 전환 ──
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

// ── 설정 모달 ──
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

// ── 색상 스와치 ──
function renderSwatches(){
  document.getElementById('bubbleSwatches').innerHTML=BUBBLE_PALETTE.map(c=>`
    <div style="width:26px;height:26px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${c===myBubbleColor?'#fff':'transparent'};transition:transform .15s"
      onclick="setBubbleColor('${c}')" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform=''"></div>`).join('');
}
function setBubbleColor(c){myBubbleColor=c;localStorage.setItem(BUBBLE_COLOR_KEY,c);document.querySelectorAll('.bubble.m').forEach(el=>el.style.background=c);renderSwatches();}
renderSwatches();

// ── 테마 ──
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

// ── 초기화 ──
selectLayout(currentLayout);
(async()=>{
  await loadRooms();
  const lastId=localStorage.getItem(LAST_ROOM_KEY);
  if(lastId&&rooms.some(r=>r.id===lastId))await openRoom(lastId,false);
})();