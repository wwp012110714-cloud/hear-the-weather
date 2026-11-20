<template>
  <section class="forecast" aria-labelledby="fc-h">
    <div class="fc-head">
      <h2 id="fc-h" class="fc-title">七日预报</h2>
      <p class="fc-note">点一天，按那天的天气重新推歌</p>
      <button v-if="selected != null" type="button" class="chart-btn" @click="$emit('select-day', null)">回到实况</button>
    </div>
    <div class="fc-scroll">
      <table v-if="days.length">
        <thead>
          <tr>
            <th scope="row" class="rh">日期</th>
            <th v-for="(d, i) in days" :key="d.date" scope="col" :class="{ sel: selected === i }">
              <button
                type="button"
                class="day-btn"
                :aria-pressed="String(selected === i)"
                @click="$emit('select-day', selected === i ? null : i)"
              >
                <span class="d-label">{{ d.dayLabel }}</span>
                <span class="d-date num">{{ d.shortDate }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" class="rh">天气</th>
            <td v-for="(d, i) in days" :key="d.date" :class="{ sel: selected === i }">
              <span class="cell-glyph">
                <svg width="30" height="26" viewBox="-15 -13 30 26" aria-hidden="true">
                  <StationGlyph :code="d.code" :s="0.75" :selected="selected === i" />
                </svg>
                {{ short(d) }}
              </span>
            </td>
          </tr>
          <tr>
            <th scope="row" class="rh">最高</th>
            <td v-for="(d, i) in days" :key="d.date" class="num big" :class="{ sel: selected === i }">
              {{ Math.round(d.maxTemp) }}°
            </td>
          </tr>
          <tr>
            <th scope="row" class="rh">最低</th>
            <td v-for="(d, i) in days" :key="d.date" class="num" :class="{ sel: selected === i }">
              {{ Math.round(d.minTemp) }}°
            </td>
          </tr>
          <tr>
            <th scope="row" class="rh">降水</th>
            <td v-for="(d, i) in days" :key="d.date" class="num" :class="{ sel: selected === i }">{{ d.popMax }}%</td>
          </tr>
          <tr>
            <th scope="row" class="rh">紫外线</th>
            <td v-for="(d, i) in days" :key="d.date" :class="{ sel: selected === i }">{{ uv(d) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="fc-empty">{{ loading ? '预报加载中…' : '暂无预报数据' }}</p>
    </div>
  </section>
</template>

<script setup>
import StationGlyph from './StationGlyph.vue'
import { getWeatherMeta, getUvMeta } from '../utils/weatherMap'

defineProps({
  days: { type: Array, default: () => [] },
  selected: { type: Number, default: null },
  loading: { type: Boolean, default: false }
})

defineEmits(['select-day'])

const short = (d) => getWeatherMeta(d.code, 1, (d.maxTemp + d.minTemp) / 2).short
const uv = (d) => `${Math.round(d.uvMax)} ${getUvMeta(d.uvMax).label}`
</script>

<style scoped>
.forecast {
  min-width: 0;
}

.fc-head {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 10px;
}

.fc-title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.fc-note {
  margin: 0;
  flex: 1;
  font-size: 0.875rem;
  color: var(--ink-3);
}

.fc-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: 0.9375rem;
}

th,
td {
  padding: 6px 10px;
  text-align: center;
  border-bottom: 1px solid var(--rule-soft);
  white-space: nowrap;
}

thead th {
  border-bottom: 1px solid var(--rule);
  padding: 0;
}

tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: 1px solid var(--rule);
}

.rh {
  text-align: left;
  width: 4.5em;
  font-weight: 400;
  color: var(--ink-3);
  font-size: 0.8125rem;
}

thead .rh {
  padding: 6px 10px;
}

.day-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  transition: background-color var(--dur-fast) ease;
}

.day-btn:hover {
  background: rgba(44, 90, 138, 0.06);
}

.d-label {
  font-weight: 700;
}

.d-date {
  font-size: 0.75rem;
  color: var(--ink-3);
}

.cell-glyph {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.big {
  font-size: 1.125rem;
}

.sel {
  color: var(--front);
  background: var(--front-wash);
}

.sel .d-date {
  color: var(--front);
}

.fc-empty {
  margin: 0;
  padding: 12px 0;
  color: var(--ink-3);
  border-top: 1px solid var(--rule);
}
</style>
