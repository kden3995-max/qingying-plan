(function (root) {
  'use strict';

  const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const DAY_SLOTS = {2:[1,5],3:[0,2,5],4:[0,2,4,6],5:[0,1,3,4,6],6:[0,1,2,3,4,5]};
  const ENUMS = {
    activity:['low','some','regular'],experience:['beginner','some','trained'],
    diet:['balanced','vegetarian','dairyfree','quick'],equipment:['none','band','dumbbell','gym'],
    place:['home','outdoor','gym'],health:['knee','injury','chronic','pregnant','breastfeeding','eating']
  };
  const DIETS = {
    balanced:{guidance:'每餐尽量同时安排蔬菜、蛋白质和适量主食，三餐规律；饮料优先选白水。无需靠跳餐来减重。',example:'例子：米饭＋鸡蛋或鱼＋两种蔬菜；按饥饿感调整份量。'},
    vegetarian:{guidance:'按素食习惯搭配：每餐有豆腐、豆类或蛋等蛋白质来源，再配蔬菜和主食；若不吃蛋奶，注意食物种类多样。',example:'例子：杂粮饭＋豆腐或豆类＋一大份蔬菜。'},
    dairyfree:{guidance:'不用乳制品也可以安排规律三餐：蔬菜、蛋白质和主食都保留；饮料优先选白水。',example:'例子：米饭＋鱼、鸡蛋或豆腐＋绿叶菜，避开含乳配料。'},
    quick:{guidance:'做饭时间少时，优先把容易买到的主食、蛋白质和蔬菜搭在一起，避免忙起来只吃零食或漏餐。',example:'例子：便利店饭团或全麦面包＋即食鸡蛋或豆腐＋袋装沙拉。'}
  };
  const LABELS = {beginner:'刚开始运动',some:'有一点基础',trained:'已规律训练',home:'家里',outdoor:'户外',gym:'健身房'};
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const round = n => Math.round(n * 10) / 10;

  function validate(data) {
    if (!data || !Number.isInteger(data.age) || data.age < 13 || data.age > 100 ||
      ![data.height,data.current,data.goal].every(finite) || data.height < 120 || data.height > 230 ||
      data.current < 30 || data.current > 300 || data.goal < 30 || data.goal > 300 ||
      !Number.isInteger(data.weeks) || data.weeks < 1 || data.weeks > 104 ||
      !Number.isInteger(data.minutes) || ![10,20,30,45,60].includes(data.minutes) ||
      !Number.isInteger(data.days) || data.days < 2 || data.days > 6 ||
      Object.entries(ENUMS).some(([key,choices]) => key !== 'health' && !choices.includes(data[key])) ||
      !Array.isArray(data.health) || data.health.some(x => !ENUMS.health.includes(x))) {
      throw new Error('请检查输入：年龄、身高、体重、时间和选择项需要在有效范围内。');
    }
  }

  function weightTrend(records) {
    if (!Array.isArray(records)) return null;
    const valid = records.filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && finite(x.weight) && x.weight >= 30 && x.weight <= 300)
      .sort((a,b) => a.date.localeCompare(b.date));
    if (valid.length < 2) return null;
    const end = valid[valid.length-1], endMs = Date.parse(end.date + 'T12:00:00Z');
    if (Date.now() - endMs > 14 * 86400000) return null;
    const recent = valid.filter(x => endMs - Date.parse(x.date + 'T12:00:00Z') <= 42 * 86400000);
    if (recent.length < 2) return null;
    const first = recent[0], span = (endMs - Date.parse(first.date + 'T12:00:00Z')) / 86400000;
    if (span < 14) return null;
    return {perWeek:round((end.weight - first.weight) * 7 / span),days:span,start:first.weight,end:end.weight};
  }

  function mealFor(data, checkin, mode, trend) {
    if (mode === 'hold') return {guidance:'先以规律进餐、食物多样和照顾身体感受为主。不要根据这里的目标体重自行节食。',example:'有特殊生理阶段或健康情况时，请与医生或营养专业人员确认适合自己的吃法。'};
    const meal = {...DIETS[data.diet]};
    if (checkin?.hunger === 'high' || (trend && trend.perWeek < -0.5)) {
      meal.guidance += ' 你反馈经常很饿，或记录显示下降较快：先保证三餐和需要时的加餐，不再进一步缩减食量。';
    }
    return meal;
  }

  function makeWeek(data, checkin, mode, trend) {
    if (mode === 'hold') return DAYS.map(day => ({day,title:'暂不安排',duration:'先咨询专业人员',detail:'按适合自己的健康建议活动'}));
    const knee = data.health.includes('knee'), senior = data.age >= 65;
    const needEase = checkin?.fatigue === 'high' || checkin?.completion === 'low' || (trend && trend.perWeek < -0.5);
    const activeDays = Math.max(2, data.days - (needEase ? 1 : 0));
    const slots = DAY_SLOTS[activeDays];
    let base = data.experience === 'beginner' ? 15 : data.experience === 'some' ? 25 : 35;
    if (data.activity === 'low') base = Math.min(base,15);
    if (senior) base = Math.min(base,20);
    if (needEase) base = Math.max(10,base - 10);
    const length = Math.min(data.minutes,base);
    const cardio = knee ? (data.place === 'gym' ? '低阻力单车' : data.place === 'outdoor' ? '平地慢走' : '低冲击活动') :
      data.place === 'gym' ? (data.activity === 'low' ? '轻松器械有氧' : '器械有氧') :
      data.place === 'outdoor' ? (data.activity === 'low' ? '户外轻松走' : data.experience === 'trained' && data.activity === 'regular' ? '户外慢跑或快走' : '户外快走') :
      (data.activity === 'low' ? '室内轻松走' : '室内快走');
    const strength = knee ? (data.equipment === 'band' ? '弹力带上肢练习' : '上肢轻力量') :
      data.equipment === 'band' ? '弹力带力量' : data.equipment === 'dumbbell' ? '哑铃基础力量' :
      data.equipment === 'gym' && data.place === 'gym' ? '器械力量' : '自重基础力量';
    const week = DAYS.map(day => ({day,title:'休息或轻松走动',duration:'按身体感受',detail:'给身体留出恢复时间'}));
    slots.forEach((index,j) => {
      let title, detail;
      if (activeDays === 2) {title='有氧＋轻力量';detail=`${cardio}、${strength}，在 ${length} 分钟内分配`;}
      else if (j === 1 || j === activeDays-1 && activeDays >= 4 || j === 2 && activeDays === 3) {title='力量练习';detail=strength;}
      else {title=knee?'低冲击活动':'有氧活动';detail=cardio;}
      if (senior && j === activeDays-1) {title='力量＋平衡';detail=`${strength}、扶稳练习平衡`;}
      week[index]={day:DAYS[index],title,duration:`约 ${length} 分钟`,detail};
    });
    return week;
  }

  function buildPlan(data, records = [], checkin = null) {
    validate(data);
    const bmi = data.current / (data.height / 100) ** 2;
    const targetBmi = data.goal / (data.height / 100) ** 2;
    const flags = new Set(data.health);
    const reasons = [];
    let mode = 'active', holdReason = '';
    if (data.age < 20) {mode='hold';holdReason='未满 20 岁不使用这里的成人 BMI 与减脂目标算法。先关注规律饮食、活动和睡眠，具体体重目标请由专业人员评估。';}
    else if (flags.has('pregnant') || flags.has('breastfeeding')) {mode='hold';holdReason='孕期或哺乳期不套用普通成人减脂节奏。请与产科或营养专业人员确认体重与活动安排。';}
    else if (flags.has('eating')) {mode='hold';holdReason='有进食障碍史时，不生成体重下降计划。请与了解你情况的专业人员讨论目标。';}
    else if (bmi < 18.5 || targetBmi < 18.5) {mode='hold';holdReason='目前或目标体重对应的 BMI 低于成人参考范围，不生成减重安排。请先咨询专业人员。';}
    else if (flags.has('chronic') || flags.has('injury')) {mode='hold';holdReason='慢性病、治疗中或其他伤病需要结合具体诊断评估，不自动给出减重速度与训练动作。';}
    else if (data.age >= 65) {mode='caution';holdReason='65 岁及以上先与专业人员确认体重目标；下方只提供保守的活动和饮食思路。';}
    else if (bmi < 25) {mode='caution';holdReason='目前 BMI 已在成人参考范围。减重未必必要，先关注生活习惯；目标是否合适可向专业人员确认。';}
    if (mode === 'active' && data.goal >= data.current) throw new Error('请把目标体重设得低于目前体重；若想保持体重，可先保持现有生活习惯。');
    const trend=weightTrend(records);
    const loss=data.current-data.goal, pace=loss/data.weeks, minWeeks=Math.ceil(Math.max(0,loss)/0.5);
    const meal=mealFor(data,checkin,mode,trend),week=makeWeek(data,checkin,mode,trend);
    let headline,summary,paceText,durationText;
    if (mode === 'hold') {headline='先照顾好身体，再谈体重目标。';summary=holdReason;paceText='暂不计算';durationText='按专业建议';reasons.push('你的健康情况改变了计划适用范围，因此暂停自动减重安排。');}
    else if (mode === 'caution') {headline='先确认目标，保持可持续的习惯。';summary=holdReason;paceText='暂不设定';durationText='按实际调整';reasons.push('年龄或目前体型提示：先确认体重目标，再决定是否减重。');}
    else if (pace > 0.5) {headline='这个时间有点赶，给自己多一点余地。';summary=`从 ${data.current} kg 到 ${data.goal} kg 共相差 ${round(loss)} kg。按较温和的每周不超过约 0.5 kg 的参考节奏，至少留出约 ${minWeeks} 周；实际变化不保证匀速。`;paceText=`${round(pace)} kg`;durationText=`建议 ≥${minWeeks} 周`;reasons.push(`你填写的 ${data.weeks} 周对应每周约 ${round(pace)} kg，因此提示延长时间。`);}
    else {headline=`按每周约 ${round(pace)} kg 的节奏，慢慢来。`;summary=`从 ${data.current} kg 到 ${data.goal} kg，计划 ${data.weeks} 周。这里只是目标平均值，实际体重会波动。`;paceText=`${round(pace)} kg`;durationText=`${data.weeks} 周`;reasons.push(`目标和时间对应每周约 ${round(pace)} kg，作为观察节奏的参考。`);}
    const active=week.filter(x=>x.title!=='休息或轻松走动'&&x.title!=='暂不安排').length;
    if (mode !== 'hold') {
      reasons.push(`你每周可用 ${data.days} 天、每次 ${data.minutes} 分钟，结合“${LABELS[data.experience]}”和“${{low:'久坐',some:'偶尔活动',regular:'经常运动'}[data.activity]}”，安排 ${active} 天活动。`);
      reasons.push(`你选择在${LABELS[data.place]}运动，器材是“${{none:'无器材',band:'弹力带',dumbbell:'哑铃',gym:'健身房器材'}[data.equipment]}”，因此动作随场地调整。`);
      if (data.equipment==='gym' && data.place!=='gym') reasons.push('场地与健身房器材不匹配，力量练习暂按无器材版本安排。');
      if (flags.has('knee')) reasons.push('因为勾选了关节不适，优先选择平地或低冲击活动，并避免让不适加重。');
      if (data.age >= 65) reasons.push('65 岁及以上额外加入平衡和轻力量练习。');
      if (checkin?.fatigue==='high'||checkin?.completion==='low') reasons.push('近期疲劳或完成困难，活动天数和单次时长已调低。');
    }
    reasons.push(`饮食建议按“${{balanced:'正常饮食',vegetarian:'素食',dairyfree:'不吃乳制品',quick:'做饭时间少'}[data.diet]}”调整。`);
    let adaptNote='体重记录跨度达到 14 天后，结合感受进一步判断是否需要调整。';
    if (mode==='hold') adaptNote='当前情况需要个体化健康指导；记录可以用来回顾变化，但不自动推算减重速度。';
    else {
      const parts=[];
      if (trend) parts.push(`最近 ${trend.days} 天记录从 ${trend.start.toFixed(1)} kg 到 ${trend.end.toFixed(1)} kg，平均每周约 ${Math.abs(trend.perWeek).toFixed(1)} kg ${trend.perWeek<0?'下降':trend.perWeek>0?'上升':'变化'}。这只是粗略趋势。`);
      else parts.push('体重记录还不足 14 天，暂时不凭几次称重判断成效。');
      if (checkin?.fatigue==='high') parts.push('疲劳明显：本周减少活动量，把休息放在前面。');
      if (checkin?.hunger==='high') parts.push('经常很饿：先保证规律吃饭和需要时的加餐，不继续缩减食量。');
      if (checkin?.completion==='low') parts.push('计划很难完成：本周减少一天安排，先恢复可执行的节奏。');
      if (trend && trend.perWeek < -0.5) parts.push('下降较快：先检查进食与恢复情况，暂停加码运动。');
      else if (trend && Math.abs(trend.perWeek)<0.1 && checkin?.fatigue!=='high' && checkin?.hunger!=='high' && checkin?.completion==='high') parts.push('趋势暂时平稳：先保持习惯，再观察一段时间，不急着大幅减量。');
      if (parts.length===1 && trend) parts.push('按当前可完成的安排继续观察，不必根据单次数字频繁改计划。');
      adaptNote=parts.join(' ');
    }
    return {mode,headline,summary,paceText,durationText,bmiText:data.age<20?'—':bmi.toFixed(1),
      bmiLabel:data.age<20?'未成年人不使用成人 BMI 分类':bmi<18.5?'低于成人 BMI 参考范围':bmi<25?'处于成人 BMI 参考范围':bmi<30?'高于成人 BMI 参考范围':'明显高于成人 BMI 参考范围',
      bmiNote:'BMI 不能区分肌肉与脂肪，也不能单独判断健康状况。',firstStep:mode==='hold'?'先确认适用建议':`每周安排 ${active} 天`,
      stepNote:mode==='hold'?'现阶段不自动指定运动强度或减重速度。':data.health.includes('knee')?'按不加重疼痛的原则选择低冲击活动。':`每次不超过你可用的 ${data.minutes} 分钟，留出恢复时间。`,
      weekIntro:mode==='hold'?'这里不生成训练日程；根据专业建议安排适合自己的活动。':data.age>=65?'优先低冲击、轻力量和平衡，量力而行。':`本周 ${active} 天，每次不超过 ${data.minutes} 分钟；长期可逐步靠近成年人活动建议。`,
      mealGuidance:meal.guidance,mealExample:meal.example,week,why:reasons,adaptNote,trend};
  }

  root.QingyingPlanner={buildPlan,weightTrend};
  if (typeof document === 'undefined') return;

  const $=id=>document.getElementById(id);
  const form=$('plan-form'), dateInput=$('record-date');
  const fields=Object.fromEntries(['age','height','current','goal','weeks','activity','experience','minutes','days','diet','equipment','place'].map(key=>[key,form.querySelector(`[name="${key}"]`)]));
  const today=new Date(),todayText=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  dateInput.max=todayText;
  let records=[],checkin=null,previous=null,currentData=null;
  function forgetLegacyData(){try{for(const key of ['qingying-plan','qingying-records','qingying-checkin'])localStorage.removeItem(key);}catch(e){}}
  function resetInputs(){
    for(const el of document.querySelectorAll('#plan-form input, #record-form input')){
      if(el.type==='checkbox')el.checked=el.defaultChecked;
      else el.value=el.defaultValue;
      el.autocomplete='off';
    }
    for(const el of document.querySelectorAll('#plan-form select, #checkin-form select')){
      const index=[...el.options].findIndex(option=>option.defaultSelected);
      el.selectedIndex=index<0?0:index;
    }
    dateInput.value=todayText;
  }
  resetInputs();
  forgetLegacyData();
  function readForm(){const num=k=>Number(fields[k].value);return {age:num('age'),height:num('height'),current:num('current'),goal:num('goal'),weeks:num('weeks'),activity:fields.activity.value,experience:fields.experience.value,minutes:num('minutes'),days:num('days'),diet:fields.diet.value,equipment:fields.equipment.value,place:fields.place.value,health:[...form.querySelectorAll('[name="health"]:checked')].map(el=>el.value)};}
  function addTextList(container,items,className){container.replaceChildren(...items.map(text=>{const node=document.createElement(className==='why-item'?'div':'li');if(className)node.className=className;node.textContent=text;return node;}));}
  function changes(oldPlan,newPlan){if(!oldPlan)return ['已按页面示例生成计划。改动资料后点击“更新我的计划”，这里会列出变化。'];const list=[];
    if(oldPlan.mode!==newPlan.mode||oldPlan.paceText!==newPlan.paceText||oldPlan.durationText!==newPlan.durationText||oldPlan.summary!==newPlan.summary)list.push(`目标节奏：${oldPlan.paceText}／${oldPlan.durationText} → ${newPlan.paceText}／${newPlan.durationText}。`);
    if(oldPlan.bmiText!==newPlan.bmiText)list.push(`体型参考：BMI 从 ${oldPlan.bmiText} 更新为 ${newPlan.bmiText}。`);
    if(oldPlan.mealGuidance!==newPlan.mealGuidance||oldPlan.mealExample!==newPlan.mealExample)list.push('饮食：根据偏好或饥饿反馈重新给出搭配建议。');
    if(JSON.stringify(oldPlan.week)!==JSON.stringify(newPlan.week))list.push(`运动：一周安排已更新，现在是“${newPlan.firstStep}”。`);
    else if(oldPlan.weekIntro!==newPlan.weekIntro)list.push('运动：实际单次时长受目前运动基础或健康情况限制，已更新可用时间说明。');
    if(oldPlan.adaptNote!==newPlan.adaptNote)list.push('后续调整：体重趋势或每周感受改变了提醒。');
    return list.length?list:['资料已更新，目前主要建议无需改变。'];}
  function render(data){const plan=buildPlan(data,records,checkin);$('plan-error').textContent='';
    for(const [key,id] of [['headline','headline'],['summary','summary'],['paceText','pace'],['durationText','duration'],['bmiText','bmi'],['bmiLabel','bmi-label'],['bmiNote','bmi-note'],['firstStep','first-step'],['stepNote','step-note'],['weekIntro','week-intro'],['mealGuidance','meal-guidance'],['mealExample','meal-example'],['adaptNote','adapt-note']])$(id).textContent=plan[key];
    $('week-grid').replaceChildren(...plan.week.map(item=>{const node=document.createElement('div');node.className='day';const a=document.createElement('strong'),b=document.createElement('span'),c=document.createElement('small'),d=document.createElement('em');a.textContent=item.day;b.textContent=item.title;c.textContent=item.duration;d.textContent=item.detail;node.append(a,b,c,d);return node;}));
    addTextList($('why-list'),plan.why,'why-item');addTextList($('change-list'),changes(previous,plan));
    previous=plan;currentData=data;
    return plan;
  }
  $('update-plan').addEventListener('click',()=>{try{render(readForm());}catch(error){$('plan-error').textContent=error.message;}});
  try{render(readForm());}catch(error){$('plan-error').textContent=error.message;}
  function validDate(date){if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>dateInput.max)return false;const d=new Date(date+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===date;}
  function draw(){const ordered=[...records].sort((a,b)=>a.date.localeCompare(b.date)),box=$('chart');box.replaceChildren();
    if(!ordered.length){box.textContent='还没有记录。先记下今天的体重吧。';$('entries').replaceChildren();return;}
    if(ordered.length===1)box.textContent=`第一条记录：${ordered[0].weight.toFixed(1)} kg。再记一次，就能看到变化。`;
    else{const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 500 130');svg.setAttribute('role','img');svg.setAttribute('aria-label',`体重从 ${ordered[0].weight.toFixed(1)} 千克变化到 ${ordered.at(-1).weight.toFixed(1)} 千克`);const values=ordered.map(x=>x.weight),low=Math.min(...values)-0.5,high=Math.max(...values)+0.5;const pts=values.map((v,i)=>[20+i*460/(values.length-1),105-(v-low)*80/(high-low)]);const line=document.createElementNS(ns,'polyline');line.setAttribute('points',pts.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#d5f468');line.setAttribute('stroke-width','3');line.setAttribute('stroke-linejoin','round');svg.append(line);pts.forEach(([cx,cy])=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r','3');c.setAttribute('fill','#d5f468');svg.append(c);});box.append(svg);}
    $('entries').replaceChildren(...ordered.slice().reverse().map(item=>{const row=document.createElement('div');row.className='entry';const date=document.createElement('span');date.textContent=item.date;const value=document.createElement('span'),strong=document.createElement('strong'),del=document.createElement('button');strong.textContent=item.weight.toFixed(1)+' kg';del.type='button';del.textContent='删除';del.setAttribute('aria-label',`删除 ${item.date} 的记录`);del.addEventListener('click',()=>{records=records.filter(x=>x.date!==item.date);draw();if(currentData)render(currentData);});value.append(strong,del);row.append(date,value);return row;}));
  }
  function record(date,weight){if(!validDate(date)||!finite(weight)||weight<30||weight>300)throw new Error('请填写今天或之前的有效日期，以及 30–300 kg 之间的体重。');records=records.filter(x=>x.date!==date);records.push({date,weight});records.sort((a,b)=>a.date.localeCompare(b.date));records=records.slice(-365);$('record-error').textContent='';draw();if(currentData)render(currentData);}
  $('add-record').addEventListener('click',()=>{try{record(dateInput.value,Number($('record-weight').value));$('record-weight').value='';}catch(error){$('record-error').textContent=error.message;}});
  $('update-checkin').addEventListener('click',()=>{const f=$('checkin-form');checkin={fatigue:f.querySelector('[name="fatigue"]').value,hunger:f.querySelector('[name="hunger"]').value,completion:f.querySelector('[name="completion"]').value,date:dateInput.max};if(currentData)render(currentData);});
  draw();
  function resetSession(){records=[];checkin=null;previous=null;currentData=null;resetInputs();forgetLegacyData();$('plan-error').textContent='';$('record-error').textContent='';draw();try{render(readForm());}catch(error){$('plan-error').textContent=error.message;}}
  $('clear-session').addEventListener('click',resetSession);
  window.addEventListener('pageshow',event=>{if(event.persisted)resetSession();});
})(globalThis);
