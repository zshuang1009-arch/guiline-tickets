const main = document.querySelector('#main');
const folder = document.querySelector('#folder');
const phoneId = new URLSearchParams(location.search).get('ticket');
const emotions = [
  ['sadness','悲伤','#8ab9d4'], ['joy','喜悦','#dfa2b6'], ['regret','矛盾','#b4ada5'],
  ['rejection','排斥','#c96257'], ['nostalgia','怀念','#e8a15b'], ['attachment','眷恋','#aa8cdb']
];
const questions = [
  [
    "当你面对一段重要的关系或一段过去时，最接近你的感受是什么？",
    [
      "我感到失落，像有什么东西已经离开了。",
      "我会想起过去，觉得温柔又有一点惆怅。",
      "我很珍惜它，即使不舍，也想继续留住它。",
      "我既想靠近，又想逃开，心里很难平静。"
    ]
  ],
  [
    "当你发现自己对家乡产生了复杂的情绪时，你通常会如何面对？",
    [
      "我能够接纳这些情绪，并从中找到积极的力量。",
      "即使想要摆脱，这些情绪仍然会影响我。",
      "我会主动与这些情绪保持距离，不让它们影响自己。",
      "我时而想面对，时而想逃避，难以决定。"
    ]
  ],
  [
    "如果此刻有人邀请你回到家乡，你的第一反应是什么？",
    [
      "感到兴奋和期待，想立刻出发。",
      "心里泛起温暖，开始想象熟悉的街道与人。",
      "有些沉重，担心面对已经改变的人和事。",
      "既期待又抗拒，不确定自己是否真的想回去。"
    ]
  ],
  [
    "当某种情感突然涌上来时，你的身体更接近哪种状态？",
    [
      "安静、沉重，动作和思绪都慢下来。",
      "轻快、舒展，想笑，甚至想活动起来。",
      "紧绷、躁动，心里像有两股力量在拉扯。",
      "身体下意识地紧绷，想避开或推开某种东西。"
    ]
  ],
  [
    "如果这段情感变成一个你可以触碰的物体，你希望它怎样对待你？",
    [
      "安静地陪着我，不需要改变什么。",
      "让我靠近它，并且可以一直保留这份联系。",
      "允许我自由地改变它，让它跟随我的意愿。",
      "与我保持距离，不要进入我的空间。"
    ]
  ],
  [
    "当你必须在保留与放下之间做出选择时，你最真实的反应是什么？",
    [
      "放下吧，虽然难过，但我已经没有力气挽回。",
      "留下美好的部分，让它成为可以回望的记忆。",
      "我还是想留住它，即使知道这并不容易。",
      "我无法确定，既舍不得又觉得应该离开。"
    ]
  ]
];
const namesReady=fetch('/assets/places.json').then(r=>r.json()).then(names=>{placeNames=names;});
const cityData=Promise.all([
  fetch('/assets/cities.json').then(r=>r.json()),
  fetch('/assets/countries.json').then(r=>r.json()),
  namesReady
]).then(([rows,countries])=>{
  const countryRows=countries.map(([id,zh,en,lng,lat])=>{
    placeNames[zh]=en;
    return [id,zh,zh,lng,lat];
  });
  return {rows,countries:countryRows};
});
const start = [117.661801,24.510897];
let city, activeTicket, departing;
let step = 0, answers = [], generation = 0;
const go = route => { location.hash = route; };
const btn = (caption, id, secondary=false) => '<button type="button" class="button '+(secondary?'secondary':'')+'" id="'+id+'">'+t(caption)+'</button>';
const find = id => document.getElementById(id);
const controls = (...buttons) => '<div class="controls">'+buttons.join('')+'</div>';
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function api(path, body, key) {
  const options = body === undefined ? {} : {method:'POST', headers:{}, body};
  if (key) options.headers['X-Ticket-Key'] = key;
  if (typeof body === 'string') options.headers['Content-Type'] = 'application/json';
  const response = await fetch(path, options);
  if (!response.ok) throw new Error('HTTP '+response.status+' '+path);
  return response.json();
}
function coordinates(lng, lat) {
  return Math.abs(lat).toFixed(2)+'° '+(lat>=0?'N':'S')+' · '+Math.abs(lng).toFixed(2)+'° '+(lng>=0?'E':'W');
}
function startTest() {
  submissions.clear();
  city = undefined; activeTicket = undefined; step = 0; answers = [];
  go('city');
}
async function cityPage(version) {
  main.classList.add('question-paper');
  main.innerHTML =localized('<section class="city"><h1>你的家乡在哪里？</h1><label for="city-search">家乡</label><input class="search" id="city-search" placeholder="搜索国家、地区或中国城市" autocomplete="off"><div class="results" id="cities"></div><div class="city-pickers"><div>国家或地区<details id="country-picker"><summary class="search">选择国家或地区</summary><div class="results"></div></details></div><div class="domestic-picker">省份或地区<details id="city-province"><summary class="search">选择省份或地区</summary><div class="results"></div></details></div><div class="domestic-picker">城市<details id="city-picker"><summary class="search">请先选择省份或地区</summary><div class="results"></div></details></div></div><p class="status" id="city-status" aria-live="polite"></p>'+controls(btn('下一步 →','city-next'))+'</section>');
  const input = find('city-search');
  const next = find('city-next');
  next.disabled = !city;
  const {rows,countries}=await cityData;
  if (version !== generation) return;
  const countryPicker=find('country-picker');
  const countryLabel=countryPicker.querySelector('summary');
  const china=countries.find(([id])=>id==='country-CN');
  let country=city?.[0].startsWith('country-')?city:china;
  const province = find('city-province');
  const picker = find('city-picker');
  const provinceLabel=province.querySelector('summary');
  const cityLabel=picker.querySelector('summary');
  const cityList=picker.querySelector('.results');
  let region=city?.[1]??'';
  function optionButton(label,choose){
    const button=document.createElement('button');
    button.type='button';
    button.textContent=place(label);
    button.onclick=choose;
    return button;
  }
  function populateCities(){
    countryLabel.textContent=place(country[2]);
    const domestic=country===china;
    for(const field of main.querySelectorAll('.domestic-picker'))field.hidden=!domestic;
    provinceLabel.textContent=region?place(region):t('选择省份或地区');
    cityLabel.textContent=city?place(city[2]):t(region?'选择城市':'请先选择省份或地区');
    cityList.replaceChildren(...rows.filter(row=>row[1]===region).map(item=>
      optionButton(item[2],()=>selectCity(item))
    ));
  }
  function selectCity(item){
    city=item;
    country=item[0].startsWith('country-')?item:china;
    region=country===china?item[1]:'';
    countryPicker.open=false;
    input.value=place(item[2]);
    province.open=false;
    picker.open=false;
    populateCities();
    next.disabled=false;
    find('cities').replaceChildren();
    find('city-status').textContent='';
  }
  for(const item of [...countries].sort((a,b)=>place(a[2]).localeCompare(place(b[2]),document.documentElement.lang))){
    countryPicker.querySelector('.results').append(optionButton(item[2],()=>{
      if(item!==china){selectCity(item);return;}
      country=china;city=undefined;region='';
      input.value='';next.disabled=true;countryPicker.open=false;
      find('cities').replaceChildren();
      populateCities();
      province.open=true;
      provinceLabel.focus();
    }));
  }
  countryPicker.ontoggle=()=>{if(countryPicker.open){province.open=false;picker.open=false;}};
  for(const name of new Set(rows.map(row=>row[1]))){
    province.querySelector('.results').append(optionButton(name,()=>{
      region=name;
      city=undefined;
      input.value='';
      province.open=false;
      next.disabled=true;
      populateCities();
      search();
      picker.open=true;
      cityLabel.focus();
    }));
  }
  province.ontoggle=()=>{if(province.open){picker.open=false;countryPicker.open=false;}};
  picker.ontoggle=()=>{if(picker.open){province.open=false;countryPicker.open=false;}};
  populateCities();
  if(city)selectCity(city);
  function search() {
    const query = input.value.trim();
    const list = find('cities');
    list.replaceChildren();
    const matches = query ? [...countries.filter(([id])=>id!=='country-CN'),...rows].filter(row=>(row[1]+row[2]+' '+(placeNames[row[1]]??'')+' '+(placeNames[row[2]]??'')).toLowerCase().includes(query.toLowerCase())).slice(0,18) : [];
    find('city-status').textContent = query && !matches.length ? t('也可以从下方选择国家或地区。') : '';
    for (const item of matches) {
      const option = document.createElement('button');
      option.type = 'button';
      option.textContent = item[1]===item[2] ? place(item[2]) : place(item[1])+' · '+place(item[2]);
      option.setAttribute('aria-pressed', String(city?.[0]===item[0]));
      option.onclick = () => selectCity(item);
      list.append(option);
    }
  }
  let composing=false;
  function updateSearch(){
    city=undefined;
    populateCities();
    next.disabled=true;
    search();
  }
  input.oncompositionstart=()=>{composing=true;};
  input.oncompositionend=()=>{composing=false;updateSearch();};
  input.oninput=e=>{if(!composing&&!e.isComposing)updateSearch();};
  input.onkeydown=e=>{
    if(e.key==='Enter'&&!composing&&!e.isComposing&&e.keyCode!==229) find('cities').querySelector('button')?.click();
  };
  next.onclick = () => go('question');
}
function questionPage() {
  if (!city) return go('city');
  const [question,options] = (language==='en'?englishQuestions:questions)[step];
  main.classList.add('question','question-paper');
  main.innerHTML =localized('<div class="meta"><span class="badge">'+(step+1)+' / 6</span><span>家乡 · <span id="hometown"></span>　<a href="#city">修改</a></span></div><h1>'+question+'</h1><div class="choices" role="radiogroup" aria-label="答案">'+options.map((option,index)=>'<label class="choice"><input type="radio" name="answer" value="'+index+'" '+(answers[step]===index?'checked':'')+'><span>'+String.fromCharCode(65+index)+'. '+option+'</span></label>').join('')+'</div>'+controls(btn('← 上一步','prev',true),btn(step===5?'完成问卷':'下一题 →','next'))+'<p class="status" id="status" role="status"></p>');
  find('hometown').textContent=place(city[2]);
  const next=find('next');
  next.disabled=answers[step]===undefined;
  for (const radio of main.querySelectorAll('input')) radio.onchange=()=>{answers[step]=Number(radio.value);next.disabled=false;};
  find('prev').onclick=()=>{if(step===0)go('city');else{step--;render();}};
  next.onclick=async()=>{
    if(step<questions.length-1){step++;render();return;}
    const version=generation;
    next.disabled=true;
    try {
      const payload=JSON.stringify({cityId:city[0],answers});
      let submission=submissions.get(payload);
      if(!submission){
        submission=api('/api/tickets',payload).then(ticket=>{
          transmit(ticket);
          return ticket;
        }).catch(error=>{
          if(submissions.get(payload)===submission)submissions.delete(payload);
          throw error;
        });
        submissions.set(payload,submission);
      }
      const ticket=await submission;
      if(version!==generation)return;
      activeTicket=ticket;
      go('result');
    } catch {
      if(version!==generation)return;
      find('status').textContent=t('暂时无法打开结果，请稍后重试。');
      next.disabled=false;
    }
  };
}
const submissions=new Map();
const pendingResults=new Map();
const imageTasks=new Map();
const seenImageNames=new Set();
let awaitingImage;
const tdAddress='ws://127.0.0.1:9980';
let ws, connectTimeout;
let tdDisconnected=false;
const tdLog = (level, stage, details) => console[level]('[归线 TD] '+stage, details);

const tdNotice=document.createElement('div');
tdNotice.hidden=true;
tdNotice.className='status';
Object.assign(tdNotice.style,{
  position:'fixed',right:'1rem',bottom:'1rem',zIndex:'5',
  padding:'.35rem .55rem',background:'#faf2e7',borderRadius:'.35rem',
  maxWidth:'calc(100% - 2rem)'
});
const tdMessage=document.createElement('span');
tdMessage.setAttribute('role','status');
const reconnect=document.createElement('button');
reconnect.type='button';
reconnect.style.marginInlineStart='.5em';
reconnect.onclick=connect;
tdNotice.append(tdMessage,reconnect);
if(!phoneId)document.body.append(tdNotice);

function updateTdStatus(){
  tdNotice.hidden=Boolean(phoneId)||!tdDisconnected;
  tdMessage.textContent=language==='en'
    ? (pendingResults.size?'TouchDesigner is offline. Result not sent.':'TouchDesigner is offline. You can still take the quiz.')
    : (pendingResults.size?'TouchDesigner 未连接，结果尚未发送。':'TouchDesigner 未连接，仍可填写问卷。');
  reconnect.textContent=language==='en'?'Reconnect':'重新连接';
  reconnect.disabled=ws?.readyState===WebSocket.CONNECTING;
}

function transmit(ticket){
  if(phoneId||imageTasks.has(ticket.id))return;
  const unique=new Map();
  const ranked=[...ticket.topThree].sort((a,b)=>b.percent-a.percent);
  for(const {id,percent} of ranked)if(!unique.has(id))unique.set(id,percent);
  const emotions=[...unique].slice(0,3).map(([name,score])=>({name,score}));
  if(emotions.length!==3)return;
  const task={ticket,status:'loading',imageUrl:null,message:{type:'emotion_result',emotions}};
  imageTasks.set(ticket.id,task);
  pendingResults.set(ticket.id,task);
  if(ws?.readyState===WebSocket.OPEN)sendPendingResults();
  else {
    tdLog('info','等待 WebSocket 连接', {ticketId:ticket.id,readyState:ws?.readyState});
    connect();
  }
  updateTdStatus();
}

async function sendPendingResults(){
  if(ws?.readyState!==WebSocket.OPEN||awaitingImage)return;
  const task=pendingResults.values().next().value;
  if(!task)return;
  awaitingImage=task;
  const socket=ws;
  try{
    if(task.ticket.folderCapture){
      await api('/api/td-folder/'+task.ticket.id,'{}',task.ticket.writeKey);
      if(socket!==ws||socket.readyState!==WebSocket.OPEN){
        awaitingImage=undefined;
        sendPendingResults();
        return;
      }
    }
    socket.send(JSON.stringify(task.message));
  }
  catch(error){
    awaitingImage=undefined;
    tdLog('error','问卷发送失败',{ticketId:task.ticket.id,error});
    task.status='error';
    if(!task.ticket.folderCapture)socket.close();
    return;
  }
  pendingResults.delete(task.ticket.id);
  tdLog('info','emotion_result 已发送，等待回图',{ticketId:task.ticket.id});
  task.timeout=setTimeout(()=>{
    // Keep the slot reserved even after timeout. A late message cannot be used
    // for a newer visitor on the same connection.
    task.status='timeout';
    tdLog('warn','30 秒未收到可匹配的回图通知',{ticketId:task.ticket.id,readyState:ws?.readyState});
  },30000);
  if(task.ticket.folderCapture)waitForFolderImage(task);
  updateTdStatus();
}

async function waitForFolderImage(task){
  while(awaitingImage===task){
    await wait(350);
    try{
      const data=await api('/api/ticket/'+task.ticket.id);
      if(!data.ready||awaitingImage!==task)continue;
      clearTimeout(task.timeout);
      task.status='ready';
      awaitingImage=undefined;
      sendPendingResults();
      return;
    }catch{ /* Continue waiting for the local file. */ }
  }
}

function connect(){
  if(phoneId||ws?.readyState===WebSocket.CONNECTING)return;
  if(ws?.readyState===WebSocket.OPEN){sendPendingResults();return;}
  let socket;
  try{socket=new WebSocket(tdAddress);}
  catch(error){
    tdLog('error','无法创建 WebSocket',{address:tdAddress,error});
    tdDisconnected=true;updateTdStatus();return;
  }
  ws=socket;
  tdLog('info','正在连接 WebSocket',{address:tdAddress});
  socket.binaryType='arraybuffer';
  socket.addEventListener('message',event=>{
    if(ws===socket)receiveTicketImage(event);
  });
  updateTdStatus();
  connectTimeout=setTimeout(()=>{
    if(ws===socket&&socket.readyState===WebSocket.CONNECTING)socket.close();
  },4000);
  socket.onopen=()=>{
    clearTimeout(connectTimeout);
    tdDisconnected=false;
    tdLog('info','WebSocket 已连接',{address:tdAddress});
    sendPendingResults();
  };
  socket.onerror=()=>{tdLog('error','WebSocket 连接错误',{address:tdAddress});tdDisconnected=true;updateTdStatus();};
  socket.onclose=event=>{
    if(ws!==socket)return;
    clearTimeout(connectTimeout);
    ws=undefined;
    tdLog('warn','WebSocket 已断开',{code:event.code,reason:event.reason,waitingTicket:awaitingImage?.ticket.id});
    if(awaitingImage&&!awaitingImage.ticket.folderCapture){
      clearTimeout(awaitingImage.timeout);
      awaitingImage.status='disconnected';
      awaitingImage=undefined;
    }
    tdDisconnected=true;
    updateTdStatus();
  };
}

function imageReadyFilename(message){
  const {filename,imageUrl}=message;
  if(typeof filename!=='string'||!/^emotion_[0-9]+\.png$/.test(filename))return;
  if(imageUrl!=='http://127.0.0.1:9980/emotion-image/'+filename)return;
  return filename;
}

async function importTdImage(task){
  if(task.status==='importing')return;
  task.status='importing';
  for(let attempt=1;attempt<=3;attempt++){
    try{
      await api('/api/td-image/'+task.ticket.id,JSON.stringify({filename:task.filename}),task.ticket.writeKey);
      task.status='ready';
      tdLog('info','图片已保存到票根',{ticketId:task.ticket.id,filename:task.filename});
      return;
    }catch(error){
      tdLog(attempt===3?'error':'warn','TD 图片读取或保存失败',{ticketId:task.ticket.id,filename:task.filename,attempt,error});
      if(attempt<3)await wait(400*attempt);
    }
  }
  task.status='error';
}

async function receiveTicketImage(event){
  try{
    const data=typeof event.data==='string'?event.data:new TextDecoder().decode(event.data);
    const message=JSON.parse(data);
    tdLog('info','收到 WebSocket 消息',{type:message?.type,filename:message?.filename});
    if(!message||typeof message!=='object')return;
    if(awaitingImage?.ticket.folderCapture&&message.type==='emotion_image_ready')return;
    if(message.type==='emotion_image_ready'){
      const filename=imageReadyFilename(message);
      if(!filename){
        tdLog('warn','回图通知的路径或文件名无效',{imageUrl:message.imageUrl,filename:message.filename});
        return;
      }
      if(!awaitingImage||seenImageNames.has(filename)){
        tdLog('warn','忽略无待处理票根或重复的回图通知',{filename});
        return;
      }
      seenImageNames.add(filename);
      const task=awaitingImage;
      clearTimeout(task.timeout);
      awaitingImage=undefined;
      task.imageUrl=message.imageUrl;
      task.filename=filename;
      const importing=importTdImage(task);
      sendPendingResults();
      await importing;
      return;
    }
    // Preserve the prior ID-bearing PNG response.
    const task=imageTasks.get(message.ticketId);
    if(message.type!=='ticket_image'||!task||pendingResults.has(task.ticket.id)||typeof message.imageBase64!=='string'||message.imageBase64.length>16_000_000)return;
    const bytes=Uint8Array.from(atob(message.imageBase64),char=>char.charCodeAt(0));
    const pngSignature=[137,80,78,71,13,10,26,10];
    if(!pngSignature.every((byte,index)=>bytes[index]===byte))return;
    await api('/api/image/'+task.ticket.id,bytes,task.ticket.writeKey);
    task.status='ready';
    if(awaitingImage===task){
      clearTimeout(task.timeout);
      awaitingImage=undefined;
      sendPendingResults();
    }
  }catch(error){tdLog('error','WebSocket 消息解析或处理失败',{error});}
}

async function watch(ticket, version, done, waiting){
  while(version===generation){
    try{
      const data=await api('/api/ticket/'+ticket);
      if(version!==generation)return;
      if(data.ready){done(data);return;}
    }catch{ /* Retry when the local service becomes available. */ }
    if(version!==generation||waiting?.()===false)return;
    await wait(350);
  }
}

function bindTicketModel(ticket, version){
  const slot=main.querySelector('.model-slot');
  const status=document.createElement('div');
  status.className='status';
  status.setAttribute('role','status');
  const caption=document.createElement('span');
  const retry=document.createElement('button');
  retry.hidden=true;
  retry.type='button';
  retry.textContent=language==='en'?'Retry':'重试';
  status.append(caption,' ',retry);
  slot.append(status);
  const task=imageTasks.get(ticket.id);
  function show(zh,en,action){
    caption.textContent=language==='en'?en:zh;
    retry.hidden=!action;
    retry.onclick=action??null;
  }
  let manualImport=false;
  async function recoverImage(){
    const imageUrl=window.prompt(language==='en'
      ? 'Paste the TouchDesigner PNG URL for this ticket.'
      : '粘贴本次问卷生成的 TouchDesigner PNG 地址。')?.trim();
    if(!imageUrl)return;
    const filename=imageReadyFilename({imageUrl,filename:imageUrl.split('/').pop()});
    if(!filename){
      window.alert(language==='en'?'Invalid TouchDesigner PNG URL.':'请粘贴 TD 生成的完整 PNG 地址。');
      return;
    }
    manualImport=true;
    showLoading();
    try{
      await api('/api/td-image/'+ticket.id,JSON.stringify({filename}),ticket.writeKey);
      tdLog('info','已手动补入本次票根的模型',{ticketId:ticket.id,filename});
    }catch(error){
      tdLog('error','补入模型失败',{ticketId:ticket.id,filename,error});
      window.alert(language==='en'?'Could not load this PNG.':'无法读取这张图，请确认 TD 正在运行，且这张 PNG 能在浏览器中打开。');
    }finally{
      manualImport=false;
    }
  }
  function waiting(){
    retry.textContent=language==='en'?'Import PNG':'补入模型图片';
    if(manualImport)return;
    if(task?.status==='error')show('图片加载失败。','Could not load the image.',recoverImage);
    else if(task?.status==='timeout')show('未收到 TouchDesigner 的回图通知。','No image notification received.',recoverImage);
    else if(task?.status==='disconnected'||tdDisconnected)show('TouchDesigner 未连接。','TouchDesigner is disconnected.',recoverImage);
    else showLoading();
  }
  function showLoading(){show('正在生成您的情绪档案……','Generating your emotion archive…');}
  async function display(){
    showLoading();
    try{
      const image=await loadImage('/api/image/'+ticket.id);
      if(version!==generation)return;
      image.className='form-photo';
      image.alt=t('你的返乡情绪形态');
      Object.assign(image.style,{objectFit:'contain',background:'transparent'});
      if(!slot.isConnected)throw new Error('票根模型区域已脱离页面');
      slot.replaceChildren(image);
      tdLog('info','模型已绑定到票根',{ticketId:ticket.id});
    }catch(error){
      tdLog('error','票根模型显示或绑定失败',{ticketId:ticket.id,error});
      if(version===generation){
        retry.textContent=language==='en'?'Retry':'重试';
        show('图片加载失败。','Could not load the image.',display);
      }
    }
  }
  waiting();
  watch(ticket.id,version,display,waiting);
}

async function bindTicketQr(ticket, version){
  const image=main.querySelector('.qr img');
  const original=image.parentElement.lastChild;
  while(version===generation){
    try{
      const response=await fetch('/api/qr/'+ticket);
      if(version!==generation)return;
      if(response.status===200&&response.headers.get('Content-Type')?.startsWith('image/')){
        const url=URL.createObjectURL(await response.blob());
        image.onload=image.onerror=()=>URL.revokeObjectURL(url);
        image.src=url;
        image.hidden=false;
        original.textContent=language==='en'?'Scan to save your ticket':'扫描二维码保存票根';
        return;
      }
    }catch{ /* Retry until the ticket is available. */ }
    image.hidden=true;
    original.textContent=language==='en'?'Preparing your QR code…':'正在准备票根二维码…';
    await wait(1000);
  }
}

function resultPage(version) {
  if(!activeTicket)return go('home');
  main.classList.add('kraft');
  main.innerHTML=localized('<h1>你的返乡情绪</h1><div class="ticket"><div id="scores"></div><div><p id="prepare" role="status">正在准备你的票根…</p>'+btn('查看票根 →','show-ticket')+'</div><div class="qr"><img hidden alt="票根二维码">扫描二维码保存票根</div></div>');
  bindTicketQr(activeTicket.id,version);
  find('scores').innerHTML=activeTicket.topThree.map(({id,percent})=>{
    const [,label,color]=emotions.find(([key])=>key===id);
    return '<div><span style="color:'+color+'">●</span> '+t(label)+'　'+percent+'%</div>';
  }).join('');
  const button=find('show-ticket');
  button.onclick=()=>go('ticket');
  watch(activeTicket.id,version,()=>go('ticket'));
}
function ticketPage() {
  if(!activeTicket)return go('home');
  const ticket=activeTicket;
  main.classList.add('kraft');
  main.innerHTML=localized('<h1>个人情绪档案</h1><article class="ticket designed-ticket"><section class="ticket-main"><header><strong lang="zh-CN">&#24402;&#32447;</strong><span lang="en">HOMEWARD THREADS</span></header><figure class="model-slot"></figure></section><section class="ticket-stub"><div class="places"><strong>漳州市</strong><span aria-hidden="true">⟶</span><p>家乡 · <span id="ticket-city"></span></p><small>'+coordinates(ticket.lng,ticket.lat)+'</small></div><div class="qr"><img hidden alt="票根二维码">扫描二维码保存票根</div></section></article>'+controls(btn('加入公共网络','join'),btn('仅保存档案卡','private',true))+'<p class="status" role="status" id="status"></p>');
  find('ticket-city').textContent=place(ticket.city);
  bindTicketModel(ticket,generation);
  bindTicketQr(ticket.id,generation);
  if(ticket.demo){
    const link=document.createElement('a');
    link.href='/?ticket='+ticket.id;
    link.target='_blank';
    link.rel='noopener';
    link.className='preview-ticket-link';
    link.textContent=t('预览扫码后的票根');
    main.querySelector('.qr').append(link);
  }
  find('private').onclick=()=>{
    const status=find('status');status.replaceChildren(t('用手机扫描右侧二维码，即可保存你的票根。　'));
    const back=document.createElement('a');back.href='#home';back.textContent=t('返回首页');status.append(back);
    find('join').disabled=true;find('private').disabled=true;
  };
  find('join').onclick=async()=>{
    const button=find('join');button.disabled=true;find('private').disabled=true;
    try{await api('/api/join/'+ticket.id,'{}',ticket.writeKey);departing=ticket;go('archive');}
    catch{if(find('status'))find('status').textContent=t('暂时无法加入，请再试一次。');button.disabled=false;find('private').disabled=false;}
  };
}
function loadImage(src) {
  return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
}
async function phonePage(version) {
  document.querySelector('.tabs').hidden=true;
  folder.className='folder phone';
  main.innerHTML=localized('<h1>你的归线票根</h1><p role="status">正在准备你的票根…</p>');
  if(!/^[a-f0-9]{32}$/.test(phoneId)){main.innerHTML=localized('<h1>票根暂不可用</h1>');return;}
  try {await api('/api/capture/'+phoneId,'{}');} catch {main.innerHTML=localized('<h1>票根暂不可用</h1>');return;}
  await cityData;
  const waitUntil=Date.now()+35000;
  watch(phoneId,version,async data=>{
    main.innerHTML=localized('<h1>你的归线票根</h1><canvas width="1800" height="760" id="print" aria-label="个人票根"></canvas>'+controls(btn('保存票根','save'))+'<p class="status" id="save-status" role="status"></p>');
    const canvas=find('print'), save=find('save');
    save.disabled=true;
    try{
      const [image,paper,qr]=await Promise.all([loadImage('/api/image/'+phoneId),loadImage('/assets/paper.webp'),loadImage('/api/qr/'+phoneId)]);
      if(version!==generation)return;
      const c=canvas.getContext('2d');
      c.fillStyle='#cfab7f';c.fillRect(0,0,1800,760);
      c.fillStyle=c.createPattern(paper,'repeat');c.fillRect(24,24,1752,712);
      const scale=Math.min(810/image.width,515/image.height);
      c.drawImage(image,85+(810-image.width*scale)/2,155+(515-image.height*scale)/2,image.width*scale,image.height*scale);
      c.fillStyle='#274453';c.font='bold 60px SimSun, STSong, serif';c.fillText(t('归线 · 个人情绪档案'),85,112,1600);
      c.setLineDash([8,12]);c.strokeStyle='#a69480';c.beginPath();c.moveTo(955,155);c.lineTo(955,670);c.stroke();c.setLineDash([]);
      c.font='56px SimSun, STSong, serif';c.fillText(place('漳州市'),1020,286);c.fillText('⟶',1020,365);c.fillText(t('家乡')+' · '+place(data.city),1020,465,680);
      c.font='37px serif';c.fillText(coordinates(data.lng,data.lat),1020,550);
      c.imageSmoothingEnabled=false;c.drawImage(qr,1510,512,145,145);
      save.disabled=false;
      save.onclick=()=>canvas.toBlob(blob=>{
        if(!blob)return;
        const url=URL.createObjectURL(blob);
        const link=document.createElement('a');link.href=url;link.download='归线票根.png';link.click();
        find('save-status').textContent=t('如浏览器打开了图片，可以长按图片保存。');
        setTimeout(()=>URL.revokeObjectURL(url),60000);
      });
    }catch(error){tdLog('error','票根导出画布准备失败',{ticketId:phoneId,error});if(version===generation)find('save-status').textContent=t('图片暂时无法显示，请刷新重试。');}
  },()=>{
    if(Date.now()<waitUntil)return;
    const status=main.querySelector('[role=status]');
    status.textContent=language==='en'?'Waiting for TouchDesigner. The image will appear automatically.':'正在等待 TD 回图，收到后会自动显示。';
  });
}
async function archivePage(version) {
  main.classList.add('map-page','kraft');
  main.innerHTML=localized('<h1>档案馆</h1><p>在归线的坐标上，遇见更多人的返乡情绪。</p><div class="map-paper"><canvas id="map" width="1450" height="530" aria-label="世界情绪地图"></canvas><div class="legend">'+emotions.map(([,label,color])=>'<span><i style="background:'+color+'"></i>'+t(label)+'</span>').join('')+'</div></div>');
  const current=departing;departing=null;
  await cityData;
  let rings,pins;
  try {
    [rings,pins]=await Promise.all([fetch('/assets/land.json').then(r=>r.json()),api('/api/archive')]);
  } catch {
    if(version===generation)main.querySelector('p').textContent=t('档案馆暂时无法打开，请刷新重试。');
    return;
  }
  if(version!==generation)return;
  const canvas=find('map');
  const ctx=canvas.getContext('2d');
  const {width,height}=canvas;
  const palette=Object.fromEntries(emotions.map(([id,,color])=>[id,color]));
  const [sx,sy]=world(start);

  function world([lng,lat]){
    return [20+(width-40)*(.5+lng/360*(.55+.45*Math.cos(lat*Math.PI/180))),18+(height-40)*(.5-lat/180)];
  }
  function trace(path,points){
    points.forEach((coord,index)=>{
      const [x,y]=world(coord);
      if(index===0)path.moveTo(x,y);else path.lineTo(x,y);
    });
  }
  const land=new Path2D();
  for(const ring of rings){trace(land,ring);land.closePath();}
  const grid=new Path2D();
  for(let lng=-180;lng<=180;lng+=30)trace(grid,Array.from({length:37},(_,i)=>[lng,i*5-90]));
  for(let lat=-60;lat<=60;lat+=30)trace(grid,[[-180,lat],[180,lat]]);

  const groups=new Map();
  const activeIndex=current ? pins.findLastIndex(pin=>pin.city===current.city&&pin.dominant===current.dominant) : -1;
  function thread(pin){
    const [tx,ty]=world([pin.lng,pin.lat]);
    const key=pin.lng+','+pin.lat;
    const order=groups.get(key)??0;
    groups.set(key,order+1);
    const lift=Math.min(135,Math.max(3,Math.hypot(tx-sx,ty-sy)*.32));
    const spread=order===0?0:(order%2===1?1:-1)*Math.min(18,Math.sqrt(order)*2);
    return {tx,ty,cx:(sx+tx)/2+spread,cy:Math.min(sy,ty)-lift-spread*.4,color:palette[pin.dominant]??'#8099a7'};
  }
  const history=pins.map(thread);
  const active=current ? history[activeIndex]??thread(current) : null;
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>t*t*(3-2*t);
  function dot(x,y,r,color){
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  }
  function drawThread(line,t,scale,featured=false){
    const ax=mix(sx,line.cx,t), ay=mix(sy,line.cy,t);
    const bx=mix(line.cx,line.tx,t), by=mix(line.cy,line.ty,t);
    const x=mix(ax,bx,t), y=mix(ay,by,t);
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.quadraticCurveTo(ax,ay,x,y);
    ctx.lineCap='round';ctx.strokeStyle=line.color;ctx.lineWidth=(featured?3:1.4)/scale;
    ctx.globalAlpha=featured?1:.52;ctx.stroke();
    dot(x,y,(featured?5:2.1)/scale,line.color);
    ctx.globalAlpha=1;
  }
  const centerX=active?(sx+active.tx)/2:width/2;
  const centerY=active?(Math.min(sy,active.ty,active.cy)+Math.max(sy,active.ty))/2:height/2;
  const zoom=active?Math.min(28,width*.68/Math.max(1,Math.abs(sx-active.tx)),height*.68/Math.max(1,Math.max(sy,active.ty)-active.cy)):1;
  function paint(camera,progress,pulse){
    const scale=mix(1,Math.max(1,zoom),camera);
    const offsetX=width/2-mix(width/2,centerX,camera)*scale;
    const offsetY=height/2-mix(height/2,centerY,camera)*scale;
    ctx.clearRect(0,0,width,height);
    ctx.save();ctx.translate(offsetX,offsetY);ctx.scale(scale,scale);
    ctx.strokeStyle='#68889670';ctx.setLineDash([2/scale,6/scale]);ctx.lineWidth=1/scale;ctx.stroke(grid);ctx.setLineDash([]);
    ctx.fillStyle='#b6c6c82a';ctx.fill(land);
    ctx.strokeStyle='#557485';ctx.stroke(land);
    for(const line of history)if(line!==active)drawThread(line,1,scale);
    if(active&&progress>0)drawThread(active,progress,scale,true);
    if(history.length||active)dot(sx,sy,3.5/scale,'#274453');
    if(active&&pulse>0){
      ctx.globalAlpha=.4*(1-pulse);ctx.strokeStyle=active.color;ctx.lineWidth=2/scale;
      ctx.beginPath();ctx.arc(active.tx,active.ty,(7+24*pulse)/scale,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    }
    ctx.restore();
    if(active&&camera>.2){
      ctx.fillStyle='#2a4857';ctx.font='20px "Noto Serif CJK SC", SimSun, serif';
      ctx.fillText(place('漳州市'),sx*scale+offsetX-68,sy*scale+offsetY+25);
      if(progress===1)ctx.fillText(place(current.city),active.tx*scale+offsetX+10,active.ty*scale+offsetY-10);
    }
  }
  if(!active||matchMedia('(prefers-reduced-motion: reduce)').matches){paint(0,1,0);return;}
  let began;
  function frame(now){
    if(version!==generation)return;
    began??=now;
    const elapsed=now-began;
    const camera=elapsed<950?smooth(elapsed/950):elapsed<3150?1:1-smooth(Math.min(1,(elapsed-3150)/1100));
    const progress=smooth(Math.max(0,Math.min(1,(elapsed-950)/1600)));
    const pulse=Math.max(0,Math.min(1,(elapsed-2550)/600));
    paint(camera,progress,pulse);
    if(elapsed<4250)requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function render(){
  const version=++generation;
  const route=location.hash.slice(1)||'home';
  main.className='';
  folder.className='folder'+(route==='home'&&!phoneId?' home':'');
  document.documentElement.lang=language==='en'?'en':'zh-CN';
  updateTdStatus();
  find('language-toggle').textContent=language==='en'?'中文':'EN';
  find('language-toggle').setAttribute('aria-label',language==='en'?'切换为中文':'Switch to English');
  document.querySelector('nav').setAttribute('aria-label',t('主导航'));
  for(const a of document.querySelectorAll('nav a')){
    const label=a.dataset.label;
    if(route==='home'&&!phoneId){
      const english=document.createElement('span');
      english.lang='en';
      english.textContent=translations[label];
      a.replaceChildren(label,' ',english);
    }else a.textContent=t(label);
    if(a.hash==='#'+(route==='archive'?'archive':'home'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  }
  if(phoneId)return phonePage(version);
  if(route==='city')return cityPage(version);
  if(route==='question')return questionPage();
  if(route==='result')return resultPage(version);
  if(route==='ticket')return ticketPage();
  if(route==='archive')return archivePage(version);
  main.replaceChildren(find('home').content.cloneNode(true));
  updateCoverDate();
  main.querySelector('[data-go=city]').onclick=startTest;
  main.querySelector('[data-go=archive]').onclick=()=>go('archive');
}
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
function updateCoverDate(){
  const date=find('cover-date');
  if(!date)return;
  const parts=Object.fromEntries(dateFormat.formatToParts(new Date()).map(({type,value})=>[type,value]));
  date.dateTime=parts.year+'-'+parts.month+'-'+parts.day;
  date.textContent=parts.year+parts.month+parts.day;
}
setInterval(updateCoverDate,1000);
find('language-toggle').onclick=()=>{
  language=language==='en'?'zh':'en';
  localStorage.setItem('guiline-language',language);
  render();
};
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
render();
connect();
