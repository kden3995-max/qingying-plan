(function (root) {
  'use strict';
  const STORAGE_KEY = 'qingying-state-v1';
  const DAY = 86400000;
  const dateMs = date => Date.parse(date + 'T12:00:00Z');
  const localDate = (now = new Date()) => [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
  const addDays = (date, days) => new Date(dateMs(date) + days * DAY).toISOString().slice(0,10);
  const validDate = (date, today = localDate()) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= '1900-01-01' && date <= today && Number.isFinite(dateMs(date)) && new Date(dateMs(date)).toISOString().slice(0,10) === date;
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  const emptyState = () => ({version:1, profile:null, records:[], checkins:[], habits:{}});
  const round = value => Math.round(value*100)/100;

  // A complete meal includes a staple, a protein source, and produce. Portions
  // remain flexible rather than being calculated from a target weight.
  const BREAKFASTS = [
    '燕麦粥＋无糖豆浆＋香蕉', '全麦面包＋鸡蛋＋番茄', '玉米＋无糖豆浆＋苹果',
    '杂粮粥＋鸡蛋＋黄瓜', '全麦馒头＋豆腐干＋橙子', '红薯＋无糖酸奶＋莓果', '全麦三明治（鸡蛋、生菜）＋水果'
  ];
  const LUNCHES = [
    '杂粮饭＋清蒸鱼＋西兰花', '米饭＋香菇鸡肉＋青菜', '荞麦面＋豆腐＋小白菜',
    '米饭＋番茄牛肉＋彩椒', '杂粮饭＋虾仁＋西葫芦', '土豆＋鸡蛋＋菠菜', '杂粮饭＋豆腐炖菌菇＋油麦菜'
  ];
  const DINNERS = [
    '红薯＋番茄豆腐＋青菜', '杂粮饭＋鸡蛋＋炒菌菇', '米饭＋清蒸鱼＋胡萝卜青菜',
    '玉米＋鸡肉＋西兰花', '荞麦面＋豆干＋时蔬', '米饭＋豆腐炖白菜', '全麦面＋虾仁＋番茄青菜'
  ];
  const VEG = [
    ['燕麦粥＋无糖豆浆＋香蕉','杂粮饭＋清蒸豆腐＋西兰花','红薯＋番茄炖鹰嘴豆＋青菜'],
    ['全麦面包＋无糖豆浆＋番茄','米饭＋香菇豆干＋青菜','杂粮饭＋鹰嘴豆＋炒菌菇'],
    ['玉米＋无糖豆浆＋苹果','荞麦面＋豆腐＋小白菜','米饭＋清蒸豆腐＋胡萝卜青菜'],
    ['杂粮粥＋豆腐干＋黄瓜','米饭＋番茄扁豆＋彩椒','玉米＋豆腐＋西兰花'],
    ['全麦馒头＋豆腐干＋橙子','杂粮饭＋鹰嘴豆＋西葫芦','荞麦面＋豆干＋时蔬'],
    ['红薯＋无糖豆浆＋莓果','土豆＋扁豆＋菠菜','米饭＋豆腐炖白菜'],
    ['全麦三明治（豆干、生菜）＋水果','杂粮饭＋豆腐炖菌菇＋油麦菜','全麦面＋鹰嘴豆＋番茄青菜']
  ];
  const QUICK = [
    ['全麦面包＋即食鸡蛋＋香蕉','饭团＋即食豆腐＋袋装沙拉','微波杂粮饭＋即食鸡胸肉＋冷冻蔬菜'],
    ['即食燕麦＋无糖豆浆＋苹果','全麦卷饼＋鸡蛋＋沙拉菜','即食玉米＋豆干＋小番茄'],
    ['全麦馒头＋即食鸡蛋＋橙子','微波杂粮饭＋即食豆干＋冷冻西兰花','全麦面包＋即食豆腐＋黄瓜'],
    ['即食燕麦＋无糖酸奶＋香蕉','饭团＋即食鸡胸肉＋小番茄','微波红薯＋即食鸡蛋＋袋装沙拉'],
    ['全麦面包＋无糖豆浆＋梨','微波杂粮饭＋即食豆腐＋冷冻蔬菜','即食玉米＋即食鸡蛋＋黄瓜'],
    ['即食玉米＋无糖酸奶＋苹果','全麦三明治（鸡蛋、生菜）＋小番茄','微波杂粮饭＋豆干＋冷冻菠菜'],
    ['即食燕麦＋无糖豆浆＋橙子','饭团＋即食鸡蛋＋袋装沙拉','全麦卷饼＋豆腐干＋小番茄']
  ];

  function mealsFor(data, index, mode) {
    if (mode === 'hold') return [];
    let foods = [BREAKFASTS[index], LUNCHES[index], DINNERS[index]];
    if (data.diet === 'vegetarian') foods = VEG[index];
    if (data.diet === 'quick') foods = QUICK[index];
    if (data.diet === 'dairyfree') foods = foods.map(food => food.replace(/无糖酸奶/g,'无糖豆浆'));
    const protein = data.diet === 'vegetarian' ? '豆腐、豆干或豆类' : '鸡蛋、豆腐、鱼或鸡肉';
    return foods.map((food,i) => ({name:['早餐','午餐','晚餐'][i],food,
      swap:`主食可换米饭、玉米或薯类；蛋白质可换${protein}；蔬菜水果选当季品种。${data.diet === 'dairyfree' ? '包装食品确认不含乳制品。' : ''}`}));
  }

  function workoutFor(data, day, mode) {
    const note = '保持能说完整句子的强度，动作缓慢、正常呼吸；有疼痛、头晕或异常不适时停止。';
    if (mode === 'hold') return {steps:[],totalMinutes:0,note:'先与了解你情况的专业人员确认活动安排。'};
    if (day.title === '休息或轻松走动') return {steps:[],totalMinutes:0,note:'今天留给恢复。久坐后可起身走动，疲劳时充分休息，无需补练。'};
    const totalMinutes = Math.min(data.minutes, Number(day.duration.match(/\d+/)?.[0]) || 10);
    const warm = totalMinutes >= 20 ? 3 : 2;
    const cool = 2, main = totalMinutes-warm-cool;
    const knee = data.health.includes('knee');
    const senior = data.age >= 65;
    const strength = /力量/.test(day.title);
    const combined = /有氧＋/.test(day.title);
    let exercises;
    if (knee) {
      exercises = data.equipment === 'band' ? '坐姿弹力带拉开、坐姿轻划船（弹力带绕双脚中部并确认稳固）' : '坐姿肩胛后收、坐姿手臂侧平举（徒手）';
    } else if (data.equipment === 'band') {
      exercises = '坐姿弹力带划船（带绕双脚中部并确认稳固）、弹力带拉开、扶稳椅子坐站';
    } else if (data.equipment === 'dumbbell') {
      exercises = '坐姿轻哑铃弯举、扶稳椅子坐站、靠墙俯卧撑';
    } else if (data.equipment === 'gym' && data.place === 'gym') {
      exercises = '轻重量器械推胸、器械划船、扶稳椅子坐站；先由教练示范和调节器械';
    } else {
      exercises = '靠墙俯卧撑、扶稳椅子坐站、站姿肩胛后收';
    }
    const strengthText = `${exercises}。每个动作 6–10 次，先做 1 轮；动作间休息 30–60 秒，时间充裕且轻松时再做第 2 轮。休息计入时间，不必赶完。`;
    let cardio = day.detail.split('、')[0];
    if(cardio === '低冲击活动')cardio='坐姿轻摆臂，或在不加重不适的前提下于室内平地慢走';
    if(/器械有氧/.test(cardio))cardio='低阻力固定单车，先请工作人员帮助调节座椅';
    const cardioText = `${cardio}，从慢速开始，保持能交谈的节奏；需要时随时放慢或休息。`;
    const steps = [{title:'轻柔热身',minutes:warm,detail:knee ? '坐姿活动肩、肘、腕关节，动作保持在舒适范围。' : '原地慢走，轻柔活动肩、肘、踝关节。'}];
    if (combined) {
      const cardioMinutes=Math.ceil(main/2);
      steps.push({title:'轻松有氧',minutes:cardioMinutes,detail:cardioText});
      steps.push({title:'基础力量',minutes:main-cardioMinutes,detail:strengthText});
    } else {
      const balance = senior && /平衡/.test(day.title) ? 2 : 0;
      steps.push({title:strength?'基础力量':'轻松有氧',minutes:main-balance,detail:strength?strengthText:cardioText});
      if (balance) steps.push({title:'扶稳练习平衡',minutes:balance,detail:'双手扶稳牢固桌面，双脚并拢站立 10–20 秒后休息，重复 2–3 次；不闭眼、不单脚站。'});
    }
    steps.push({title:'慢慢放松',minutes:cool,detail:knee?'坐姿放松肩颈和手臂，恢复平稳呼吸，不强拉疼痛部位。':'慢走后轻柔放松肩背和腿部，不屏气、不强拉。'});
    return {totalMinutes,steps,note};
  }

  function detailedWeek(data, week, mode) {
    return week.map((day,index) => ({...day,meals:mealsFor(data,index,mode),workout:workoutFor(data,day,mode)}));
  }

  function normalizeState(value, validateProfile, today = localDate()) {
    const bad = () => {throw new Error('数据格式或日期无效，请使用本页导出的完整备份。');};
    if (!plain(value) || value.version !== 1 || !Array.isArray(value.records) || !Array.isArray(value.checkins) || !plain(value.habits)) return bad();
    if (value.records.length > 10000 || value.checkins.length > 10000 || Object.keys(value.habits).length > 10000) return bad();
    let profile=null;
    if (value.profile !== null) {
      if (!plain(value.profile) || typeof validateProfile !== 'function') return bad();
      validateProfile(value.profile);
      const keys=['age','height','current','goal','weeks','activity','experience','minutes','days','diet','equipment','place','health'];
      profile=Object.fromEntries(keys.map(key=>[key,key==='health'?[...value.profile[key]]:value.profile[key]]));
    }
    function dates(items, convert) {
      const seen=new Set();
      return items.map(item=>{
        if (!plain(item) || !validDate(item.date,today) || seen.has(item.date)) return bad();
        seen.add(item.date); return convert(item);
      }).sort((a,b)=>a.date.localeCompare(b.date));
    }
    const records=dates(value.records,item=>{
      if (typeof item.weight!=='number' || !Number.isFinite(item.weight) || item.weight<30 || item.weight>300) return bad();
      return {date:item.date,weight:item.weight};
    });
    const checkins=dates(value.checkins,item=>{
      if (['fatigue','hunger','completion'].some(key=>!['low','medium','high'].includes(item[key]))) return bad();
      return {date:item.date,fatigue:item.fatigue,hunger:item.hunger,completion:item.completion};
    });
    const habits={};
    for (const [date,item] of Object.entries(value.habits)) {
      if (!validDate(date,today) || !plain(item) || typeof item.meal!=='boolean' || typeof item.movement!=='boolean') return bad();
      habits[date]={meal:item.meal,movement:item.movement};
    }
    return {version:1,profile,records,checkins,habits};
  }

  function exportBackup(state) {return JSON.stringify({app:'qingying-plan',exportedAt:new Date().toISOString(),state},null,2);}
  function parseBackup(text, validateProfile, today = localDate()) {
    if (typeof text!=='string' || text.length>2*1024*1024) throw new Error('备份过大，文件需小于 2 MB。');
    let data;
    try {data=JSON.parse(text);} catch {throw new Error('无法读取备份，请选择本页导出的 JSON 文件。');}
    if (!plain(data) || data.app!=='qingying-plan') throw new Error('这不是轻盈计划备份。');
    return normalizeState(data.state,validateProfile,today);
  }

  function createStore(storage, validateProfile, today = localDate) {
    return {
      load() {const raw=storage.getItem(STORAGE_KEY); return raw===null?emptyState():normalizeState(JSON.parse(raw),validateProfile,today());},
      save(value) {const clean=normalizeState(value,validateProfile,today()); storage.setItem(STORAGE_KEY,JSON.stringify(clean));},
      clear() {storage.removeItem(STORAGE_KEY);}
    };
  }

  function trendSummary(records, days, today = localDate()) {
    const start=addDays(today,1-days);
    const all=records.filter(r=>validDate(r.date,today)).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const selected=all.filter(r=>r.date>=start);
    // A rolling mean uses actual measurements within the previous seven days.
    // No interpolated or zero-valued measurements are introduced.
    const points=selected.map(r=>{
      const sample=all.filter(x=>x.date<=r.date && x.date>=addDays(r.date,-6));
      return {...r,average:round(sample.reduce((n,x)=>n+x.weight,0)/sample.length)};
    });
    const recent=all.filter(r=>r.date>=addDays(today,-6));
    return {records:selected,points,start,end:today,change:selected.length>1?round(selected.at(-1).weight-selected[0].weight):null,
      average:recent.length?round(recent.reduce((n,r)=>n+r.weight,0)/recent.length):null,averageCount:recent.length};
  }

  function habitStats(habits, today = localDate()) {
    const recent=Object.entries(habits).filter(([date])=>date>=addDays(today,-6) && date<=today);
    const checked = date => habits[date]?.meal || habits[date]?.movement;
    let cursor=checked(today)?today:addDays(today,-1),streak=0;
    while (checked(cursor)) {streak++;cursor=addDays(cursor,-1);}
    return {days:recent.filter(([,h])=>h.meal||h.movement).length,mealDays:recent.filter(([,h])=>h.meal).length,
      movementDays:recent.filter(([,h])=>h.movement).length,streak};
  }

  root.QingyingFeatures={STORAGE_KEY,localDate,addDays,validDate,emptyState,detailedWeek,normalizeState,exportBackup,parseBackup,createStore,trendSummary,habitStats};
})(globalThis);
