const form=document.querySelector('#searchForm');
const plateInput=document.querySelector('#plate');
const button=document.querySelector('#searchButton');
const message=document.querySelector('#message');
const result=document.querySelector('#result');
const vehicleName=document.querySelector('#vehicleName');
const vehicleSub=document.querySelector('#vehicleSub');
const latestKm=document.querySelector('#latestKm');
const alertBox=document.querySelector('#alert');
const consistencyBadge=document.querySelector('#consistencyBadge');
const inspectionCount=document.querySelector('#inspectionCount');
const historyList=document.querySelector('#historyList');
const canvas=document.querySelector('#kmChart');
const ctx=canvas.getContext('2d');
let chartData=[];

form.addEventListener('submit',async event=>{
  event.preventDefault();
  const plate=plateInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  hideMessage(); result.classList.add('hidden'); button.disabled=true; button.textContent='Consultando...';
  try {
    const response=await fetch(`/api/vistorias?placa=${encodeURIComponent(plate)}`);
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Erro ao consultar o veículo.');
    renderResult(data);
  } catch(error) { showMessage(error.message,true); }
  finally { button.disabled=false; button.textContent='Consultar'; }
});

function renderResult(raw){
  const inspections=normalizeInspections(raw);
  if(!inspections.length){ showMessage('Nenhuma vistoria válida foi retornada para essa placa.'); return; }
  chartData=inspections.filter(item=>Number.isFinite(item.km)).sort((a,b)=>a.dateValue-b.dateValue);
  if(!chartData.length){ showMessage('A API retornou vistorias, mas nenhuma possui quilometragem numérica.'); return; }
  const v=chartData[0].vehicle||{};
  vehicleName.textContent=v?.marca?.descricao||'Modelo não informado';
  vehicleSub.textContent=[v?.tipo?.descricao,v?.anoModelo?`Ano/modelo ${v.anoModelo}`:'',`Placa ${chartData[chartData.length-1].plate}`].filter(Boolean).join(' · ');
  latestKm.textContent=formatKm(chartData[chartData.length-1].km);
  inspectionCount.textContent=`${inspections.length} vistoria${inspections.length===1?'':'s'}`;
  const analysis=analyzeMileage(chartData); renderAnalysis(analysis); renderHistory(chartData); drawChart(chartData,analysis); result.classList.remove('hidden');
}
function normalizeInspections(raw){
  const list=Array.isArray(raw)?raw:(Array.isArray(raw?.data)?raw.data:[]);
  return list.map(item=>{
    const vehicle=item?.veiculo||{}; const km=Number(vehicle.km); const dateRaw=item?.dataVistoria||item?.data||null; const dateValue=dateRaw?new Date(dateRaw).getTime():0;
    return {id:item?.id,plate:vehicle?.placa||plateInput.value.toUpperCase(),km,dateRaw,dateValue,modality:item?.modalidade||'Vistoria',situation:item?.situacao?.descricao||'Não informado',vehicle};
  }).filter(item=>item.dateValue||Number.isFinite(item.km));
}
function analyzeMileage(items){
  let reduction=null;
  for(let i=1;i<items.length;i++){
    const previous=items[i-1].km,current=items[i].km;
    if(Number.isFinite(previous)&&Number.isFinite(current)&&current<previous){ const amount=previous-current; if(!reduction||amount>reduction.amount) reduction={index:i,previous,current,amount,previousDate:items[i-1].dateRaw,currentDate:items[i].dateRaw}; }
  }
  return {hasReduction:Boolean(reduction),reduction};
}
function renderAnalysis(analysis){
  if(analysis.hasReduction){ const r=analysis.reduction; consistencyBadge.textContent='Possível alteração'; consistencyBadge.classList.add('danger'); alertBox.classList.remove('hidden'); alertBox.innerHTML=`<strong>⚠ Possível alteração na quilometragem</strong><div class="reduction">-${formatKm(r.amount)}</div><div>A quilometragem caiu de <b>${formatKm(r.previous)}</b> para <b>${formatKm(r.current)}</b> entre ${formatDate(r.previousDate)} e ${formatDate(r.currentDate)}.</div>`; }
  else { consistencyBadge.textContent='Quilometragem consistente'; consistencyBadge.classList.remove('danger'); alertBox.classList.add('hidden'); alertBox.innerHTML=''; }
}
function renderHistory(items){
  historyList.innerHTML='';
  [...items].reverse().forEach((item,reverseIndex)=>{ const originalIndex=items.length-1-reverseIndex; const previous=originalIndex>0?items[originalIndex-1].km:null; const down=Number.isFinite(previous)&&item.km<previous; const delta=Number.isFinite(previous)?item.km-previous:null; const el=document.createElement('div'); el.className='history-item'; el.innerHTML=`<div><strong>${formatDate(item.dateRaw)}</strong><small>${escapeHtml(item.modality)}</small></div><div class="${down?'km-down':'km-up'}">${formatKm(item.km)} ${down?`(${formatSignedKm(delta)})`:''}</div><div><small>${escapeHtml(item.situation)}</small></div>`; historyList.appendChild(el); });
}
function drawChart(items,analysis){
  const dpr=window.devicePixelRatio||1,rect=canvas.getBoundingClientRect(),width=Math.max(320,rect.width),height=Math.max(220,rect.height); canvas.width=Math.round(width*dpr); canvas.height=Math.round(height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
  const pad={left:52,right:18,top:26,bottom:42},plotW=width-pad.left-pad.right,plotH=height-pad.top-pad.bottom,minKm=Math.min(...items.map(x=>x.km)),maxKm=Math.max(...items.map(x=>x.km)),range=Math.max(maxKm-minKm,1),yMin=Math.max(0,minKm-range*.12),yMax=maxKm+range*.12;
  const x=i=>pad.left+(items.length===1?plotW/2:(i/(items.length-1))*plotW), y=km=>pad.top+(1-((km-yMin)/(yMax-yMin)))*plotH;
  ctx.font='12px system-ui,sans-serif'; ctx.fillStyle='#64748b'; ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){ const yy=pad.top+(i/4)*plotH; ctx.beginPath();ctx.moveTo(pad.left,yy);ctx.lineTo(width-pad.right,yy);ctx.stroke(); const value=yMax-(i/4)*(yMax-yMin); ctx.fillText(formatShortKm(value),4,yy+4); }
  const points=items.map((item,i)=>({x:x(i),y:y(item.km),item}));
  const gradient=ctx.createLinearGradient(0,pad.top,0,height-pad.bottom); gradient.addColorStop(0,'rgba(22,163,74,.16)'); gradient.addColorStop(1,'rgba(22,163,74,0)'); ctx.beginPath(); ctx.moveTo(points[0].x,height-pad.bottom); points.forEach(p=>ctx.lineTo(p.x,p.y)); ctx.lineTo(points[points.length-1].x,height-pad.bottom); ctx.closePath(); ctx.fillStyle=gradient; ctx.fill();
  for(let i=1;i<points.length;i++){ const a=points[i-1],b=points[i],down=b.item.km<a.item.km; ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=down?'#dc2626':'#16a34a';ctx.lineWidth=3;ctx.lineCap='round';ctx.stroke(); }
  points.forEach((p,i)=>{ const down=i>0&&p.item.km<points[i-1].item.km; ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle=down?'#dc2626':'#16a34a';ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#fff';ctx.stroke(); ctx.fillStyle=down?'#dc2626':'#16a34a';ctx.font='700 11px system-ui,sans-serif';ctx.textAlign=i===0?'left':(i===points.length-1?'right':'center');ctx.fillText(formatShortKm(p.item.km),p.x,p.y-12);ctx.fillStyle='#64748b';ctx.font='11px system-ui,sans-serif';ctx.fillText(formatDateShort(p.item.dateRaw),p.x,height-15); });
}
window.addEventListener('resize',()=>{if(!result.classList.contains('hidden')&&chartData.length)drawChart(chartData,analyzeMileage(chartData));});
function formatKm(value){return `${Math.round(value).toLocaleString('pt-BR')} km`;}
function formatSignedKm(value){const sign=value>0?'+':'';return `${sign}${Math.round(value).toLocaleString('pt-BR')} km`;}
function formatShortKm(value){return `${Math.round(value/1000)}k`;}
function formatDate(value){if(!value)return'data não informada';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('pt-BR');}
function formatDateShort(value){if(!value)return'';const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function showMessage(text,error=false){message.textContent=text;message.classList.remove('hidden');message.classList.toggle('error',error);}
function hideMessage(){message.classList.add('hidden');message.textContent='';}
