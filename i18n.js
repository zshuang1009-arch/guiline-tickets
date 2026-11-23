const translations = {
  '搜索国家、地区或中国城市':'Search for a country, region, or city in China',
  '国家或地区':'Country or region','选择国家或地区':'Select a country or region',
  '也可以从下方选择国家或地区。':'You can also choose a country or region below.',
  '归线':'Homeward Threads','主导航':'Main navigation','首页':'Home','档案馆':'Archive',
  '你的家乡在哪里？':'Where is your hometown?','家乡':'Hometown','搜索地级市':'Search for a city',
  '选择省份或地区':'Select a province or region','请先选择省份或地区':'Select a province or region first',
  '省份或地区':'Province or region','选择城市':'Select a city','城市':'City',
  '也可以从下方选择省份和城市。':'You can also choose a province and city below.',
  '下一步 →':'Next →','修改':'Change','答案':'Answers','← 上一步':'← Back','完成问卷':'Finish','下一题 →':'Next question →',
  '暂时无法打开结果，请稍后重试。':'Could not load your results. Please try again.',
  '你的返乡情绪':'Your feelings about returning home','正在准备你的票根…':'Preparing your ticket…',
  '查看票根 →':'View ticket →','票根二维码':'Ticket QR code','扫描二维码保存票根':'Scan to save your ticket',
  '你的票根已准备好。':'Your ticket is ready.','个人情绪档案':'Personal emotion archive',
  '你的返乡情绪形态':'A visual form of your feelings about home','漳州市':'Zhangzhou',
  '加入公共网络':'Add to the shared map','仅保存档案卡':'Keep my ticket private',
  '预览扫码后的票根':'Preview the mobile ticket','返回首页':'Back to home',
  '用手机扫描右侧二维码，即可保存你的票根。　':'Scan the QR code with your phone to save your ticket. ',
  '暂时无法加入，请再试一次。':'Could not add your thread. Please try again.',
  '你的归线票根':'Your Homeward Threads ticket','票根暂不可用':'Ticket unavailable',
  '个人票根':'Personal ticket','保存票根':'Save ticket',
  '归线 · 个人情绪档案':'Homeward Threads · Personal Archive',
  '如浏览器打开了图片，可以长按图片保存。':'If the image opens in your browser, press and hold it to save.',
  '图片暂时无法显示，请刷新重试。':'Could not load the image. Refresh to try again.',
  '在归线的坐标上，遇见更多人的返乡情绪。':'Discover how others feel about returning home.',
  '世界情绪地图':'World map of homeward threads',
  '档案馆暂时无法打开，请刷新重试。':'Could not open the archive. Refresh to try again.',
  '悲伤':'Sadness','喜悦':'Joy','矛盾':'Ambivalence','排斥':'Aversion','怀念':'Nostalgia','眷恋':'Attachment'
};
const englishQuestions = [
  ['When you think about an important relationship or a chapter of your past, what comes closest to how you feel?', [
    'I feel a sense of loss, as if something has already left.', 'I look back with warmth and a little sadness.',
    'I treasure it and want to hold on, even if it hurts to let go.', 'I want to get closer and run away at the same time. I can’t settle.']],
  ['When you notice mixed feelings about your hometown, how do you usually deal with them?', [
    'I can accept them and draw strength from them.', 'They still affect me, even when I try to shake them off.',
    'I deliberately keep my distance so they won’t affect me.', 'I go back and forth between facing them and avoiding them.']],
  ['If someone invited you to return to your hometown right now, what would your first reaction be?', [
    'I’d be excited and want to leave right away.', 'I’d feel a warmth inside and picture familiar streets and faces.',
    'I’d feel weighed down, worried about facing people and places that have changed.', 'I’d feel both eager and reluctant, unsure if I really want to go.']],
  ['When a feeling suddenly washes over you, which response is closest to what happens in your body?', [
    'I get quiet and heavy. My movements and thoughts slow down.', 'I feel light and relaxed. I want to smile or move around.',
    'I feel tense and restless, as if I’m being pulled in two directions.', 'I tense up without thinking and want to pull away or push something back.']],
  ['If this feeling became something you could touch, what would you want from it?', [
    'For it to stay quietly beside me, with nothing needing to change.', 'To get close to it and keep that connection.',
    'To change it freely and make it respond the way I want.', 'For it to keep its distance and stay out of my space.']],
  ['When you have to choose between holding on and letting go, what’s your most honest reaction?', [
    'I’d let go. It hurts, but I don’t have the energy to get it back.', 'I’d keep the good parts as a memory I can return to.',
    'I’d still try to hold on, even if it’s difficult.', 'I’m not sure. I don’t want to let go, but I feel I ought to leave.']]
];
let language = localStorage.getItem('guiline-language') === 'en' ? 'en' : 'zh';
let placeNames = {};
const t = text => language === 'en' ? translations[text] ?? text : text;
const place = name => language === 'en' ? placeNames[name] ?? t(name) : name;
const phrases = Object.keys(translations).sort((a,b)=>b.length-a.length);
const localized = html => language === 'en' ? html.replace(new RegExp(phrases.join('|'),'g'),key=>translations[key]) : html;
