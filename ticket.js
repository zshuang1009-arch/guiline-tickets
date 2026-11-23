const params=new URLSearchParams(location.hash.slice(1));
const status=document.getElementById('status');
const canvas=document.getElementById('ticket');
const save=document.getElementById('save');

function loadImage(source){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=reject;
    image.src=source;
  });
}

async function showTicket(){
  const id=params.get('id')||'', token=params.get('token')||'';
  if(!/^[a-f0-9]{32}$/.test(id)||!token){
    status.textContent='请扫描你的归线票根二维码。';
    return;
  }
  const url=new URL('https://esfodpqwhqoiznfccrmi.supabase.co/storage/v1/object/sign/guiline-tickets/'+id+'.json');
  url.searchParams.set('token',token);
  const response=await fetch(url);
  if(!response.ok)throw new Error('Ticket unavailable');
  const data=await response.json();
  if(!/^data:image\/(png|jpeg);base64,/.test(data.image))throw new Error('Invalid ticket image');
  const [image,paper]=await Promise.all([loadImage(data.image),loadImage('./assets/paper.webp')]);
  const c=canvas.getContext('2d');
  c.fillStyle='#cfab7f';c.fillRect(0,0,1800,760);
  c.fillStyle=c.createPattern(paper,'repeat');c.fillRect(24,24,1752,712);
  const scale=Math.min(810/image.width,515/image.height);
  c.drawImage(image,85+(810-image.width*scale)/2,155+(515-image.height*scale)/2,image.width*scale,image.height*scale);
  c.fillStyle='#274453';c.font='bold 60px SimSun, STSong, serif';c.fillText('归线 · 个人情绪档案',85,112,1600);
  c.setLineDash([8,12]);c.strokeStyle='#a69480';c.beginPath();c.moveTo(955,155);c.lineTo(955,670);c.stroke();c.setLineDash([]);
  c.font='56px SimSun, STSong, serif';c.fillText('漳州市',1020,286);c.fillText('⟶',1020,365);c.fillText('家乡 · '+data.city,1020,465,680);
  const coordinate=(value,positive,negative)=>Math.abs(value).toFixed(2)+'° '+(value>=0?positive:negative);
  c.font='37px serif';c.fillText(coordinate(data.lat,'N','S')+' · '+coordinate(data.lng,'E','W'),1020,550);
  save.onclick=()=>canvas.toBlob(blob=>{
    if(!blob)return;
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='归线票根.png';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  });
  canvas.hidden=false;save.hidden=false;status.hidden=true;
}

showTicket().catch(()=>{status.textContent='票根暂时无法读取，链接可能已过期。';});
