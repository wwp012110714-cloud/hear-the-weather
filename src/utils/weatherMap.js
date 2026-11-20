/**
 * 城市漫游快捷入口（仅作为地理坐标查询入参，所有气象、空气质量与音乐数据均通过公共 API 实时拉取）
 */
export const FEATURED_CITIES = [
  { id: 'chengdu', name: '成都', region: '四川', lat: 30.6667, lon: 104.0667, vibe: '蓉城慢调' },
  { id: 'dali', name: '大理', region: '云南', lat: 25.5847, lon: 100.2123, vibe: '苍洱长风' },
  { id: 'hangzhou', name: '杭州', region: '浙江', lat: 30.2741, lon: 120.1551, vibe: '西子烟波' },
  { id: 'beijing', name: '北京', region: '北京市', lat: 39.9042, lon: 116.4074, vibe: '京华晴云' },
  { id: 'harbin', name: '哈尔滨', region: '黑龙江', lat: 45.75, lon: 126.65, vibe: '北国冰城' },
  { id: 'sanya', name: '三亚', region: '海南', lat: 18.2544, lon: 109.5095, vibe: '椰林海风' },
  { id: 'lhasa', name: '拉萨', region: '西藏', lat: 29.65, lon: 91.1, vibe: '日光之城' },
  { id: 'xiamen', name: '厦门', region: '福建', lat: 24.4798, lon: 118.0819, vibe: '鹭岛潮音' },
  { id: 'chongqing', name: '重庆', region: '重庆市', lat: 29.5603, lon: 106.5577, vibe: '山城雾夜' },
  { id: 'mohe', name: '漠河', region: '黑龙江', lat: 52.9721, lon: 122.5362, vibe: '极北雪原' }
]

/**
 * 「随机漫游」国内多元气候目的地池
 */
export const ROAM_CITY_POOL = [
  ...FEATURED_CITIES,
  { id: 'altay', name: '阿勒泰', region: '新疆', lat: 47.8484, lon: 88.1396, vibe: '旷野牧云' },
  { id: 'qingdao', name: '青岛', region: '山东', lat: 36.0671, lon: 120.3826, vibe: '红瓦海雾' },
  { id: 'xian', name: '西安', region: '陕西', lat: 34.2583, lon: 108.9286, vibe: '长安暮鼓' },
  { id: 'suzhou', name: '苏州', region: '江苏', lat: 31.299, lon: 120.5853, vibe: '姑苏听雨' },
  { id: 'guilin', name: '桂林', region: '广西', lat: 25.2819, lon: 110.2864, vibe: '漓江烟岚' },
  { id: 'dunhuang', name: '敦煌', region: '甘肃', lat: 40.1421, lon: 94.662, vibe: '大漠星河' },
  { id: 'weihai', name: '威海', region: '山东', lat: 37.5091, lon: 122.1136, vibe: '山海观雪' },
  { id: 'guiyang', name: '贵阳', region: '贵州', lat: 26.5783, lon: 106.7135, vibe: '黔山翠雨' },
  { id: 'wuhan', name: '武汉', region: '湖北', lat: 30.5844, lon: 114.2986, vibe: '江城晚风' },
  { id: 'changsha', name: '长沙', region: '湖南', lat: 28.2278, lon: 112.9389, vibe: '湘江夜色' },
  { id: 'kunming', name: '昆明', region: '云南', lat: 25.0389, lon: 102.7183, vibe: '春城暖阳' },
  { id: 'hongkong', name: '香港', region: '香港', lat: 22.3193, lon: 114.1694, vibe: '维港霓虹' }
]

/**
 * WMO 国际气象代码映射表
 */
const WMO_MAP = {
  0: { label: '晴朗无云', short: '晴', category: 'clear', icon: 'sun' },
  1: { label: '晴间微云', short: '晴间多云', category: 'clear', icon: 'partly-cloudy' },
  2: { label: '多云', short: '多云', category: 'cloudy', icon: 'partly-cloudy' },
  3: { label: '阴天层云', short: '阴', category: 'cloudy', icon: 'cloud' },
  45: { label: '薄雾轻笼', short: '雾', category: 'fog', icon: 'fog' },
  48: { label: '雾凇凝霜', short: '雾凇', category: 'fog', icon: 'fog' },
  51: { label: '毛毛细雨', short: '细雨', category: 'rain', icon: 'drizzle' },
  53: { label: '绵密微雨', short: '微雨', category: 'rain', icon: 'drizzle' },
  55: { label: '浓密细雨', short: '细雨', category: 'rain', icon: 'rain' },
  56: { label: '冻毛毛雨', short: '冻雨', category: 'rain', icon: 'rain' },
  57: { label: '强冻细雨', short: '冻雨', category: 'rain', icon: 'rain' },
  61: { label: '淅沥小雨', short: '小雨', category: 'rain', icon: 'rain' },
  63: { label: '中雨如织', short: '中雨', category: 'rain', icon: 'rain' },
  65: { label: '倾盆大雨', short: '大雨', category: 'rain', icon: 'heavy-rain' },
  66: { label: '轻度冻雨', short: '冻雨', category: 'rain', icon: 'rain' },
  67: { label: '强冻雨', short: '冻雨', category: 'rain', icon: 'heavy-rain' },
  71: { label: '零星小雪', short: '小雪', category: 'snow', icon: 'snow' },
  73: { label: '漫天中雪', short: '中雪', category: 'snow', icon: 'snow' },
  75: { label: '鹅毛大雪', short: '大雪', category: 'snow', icon: 'snow' },
  77: { label: '细碎雪粒', short: '雪粒', category: 'snow', icon: 'snow' },
  80: { label: '零星阵雨', short: '阵雨', category: 'rain', icon: 'rain' },
  81: { label: '中度阵雨', short: '阵雨', category: 'rain', icon: 'rain' },
  82: { label: '强阵雨', short: '强阵雨', category: 'rain', icon: 'heavy-rain' },
  85: { label: '阵雪纷飞', short: '阵雪', category: 'snow', icon: 'snow' },
  86: { label: '强阵雪', short: '大阵雪', category: 'snow', icon: 'snow' },
  95: { label: '雷阵雨', short: '雷雨', category: 'storm', icon: 'storm' },
  96: { label: '雷雨伴冰雹', short: '雷雹', category: 'storm', icon: 'storm' },
  99: { label: '强雷暴冰雹', short: '强雷暴', category: 'storm', icon: 'storm' }
}

export function getWeatherMeta(code = 0, isDay = 1, temp = 18) {
  const base = WMO_MAP[code] || { label: '多云微风', short: '多云', category: 'cloudy', icon: 'cloud' }
  let skyTheme = 'sunny-day'

  if (base.category === 'storm') {
    skyTheme = 'storm'
  } else if (base.category === 'rain') {
    skyTheme = 'rainy'
  } else if (base.category === 'snow' || temp <= -4) {
    skyTheme = 'snowy'
  } else if (!isDay) {
    skyTheme = 'clear-night'
  } else if (temp >= 25 && code <= 2) {
    skyTheme = 'sunny-day'
  } else if (base.category === 'cloudy' || base.category === 'fog') {
    skyTheme = 'cloudy-day'
  } else {
    skyTheme = 'sunny-day'
  }

  let icon = base.icon
  if (!isDay && icon === 'sun') icon = 'moon'
  if (!isDay && icon === 'partly-cloudy') icon = 'cloudy-night'

  return {
    ...base,
    icon,
    skyTheme,
    isDay: Boolean(isDay)
  }
}

export function getWindDirectionLabel(deg = 0) {
  const dirs = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风']
  return dirs[Math.round(((deg % 360) / 45)) % 8]
}

export function getAqiMeta(aqi) {
  if (aqi == null || Number.isNaN(aqi)) {
    return { label: '暂无', level: 'neutral', advice: '气象站暂未返回实时颗粒物数据' }
  }
  if (aqi <= 50) return { label: '优', level: 'good', advice: '空气清冽通透，适宜开窗通风与户外漫步' }
  if (aqi <= 100) return { label: '良', level: 'fair', advice: '空气质量良好，适合日常出行与运动' }
  if (aqi <= 150) return { label: '轻度', level: 'moderate', advice: '敏感人群建议适度减少高强度户外活动' }
  return { label: '偏高', level: 'poor', advice: '建议留在室内静听音乐，外出做好防护' }
}

export function getUvMeta(uv = 0) {
  if (uv < 3) return { label: '较弱', tip: '光线柔和无需特别防晒' }
  if (uv < 6) return { label: '中等', tip: '午后外出可备遮阳帽' }
  if (uv < 8) return { label: '偏强', tip: '阳光热烈，注意防晒补水' }
  return { label: '很强', tip: '高原或海滨强日照，务必做好防晒' }
}

/**
 * 生成贴合当地实时气象的一句诗意观察语
 */
export function buildPoeticSummary({ cityName, code, isDay, temp, windSpeed, humidity }) {
  const meta = getWeatherMeta(code, isDay, temp)
  if (meta.category === 'rain') {
    return `${cityName}此刻细雨轻落（湿度 ${humidity}%），窗外雨声淅沥，适合泡一杯热茶静听温柔慢歌。`
  }
  if (meta.category === 'storm') {
    return `${cityName}正值雷雨云系过境，风声与远雷交织，让舒缓的旋律陪你安坐室内。`
  }
  if (meta.category === 'snow' || temp <= -3) {
    return `${cityName}当前气温 ${temp.toFixed(1)}°C，寒意清冽纯净，最宜围炉听一曲冬日钢琴与暖心民谣。`
  }
  if (!isDay) {
    return `夜幕降临${cityName}，晚风 ${windSpeed} km/h，城市灯火渐次亮起，适合调低灯光进入夜色电台。`
  }
  if (temp >= 25) {
    return `${cityName}阳光炽热（${temp.toFixed(1)}°C），海风与热浪拂面，来一首橘子汽水味的轻快旋律吧。`
  }
  if (meta.category === 'cloudy' || meta.category === 'fog') {
    return `${cityName}云层轻拢、天色天青柔和，微凉气流拂过街巷，正适合漫不经心地放空听歌。`
  }
  return `${cityName}此刻晴空澄澈（${temp.toFixed(1)}°C），微风和煦，把阳光与好心情一起装进耳机里。`
}

/**
 * 曲风偏好可选项
 */
export const GENRE_MODES = [
  { id: 'auto', label: '随天气智能调频' },
  { id: 'mandopop', label: '华语流行' },
  { id: 'folk', label: '城市民谣' },
  { id: 'pure', label: '治愈纯音' },
  { id: 'jazz', label: '微醺爵士' }
]

/**
 * 核心气象声学智能映射引擎：
 * 根据城市实时天气码、昼夜、温度、风速推导专属电台频道、检索词组与环境混音预设
 */
export function deriveMusicProfile({
  cityName = '成都',
  code = 0,
  isDay = 1,
  temp = 18,
  windSpeed = 6,
  precipitation = 0,
  genreMode = 'auto',
  batchIndex = 0
}) {
  const meta = getWeatherMeta(code, isDay, temp)

  // 计算当地自然环境声默认混音比例 (0 ~ 100)
  const ambientPreset = {
    rain: 0,
    wind: Math.min(75, Math.max(10, Math.round(windSpeed * 2.4))),
    hearth: 0,
    chimes: 0
  }

  let moodTitle = '晴空微风 · 浮光掠影'
  let moodBadge = '暖阳声景'
  let queries = ['晴天 温柔', '微风 治愈', '夏天 清新']

  if (meta.category === 'storm') {
    moodTitle = '雷雨夜幕 · 沉浸剧场'
    moodBadge = '风暴声景'
    queries = ['雷雨 钢琴', '雨夜 华语', '电影原声 治愈', '大雨 温柔']
    ambientPreset.rain = 72
    ambientPreset.wind = 55
  } else if (meta.category === 'rain') {
    moodTitle = isDay ? '烟雨微凉 · 屋檐听雨' : '夜雨敲窗 · 城市慢歌'
    moodBadge = '雨天声景'
    queries = ['下雨 温柔', '雨天 民谣', '细雨 纯音乐', '雨夜 华语']
    ambientPreset.rain = Math.min(82, Math.max(48, Math.round(45 + precipitation * 8)))
    ambientPreset.wind = Math.max(22, ambientPreset.wind)
  } else if (meta.category === 'snow' || temp <= -2) {
    moodTitle = '霁雪寒林 · 围炉钢琴'
    moodBadge = '冰雪声景'
    queries = ['冬日 钢琴', '雪 治愈', '温暖 民谣', '下雪 华语']
    ambientPreset.hearth = 62
    ambientPreset.wind = Math.max(28, ambientPreset.wind)
  } else if (!isDay) {
    moodTitle = temp < 10 ? '清冷星夜 · 深夜独白' : '晚风微醺 · 星夜电台'
    moodBadge = '夜晚声景'
    queries = ['夜晚 爵士', '晚风 温柔', '深夜 民谣', '星空 纯音乐']
    ambientPreset.chimes = 28
    if (temp < 8) ambientPreset.hearth = 38
  } else if (temp >= 25) {
    moodTitle = '热浪海风 · 橘子汽水'
    moodBadge = '盛夏声景'
    queries = ['海边 夏天', '夏日 轻快', '海风 流行', '阳光 旅行']
    ambientPreset.wind = Math.max(42, ambientPreset.wind)
    ambientPreset.chimes = 36
  } else if (meta.category === 'cloudy' || meta.category === 'fog') {
    moodTitle = '天青云影 · 漫步遐思'
    moodBadge = '云雾声景'
    queries = ['多云 治愈', '独立民谣', '午后 轻音乐', '微风 慢歌']
    ambientPreset.wind = Math.max(25, ambientPreset.wind)
  } else {
    moodTitle = temp < 12 ? '秋高气爽 · 清朗原声' : '暖阳微风 · 治愈漫游'
    moodBadge = '晴朗声景'
    queries = ['晴天 轻快', '微风 治愈', '午后 民谣', '旅行 华语']
    ambientPreset.chimes = 42
  }

  // 融入城市人文音乐印记（若该城市有鲜明音乐意象且处于智能模式）
  const cleanCity = cityName.replace(/(市|地区|自治州|特别行政区)$/, '')
  const musicalCities = ['成都', '北京', '大理', '杭州', '拉萨', '厦门', '哈尔滨', '台北', '香港', '重庆', '西安', '武汉']
  if (genreMode === 'auto' && musicalCities.includes(cleanCity)) {
    queries = [`${cleanCity} 民谣`, ...queries]
  }

  // 用户手动切换曲风偏好时，与当前天气状态交叉融合
  const weatherWord =
    meta.category === 'rain' || meta.category === 'storm'
      ? '雨'
      : meta.category === 'snow' || temp <= 0
      ? '冬'
      : !isDay
      ? '夜'
      : temp >= 25
      ? '夏'
      : '微风'

  if (genreMode === 'mandopop') {
    queries = [`${weatherWord} 周杰伦`, `${weatherWord} 陈奕迅`, '华语 抒情', '孙燕姿 莫文蔚']
  } else if (genreMode === 'folk') {
    queries = [`${cleanCity} 民谣`, `${weatherWord} 民谣`, '房东的猫 民谣', '赵雷 民谣']
  } else if (genreMode === 'pure') {
    queries = [`${weatherWord} 治愈纯音乐`, '久石让 钢琴', '森林 轻音乐', '清晨 钢琴']
  } else if (genreMode === 'jazz') {
    queries = ['夜晚 爵士', '咖啡馆 爵士', 'Bossa Nova 轻快', '浪漫 萨克斯']
  }

  // 支持「换一批」轮换查询词顺序
  const rotated = [...queries]
  const shift = batchIndex % rotated.length
  const orderedQueries = [...rotated.slice(shift), ...rotated.slice(0, shift)]

  const dayText = isDay ? '白昼' : '夜晚'
  const reasonText = `依据 ${cityName} 实时气象「${meta.label} · ${temp.toFixed(1)}°C · ${dayText} · 风速 ${windSpeed} km/h」，智能匹配 ${moodTitle} 曲库`

  return {
    moodTitle,
    moodBadge,
    reasonText,
    queries: orderedQueries.slice(0, 2),
    ambientPreset,
    weatherMeta: meta
  }
}
