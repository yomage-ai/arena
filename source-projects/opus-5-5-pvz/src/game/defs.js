// 植物与僵尸的数据定义（数值参考原作并按本作尺度换算：1 格 = 100 像素）。
export const PLANTS = {
  peashooter: {
    name: '豌豆射手', cost: 100, recharge: 7.5, hp: 300, kind: 'shooter',
    desc: '最基础的攻击植物，朝同一行的僵尸连续发射豌豆。',
    stats: [['伤害', '普通'], ['射速', '普通']],
    lore: '豌豆射手每天早上都会做五十个俯卧撑来锻炼颈部——毕竟，所有的后坐力都得靠脖子扛。',
  },
  sunflower: {
    name: '向日葵', cost: 50, recharge: 7.5, hp: 300, kind: 'producer',
    desc: '会定期产出阳光的经济植物，开局多种几株准没错。',
    stats: [['阳光产量', '普通']],
    lore: '向日葵坚信微笑可以传染。它对着僵尸笑了整整一个下午，结果只收获了一句“脑子……”。',
  },
  cherrybomb: {
    name: '樱桃炸弹', cost: 150, recharge: 50, hp: 300, kind: 'instant',
    desc: '种下后片刻即爆炸，消灭周围 3×3 范围内的所有僵尸。',
    stats: [['伤害', '极高'], ['范围', '3×3 区域'], ['用法', '单独使用，立即生效']],
    lore: '这对双胞胎从小就形影不离，连发脾气都要同步。它们唯一的分歧是：谁先喊出“轰”。',
  },
  wallnut: {
    name: '坚果墙', cost: 50, recharge: 30, hp: 4000, kind: 'wall',
    desc: '坚硬的外壳能长时间挡住僵尸，为身后的植物争取时间。',
    stats: [['韧性', '高']],
    lore: '坚果墙的座右铭是“站着别动”。它在这方面天赋异禀，至今保持着花园“最久不动”的纪录。',
  },
  potatomine: {
    name: '土豆地雷', cost: 25, recharge: 30, hp: 300, kind: 'mine', armTime: 15,
    desc: '需要一段时间破土准备，就绪后一碰即炸，炸飞所在格子的僵尸。',
    stats: [['伤害', '极高'], ['范围', '一个格子内的全部僵尸'], ['用法', '单独使用，需要一点准备时间']],
    lore: '土豆地雷认为准备工作决定一切。它花十五秒钻出泥土，其中十四秒用来整理发型。',
  },
  snowpea: {
    name: '寒冰射手', cost: 175, recharge: 7.5, hp: 300, kind: 'shooter',
    desc: '发射寒冰豌豆，造成伤害的同时让僵尸减速。',
    stats: [['伤害', '普通，并减速']],
    lore: '寒冰射手的冰箱里什么都没有——它只是喜欢待在里面思考人生。',
  },
  chomper: {
    name: '大嘴花', cost: 150, recharge: 7.5, hp: 300, kind: 'melee', chewTime: 42,
    desc: '能一口吞下面前的整只僵尸，但咀嚼期间毫无防备。',
    stats: [['伤害', '巨大'], ['范围', '非常短'], ['特点', '咀嚼时间很长']],
    lore: '大嘴花正在节食，每天只吃一只僵尸。问题在于，它嚼一只僵尸需要大半分钟。',
  },
  repeater: {
    name: '双发射手', cost: 200, recharge: 7.5, hp: 300, kind: 'shooter',
    desc: '一次发射两颗豌豆，火力是豌豆射手的两倍。',
    stats: [['伤害', '普通（每颗）'], ['射速', '两倍']],
    lore: '双发射手坚持“重要的事情说两遍”，连打招呼都要说“你好你好”。',
  },
  puffshroom: {
    name: '小喷菇', cost: 0, recharge: 7.5, hp: 300, kind: 'shooter', night: true, range: 3.2,
    desc: '免费的短程射手，适合在夜晚快速铺开防线。',
    stats: [['伤害', '普通'], ['范围', '近'], ['特点', '白天要睡觉']],
    lore: '小喷菇个子不高，嗓门却不小。它最喜欢的运动是对着三格以外的僵尸大喊“有种过来”。',
  },
  sunshroom: {
    name: '阳光菇', cost: 25, recharge: 7.5, hp: 300, kind: 'producer', night: true,
    desc: '夜晚的阳光来源：起初产出少量阳光，长大后产量提升。',
    stats: [['阳光产量', '低，之后正常'], ['特点', '白天要睡觉']],
    lore: '阳光菇晚上发光、白天睡觉，被问到原因时它总是打着哈欠说：“时差。”',
  },
  fumeshroom: {
    name: '大喷菇', cost: 75, recharge: 7.5, hp: 300, kind: 'fume', night: true, range: 4.2,
    desc: '喷出一股毒气，伤害前方一段距离内的所有僵尸，可以穿透铁栅门。',
    stats: [['伤害', '普通，可穿透铁丝网门'], ['范围', '臭气中的所有僵尸'], ['特点', '白天要睡觉']],
    lore: '大喷菇每次开口前都会先深吸一口气，这让它在花园合唱团里的表现相当惊人。',
  },
  gravebuster: {
    name: '墓碑吞噬者', cost: 75, recharge: 7.5, hp: 300, kind: 'grave', night: false,
    desc: '种在墓碑上，把整块墓碑慢慢啃掉。',
    stats: [['用法', '单独使用，只能种在墓碑上'], ['特点', '可以移除墓碑']],
    lore: '墓碑吞噬者对石头的口感颇有研究，它认为大理石“略显油腻”，花岗岩“嚼劲十足”。',
  },
  hypnoshroom: {
    name: '魅惑菇', cost: 75, recharge: 30, hp: 300, kind: 'hypno', night: true,
    desc: '被僵尸吃掉后，会让这只僵尸掉头为你而战。',
    stats: [['用法', '单独使用，接触生效'], ['特点', '让一只僵尸为你作战'], ['特点', '白天要睡觉']],
    lore: '魅惑菇的眼睛会转圈圈。它说自己并没有催眠谁，只是大家都莫名其妙地同意了它的观点。',
  },
  scaredyshroom: {
    name: '胆小菇', cost: 25, recharge: 7.5, hp: 300, kind: 'shooter', night: true, scared: true,
    desc: '射程很远的射手，但僵尸靠近时会害怕得缩成一团。',
    stats: [['伤害', '普通'], ['特点', '敌人接近时停止攻击'], ['特点', '白天要睡觉']],
    lore: '胆小菇连自己的影子都怕。好消息是：在夜晚，它几乎看不见自己的影子。',
  },
  iceshroom: {
    name: '寒冰菇', cost: 75, recharge: 50, hp: 300, kind: 'instant', night: true,
    desc: '瞬间冻结全场所有僵尸，并让它们在一段时间内减速。',
    stats: [['伤害', '非常低，冻结全屏僵尸'], ['范围', '全屏'], ['用法', '单独使用，立即生效'], ['特点', '白天要睡觉']],
    lore: '寒冰菇从不参加派对，因为每次它一进门，气氛就会立刻冷下来。',
  },
  doomshroom: {
    name: '毁灭菇', cost: 125, recharge: 50, hp: 300, kind: 'instant', night: true,
    desc: '引发一场巨大的爆炸，消灭大范围内的僵尸，并留下一个暂时无法种植的弹坑。',
    stats: [['伤害', '极高'], ['范围', '大范围内的所有僵尸'], ['用法', '单独使用，立即生效'], ['特点', '留下弹坑，白天要睡觉']],
    lore: '毁灭菇平时安静内敛，喜欢园艺和插花。只是它的每一次“插花”，都会让方圆几格寸草不生。',
  },
  lilypad: {
    name: '睡莲', cost: 25, recharge: 7.5, hp: 300, kind: 'base', aquatic: true,
    desc: '浮在水面上，让陆地植物也能种在泳池里。',
    stats: [['特点', '非水生植物可以种在上面'], ['用法', '必须种在水面上']],
    lore: '睡莲是泳池里最好的倾听者。无论谁站在它身上抱怨，它都只是轻轻地晃一晃。',
  },
  squash: {
    name: '窝瓜', cost: 50, recharge: 30, hp: 300, kind: 'squash',
    desc: '发现身旁的僵尸后会高高跃起，把它狠狠压扁。',
    stats: [['伤害', '极高'], ['范围', '短，覆盖所有它压到的僵尸'], ['用法', '单独使用']],
    lore: '窝瓜的人生信条只有一个字：压。它曾试图压扁一只苍蝇，结果在地上躺了一整天。',
  },
  threepeater: {
    name: '三线射手', cost: 325, recharge: 7.5, hp: 300, kind: 'shooter',
    desc: '同时向自己和上下相邻的三行发射豌豆。',
    stats: [['伤害', '普通（每颗）'], ['范围', '三条线']],
    lore: '三线射手的三个脑袋经常为吃什么吵架，但只要僵尸出现，它们总能瞬间达成一致。',
  },
  tanglekelp: {
    name: '缠绕海草', cost: 25, recharge: 30, hp: 300, kind: 'kelp', aquatic: true,
    desc: '潜伏在水中，把第一个靠近的僵尸拖入水底。',
    stats: [['伤害', '极高'], ['用法', '单独使用，接触生效'], ['特点', '必须种在水中']],
    lore: '缠绕海草自称是泳池里的“隐形刺客”，尽管它那双大眼睛在水面上一览无余。',
  },
  jalapeno: {
    name: '火爆辣椒', cost: 125, recharge: 50, hp: 300, kind: 'instant',
    desc: '片刻后爆发出一道烈焰，烧光整行的僵尸。',
    stats: [['伤害', '极高'], ['范围', '整条线'], ['用法', '单独使用，立即生效']],
    lore: '火爆辣椒的脾气比它的辣度还要火爆。据说它生气时，连太阳都要往后退一步。',
  },
  spikeweed: {
    name: '地刺', cost: 100, recharge: 7.5, hp: 300, kind: 'spike',
    desc: '趴在地上扎伤经过的僵尸，还能扎爆车辆轮胎；僵尸不会啃食它。',
    stats: [['伤害', '普通'], ['范围', '所有踩到它的僵尸'], ['特点', '不会被僵尸吃掉']],
    lore: '地刺并不介意被人踩——事实上，它就盼着这一刻。',
  },
  torchwood: {
    name: '火炬树桩', cost: 175, recharge: 7.5, hp: 300, kind: 'torch',
    desc: '让穿过它的豌豆变成火球，伤害翻倍并溅射周围僵尸。',
    stats: [['特点', '豌豆穿过后变成火球，伤害加倍'], ['特点', '火球会溅射附近的僵尸']],
    lore: '火炬树桩是花园里最受欢迎的邻居：冬天能取暖，夏天能烧烤，还从不收电费。',
  },
  tallnut: {
    name: '高坚果', cost: 125, recharge: 30, hp: 8000, kind: 'wall', tall: true,
    desc: '比坚果墙更高更硬的壁垒，撑杆和海豚都无法跃过它。',
    stats: [['韧性', '非常高'], ['特点', '不会被撑杆或海豚跳过']],
    lore: '高坚果身高是它最骄傲的资本，它每天都要量一次身高，确认自己没有被啃矮。',
  },
  magnetshroom: {
    name: '磁力菇', cost: 100, recharge: 7.5, hp: 300, kind: 'magnet', night: true,
    desc: '吸走附近僵尸身上的铁桶、头盔、铁栅门等金属装备。',
    stats: [['范围', '附近的僵尸'], ['特点', '移除金属物品'], ['特点', '白天要睡觉']],
    lore: '磁力菇收藏了满满一屋子的铁桶和头盔，它正在考虑开一家二手五金店。',
  },
  coffeebean: {
    name: '咖啡豆', cost: 75, recharge: 7.5, hp: 300, kind: 'coffee', overlay: true,
    desc: '种在白天睡觉的蘑菇上，把它唤醒投入战斗。',
    stats: [['用法', '种在蘑菇上，立即生效'], ['特点', '唤醒蘑菇']],
    lore: '咖啡豆精力过剩，说话语速是正常植物的三倍。蘑菇们一听它开口，就再也睡不着了。',
  },
  seashroom: {
    name: '海蘑菇', cost: 0, recharge: 30, hp: 300, kind: 'shooter', night: true, aquatic: true, range: 3.2,
    desc: '只能种在水面上的短程射手，免费但冷却较慢。',
    stats: [['伤害', '普通'], ['范围', '近'], ['特点', '只能种在水面上，白天要睡觉']],
    lore: '海蘑菇从没见过大海，但它坚信泳池就是大海的缩小版，只是咸味淡了一点。',
  },
  plantern: {
    name: '路灯花', cost: 25, recharge: 30, hp: 300, kind: 'lantern',
    desc: '照亮周围的浓雾，让你看清雾里藏着的僵尸。',
    stats: [['范围', '周围一片区域'], ['特点', '驱散浓雾']],
    lore: '路灯花最怕停电。它总是随身带着备用灯泡，以防万一。',
  },
  cactus: {
    name: '仙人掌', cost: 125, recharge: 7.5, hp: 300, kind: 'shooter', antiAir: true,
    desc: '发射尖刺，还能伸长身体戳破气球僵尸的气球。',
    stats: [['伤害', '普通'], ['特点', '可以攻击空中的气球僵尸']],
    lore: '仙人掌看起来浑身是刺，其实内心非常柔软。它的梦想是开一家气球店——当然，是卖给别人扎的。',
  },
  blover: {
    name: '三叶草', cost: 100, recharge: 7.5, hp: 300, kind: 'blover',
    desc: '种下后立即刮起大风，吹走所有气球僵尸，并暂时吹散浓雾。',
    stats: [['用法', '单独使用，立即生效'], ['特点', '吹走气球僵尸，吹散浓雾']],
    lore: '三叶草总说自己是四叶草，只是有一片叶子出门旅游去了。',
  },
  splitpea: {
    name: '裂荚射手', cost: 125, recharge: 7.5, hp: 300, kind: 'shooter', split: true,
    desc: '同时向前方和后方发射豌豆，后方一次两颗。',
    stats: [['伤害', '普通'], ['射向', '前方一颗，后方两颗']],
    lore: '裂荚射手的两个脑袋一个乐观一个悲观，它们从来没有面对面聊过天。',
  },
  starfruit: {
    name: '杨桃', cost: 125, recharge: 7.5, hp: 300, kind: 'star',
    desc: '同时朝五个方向发射星星，打击上下左右与斜前方的僵尸。',
    stats: [['伤害', '普通'], ['射向', '五个方向']],
    lore: '杨桃的梦想是成为夜空中最亮的星。它每天都在练习发光，虽然目前只能发射星星。',
  },
  pumpkin: {
    name: '南瓜头', cost: 125, recharge: 30, hp: 4000, kind: 'pumpkin', shell: true,
    desc: '可以套在其他植物外面，替它们挡住僵尸的啃咬。',
    stats: [['韧性', '高'], ['用法', '可以套在其他植物上']],
    lore: '南瓜头总是把最好的位置让给别人，自己挡在外面。邻居们都说，它是花园里最有担当的蔬菜。',
  },
  garlic: {
    name: '大蒜', cost: 50, recharge: 7.5, hp: 400, kind: 'garlic',
    desc: '僵尸咬一口大蒜就会难受地换到相邻的行去。',
    stats: [['韧性', '中'], ['特点', '让啃咬它的僵尸换行']],
    lore: '大蒜从不用香水。它说：“真正的魅力，是让人闻一下就想转身离开。”',
  },
};

export const PLANT_ORDER = [
  'peashooter', 'sunflower', 'cherrybomb', 'wallnut', 'potatomine', 'snowpea', 'chomper', 'repeater',
  'puffshroom', 'sunshroom', 'fumeshroom', 'gravebuster', 'hypnoshroom', 'scaredyshroom', 'iceshroom', 'doomshroom',
  'lilypad', 'squash', 'threepeater', 'tanglekelp', 'jalapeno', 'spikeweed', 'torchwood', 'tallnut',
  'magnetshroom', 'coffeebean', 'seashroom', 'plantern', 'cactus', 'blover', 'splitpea', 'starfruit', 'pumpkin', 'garlic',
];

// 僵尸：hp 为本体血量；armor 头部护具；shield 手持护具；speed 像素/秒；pts 出场点数
export const ZOMBIES = {
  normal: {
    name: '普通僵尸', hp: 200, speed: 19, pts: 1, weight: 4000,
    desc: '最常见的僵尸，慢吞吞地走向你的房子。', stats: [['韧性', '低']],
    lore: '普通僵尸并不普通——它是全队唯一一个记得打领带的。',
  },
  flag: {
    name: '旗帜僵尸', hp: 200, speed: 24, pts: 1, weight: 0, flag: true,
    desc: '举着旗帜的僵尸，它的出现意味着一大波僵尸正在逼近。', stats: [['韧性', '低']],
    lore: '旗帜僵尸把旗子洗得干干净净，旗面上的脑子图案是它亲手缝上去的。',
  },
  cone: {
    name: '路障僵尸', hp: 200, speed: 19, pts: 2, weight: 4000, armor: { kind: 'cone', hp: 370, metal: false },
    desc: '头顶路障的僵尸，比普通僵尸耐打得多。', stats: [['韧性', '中']],
    lore: '路障僵尸在马路边捡到了这顶“帽子”，从此自认为是整条街最时髦的僵尸。',
  },
  pole: {
    name: '撑杆僵尸', hp: 340, speed: 42, walkSpeed: 19, pts: 2, weight: 2000, firstWave: 5, land: true,
    desc: '手持撑杆快速奔跑，会跳过遇到的第一株植物。', stats: [['韧性', '中'], ['速度', '快，跳跃后变慢'], ['特点', '跳过遇到的第一株植物']],
    lore: '撑杆僵尸生前是一名田径运动员，它至今仍在为打破“后院跳高纪录”而努力。',
  },
  bucket: {
    name: '铁桶僵尸', hp: 200, speed: 19, pts: 4, weight: 3000, firstWave: 8, armor: { kind: 'bucket', hp: 1100, metal: true },
    desc: '头戴铁桶的僵尸，防御力非常高。', stats: [['韧性', '高'], ['弱点', '磁力菇']],
    lore: '铁桶僵尸已经很久没看清路了，但它相信只要一直往左走，总能找到脑子。',
  },
  newspaper: {
    name: '读报僵尸', hp: 200, speed: 19, angrySpeed: 45, pts: 2, weight: 1000, firstWave: 3, land: true,
    shield: { kind: 'paper', hp: 150, metal: false, blocksPeas: false },
    desc: '用报纸挡住伤害，报纸被打烂后会暴怒并加速。', stats: [['韧性', '低'], ['报纸韧性', '低'], ['速度', '普通，失去报纸后加快']],
    lore: '读报僵尸每天都在追一篇连载小说。要是有人打断它的阅读，后果自负。',
  },
  screendoor: {
    name: '铁栅门僵尸', hp: 200, speed: 19, pts: 4, weight: 3500, firstWave: 5, land: true,
    shield: { kind: 'door', hp: 1100, metal: true, blocksPeas: true },
    desc: '举着铁栅门当盾牌，能挡住正面射来的豌豆。', stats: [['韧性', '低'], ['铁栅门韧性', '高'], ['弱点', '大喷菇和磁力菇']],
    lore: '这扇铁栅门是它从邻居家“借”来的，它打算用完再还——大概吧。',
  },
  football: {
    name: '橄榄球僵尸', hp: 200, speed: 36, pts: 7, weight: 2000, firstWave: 8, land: true, scale: 1.06,
    armor: { kind: 'helmet', hp: 1400, metal: true },
    desc: '身穿全套护具，速度快、极其耐打。', stats: [['韧性', '极高'], ['速度', '快'], ['弱点', '磁力菇']],
    lore: '橄榄球僵尸从不传球，它唯一的战术就是冲、冲、冲。',
  },
  dancer: {
    name: '舞王僵尸', hp: 500, speed: 22, pts: 5, weight: 1000, firstWave: 10, land: true,
    desc: '会召唤四名伴舞僵尸，和它们一起舞动前进。', stats: [['韧性', '中'], ['特点', '召唤伴舞僵尸']],
    lore: '舞王僵尸的鞋底永远擦得锃亮。它说：“舞台在哪里，我就在哪里。”',
  },
  backup: {
    name: '伴舞僵尸', hp: 200, speed: 22, pts: 1, weight: 0, land: true,
    desc: '由舞王僵尸召唤的伴舞者。', stats: [['韧性', '低']],
    lore: '伴舞僵尸的梦想是有一天也能站在C位，不过目前它连舞步都还没记全。',
  },
  ducky: {
    name: '鸭子救生圈僵尸', hp: 200, speed: 19, pts: 1, weight: 0, swim: true,
    desc: '套着鸭子救生圈，可以在泳池中漂浮前进。', stats: [['韧性', '低'], ['特点', '只在水中出现']],
    lore: '这只鸭子救生圈是它小时候的玩具，它一直舍不得扔。',
  },
  snorkel: {
    name: '潜水僵尸', hp: 200, speed: 19, pts: 3, weight: 2000, firstWave: 5, water: true,
    desc: '潜入水下前进，潜泳时豌豆打不到它。', stats: [['韧性', '低'], ['特点', '潜泳时可以躲避攻击'], ['特点', '只在水中出现']],
    lore: '潜水僵尸并不需要呼吸管，它只是觉得这样看起来更专业。',
  },
  zomboni: {
    name: '冰车僵尸', hp: 1350, speed: 16, pts: 7, weight: 2000, firstWave: 10, land: true, vehicle: true,
    desc: '驾驶冰车碾压植物，并在身后留下无法种植的冰道；怕地刺。', stats: [['韧性', '高'], ['特点', '碾压植物，留下冰道'], ['弱点', '地刺']],
    lore: '冰车僵尸考了三次驾照才通过，考官至今仍心有余悸。',
  },
  dolphin: {
    name: '海豚骑士僵尸', hp: 340, speed: 44, walkSpeed: 19, pts: 3, weight: 1500, firstWave: 10, water: true,
    desc: '骑着海豚在水中飞驰，会跳过遇到的第一株植物。', stats: [['韧性', '中'], ['速度', '快，跳跃后变慢'], ['特点', '跳过遇到的第一株植物'], ['特点', '只在水中出现']],
    lore: '海豚和骑手配合默契，据说它们曾一起获得过“水上表演”铜牌。',
  },
  gargantuar: {
    name: '巨人僵尸', hp: 3000, speed: 14, pts: 10, weight: 1500, firstWave: 15, land: true, scale: 1,
    desc: '体型巨大的僵尸，一棒砸扁植物，受伤后还会扔出小鬼僵尸。', stats: [['韧性', '极高'], ['特点', '砸扁植物'], ['特点', '血量过半时扔出小鬼僵尸']],
    lore: '巨人僵尸的电线杆是它最心爱的玩具，它甚至给它起了名字。',
  },
  imp: {
    name: '小鬼僵尸', hp: 200, speed: 26, pts: 2, weight: 0, land: true,
    desc: '被巨人僵尸扔进防线的小个子僵尸。', stats: [['韧性', '低'], ['速度', '快']],
    lore: '小鬼僵尸最喜欢被扔出去的那一瞬间，每次落地它都想说“再来一次”。',
  },
  balloon: {
    name: '气球僵尸', hp: 200, speed: 26, pts: 2, weight: 1500, firstWave: 8, land: true,
    desc: '乘着气球飘过你的防线，只有仙人掌和三叶草能对付它。', stats: [['韧性', '低'], ['特点', '飞行，越过植物'], ['弱点', '仙人掌、三叶草']],
    lore: '气球僵尸小时候就想飞。它唯一没想明白的是，下来之后该怎么办。',
  },
  digger: {
    name: '矿工僵尸', hp: 300, speed: 40, walkSpeed: 19, pts: 4, weight: 1200, firstWave: 8, land: true,
    desc: '在地底挖隧道，从你的房子那一头钻出来，再从背后发动袭击。', stats: [['韧性', '中'], ['特点', '地下潜行，从后方进攻'], ['弱点', '裂荚射手、杨桃、磁力菇']],
    lore: '矿工僵尸挖了一辈子隧道，至今没挖到过一粒金子，但它挖到过三只鼹鼠和一只非常生气的獾。',
  },
  pogo: {
    name: '跳跳僵尸', hp: 500, speed: 30, walkSpeed: 19, pts: 4, weight: 1200, firstWave: 8, land: true,
    desc: '踩着弹簧高跷跳过一株又一株植物。', stats: [['韧性', '中'], ['特点', '跳过所有植物'], ['弱点', '高坚果、磁力菇']],
    lore: '跳跳僵尸停不下来，因为它忘了怎么下来。',
  },
  jackbox: {
    name: '小丑僵尸', hp: 500, speed: 30, pts: 3, weight: 1000, firstWave: 8, land: true,
    desc: '它的玩具盒随时可能爆炸，炸毁附近的植物。', stats: [['韧性', '中'], ['速度', '快'], ['特点', '会突然自爆'], ['弱点', '磁力菇']],
    lore: '小丑僵尸的音乐盒只会弹一首歌，它已经循环播放了四十年。',
  },
};

export const ZOMBIE_ORDER = ['normal', 'flag', 'cone', 'pole', 'bucket', 'newspaper', 'screendoor', 'football', 'dancer', 'backup', 'ducky', 'snorkel', 'zomboni', 'dolphin', 'balloon', 'digger', 'pogo', 'jackbox', 'gargantuar', 'imp'];

const FOG_PLANTS = ['seashroom', 'plantern', 'cactus', 'blover', 'splitpea', 'starfruit', 'pumpkin', 'garlic'];
// 植物在图鉴 / 奖励界面里展示时使用的场景
export function plantHomeEnv(id) {
  const d = PLANTS[id];
  if (FOG_PLANTS.includes(id)) return d.aquatic ? 'fog' : 'night';
  if (d.aquatic) return 'pool';
  if (d.night) return 'night';
  return 'day';
}

export function rechargeLabel(t) {
  if (t <= 8) return '快';
  if (t <= 30) return '慢';
  return '很慢';
}
