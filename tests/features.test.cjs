const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
if (fs.existsSync(require('node:path').join(__dirname, '../features.js'))) require('../features.js');
require('../app.js');
const P = globalThis.QingyingPlanner;
const F = globalThis.QingyingFeatures || {};
const profile = {age:25,height:170,current:75,goal:70,weeks:12,activity:'low',experience:'beginner',minutes:20,days:3,diet:'balanced',equipment:'none',place:'home',health:[]};
const today = '2026-10-22';
const state = () => ({version:1,profile:{...profile},records:[{date:today,weight:74.5}],checkins:[{date:today,fatigue:'high',hunger:'low',completion:'medium'}],habits:{[today]:{meal:true,movement:false}}});

test('a full week has three varied meals per day, and dietary alternatives respect preferences', () => {
  for (const diet of ['balanced','vegetarian','dairyfree','quick']) {
    const plan = P.buildPlan({...profile,diet});
    assert.equal(plan.week[0].meals?.length, 3, 'each day needs breakfast, lunch and dinner');
    assert.equal(new Set(plan.week.map(d => d.meals.map(m => m.food).join('|'))).size, 7);
    const text = plan.week.flatMap(d => d.meals).map(m => m.food + m.swap).join(' ');
    if (diet === 'vegetarian') assert.doesNotMatch(text, /鸡肉|鱼|牛肉|虾|猪肉/);
    if (diet === 'dairyfree') assert.doesNotMatch(text, /牛奶|酸奶|奶酪|乳酪/);
    assert.ok(plan.week.every(d => d.meals.every(m => m.swap)));
  }
});

test('workouts include warmup and recovery within available time, including a ten-minute session', () => {
  for (const minutes of [10,20,30,45,60]) {
    const plan = P.buildPlan({...profile,minutes});
    const days = plan.week.filter(d => d.title !== '休息或轻松走动');
    for (const d of days) {
      assert.ok(d.workout?.steps?.length >= 3, 'workout needs actionable steps');
      assert.ok(d.workout.totalMinutes <= minutes);
      assert.equal(d.workout.steps.reduce((n,s) => n+s.minutes,0), d.workout.totalMinutes);
      assert.match(d.workout.steps[0].title, /热身/);
      assert.match(d.workout.steps.at(-1).title, /放松/);
    }
  }
});

test('health holds never acquire automated meal plans or workouts', () => {
  for (const health of [['pregnant'],['eating'],['injury'],['chronic'],['breastfeeding']]) {
    const plan = P.buildPlan({...profile,health});
    assert.equal(plan.mode,'hold');
    assert.ok(plan.week.every(d => d.meals?.length === 0 && d.workout?.steps?.length === 0));
  }
  assert.equal(P.buildPlan({...profile,age:17}).mode,'hold');
});

test('joint discomfort avoids lower-body loading and incompatible gym equipment falls back', () => {
  const knee = P.buildPlan({...profile,health:['knee'],equipment:'dumbbell'});
  assert.ok(knee.week[2].workout, 'joint-friendly workout details exist');
  assert.doesNotMatch(JSON.stringify(knee.week.map(d=>d.workout)), /深蹲|弓步|跳跃|跑步/);
  const home = P.buildPlan({...profile,equipment:'gym',place:'home'});
  assert.doesNotMatch(JSON.stringify(home.week.map(d=>d.workout)), /器械推胸|器械划船/);
});

test('backup roundtrip preserves profile, all dates, habits and historical feelings', () => {
  assert.equal(typeof F.parseBackup,'function');
  const data = state();
  const copy = F.parseBackup(F.exportBackup(data), P.validate, today);
  assert.deepEqual(copy,data);
  const many = state();
  many.records = Array.from({length:400}, (_,i) => ({date:F.addDays(today,-i),weight:75}));
  assert.equal(F.parseBackup(F.exportBackup(many), P.validate,today).records.length,400);
});

test('malformed backups, future dates, duplicate dates and invalid profiles are rejected before replacement', () => {
  assert.equal(typeof F.parseBackup,'function');
  for (const edit of [
    d=>d.records.push({date:'2026-02-30',weight:70}),
    d=>d.records.push({date:'2026-10-23',weight:70}),
    d=>d.records.push({date:today,weight:70}),
    d=>d.records[0].weight='70',
    d=>d.profile.age=0,
    d=>d.profile.goal=80,
    d=>d.checkins[0].fatigue='other',
    d=>d.habits[today].meal='yes',
    d=>d.version=999
  ]) {
    const data=state(); edit(data);
    assert.throws(()=>F.parseBackup(JSON.stringify({app:'qingying-plan',state:data}),P.validate,today));
  }
  assert.throws(()=>F.parseBackup('{', P.validate,today));
  assert.throws(()=>F.parseBackup(JSON.stringify({state:state()}),P.validate,today));
});

test('storage read/write errors are surfaced and corrupt stored data is not silently replaced', () => {
  assert.equal(typeof F.createStore,'function');
  const values=new Map();
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const store=F.createStore(storage,P.validate,()=>today);
  store.save(state());
  assert.deepEqual(store.load(),state());
  values.set(F.STORAGE_KEY,'broken');
  assert.throws(()=>store.load());
  assert.equal(values.get(F.STORAGE_KEY),'broken');
  const denied=F.createStore({getItem(){throw Error('denied');},setItem(){throw Error('quota');},removeItem(){throw Error('denied');}},P.validate,()=>today);
  assert.throws(()=>denied.load()); assert.throws(()=>denied.save(state())); assert.throws(()=>denied.clear());
  store.clear(); assert.equal(values.size,0);
});

test('trend filtering uses calendar dates and seven-day averages do not fabricate missing days', () => {
  assert.equal(typeof F.trendSummary,'function');
  const records=[{date:'2026-09-01',weight:80},{date:'2026-10-15',weight:76},{date:'2026-10-16',weight:75},{date:'2026-10-22',weight:74}];
  const seven=F.trendSummary(records,7,today);
  assert.deepEqual(seven.records.map(r=>r.date),['2026-10-16','2026-10-22']);
  assert.equal(seven.change,-1);
  assert.equal(seven.average,74.5);
  assert.equal(seven.points.at(-1).average,74.5);
  assert.equal(F.trendSummary([],30,today).change,null);
  assert.equal(F.trendSummary([{date:today,weight:74}],30,today).change,null);
});

test('habit statistics count checked dates and calendar streaks rather than checkbox totals', () => {
  assert.equal(typeof F.habitStats,'function');
  const habits={'2026-10-22':{meal:true,movement:false},'2026-10-21':{meal:false,movement:true},'2026-10-19':{meal:true,movement:true},'2026-10-10':{meal:true,movement:true}};
  const stats=F.habitStats(habits,today);
  assert.equal(stats.days,3); assert.equal(stats.mealDays,2); assert.equal(stats.movementDays,2); assert.equal(stats.streak,2);
  assert.equal(F.habitStats({'2026-10-21':{meal:true,movement:false}},today).streak,1);
});
