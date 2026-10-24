(function () {
  'use strict';
  const F=globalThis.QingyingFeatures, P=globalThis.QingyingPlanner;
  const $=id=>document.getElementById(id), today=()=>F.localDate();
  const profileFields=['age','height','current','goal','weeks','activity','experience','minutes','days','diet','equipment','place'];
  const numbers=['age','height','current','goal','weeks','minutes','days'];
  const form=$('plan-form'),fields=Object.fromEntries(profileFields.map(key=>[key,form.querySelector(`[name="${key}"]`)]));
  const exampleProfile={age:25,height:170,current:75,goal:70,weeks:12,activity:'low',experience:'beginner',minutes:20,days:3,diet:'balanced',equipment:'none',place:'home',health:[]};
  const store=F.createStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)},P.validate,today);
  let state=F.emptyState(),previous=null,currentData=null,currentPlan=null,range=30,pendingImport=null,profileDraft=false,feelingsDraft=false;
  let selectedDay=(new Date(today()+'T12:00:00Z').getUTCDay()+6)%7,readBlocked=false,writeConflict=false,unsaved=false;
  let exampleMode=false,route={screen:'home',step:null,panel:null},router;
  const steps=['basic','habits','health'];
  function node(tag,text,className) {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
  function status(text,warning=false) {$('save-status').textContent=text;$('save-status').classList.toggle('warning',warning);$('storage-warning').textContent=warning?text:'';$('storage-warning').hidden=!warning;$('profile-note').textContent=warning?text:'未提交的填写内容仅在当前页面保留。';$('profile-note').classList.toggle('warning',warning);}
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
    if(!oldPlan)return [exampleMode?'当前展示示例计划，未将示例资料保存为你的资料。':'已按提交的资料生成计划，记录保存在当前浏览器。'];
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
    const compact=plan.mode==='active'&&plan.headline.startsWith('按每周约 ');
    document.querySelector('.overview').classList.toggle('compact-plan',compact);
    if(compact){$('headline').textContent=plan.headline.replace(/^按每周约 /,'每周约 ').replace(' 的节奏，','，');$('summary').textContent='这里只是目标平均值，实际体重会波动。';}
    $('why-list').replaceChildren(...plan.why.map(text=>node('div',text,'why-item')));
    $('change-list').replaceChildren(...changes(previous,plan).map(text=>node('li',text)));
    currentData=data;currentPlan=plan;previous=plan;
    $('first-step').textContent=plan.mode==='hold'?plan.firstStep:plan.firstStep.replace('每周安排 ','');
    $('target-current').textContent=data.current+' kg';$('target-goal').textContent=data.goal+' kg';$('target-row').hidden=plan.mode!=='active';
    $('week-grid').replaceChildren(...plan.week.map((day,index)=>{
      const button=node('button',undefined,'day');button.type='button';button.setAttribute('aria-pressed',String(index===selectedDay));button.setAttribute('aria-controls','daily-detail');
      button.setAttribute('aria-label',`${day.day}，${day.title}，${day.duration}`);
      const shortTitle=day.title==='休息或轻松走动'?'恢复':day.title==='暂不安排'?'暂停':day.title.includes('力量')?'力量':'有氧';
      button.append(node('strong',day.day),node('span',shortTitle));
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
    const width=Math.max(260,Math.min(640,box.clientWidth||640)),right=width-20;
    const low=Math.min(...values)-.5,high=Math.max(...values)+.5;
    const x=date=>55+(Date.parse(date+'T12:00:00Z')-Date.parse(summary.start+'T12:00:00Z'))/86400000/(range-1)*(right-55);
    const y=value=>170-(value-low)/(high-low)*145;
    const svg=svgNode('svg',{viewBox:`0 0 ${width} 215`,role:'img','aria-label':`近 ${range} 天体重图，${points[0].date} 的 ${points[0].weight.toFixed(1)} 千克到 ${points.at(-1).date} 的 ${points.at(-1).weight.toFixed(1)} 千克；详细数值见下方记录。`});
    for(let i=0;i<3;i++){const v=low+(high-low)*i/2,py=y(v);svg.append(svgNode('line',{x1:55,x2:right,y1:py,y2:py,stroke:'#E3E7E4','stroke-width':1}),svgNode('text',{x:44,y:py+4,'text-anchor':'end',fill:'#65686D','font-size':12},v.toFixed(1)));}
    svg.append(svgNode('text',{x:12,y:13,fill:'#65686D','font-size':11},'kg'));
    for(const [date,anchor] of [[summary.start,'start'],[F.addDays(summary.start,Math.floor((range-1)/2)),'middle'],[summary.end,'end']])svg.append(svgNode('text',{x:x(date),y:199,'text-anchor':anchor,fill:'#65686D','font-size':12},date.slice(5)));
    svg.append(svgNode('polyline',{points:points.map(p=>`${x(p.date)},${y(p.weight)}`).join(' '),fill:'none',stroke:'#8A9C94','stroke-width':2,'stroke-dasharray':'5 5'}));
    svg.append(svgNode('polyline',{points:points.map(p=>`${x(p.date)},${y(p.average)}`).join(' '),fill:'none',stroke:'#176149','stroke-width':3,'stroke-linejoin':'round'}));
    for(const p of points){const dot=svgNode('circle',{cx:x(p.date),cy:y(p.weight),r:4,fill:'#536E61','data-weight':p.weight});dot.append(svgNode('title',{},`${p.date}：${p.weight.toFixed(1)} kg，7 日均值 ${p.average.toFixed(1)} kg`));svg.append(dot);}box.append(svg);
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
  function updatePlanState() {
    const pending=!!currentData&&JSON.stringify(readForm())!==JSON.stringify(currentData)&&profileDraft;
    $('plan-pending').hidden=!pending;
    $('plan-badge').textContent=exampleMode?'示例计划':currentData?'按你的资料生成':'尚未生成';
    $('plan-caption').textContent=exampleMode?'示例建议，请按自己的资料重新生成。':pending?'资料已修改，重新生成后才会更新建议。':'先找到能坚持的节奏，再把变化记下来。';
    $('return-plan').hidden=!currentData;
    $('update-plan').firstChild.nodeValue=currentData&&!exampleMode?'重新生成计划 ':'生成我的计划 ';
    const latest=state.records.at(-1);
    $('overview-record-note').textContent=latest?`最近一次：${latest.date}，${latest.weight.toFixed(1)} kg。查看你的实际记录与变化。`:'还没有体重记录，先记下第一次体重吧。';
  }
  function refresh() {
    $('plan-content').hidden=!currentData;$('plan-empty').hidden=!!currentData;$('week').hidden=!currentData;$('week-empty').hidden=!!currentData;
    if(currentData)renderPlan(currentData);else{currentPlan=null;$('adapt-note').textContent='先填写资料并生成计划，再结合体重记录和身体感受查看建议。';}
    drawRecords();drawHabits();drawFeelings();updatePlanState();
  }
  function restoreAll(preserveDrafts=false) {previous=null;if(!preserveDrafts||!profileDraft){restoreProfile(state.profile);profileDraft=false;}currentData=exampleMode?exampleProfile:state.profile;if(!preserveDrafts||!feelingsDraft)restoreFeelings();refresh();}
  function showRoute(next) {
    route=next;
    for(const screen of document.querySelectorAll('[data-screen]'))screen.hidden=screen.dataset.screen!==route.screen;
    for(const group of document.querySelectorAll('[data-profile-step]'))group.hidden=group.dataset.profileStep!==route.step;
    for(const panel of document.querySelectorAll('[data-plan-panel]'))panel.hidden=panel.dataset.planPanel!==route.panel;
    for(const button of document.querySelectorAll('[data-step-target]')){if(button.dataset.stepTarget===route.step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');}
    for(const link of document.querySelectorAll('a[href^="#/"]')){if(link.getAttribute('href')===route.hash)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    $('previous-profile').hidden=route.step==='basic';$('next-profile').hidden=route.step==='health';$('update-plan').hidden=route.step!=='health';
    const titles={overview:'你的轻盈计划',week:'饮食与运动',records:'记录与回顾'};
    $('plan-view-title').textContent=titles[route.panel]||titles.overview;
    document.querySelector('.mobile-edit').hidden=route.screen!=='plan';
    document.querySelector('.mobile-menu').open=false;
    if(route.screen==='plan'&&route.panel==='records')drawRecords();
    const heading=route.screen==='home'?$('home-title'):route.screen==='profile'?$('profile-view-title'):$('plan-view-title');
    document.title=heading.textContent.replace(/\s+/g,'')+'｜轻盈计划';heading.focus({preventScroll:true});window.scrollTo(0,0);
    updatePlanState();
  }
  function clearProfileErrors() {
    for(const key of profileFields){fields[key].removeAttribute('aria-invalid');$(key+'-error').hidden=true;}
    $('plan-error').hidden=true;$('plan-error').textContent='';
  }
  function validateProfile(complete=false) {
    clearProfileErrors();
    const labels={age:'年龄',height:'身高',current:'目前体重',goal:'目标体重',weeks:'计划周期'};
    let first=null;
    for(const key of ['age','height','current','goal','weeks']){
      const el=fields[key];if(el.validity.valid)continue;
      const text=el.validity.valueMissing||el.validity.badInput?`请填写${labels[key]}。`:`${labels[key]}需在 ${el.min}–${el.max} 之间${el.step==='1'?'，请填写整数':''}。`;
      el.setAttribute('aria-invalid','true');$(key+'-error').textContent=text;$(key+'-error').hidden=false;first=first||el;
    }
    if(!first&&complete){try{P.validate(readForm());}catch(error){first=fields.goal;first.setAttribute('aria-invalid','true');$('goal-error').textContent=error.message;$('goal-error').hidden=false;}}
    if(first){
      $('plan-error').textContent='请检查标出的资料，再继续。';$('plan-error').hidden=false;
      if(route.step!=='basic'){router.go('#/profile/basic');setTimeout(()=>first.focus(),0);}else first.focus();
      return false;
    }
    return true;
  }
  for(const id of ['record-date','habit-date','checkin-date']){$(id).max=today();$(id).value=today();}
  try {state=store.load();status(state.profile||state.records.length||state.checkins.length||Object.keys(state.habits).length?'已恢复此浏览器保存的资料和记录':'还没有保存数据。生成计划、记录或打卡后会保存在此浏览器。');}
  catch {readBlocked=true;status('原数据暂时无法读取，已保留。可以导入备份，或确认清空后重新开始。',true);}
  restoreAll();
  router=globalThis.QingyingRouter.start(showRoute);
  window.addEventListener('resize',()=>{if(route.screen==='plan'&&route.panel==='records')drawRecords();});
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest('a[href^="#/"]');if(!link)return;
    event.preventDefault();router.go(link.getAttribute('href'));
  });
  document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();$('main-content').focus();});

  const markProfileDraft=()=>{profileDraft=true;updatePlanState();};
  form.addEventListener('input',markProfileDraft);form.addEventListener('change',markProfileDraft);
  $('checkin-form').addEventListener('change',()=>{feelingsDraft=true;});
  $('next-profile').addEventListener('click',()=>{if(validateProfile())router.go('#/profile/'+steps[Math.min(2,steps.indexOf(route.step)+1)]);});
  $('previous-profile').addEventListener('click',()=>router.go('#/profile/'+steps[Math.max(0,steps.indexOf(route.step)-1)]));
  for(const button of document.querySelectorAll('[data-step-target]'))button.addEventListener('click',()=>{if(steps.indexOf(button.dataset.stepTarget)<=steps.indexOf(route.step)||validateProfile())router.go('#/profile/'+button.dataset.stepTarget);});
  form.addEventListener('submit',event=>{event.preventDefault();if(!validateProfile(true))return;const data=readForm();save({...state,profile:data});currentData=data;exampleMode=false;profileDraft=false;refresh();router.go('#/plan/overview');});
  $('view-example').addEventListener('click',()=>{exampleMode=true;previous=null;currentData=exampleProfile;refresh();router.go('#/plan/overview');});
  $('add-record').addEventListener('click',()=>{try{const date=$('record-date').value,weight=Number($('record-weight').value);if(!F.validDate(date,today())||!Number.isFinite(weight)||weight<30||weight>300)throw new Error('请填写今天或之前的有效日期，以及 30–300 kg 之间的体重。');save({...state,records:[...state.records.filter(r=>r.date!==date),{date,weight:Math.round(weight*10)/10}].sort((a,b)=>a.date.localeCompare(b.date))});$('record-error').textContent='';$('record-weight').value='';refresh();}catch(error){$('record-error').textContent=error.message;}});
  for(const button of document.querySelectorAll('[data-range]'))button.addEventListener('click',()=>{range=Number(button.dataset.range);for(const b of document.querySelectorAll('[data-range]'))b.setAttribute('aria-pressed',String(b===button));drawRecords();});
  $('habit-date').addEventListener('change',()=>{if(F.validDate($('habit-date').value,today())){$('habit-error').textContent='';drawHabits();}else{$('habit-error').textContent='请选择今天或之前的有效日期。';$('meal-check').checked=false;$('movement-check').checked=false;}});
  for(const id of ['meal-check','movement-check'])$(id).addEventListener('change',()=>{const date=$('habit-date').value;if(!F.validDate(date,today())){$('habit-error').textContent='请选择今天或之前的有效日期。';$(id).checked=false;return;}const habits={...state.habits,[date]:{meal:$('meal-check').checked,movement:$('movement-check').checked}};if(!habits[date].meal&&!habits[date].movement)delete habits[date];save({...state,habits});$('habit-error').textContent='';drawHabits();});
  $('checkin-date').addEventListener('change',restoreFeelings);
  $('update-checkin').addEventListener('click',()=>{const date=$('checkin-date').value;if(!F.validDate(date,today())){$('checkin-error').textContent='请选择今天或之前的有效日期。';return;}const item={date};for(const key of ['fatigue','hunger','completion'])item[key]=$('checkin-form').querySelector(`[name="${key}"]`).value;save({...state,checkins:[...state.checkins.filter(c=>c.date!==date),item].sort((a,b)=>a.date.localeCompare(b.date))});feelingsDraft=false;$('checkin-error').textContent='';refresh();});
  form.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName==='INPUT'&&event.target.type!=='checkbox'&&route.step!=='health'){event.preventDefault();$('next-profile').click();}});
  for(const [group,button] of [['record-form','add-record'],['checkin-form','update-checkin']])$(group).addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName==='INPUT'){event.preventDefault();$(button).click();}});

  $('export-data').addEventListener('click',()=>{const blob=new Blob([F.exportBackup(state)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download='轻盈计划备份-'+today()+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('备份已生成，包含资料、体重、打卡和感受记录。请妥善保管。');});
  $('import-data').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async()=>{const input=$('import-file'),file=input.files[0];if(!file)return;input.disabled=true;try{if(file.size>2*1024*1024)throw new Error('备份过大，文件需小于 2 MB。');pendingImport=F.parseBackup(await file.text(),P.validate,today());$('import-summary').textContent=`备份包含 ${pendingImport.records.length} 条体重、${Object.keys(pendingImport.habits).length} 天打卡、${pendingImport.checkins.length} 条感受记录，${pendingImport.profile?'包含个人资料':'不包含个人资料'}。确认后会替换当前资料和记录，建议先导出当前备份。`;$('import-dialog').showModal();message('请核对备份内容，再确认导入。');}catch(error){pendingImport=null;message(error.message,true);}finally{input.value='';input.disabled=false;}});
  $('cancel-import').addEventListener('click',()=>$('import-dialog').close());
  $('confirm-import').addEventListener('click',()=>{if(!pendingImport)return;const saved=save(pendingImport,true);$('import-dialog').close();exampleMode=false;clearProfileErrors();restoreAll();message(saved?'已导入并保存备份。':'备份已载入当前页，但尚未保存到浏览器；请保留原备份。',!saved);});
  $('import-dialog').addEventListener('close',()=>{pendingImport=null;});
  $('clear-session').addEventListener('click',()=>{if(!confirm('清空此浏览器中的全部资料、体重、打卡和感受记录？此操作无法撤销，建议先导出备份。'))return;try{store.clear();state=F.emptyState();readBlocked=false;writeConflict=false;unsaved=false;exampleMode=false;clearProfileErrors();for(const id of ['record-date','habit-date','checkin-date'])$(id).value=today();$('record-weight').value='';for(const id of ['record-error','plan-error','habit-error','checkin-error'])$(id).textContent='';restoreAll();status('已清空此浏览器中的资料和记录。');message('已清空。需要时可重新导入备份。');}catch{message('无法清空浏览器存储，当前资料仍保留。请先导出备份并检查浏览器设置。',true);}});

  window.addEventListener('storage',event=>{if(event.key!==F.STORAGE_KEY&&event.key!==null)return;if(unsaved){writeConflict=true;status('其他页面更新了记录；本页有未保存改动，请先导出备份，再刷新查看最新记录。',true);return;}try{state=store.load();readBlocked=false;writeConflict=false;restoreAll(true);status(profileDraft||feelingsDraft?'已同步其他页面的记录，并保留本页尚未提交的表单内容。':'已同步同一浏览器其他页面的记录。');}catch{readBlocked=true;status('其他页面的数据无法读取，原数据已保留。请先导出当前备份。',true);}});
  let lastDay=today();
  function refreshDates(){const now=today();if(now===lastDay)return;for(const id of ['record-date','habit-date','checkin-date']){const el=$(id);el.max=now;if(el.value===lastDay)el.value=now;}lastDay=now;selectedDay=(new Date(now+'T12:00:00Z').getUTCDay()+6)%7;restoreFeelings();refresh();}
  window.addEventListener('focus',refreshDates);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDates();});
})();
