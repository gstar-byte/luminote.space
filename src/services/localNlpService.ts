const CHINESE_NUMBERS: Record<string, number> = {
  '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
  '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
  '廿': 20, '廿一': 21, '廿二': 22, '廿三': 23, '廿四': 24,
};

function parseChineseNumber(str: string): number | undefined {
  // Try direct lookup first (for multi-char numbers like "十二")
  if (CHINESE_NUMBERS[str] !== undefined) return CHINESE_NUMBERS[str];
  // Try single char
  if (str.length === 1 && CHINESE_NUMBERS[str] !== undefined) return CHINESE_NUMBERS[str];
  // Try "十+X" pattern (十三 = 10+3)
  if (str.startsWith('十') && str.length > 1) {
    const unit = CHINESE_NUMBERS[str.slice(1)];
    if (unit !== undefined) return 10 + unit;
  }
  return undefined;
}

/**
 * 本地规则解析器 - 不依赖外部 API
 * 支持中文和英文时间表达解析
 */

// ===== Chinese Weekday Map =====
const WEEKDAY_MAP_CN: Record<string, number> = {
  '周日': 0, '星期天': 0, '星期日': 0,
  '周一': 1, '星期一': 1, '礼拜一': 1,
  '周二': 2, '星期二': 2, '礼拜二': 2,
  '周三': 3, '星期三': 3, '礼拜三': 3,
  '周四': 4, '星期四': 4, '礼拜四': 4,
  '周五': 5, '星期五': 5, '礼拜五': 5,
  '周六': 6, '星期六': 6, '礼拜六': 6,
};

// ===== English Weekday Map =====
const WEEKDAY_MAP_EN: Record<string, number> = {
  'sunday': 0, 'sun': 0,
  'monday': 1, 'mon': 1,
  'tuesday': 2, 'tue': 2, 'tues': 2,
  'wednesday': 3, 'wed': 3, 'weds': 3,
  'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
  'friday': 5, 'fri': 5,
  'saturday': 6, 'sat': 6,
};

function resolveWeekdayCN(weekdayName: string, now: Date): Date {
  const targetDay = WEEKDAY_MAP_CN[weekdayName];
  if (targetDay === undefined) return now;
  const currentDay = now.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  const result = new Date(now);
  result.setDate(now.getDate() + daysUntil);
  return result;
}

function resolveWeekdayEN(weekdayName: string, now: Date): Date {
  const targetDay = WEEKDAY_MAP_EN[weekdayName.toLowerCase()];
  if (targetDay === undefined) return now;
  const currentDay = now.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  const result = new Date(now);
  result.setDate(now.getDate() + daysUntil);
  return result;
}

function parseTimeFromText(text: string, baseDate: Date): { date: Date; hasTime: boolean; hasPeriod: boolean } {
  let hour = 9;
  let minute = 0;
  let hasTime = false;
  let hasPeriod = false;

  const now = new Date();

  // ===== Arabic numeral Chinese patterns: 3点15分, 3:15, 3点半, 3点 =====
  const cnArabicMatch = text.match(/(\d{1,2})[点:：](\d{1,2})分?/);
  if (cnArabicMatch) {
    hour = parseInt(cnArabicMatch[1]);
    minute = parseInt(cnArabicMatch[2]);
    hasTime = true;
  } else if (/\d{1,2}[点:：]半/.test(text)) {
    const m = text.match(/(\d{1,2})/);
    if (m) { hour = parseInt(m[1]); minute = 30; hasTime = true; }
  } else if (/\d{1,2}[点:：]/.test(text)) {
    const m = text.match(/(\d{1,2})/);
    if (m) { hour = parseInt(m[1]); minute = 0; hasTime = true; }
  }

  // ===== Chinese numeral patterns: 四点, 四点半, 四点十五分 =====
  if (!hasTime) {
    // Try "[中文数字]点[阿拉伯数字]分" e.g., 四点十五分
    const cnNumMatch1 = text.match(/([一二两三四五六七八九十廿]+)[点:：](\d{1,2})分?/);
    if (cnNumMatch1) {
      const h = parseChineseNumber(cnNumMatch1[1]);
      if (h !== undefined) { hour = h; minute = parseInt(cnNumMatch1[2]); hasTime = true; }
    }
    // Try "[中文数字]点半"
    if (!hasTime) {
      const cnNumMatch2 = text.match(/([一二两三四五六七八九十廿]+)[点:：]半/);
      if (cnNumMatch2) {
        const h = parseChineseNumber(cnNumMatch2[1]);
        if (h !== undefined) { hour = h; minute = 30; hasTime = true; }
      }
    }
    // Try "[中文数字]点"
    if (!hasTime) {
      const cnNumMatch3 = text.match(/([一二两三四五六七八九十廿]+)[点:：]/);
      if (cnNumMatch3) {
        const h = parseChineseNumber(cnNumMatch3[1]);
        if (h !== undefined) { hour = h; minute = 0; hasTime = true; }
      }
    }
  }

  // ===== English patterns: 3:15 PM, 3 PM, 3pm, 15:30 =====
  if (!hasTime) {
    const enMatch = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (enMatch) {
      hour = parseInt(enMatch[1]);
      minute = parseInt(enMatch[2]);
      const ampm = enMatch[3]?.toLowerCase();
      if (ampm === 'pm' && hour !== 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      hasTime = true;
    } else {
      const enSimple = text.match(/(\d{1,2})\s*(am|pm)/i);
      if (enSimple) {
        hour = parseInt(enSimple[1]);
        const ampm = enSimple[2].toLowerCase();
        if (ampm === 'pm' && hour !== 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        minute = 0;
        hasTime = true;
      }
    }
  }

  // ===== Period-based default time (no specific hour given) =====
  if (!hasTime) {
    if (/早上|早晨|上午|早/.test(text)) {
      hour = 9; hasPeriod = true;
    } else if (/中午|午间/.test(text)) {
      hour = 12; hasPeriod = true;
    } else if (/下午/.test(text)) {
      hour = 15; hasPeriod = true;
    } else if (/傍晚|晚上|晚/.test(text)) {
      hour = 20; hasPeriod = true;
    } else if (/半夜|凌晨/.test(text)) {
      hour = 0; hasPeriod = true;
    }
  }

  // AM/PM context adjustment for Chinese when specific hour is given
  if (hasTime && hour <= 12 && !text.match(/\d{1,2}:\d{2}\s*(am|pm)/i)) {
    if (/下午|傍晚|晚上|晚/.test(text)) {
      if (hour !== 12) hour += 12;
    } else if (/中午|午间/.test(text)) {
      if (hour < 12) hour += 12;
    }
  }

  const result = new Date(baseDate);
  result.setHours(hour, minute, 0, 0);

  // If time already passed today, push to tomorrow (unless explicit date given)
  if ((hasTime || hasPeriod) && result.getTime() <= now.getTime() && !baseDate.getTime()) {
    result.setDate(result.getDate() + 1);
  }

  return { date: result, hasTime, hasPeriod };
}

function extractContent(text: string): string {
  // Step-by-step removal with precise patterns
  let content = text;

  // 1. Reminder verbs
  content = content.replace(/提醒我?/g, '').replace(/记得/g, '').replace(/别忘了/g, '').replace(/注意/g, '');
  content = content.replace(/remind me( to)?/gi, '').replace(/remember to/gi, '').replace(/don't forget( to)?/gi, '');

  // 2. Recurring patterns (remove before single characters)
  content = content.replace(/每天|每日|天天|每晚|每早|每周|每月/g, '');
  content = content.replace(/every day|daily|everyday|every week|weekly|every month|monthly/gi, '');

  // 3. Full weekday names (most specific first)
  content = content.replace(/星期天|星期日|礼拜天|礼拜日/g, '');
  content = content.replace(/星期一|礼拜一/g, '').replace(/星期二|礼拜二/g, '').replace(/星期三|礼拜三/g, '');
  content = content.replace(/星期四|礼拜四/g, '').replace(/星期五|礼拜五/g, '').replace(/星期六|礼拜六/g, '');
  content = content.replace(/周日|周一|周二|周三|周四|周五|周六/g, '');
  content = content.replace(/本周[一二三四五六日天]/g, '').replace(/下[一二三四五六日天]/g, '');
  content = content.replace(/这[一二三四五六日天]/g, '').replace(/上[一二三四五六日天]/g, '');
  content = content.replace(/星期[一二三四五六日天]/g, '');

  // 4. Relative days
  content = content.replace(/明天|后天|大后天|今天/g, '');
  content = content.replace(/tomorrow|today/gi, '').replace(/the day after tomorrow/gi, '');
  // Specific dates
  content = content.replace(/下月\d{1,2}[号日]/g, '').replace(/本月\d{1,2}[号日]/g, '').replace(/\d{1,2}月\d{1,2}[号日]/g, '');

  // 5. Time periods
  content = content.replace(/早上|早晨|上午|中午|下午|傍晚|晚上|半夜|凌晨/g, '');
  content = content.replace(/morning|afternoon|evening|night|noon|midnight/gi, '');

  // 6. Chinese numeral + 点 time (e.g., 四点, 四点半, 四点十五分)
  content = content.replace(/[一二两三四五六七八九十廿]+[点:：]\d{1,2}分?/g, '');
  content = content.replace(/[一二两三四五六七八九十廿]+[点:：]半/g, '');
  content = content.replace(/[一二两三四五六七八九十廿]+[点:：]/g, '');

  // 7. Arabic numeral time (e.g., 3点15分, 3:15, 3点半, 3点)
  content = content.replace(/\d{1,2}[点:：]\d{1,2}分?/g, '');
  content = content.replace(/\d{1,2}[点:：]半/g, '');
  content = content.replace(/\d{1,2}[点:：]/g, '');

  // 8. English time
  content = content.replace(/\d{1,2}:\d{2}\s*(am|pm)?/gi, '');
  content = content.replace(/\d{1,2}\s*(am|pm)/gi, '');

  // 9. English weekdays
  content = content.replace(/next (monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)/gi, '');
  content = content.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)\b/gi, '');

  // 10. Star / Pin / Importance keywords
  content = content.replace(/[,，]\s*(重要|星标|置顶|收藏|pinned|starred|important)/gi, '');
  content = content.replace(/(重要|星标|置顶|收藏|pinned|starred|important)\s*[,，]?/gi, '');

  // 11. Fillers and pronouns
  content = content.replace(/^我/g, '');
  content = content.replace(/去|把|将/g, '');
  content = content.replace(/\bto\b/gi, '');

  content = content.trim();
  return content || text;
}

function parseReminder(text: string): {
  refinedContent: string;
  reminder?: { type: 'once' | 'daily' | 'weekly' | 'monthly'; date: number };
  isTodo: boolean;
  isAmbiguous: boolean;
  clarificationPrompt?: string | null;
} {
  const now = new Date();
  let targetDate = new Date(now);
  let hasExplicitDate = false;
  let hasExplicitTime = false;
  let isRecurring = false;
  let recurrenceType: 'daily' | 'weekly' | 'monthly' | undefined;

  // ===== Recurring patterns =====
  if (/每天|每日|天天|每晚|每早|每个早上|每个晚上/.test(text)) {
    isRecurring = true;
    recurrenceType = 'daily';
  } else if (/every day|daily|everyday|every night|every morning/i.test(text)) {
    isRecurring = true;
    recurrenceType = 'daily';
  } else if (/每周|每星期|每个周/.test(text)) {
    isRecurring = true;
    recurrenceType = 'weekly';
  } else if (/every week|weekly/i.test(text)) {
    isRecurring = true;
    recurrenceType = 'weekly';
  } else if (/每月|每个月/.test(text)) {
    isRecurring = true;
    recurrenceType = 'monthly';
  } else if (/every month|monthly/i.test(text)) {
    isRecurring = true;
    recurrenceType = 'monthly';
  }

  // ===== Chinese weekday =====
  for (const [name, _] of Object.entries(WEEKDAY_MAP_CN)) {
    if (text.includes(name)) {
      targetDate = resolveWeekdayCN(name, now);
      hasExplicitDate = true;
      break;
    }
  }

  // ===== English weekday =====
  if (!hasExplicitDate) {
    for (const [name, _] of Object.entries(WEEKDAY_MAP_EN)) {
      const regex = new RegExp(`\\b${name}\\b`, 'i');
      if (regex.test(text)) {
        targetDate = resolveWeekdayEN(name, now);
        hasExplicitDate = true;
        break;
      }
    }
  }

  // ===== Relative day references (Chinese) =====
  if (!hasExplicitDate) {
    if (/明天/.test(text)) {
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() + 1);
      hasExplicitDate = true;
    } else if (/后天/.test(text)) {
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() + 2);
      hasExplicitDate = true;
    } else if (/大后天/.test(text)) {
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() + 3);
      hasExplicitDate = true;
    }
  }

  // ===== Relative day references (English) =====
  if (!hasExplicitDate) {
    if (/\btomorrow\b/i.test(text)) {
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() + 1);
      hasExplicitDate = true;
    } else if (/\bthe day after tomorrow\b/i.test(text)) {
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() + 2);
      hasExplicitDate = true;
    }
  }

  // ===== Specific date patterns (Chinese): 6月18号, 六月十八号, 下月15号 =====
  if (!hasExplicitDate) {
    // "下月X号/日"
    const nextMonthMatch = text.match(/下月(\d{1,2})[号日]/);
    if (nextMonthMatch) {
      const day = parseInt(nextMonthMatch[1]);
      targetDate = new Date(now.getFullYear(), now.getMonth() + 1, day, 9, 0, 0, 0);
      hasExplicitDate = true;
    }
    // "本月X号/日"
    const thisMonthMatch = text.match(/本月(\d{1,2})[号日]/);
    if (!hasExplicitDate && thisMonthMatch) {
      const day = parseInt(thisMonthMatch[1]);
      targetDate = new Date(now.getFullYear(), now.getMonth(), day, 9, 0, 0, 0);
      hasExplicitDate = true;
    }
    // "X月X号/日" (Arabic numerals)
    const monthDayMatch = text.match(/(\d{1,2})月(\d{1,2})[号日]/);
    if (!hasExplicitDate && monthDayMatch) {
      const month = parseInt(monthDayMatch[1]) - 1; // 0-indexed
      const day = parseInt(monthDayMatch[2]);
      targetDate = new Date(now.getFullYear(), month, day, 9, 0, 0, 0);
      hasExplicitDate = true;
    }
    // English: "June 18" or "Jun 18"
    const enDateMatch = text.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})\b/i);
    if (!hasExplicitDate && enDateMatch) {
      const monthNames: Record<string, number> = {
        january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
        april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
        august: 7, aug: 7, september: 8, sep: 8, october: 9, oct: 9,
        november: 10, nov: 10, december: 11, dec: 11
      };
      const month = monthNames[enDateMatch[1].toLowerCase()];
      const day = parseInt(enDateMatch[2]);
      if (month !== undefined) {
        targetDate = new Date(now.getFullYear(), month, day, 9, 0, 0, 0);
        hasExplicitDate = true;
      }
    }
  }

  // ===== Parse time =====
  const timeResult = parseTimeFromText(text, targetDate);
  if (timeResult.hasTime || timeResult.hasPeriod) {
    hasExplicitTime = true;
    targetDate = timeResult.date;
  }

  // Extract content
  let refinedContent = extractContent(text);
  // Clean up leading punctuation/spaces
  refinedContent = refinedContent.replace(/^[\s，,、]+/, '').trim();

  // Determine intent
  const hasReminderIntent = /提醒|记得|别忘了|注意|待办|任务|remind|remember|don't forget|todo/i.test(text);
  // Activity/todo keywords: things people plan to do
  const hasActivityIntent = /参加|做|去|交|买|卖|取|体检|活动|促销|开会|跑步|健身|读书|学习|考试|面试|旅行|旅游|聚餐|聚会|约会|买菜|做饭|洗衣服|打扫|整理|写作业|工作|出差|报到|报名|缴费|还款|付款|转账|寄|收|体检|复查|复诊|打针|吃药|运动|锻炼|俯卧撑|瑜伽|游泳|骑车|爬山|散步|逛街|看电影|看医生|看牙|剪头发|理发|洗车|加油|保养|维修|安装|搬家|装修|布置|准备|策划|组织|主持|演讲|发言|培训|上课|考试|测验|竞赛|比赛|演出|展览|发布|上线|交付|提交|申请|填写|签字|盖章|审批|审核|检查|验收|考核|评估|总结|汇报|报告|分析|研究|调研|考察|参观|访问|拜访|接待|招待|宴请|送礼|寄送|派发|分发|收集|整理|归档|存档|备份|恢复|更新|升级|维护|修理|调试|测试|检验|检测|测量|称重|计数|统计|计算|核算|审计|清算|结算|结账|对账|核账|查账|报税|缴税|退税|领税|发票|开票|报销|借款|贷款|抵押|担保|保险|理赔|索赔|仲裁|诉讼|起诉|上诉|申诉|复议|调解|协商|谈判|签约|签订|签署|盖章|备案|登记|注册|注销|变更|转让|过户|继承|赠与|捐赠|资助|赞助|投资|融资|筹款|募捐|众筹|团购|秒杀|抢购|预订|预定|预约|挂号|排队|取票|登机|入住|退房|租车|打车|叫车|拼车|顺风车|高铁|飞机|船票|门票|入场券|签证|护照|证件|身份证|驾照|行驶证|房产证|合同|协议|章程|制度|规定|条例|办法|细则|标准|规范|指南|手册|教程|教材|课本|笔记|日记|周记|记录|记载|登记|注册|报名|报考|应征|应聘|求职|招聘|面试|笔试|复试|录用|入职|离职|辞职|退休|休假|请假|调休|加班|值班|轮班|换班|替班|代班|顶班|接班|交班|开班|结业|毕业|入学|转学|升学|考研|考博|考公|考编|考证|考级|考照|培训|进修|研修|游学|留学|访学|交换|实习|实践|见习|试用|转正|晋升|升职|加薪|降薪|调岗|轮岗|借调|派驻|挂职|锻炼|培养|选拔|提拔|任命|免职|撤职|降职|处分|处罚|罚款|赔偿|补偿|救济|救助|救援|求救|报警|报案|举报|投诉|建议|意见|反馈|回复|答复|回应|声明|公告|通知|通告|通报|简报|快讯|消息|新闻|报道|采访|直播|转播|录制|拍摄|剪辑|制作|创作|设计|绘制|描绘|描写|描述|叙述|讲述|讲解|解释|说明|阐明|阐述|论述|论证|证明|证实|确认|核实|验证|校验|校准|校正|纠正|改正|修改|修订|修正|调整|调节|调控|控制|管理|治理|整治|整顿|整改|改良|改进|改善|优化|提升|提高|增强|加强|巩固|强化|深化|细化|量化|简化|美化|净化|绿化|硬化|软化|固化|活化|激化|淡化|弱化|老化|恶化|好转|痊愈|康复|恢复|复原|修复|重建|重构|重组|重塑|重造|重置|重置|重启|重开|重办|重做|重写|重读|重学|重考|重测|重审|重评|重估|重算|重印|重发|重播|重映|重演|重排|重调|重配|重装|重建|重造|翻新|更新|换代|升级|改造|改建|扩建|新建|筹建|兴建|营造|打造|铸造|锻造|铸造|铸造|铸造|铸造|铸造|铸造|铸造|铸造|铸造|铸造|铸造/i.test(text);
  const hasSocialIntent = /吃|喝|玩|乐|聚|约|逛|拍|打卡|野餐|露营|烧烤|烤肉|撸串|火锅|唱歌|唱K|KTV|看电影|追剧|打球|踢球|下棋|打牌|打麻将|玩桌游|剧本杀|密室逃脱|蹦极|攀岩|滑翔|跳伞|潜水|滑雪|滑冰|冲浪|骑行|自驾游|踏青|赏花|钓鱼|饮茶|下午茶|喝酒|按摩|SPA|美容|美甲|美发|化妆|护肤|冥想|瑜伽|普拉提|街舞|爵士舞|拉丁舞|芭蕾舞|现代舞|嘻哈|说唱|相声|小品|脱口秀|话剧|歌剧|音乐剧|演唱会|音乐会|K歌|卡拉OK|抖音|直播|带货|摆摊|创业|兼职|开店|团建|联谊|社交|访友|探亲|拜年|走访|慰问|陪护|陪伴|陪同|接送|接人|送人|串门|做客|招待|款待|接风|洗尘|饯行|送别|送行|告别|辞行|启程|出发|动身|起程|上路|出海|登山|探险|远足|徒步|穿越|漂流|溯溪|探洞|浮潜|深潜|海钓|矶钓|路亚|冰钓|赶海|拾贝|滑水|风筝冲浪|帆板|桨板|皮划艇|独木舟|瀑降|攀冰|单板|双板|越野滑雪|高山滑雪|BMX|小轮车|特技|漂移|甩尾|赛道|拉力|越野|穿越|探险|征服|挑战|突破|极限|超越|跨越|攀登|登顶|冲顶|攻顶|扎营|安营|宿营|野营|房车|帐篷|睡袋|天幕|吊床|野餐垫|保温箱|烧烤架|烤炉|炭火|篝火|营火|烟花|鞭炮|爆竹|灯笼|灯谜|对联|春联|福字|窗花|年画|剪纸|刺绣|编织|陶艺|木工|金工|银匠|皮具|皮革|裁缝|缝纫|织补|十字绣|钻石画|数字油画|手绘|涂鸦|喷绘|版画|篆刻|印章|刻字|碑刻|拓片|装裱|修复|文物修复|古籍修复|书画修复|装帧|排版|印刷|出版|发行|编辑|校对|审稿|润色|改写|缩写|扩写|续写|仿写|默写|听写|抄写|描红|临帖|临摹|写生|速写|素描|水彩|水粉|油画|丙烯|国画|工笔|写意|白描|泼墨|重彩|岩彩|漆画|壁画|唐卡|木刻|铜版|石版|丝网版|综合材料|装置|雕塑|浮雕|圆雕|透雕|线雕|微雕|核雕|根雕|木雕|石雕|玉雕|牙雕|骨雕|角雕|贝雕|竹雕|漆雕|景泰蓝|珐琅|掐丝|花丝|镶嵌|点翠|烧蓝|錾刻|锻打|失蜡法|3D打印|激光切割|CNC|数控|车床|铣床|磨床|钻床|刨床|插床|拉床|锯床|冲床|折弯|剪板|焊接|氩弧焊|气保焊|激光焊|点焊|铆接|粘接|装配|调试|检测|质检|品控|认证|审核|年审|复审|年检|注册|备案|许可|资质|证照|执照|许可证|合格证|检验报告|环评|安评|能评|卫评|稳评|文评|地震评价|地质灾害|水土保持|防洪评价|通航论证|文物勘探|考古发掘|地质勘察|工程测量|测绘|遥感|GIS|GPS|北斗|导航|定位|授时|通信|5G|物联网|传感|RFID|NFC|蓝牙|WiFi|ZigBee|LoRa|NB-IoT|卫星|遥感|遥测|遥控|遥信|遥调|SCADA|DCS|PLC|变频器|伺服|电机|液压|气动|传动|轴承|齿轮|链条|皮带|联轴器|密封|润滑|冷却|加热|制冷|空调|通风|换气|净化|过滤|除尘|脱硫|脱硝|污水处理|垃圾处理|固废处理|危废处理|污泥处理|中水回用|雨水收集|海绵城市|节水|节能|减排|低碳|零碳|碳中和|碳达峰|ESG|绿色|环保|可持续|循环经济|再生|回收|利用|资源化|无害化|减量化|清洁生产|绿色制造|智能制造|工业互联网|数字孪生|元宇宙|虚拟现实|增强现实|混合现实|全息|裸眼3D|沉浸式|互动|交互|人机交互|脑机接口|神经接口|意念控制|思维控制|情感计算|情绪识别|人脸识别|指纹识别|虹膜识别|声纹识别|步态识别|静脉识别|掌纹识别|DNA识别|基因检测|基因编辑|基因测序|基因合成|克隆|干细胞|再生医学|器官移植|人工器官|假肢|义肢|外骨骼|康复机器人|手术机器人|达芬奇|腹腔镜|内窥镜|胃镜|肠镜|支气管镜|膀胱镜|宫腔镜|阴道镜|喉镜|鼻镜|耳镜|皮肤镜|输尿管镜|经皮肾镜|关节镜|椎间孔镜|神经内镜|显微镜|电子显微镜|光学显微镜|荧光显微镜|共聚焦|超分辨|冷冻电镜|X射线|CT|MRI|PET|SPECT|超声|B超|彩超|多普勒|心电图|脑电图|肌电图|诱发电位|睡眠监测|Holter|动态血压|动态心电|脉搏|血氧|体温|呼吸|血压|血糖|血脂|尿酸|肝功能|肾功能|甲状腺功能|性激素|肿瘤标志物|基因检测|液体活检|ctDNA|外泌体|循环肿瘤细胞|病原微生物|细菌培养|药敏试验|病毒检测|核酸检测|抗原检测|抗体检测|血清学|免疫学|组织病理|细胞病理|分子病理|流式细胞|质谱|色谱|光谱|核磁共振|红外|紫外|拉曼|XRD|SEM|TEM|AFM|STM|KFM|SKPM|EDS|WDS|EBSD|CL|PL|傅里叶|太赫兹|微波|射频|毫米波|激光|光纤|光通信|光电子|光伏|光热|光电|光催化|光化学|光生物|光合作用|光敏|光刻|光刻胶|光刻机|EUV|DUV|电子束|离子束|分子束|原子层沉积|物理气相沉积|化学气相沉积|溅射|蒸镀|电镀|化学镀|阳极氧化|微弧氧化|磷化|钝化|发黑|发蓝|渗碳|渗氮|碳氮共渗|高频淬火|中频淬火|工频淬火|火焰淬火|激光淬火|感应淬火|盐浴淬火|油淬|水淬|空淬|等温淬火|分级淬火|贝氏体淬火|马氏体淬火|奥氏体淬火|回火|退火|正火|淬火|调质|时效|固溶|深冷|冷处理|喷丸|抛丸|喷砂|喷塑|喷漆|电泳|浸塑|浸漆|粉末涂装|氟碳喷涂|热喷涂|电弧喷涂|等离子喷涂|超音速喷涂|冷喷涂|激光熔覆|等离子熔覆|堆焊|钎焊|扩散焊|摩擦焊|搅拌摩擦焊|超声波焊|高频焊|爆炸焊|真空钎焊|氢炉钎焊|盐浴钎焊|火焰钎焊|感应钎焊|电阻钎焊|炉中钎焊|浸渍钎焊|红外线钎焊|激光钎焊|电子束钎焊|摩擦钎焊|超声波钎焊|气压钎焊|氢氧钎焊|氮气保护钎焊|氩气保护钎焊|真空扩散焊|热等静压|冷等静压|粉末冶金|注射成型|压制成型|等静压成型|热压成型|温压成型|微波烧结|放电等离子烧结|激光烧结|电子束烧结|区域熔炼|定向凝固|单晶生长|区熔|Czochralski|直拉法|悬浮区熔|分子束外延|金属有机气相外延|液相外延|脉冲激光沉积|磁控溅射|离子束溅射|反应溅射|射频溅射|直流溅射|中频溅射|高功率脉冲磁控溅射|阴极弧|过滤阴极弧|离子镀|空心阴极|热阴极|电子束蒸发|电阻蒸发|感应蒸发|激光蒸发|脉冲激光沉积|分子束外延|原子层沉积|等离子体增强化学气相沉积|低压化学气相沉积|常压化学气相沉积|金属有机化学气相沉积|物理气相传输|卤化物气相外延|氢化物气相外延|氯化物气相外延|液相外延|熔剂法|水热法|溶剂热法|高温高压|化学气相输运|物理气相输运|升华法|布里奇曼法|坩埚下降法|顶部籽晶法|底部籽晶法|泡生法|温梯法|热交换法|微下拉法|边限定薄膜喂料生长|水平区熔|垂直区熔|浮区法|焰熔法|维尔纳叶法|提拉法|导模法|微重力生长|空间晶体生长|超纯材料|高纯金属|高纯气体|高纯化学品|超纯水|超纯溶剂|电子级|半导体级|光纤级|光伏级|核级|航天级|航空级|军工级|医疗级|食品级|化妆品级|分析纯|化学纯|优级纯|基准试剂|标准物质|标准溶液|滴定液|缓冲液|培养基|染色液|固定液|脱水液|透明液|包埋剂|切片|贴片|烤片|脱蜡|水化|抗原修复|封闭|一抗|二抗|显色|复染|封片|HE染色|免疫组化|免疫荧光|原位杂交|FISH|CISH|SISH|银染|PAS染色|Masson三色|VanGieson|天狼猩红|油红O|苏丹黑|尼氏染色|Golgi染色|镀银|镀镍|镀金|镀铂|镀铑|镀钯|镀钌|镀锇|镀铱|镀钛|镀锆|镀铌|镀钽|镀铬|镀钼|镀钨|镀钒|镀锰|镀钴|镀铁|镀铜|镀锡|镀铅|镀锌|镀镉|镀铟|镀铊|镀锗|镀硒|镀碲|镀砷|镀锑|镀铋|镀钋|镀砹|镀氡|镀钫|镀镭|镀锕|镀钍|镀镤|镀铀|镀镎|镀钚|镀镅|镀锔|镀锫|镀锎|镀锿|镀镄|镀钔|镀锘|镀铹|镀鐽|镀錀|镀鎶|镀鉨|镀鈇|镀镆|镀鉝|镀鿬|镀鿫/i.test(text);
  const isTodo = hasReminderIntent || hasActivityIntent || hasSocialIntent || hasExplicitDate || hasExplicitTime || isRecurring;

  // Ambiguity check
  let isAmbiguous = false;
  let clarificationPrompt: string | null = null;

  // Build reminder
  let reminder: { type: 'once' | 'daily' | 'weekly' | 'monthly'; date: number } | undefined;

  if (hasExplicitDate || hasExplicitTime || isRecurring) {
    reminder = {
      type: recurrenceType || 'once',
      date: targetDate.getTime(),
    };
  }

  // If todo intent but no date/time/recurring → ambiguous
  if (isTodo && !reminder) {
    isAmbiguous = true;
    clarificationPrompt = `Would you like to set a reminder for "${refinedContent}", or keep it as a plain note?`;
  }

  return {
    refinedContent,
    reminder,
    isTodo,
    isAmbiguous,
    clarificationPrompt,
  };
}

export async function categorizeThoughtLocal(text: string): Promise<{
  category?: string;
  tags?: string[];
  refinedContent: string;
  isTodo?: boolean;
  reminder?: any;
  isAmbiguous?: boolean;
  clarificationPrompt?: string | null;
  isStarred?: boolean;
  isPinned?: boolean;
}> {
  try {
    const result = parseReminder(text);

    // Category detection (Chinese + English)
    const categories: Record<string, string> = {
      '工作': 'Work', '会议': 'Work', '项目': 'Work', '报告': 'Work', '加班': 'Work', '汇报': 'Work', '客户': 'Work', '同事': 'Work', '领导': 'Work', 'work': 'Work', 'meeting': 'Work', 'project': 'Work', 'deadline': 'Work', 'office': 'Work',
      '购物': 'Errands', '买': 'Errands', '卖': 'Errands', '快递': 'Errands', '取': 'Errands', '外卖': 'Errands', '超市': 'Errands', 'shopping': 'Errands', 'buy': 'Errands', 'purchase': 'Errands', 'delivery': 'Errands',
      '健康': 'Health', '体检': 'Health', '药': 'Health', '医院': 'Health', '运动': 'Health', '健身': 'Health', '跑步': 'Health', '瑜伽': 'Health', '看病': 'Health', '挂号': 'Health', 'health': 'Health', 'gym': 'Health', 'exercise': 'Health', 'workout': 'Health', 'doctor': 'Health', 'hospital': 'Health',
      '学习': 'Learning', '读书': 'Learning', '课程': 'Learning', '考试': 'Learning', '上课': 'Learning', '培训': 'Learning', 'study': 'Learning', 'read': 'Learning', 'course': 'Learning', 'book': 'Learning', 'exam': 'Learning', 'learn': 'Learning',
      '个人': 'Personal', '家庭': 'Personal', '生活': 'Personal', 'personal': 'Personal', 'family': 'Personal', 'life': 'Personal',
      '财务': 'Finance', '钱': 'Finance', '账单': 'Finance', '理财': 'Finance', '投资': 'Finance', '国债': 'Finance', '基金': 'Finance', '股票': 'Finance', '债券': 'Finance', '保险': 'Finance', '银行': 'Finance', '存款': 'Finance', '取款': 'Finance', '转账': 'Finance', '信用卡': 'Finance', '房贷': 'Finance', '车贷': 'Finance', '利息': 'Finance', '收益': 'Finance', '分红': 'Finance', 'tax': 'Finance', 'finance': 'Finance', 'money': 'Finance', 'bill': 'Finance', 'invest': 'Finance', 'stock': 'Finance', 'fund': 'Finance', 'loan': 'Finance', 'budget': 'Finance', 'savings': 'Finance',
      '社交': 'Social', '聚会': 'Social', '朋友': 'Social', '聚餐': 'Social', '约会': 'Social', '生日': 'Social', '婚礼': 'Social', 'social': 'Social', 'party': 'Social', 'friend': 'Social', 'dinner': 'Social', 'date': 'Social',
      '旅行': 'Travel', '旅游': 'Travel', '出差': 'Travel', '机票': 'Travel', '酒店': 'Travel', '签证': 'Travel', 'travel': 'Travel', 'trip': 'Travel', 'flight': 'Travel', 'hotel': 'Travel',
    };

    let category = 'Personal';
    for (const [keyword, cat] of Object.entries(categories)) {
      if (text.includes(keyword)) {
        category = cat;
        break;
      }
    }

    // Star & Pin detection
    const isStarred = /重要|important|⭐|★|星标|star|favorite|收藏/i.test(text);
    const isPinned = /置顶|pin|fixed|sticky|置顶显示/i.test(text);

    // Tag extraction
    const tags: string[] = [];
    if (/提醒|待办|todo|remind/i.test(text)) tags.push('reminder');
    if (/紧急|尽快|马上|urgent|asap/i.test(text)) tags.push('urgent');
    if (isStarred) tags.push('important');
    if (/理财|投资|国债|基金|股票|债券|保险|存款|收益|分红|savings|investment/i.test(text)) tags.push('finance');
    if (/重复|每天|每周|每月|recurring|repeat/i.test(text)) tags.push('recurring');

    // Ensure category and tags don't overlap
    let finalTags = tags.length > 0 ? tags : undefined;
    if (category && finalTags) {
      finalTags = finalTags.filter((t) => t.toLowerCase() !== category.toLowerCase());
      if (finalTags.length === 0) finalTags = undefined;
    }

    console.log('[localNLP] input:', text, '-> refinedContent:', result.refinedContent, 'isTodo:', result.isTodo, 'reminder:', !!result.reminder, 'isAmbiguous:', result.isAmbiguous);

    return {
      category,
      tags: finalTags,
      refinedContent: result.refinedContent,
      isTodo: result.isTodo,
      reminder: result.reminder,
      isAmbiguous: result.isAmbiguous,
      clarificationPrompt: result.clarificationPrompt,
      isStarred: isStarred || undefined,
      isPinned: isPinned || undefined,
    };
  } catch (err) {
    console.error('[localNLP] Error:', err);
    return { refinedContent: text };
  }
}
