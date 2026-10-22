(function () {
  'use strict';
  const F=globalThis.QingyingFeatures, P=globalThis.QingyingPlanner;
  const $=id=>document.getElementById(id), today=()=>F.localDate();
  const profileFields=['age','height','current','goal','weeks','activity','experience','minutes','days','diet','equipment','place'];
  const numbers=['age','height','current','goal','weeks','minutes','days'];
  const form=$('plan-form'),fields=Object.fromEntries(profileFields.map(key=>[key,form.querySelector(`[name="${key}"]`)]));
  const exampleProfile=readForm();
  const store=F.createStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)},P.validate,today);
  let state=F.emptyState(),previous=null,currentData=null,currentPlan=null,range=30,pendingImport=null,profileDraft=false,feelingsDraft=false;
  let selectedDay=(new Date(today()+'T12:00:00Z').getUTCDay()+6)%7,readBlocked=false,writeConflict=false,unsaved=false;
  function node(tag,text,className) {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
  function status(text,warning=false) {$('save-status').textContent=text;$('save-status').classList.toggle('warning',warning);}
  function message(text,error=false) {$('data-message').textContent=text;$('data-message').classList.toggle('error-message',error);}
  function readForm() {const data=Object.fromEntries(profileFields.map(key=>[key,numbers.includes(key)?Number(fields[key].value):fields[key].value]));data.health=[...form.querySelectorAll('[name="health"]:checked')].map(el=>el.value);return data;}
  function restoreProfile(profile) {
    for(const key of profileFields){const el=fields[key];if(profile)el.value=profile[key];else if(el.tagName==='SELECT'){const index=[...el.options].findIndex(o=>o.defaultSelected);el.selectedIndex=index<0?0:index;}else el.value=el.defaultValue;}
    for(const el of form.querySelectorAll('[name="health"]'))el.checked=profile?profile.health.includes(el.value):false;
  }
  function recentCheckin() {const last=state.checkins.at(-1);return last && last.date>=F.addDays(today(),-13)?last:null;}
  function save(next,replace=false) {
    state=F.normalizeState(next,P.validate,today());unsaved=true;
    if(writeConflict&&!replace){status('其他页面已有更新记录，本次改动仅暂存于页面。请先导出备份，再刷新；也可通过确认导入来替换。',true);return false;}
    if(readBlocked&&!replace){status('原数据无法读取，已保留。本次改动仅暂存于页面；请导出备份，或确认清空后重新保存。',true);return false;}
    try {store.save(state);readBlocked=false;writeConflict=false;unsaved=false;status('已保存到此浏览器 · 刷新后可继续记录');return true;}
    catch {status('本次改动未保存，仅暂存于页面。浏览器存储不可用或空间不足，请先导出备份。',true);return false;}
  }
  function changes(oldPlan,newPlan) {
    if(!oldPlan)return [state.profile?'已恢复保存的资料、记录和每日计划。':'当前展示示例计划。更新资料后会保存在此浏览器。'];
    const list=[];
    if(oldPlan.summary!==newPlan.summary)list.push('目标节奏与适用范围已按资料更新。');
    if(oldPlan.bmiText!==newPlan.bmiText)list.push(`体型参考：BMI 从 ${oldPlan.bmiText} 更新为 ${newPlan.bmiText}。`);
    if(JSON.stringify(oldPlan.week.map(d=>d.meals))!==JSON.stringify(newPlan.week.map(d=>d.meals)))list.push('每日三餐和替换食材已按饮食偏好更新。');
    if(JSON.stringify(oldPlan.week.map(d=>d.workout))!==JSON.stringify(newPlan.week.map(d=>d.workout)))list.push('每日运动步骤、时长和休息已重新安排。');
    if(oldPlan.adaptNote!==newPlan.adaptNote)list.push('体重趋势或近期感受更新了调整建议。');
    return list.length?list:['资料和记录已更新，目前主要建议无需改变。'];
  }
  function renderPlan(data) {
    const plan=P.buildPlan(data,state.records,recentCheckin());
    for(const [key,id] of [['headline','headline'],['summary','summary'],['paceText','pace'],['durationText','duration'],['bmiText','bmi'],['bmiLabel','bmi-label'],['bmiNote','bmi-note'],['firstStep','first-step'],['stepNote','step-note'],['weekIntro','week-intro'],['mealGuidance','meal-guidance'],['mealExample','meal-example'],['adaptNote','adapt-note']])$(id).textContent=plan[key];
    $('why-list').replaceChildren(...plan.why.map(text=>node('div',text,'why-item')));
    $('change-list').replaceChildren(...changes(previous,plan).map(text=>node('li',text)));
    currentData=data;currentPlan=plan;previous=plan;$('plan-error').textContent='';
    $('week-grid').replaceChildren(...plan.week.map((day,index)=>{
      const button=node('button',undefined,'day');button.type='button';button.setAttribute('aria-pressed',String(index===selectedDay));button.setAttribute('aria-controls','daily-detail');
      button.append(node('strong',day.day),node('span',day.title),node('small',day.duration));
      button.addEventListener('click',()=>{selectedDay=index;for(const [i,b] of [...$('week-grid').children].entries())b.setAttribute('aria-pressed',String(i===index));renderDaily();});
      return button;
    }));renderDaily();
  }
  function renderDaily() {
    const day=currentPlan.week[selectedDay],box=$('daily-detail');box.replaceChildren();
    const heading=node('div',undefined,'daily-heading'),copy=node('div');copy.append(node('h3',day.day+' · 吃饭与活动'));copy.lastChild.id='daily-title';copy.append(node('p','按你的条件生成的一周参考，可按生活节奏调整。'));
    heading.append(copy,node('span',day.workout.totalMinutes?`共约 ${day.workout.totalMinutes} 分钟`:currentPlan.mode==='hold'?'先确认建议':'恢复日','pill'));box.append(heading);
    if(currentPlan.mode==='hold'){box.append(node('p',currentPlan.summary,'subtle'),node('p','这里暂不生成每日食谱或训练动作，请与专业人员确认适合自己的安排。','daily-note'));return;}
    const columns=node('div',undefined,'daily-columns'),meals=node('section'),workout=node('section');meals.append(node('h4','三餐有着落'));
    for(const meal of day.meals){const item=node('article',undefined,'meal-item'),details=node('details');details.append(node('summary','换一种搭配'),node('p',meal.swap));item.append(node('strong',meal.name),node('p',meal.food),details);meals.append(item);}
    meals.append(node('p','这是搭配示例，份量按饥饿感和日常需要调整，不用跳餐。饿时可补充水果、豆浆或其他合适加餐；过敏食材请替换，包装食品注意配料。','daily-note'));
    workout.append(node('h4',day.title));
    if(day.workout.steps.length){const list=node('ol',undefined,'workout-list');day.workout.steps.forEach((step,index)=>{const item=node('li',undefined,'workout-step'),copy=node('div'),head=node('div',undefined,'step-head');head.append(node('strong',step.title),node('span',step.minutes+' 分钟'));copy.append(head,node('p',step.detail));item.append(node('span',String(index+1),'step-index'),copy);list.append(item);});workout.append(list);}
    workout.append(node('p',day.workout.note,'daily-note'));columns.append(meals,workout);box.append(columns);
  }
  function svgNode(tag,attrs,text) {const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));if(text!==undefined)el.textContent=text;return el;}
  function drawChart(summary) {
    const box=$('chart');box.replaceChildren();
    if(summary.records.length<2){box.append(node('p',summary.records.length?`这段时间有 1 条记录：${summary.records[0].weight.toFixed(1)} kg。\n再记录一天，就能查看变化。`:'这段时间还没有体重记录。可以记下今天的体重，或切换时间范围。'));return;}
    const points=summary.points,values=points.flatMap(p=>[p.weight,p.average]);
    const low=Math.min(...values)-.5,high=Math.max(...values)+.5;
    const x=date=>55+(Date.parse(date+'T12:00:00Z')-Date.parse(summary.start+'T12:00:00Z'))/86400000/(range-1)*555;
    const y=value=>170-(value-low)/(high-low)*145;
    const svg=svgNode('svg',{viewBox:'0 0 640 215',role:'img','aria-label':`近 ${range} 天体重图，${points[0].date} 的 ${points[0].weight.toFixed(1)} 千克到 ${points.at(-1).date} 的 ${points.at(-1).weight.toFixed(1)} 千克；详细数值见下方记录。`});
    for(let i=0;i<3;i++){const v=low+(high-low)*i/2,py=y(v);svg.append(svgNode('line',{x1:55,x2:610,y1:py,y2:py,stroke:'#3b535c','stroke-width':1}),svgNode('text',{x:44,y:py+4,'text-anchor':'end',fill:'#a8bebb','font-size':12},v.toFixed(1)));}
    svg.append(svgNode('text',{x:12,y:13,fill:'#a8bebb','font-size':11},'kg'));
    for(const [date,anchor] of [[summary.start,'start'],[F.addDays(summary.start,Math.floor((range-1)/2)),'middle'],[summary.end,'end']])svg.append(svgNode('text',{x:x(date),y:199,'text-anchor':anchor,fill:'#a8bebb','font-size':12},date.slice(5)));
    svg.append(svgNode('polyline',{points:points.map(p=>`${x(p.date)},${y(p.weight)}`).join(' '),fill:'none',stroke:'#8faaa8','stroke-width':2,'stroke-dasharray':'5 5'}));
    svg.append(svgNode('polyline',{points:points.map(p=>`${x(p.date)},${y(p.average)}`).join(' '),fill:'none',stroke:'#d5f468','stroke-width':3,'stroke-linejoin':'round'}));
    for(const p of points){const dot=svgNode('circle',{cx:x(p.date),cy:y(p.weight),r:4,fill:'#bacbc8','data-weight':p.weight});dot.append(svgNode('title',{},`${p.date}：${p.weight.toFixed(1)} kg，7 日均值 ${p.average.toFixed(1)} kg`));svg.append(dot);}box.append(svg);
  }
  function drawRecords() {
    const summary=F.trendSummary(state.records,range,today()),latest=summary.records.at(-1);
    $('latest-weight').textContent=latest?latest.weight.toFixed(1)+' kg':'—';
    $('weight-change').textContent=summary.change===null?'—':(summary.change>0?'+':'')+summary.change.toFixed(1)+' kg';
    $('weight-average').textContent=summary.average===null?'—':summary.average.toFixed(1)+' kg';
    $('trend-note').textContent=`近 ${range} 天有 ${summary.records.length} 条记录；最近 7 天均值基于 ${summary.averageCount} 次称重。纵轴随数据缩放，留意长期趋势。`;
    drawChart(summary);
    $('entries').replaceChildren(...state.records.slice().reverse().map(record=>{
      const row=node('div',undefined,'entry'),time=node('time',record.date),value=node('span'),del=node('button','删除');time.dateTime=record.date;del.type='button';del.setAttribute('aria-label',`删除 ${record.date} 的记录`);
      del.addEventListener('click',()=>{save({...state,records:state.records.filter(r=>r.date!==record.date)});refresh();});value.append(node('strong',record.weight.toFixed(1)+' kg'),del);row.append(time,value);return row;
    }));$('record-count').textContent=`全部记录（${state.records.length}）`;
  }
  function drawHabits() {
    const date=$('habit-date').value,habit=state.habits[date]||{meal:false,movement:false};$('meal-check').checked=habit.meal;$('movement-check').checked=habit.movement;
    const stats=F.habitStats(state.habits,today());$('habit-days').textContent=stats.days+' 天';$('habit-streak').textContent=stats.streak+' 天';$('habit-counts').textContent=`最近 7 天：饮食 ${stats.mealDays} 天，活动／恢复 ${stats.movementDays} 天。任一项完成即计为打卡一天。`;
    $('habit-history').replaceChildren(...Array.from({length:7},(_,i)=>{const date=F.addDays(today(),-i),h=state.habits[date];const item=node('li');item.append(node('time',date),node('span',`${h?.meal?'✓ 饮食':'— 饮食'}　${h?.movement?'✓ 活动／恢复':'— 活动／恢复'}`,h?.meal||h?.movement?'done':''));return item;}));
  }
  const feelLabels={fatigue:{low:'疲劳不明显',medium:'有一点疲劳',high:'很疲劳'},hunger:{low:'饥饿不明显',medium:'有一点饿',high:'经常很饿'},completion:{low:'很难完成',medium:'完成一半',high:'大多完成'}};
  function drawFeelings() {$('checkin-count').textContent=`最近的感受记录（共 ${state.checkins.length} 条）`;$('checkin-history').replaceChildren(...state.checkins.slice(-5).reverse().map(item=>{const row=node('div',undefined,'checkin-entry'),time=node('time',item.date);time.dateTime=item.date;row.append(time,node('span',['fatigue','hunger','completion'].map(k=>feelLabels[k][item[k]]).join(' · ')));return row;}));if(!state.checkins.length)$('checkin-history').append(node('p','还没有感受记录。'));}
  function restoreFeelings() {const item=state.checkins.find(c=>c.date===$('checkin-date').value);for(const key of ['fatigue','hunger','completion'])$('checkin-form').querySelector(`[name="${key}"]`).value=item?item[key]:key==='completion'?'high':'low';feelingsDraft=false;}
  function refresh() {renderPlan(currentData||state.profile||readForm());drawRecords();drawHabits();drawFeelings();}
  function restoreAll(preserveDrafts=false) {previous=null;if(!preserveDrafts||!profileDraft){restoreProfile(state.profile);profileDraft=false;}currentData=state.profile||exampleProfile;if(!preserveDrafts||!feelingsDraft)restoreFeelings();refresh();}
  for(const id of ['record-date','habit-date','checkin-date']){$(id).max=today();$(id).value=today();}
  try {state=store.load();status(state.profile||state.records.length||state.checkins.length||Object.keys(state.habits).length?'已恢复此浏览器保存的资料和记录':'当前资料为示例。更新计划、记录或打卡后会自动保存在此浏览器。');}
  catch {readBlocked=true;status('原数据暂时无法读取，已保留。可以导入备份，或确认清空后重新开始；当前页面从示例展示。',true);}
  restoreAll();

  form.addEventListener('input',()=>{profileDraft=true;});form.addEventListener('change',()=>{profileDraft=true;});
  $('checkin-form').addEventListener('change',()=>{feelingsDraft=true;});
  $('update-plan').addEventListener('click',()=>{try{const data=readForm();P.validate(data);save({...state,profile:data});profileDraft=false;renderPlan(data);}catch(error){$('plan-error').textContent=error.message;}});
  $('add-record').addEventListener('click',()=>{try{const date=$('record-date').value,weight=Number($('record-weight').value);if(!F.validDate(date,today())||!Number.isFinite(weight)||weight<30||weight>300)throw new Error('请填写今天或之前的有效日期，以及 30–300 kg 之间的体重。');save({...state,records:[...state.records.filter(r=>r.date!==date),{date,weight:Math.round(weight*10)/10}].sort((a,b)=>a.date.localeCompare(b.date))});$('record-error').textContent='';$('record-weight').value='';refresh();}catch(error){$('record-error').textContent=error.message;}});
  for(const button of document.querySelectorAll('[data-range]'))button.addEventListener('click',()=>{range=Number(button.dataset.range);for(const b of document.querySelectorAll('[data-range]'))b.setAttribute('aria-pressed',String(b===button));drawRecords();});
  $('habit-date').addEventListener('change',()=>{if(F.validDate($('habit-date').value,today())){$('habit-error').textContent='';drawHabits();}else{$('habit-error').textContent='请选择今天或之前的有效日期。';$('meal-check').checked=false;$('movement-check').checked=false;}});
  for(const id of ['meal-check','movement-check'])$(id).addEventListener('change',()=>{const date=$('habit-date').value;if(!F.validDate(date,today())){$('habit-error').textContent='请选择今天或之前的有效日期。';$(id).checked=false;return;}const habits={...state.habits,[date]:{meal:$('meal-check').checked,movement:$('movement-check').checked}};if(!habits[date].meal&&!habits[date].movement)delete habits[date];save({...state,habits});$('habit-error').textContent='';drawHabits();});
  $('checkin-date').addEventListener('change',restoreFeelings);
  $('update-checkin').addEventListener('click',()=>{const date=$('checkin-date').value;if(!F.validDate(date,today())){$('checkin-error').textContent='请选择今天或之前的有效日期。';return;}const item={date};for(const key of ['fatigue','hunger','completion'])item[key]=$('checkin-form').querySelector(`[name="${key}"]`).value;save({...state,checkins:[...state.checkins.filter(c=>c.date!==date),item].sort((a,b)=>a.date.localeCompare(b.date))});feelingsDraft=false;$('checkin-error').textContent='';refresh();});
  for(const [group,button] of [['plan-form','update-plan'],['record-form','add-record'],['checkin-form','update-checkin']])$(group).addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName==='INPUT'){event.preventDefault();$(button).click();}});

  $('export-data').addEventListener('click',()=>{const blob=new Blob([F.exportBackup(state)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download='轻盈计划备份-'+today()+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('备份已生成，包含资料、体重、打卡和感受记录。请妥善保管。');});
  $('import-data').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async()=>{const input=$('import-file'),file=input.files[0];if(!file)return;input.disabled=true;try{if(file.size>2*1024*1024)throw new Error('备份过大，文件需小于 2 MB。');pendingImport=F.parseBackup(await file.text(),P.validate,today());$('import-summary').textContent=`备份包含 ${pendingImport.records.length} 条体重、${Object.keys(pendingImport.habits).length} 天打卡、${pendingImport.checkins.length} 条感受记录，${pendingImport.profile?'包含个人资料':'不包含个人资料'}。确认后会替换当前资料和记录，建议先导出当前备份。`;$('import-dialog').showModal();message('请核对备份内容，再确认导入。');}catch(error){pendingImport=null;message(error.message,true);}finally{input.value='';input.disabled=false;}});
  $('cancel-import').addEventListener('click',()=>$('import-dialog').close());
  $('confirm-import').addEventListener('click',()=>{if(!pendingImport)return;const saved=save(pendingImport,true);$('import-dialog').close();restoreAll();message(saved?'已导入并保存备份。':'备份已载入当前页，但尚未保存到浏览器；请保留原备份。',!saved);});
  $('import-dialog').addEventListener('close',()=>{pendingImport=null;});
  $('clear-session').addEventListener('click',()=>{if(!confirm('清空此浏览器中的全部资料、体重、打卡和感受记录？此操作无法撤销，建议先导出备份。'))return;try{store.clear();state=F.emptyState();readBlocked=false;writeConflict=false;unsaved=false;for(const id of ['record-date','habit-date','checkin-date'])$(id).value=today();$('record-weight').value='';for(const id of ['record-error','plan-error','habit-error','checkin-error'])$(id).textContent='';restoreAll();status('已清空此浏览器中的资料和记录。当前展示示例。');message('已清空。需要时可重新导入备份。');}catch{message('无法清空浏览器存储，当前资料仍保留。请先导出备份并检查浏览器设置。',true);}});

  window.addEventListener('storage',event=>{if(event.key!==F.STORAGE_KEY&&event.key!==null)return;if(unsaved){writeConflict=true;status('其他页面更新了记录；本页有未保存改动，请先导出备份，再刷新查看最新记录。',true);return;}try{state=store.load();readBlocked=false;writeConflict=false;restoreAll(true);status(profileDraft||feelingsDraft?'已同步其他页面的记录，并保留本页尚未提交的表单内容。':'已同步同一浏览器其他页面的记录。');}catch{readBlocked=true;status('其他页面的数据无法读取，原数据已保留。请先导出当前备份。',true);}});
  let lastDay=today();
  function refreshDates(){const now=today();if(now===lastDay)return;for(const id of ['record-date','habit-date','checkin-date']){const el=$(id);el.max=now;if(el.value===lastDay)el.value=now;}lastDay=now;selectedDay=(new Date(now+'T12:00:00Z').getUTCDay()+6)%7;restoreFeelings();refresh();}
  window.addEventListener('focus',refreshDates);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDates();});
})();
