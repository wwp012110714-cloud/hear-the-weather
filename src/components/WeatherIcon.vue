<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="weather-svg-icon"
    :class="`icon-${type}`"
    aria-hidden="true"
  >
    <!-- 晴朗白昼 -->
    <g v-if="type === 'sun'">
      <circle cx="24" cy="24" r="10.5" fill="url(#sunGrad)" />
      <g stroke="#FCD34D" stroke-width="2.4" stroke-linecap="round" class="sun-rays">
        <line x1="24" y1="5" x2="24" y2="9" />
        <line x1="24" y1="39" x2="24" y2="43" />
        <line x1="5" y1="24" x2="9" y2="24" />
        <line x1="39" y1="24" x2="43" y2="24" />
        <line x1="10.6" y1="10.6" x2="13.4" y2="13.4" />
        <line x1="34.6" y1="34.6" x2="37.4" y2="37.4" />
        <line x1="37.4" y1="10.6" x2="34.6" y2="13.4" />
        <line x1="13.4" y1="34.6" x2="10.6" y2="37.4" />
      </g>
    </g>

    <!-- 晴朗星夜 -->
    <g v-else-if="type === 'moon'">
      <path
        d="M31.8 29.6C25.3 29.6 20 24.3 20 17.8C20 14.7 21.2 11.9 23.1 9.8C16.2 10.6 10.8 16.5 10.8 23.7C10.8 31.4 17.1 37.7 24.8 37.7C30.8 37.7 36 33.9 37.9 28.5C36.1 29.2 34 29.6 31.8 29.6Z"
        fill="url(#moonGrad)"
      />
      <circle cx="35" cy="14" r="1.6" fill="#FEF08A" />
      <circle cx="39" cy="20" r="1.1" fill="#FEF08A" opacity="0.75" />
    </g>

    <!-- 晴间多云 -->
    <g v-else-if="type === 'partly-cloudy'">
      <circle cx="18" cy="18" r="8" fill="url(#sunGrad)" />
      <path
        d="M15 37H35.2C38.9 37 42 34 42 30.2C42 26.7 39.4 23.9 36 23.5C34.9 18.7 30.6 15.2 25.5 15.2C19.8 15.2 15.1 19.6 14.7 25.2C11.5 25.7 9 28.5 9 31.9C9 34.8 11.7 37 15 37Z"
        fill="url(#cloudGrad)"
      />
    </g>

    <!-- 夜间多云 -->
    <g v-else-if="type === 'cloudy-night'">
      <path
        d="M23.5 18.5C19.6 18.5 16.5 15.4 16.5 11.5C16.5 9.8 17.1 8.2 18.2 7C13.9 7.6 10.6 11.3 10.6 15.8C10.6 20.7 14.6 24.7 19.5 24.7C23.2 24.7 26.3 22.5 27.6 19.3C26.3 18.8 25 18.5 23.5 18.5Z"
        fill="url(#moonGrad)"
      />
      <path
        d="M15 38H35.2C38.9 38 42 35 42 31.2C42 27.7 39.4 24.9 36 24.5C34.9 19.7 30.6 16.2 25.5 16.2C19.8 16.2 15.1 20.6 14.7 26.2C11.5 26.7 9 29.5 9 32.9C9 35.8 11.7 38 15 38Z"
        fill="url(#cloudGrad)"
      />
    </g>

    <!-- 阴云 -->
    <g v-else-if="type === 'cloud'">
      <path
        d="M14 36H34.8C38.8 36 42 32.8 42 28.8C42 25.1 39.2 22.1 35.6 21.7C34.4 16.6 29.8 12.8 24.4 12.8C18.3 12.8 13.4 17.5 12.9 23.5C9.5 24 6.8 27 6.8 30.6C6.8 33.7 9.9 36 14 36Z"
        fill="url(#cloudGrad)"
      />
    </g>

    <!-- 薄雾 -->
    <g v-else-if="type === 'fog'">
      <path
        d="M14 28H34.5C38.1 28 41 25.1 41 21.5C41 18.2 38.5 15.5 35.3 15.1C34.2 10.6 30.1 7.4 25.2 7.4C19.8 7.4 15.4 11.6 15 16.9C11.9 17.4 9.5 20.1 9.5 23.3C9.5 26 11.5 28 14 28Z"
        fill="url(#cloudGrad)"
        opacity="0.88"
      />
      <g stroke="#CBD5E1" stroke-width="2.4" stroke-linecap="round">
        <line x1="10" y1="33" x2="38" y2="33" />
        <line x1="14" y1="38.5" x2="34" y2="38.5" opacity="0.72" />
      </g>
    </g>

    <!-- 细雨 / 降雨 -->
    <g v-else-if="type === 'drizzle' || type === 'rain' || type === 'heavy-rain'">
      <path
        d="M14 30H34.6C38.4 30 41.5 26.9 41.5 23.1C41.5 19.6 38.9 16.7 35.5 16.3C34.3 11.5 30 8 24.8 8C19 8 14.3 12.4 13.9 18.1C10.6 18.6 8 21.5 8 24.9C8 27.8 10.7 30 14 30Z"
        fill="url(#cloudGrad)"
      />
      <g stroke="#38BDF8" stroke-width="2.4" stroke-linecap="round">
        <line x1="17" y1="34" x2="14.8" y2="40" />
        <line x1="25" y1="34" x2="22.8" y2="41.5" />
        <line v-if="type !== 'drizzle'" x1="33" y1="34" x2="30.8" y2="40" />
      </g>
    </g>

    <!-- 降雪 -->
    <g v-else-if="type === 'snow'">
      <path
        d="M14 30H34.6C38.4 30 41.5 26.9 41.5 23.1C41.5 19.6 38.9 16.7 35.5 16.3C34.3 11.5 30 8 24.8 8C19 8 14.3 12.4 13.9 18.1C10.6 18.6 8 21.5 8 24.9C8 27.8 10.7 30 14 30Z"
        fill="url(#cloudGrad)"
      />
      <g fill="#E0F2FE">
        <circle cx="16.5" cy="36.5" r="2.1" />
        <circle cx="24.5" cy="39.5" r="2.3" />
        <circle cx="32.5" cy="36.5" r="2.1" />
      </g>
    </g>

    <!-- 雷暴 -->
    <g v-else-if="type === 'storm'">
      <path
        d="M14 29H34.6C38.4 29 41.5 25.9 41.5 22.1C41.5 18.6 38.9 15.7 35.5 15.3C34.3 10.5 30 7 24.8 7C19 7 14.3 11.4 13.9 17.1C10.6 17.6 8 20.5 8 23.9C8 26.8 10.7 29 14 29Z"
        fill="url(#stormCloudGrad)"
      />
      <path
        d="M25.5 26L19.5 35H24.6L22.8 43L30.5 33H25.2L25.5 26Z"
        fill="#FBBF24"
      />
    </g>

    <defs>
      <linearGradient id="sunGrad" x1="14" y1="12" x2="34" y2="36" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FDE68A" />
        <stop offset="1" stop-color="#F59E0B" />
      </linearGradient>
      <linearGradient id="moonGrad" x1="12" y1="10" x2="34" y2="36" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FEF3C7" />
        <stop offset="1" stop-color="#FBBF24" />
      </linearGradient>
      <linearGradient id="cloudGrad" x1="12" y1="12" x2="36" y2="38" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FFFFFF" stop-opacity="0.96" />
        <stop offset="1" stop-color="#CBD5E1" stop-opacity="0.88" />
      </linearGradient>
      <linearGradient id="stormCloudGrad" x1="12" y1="10" x2="36" y2="32" gradientUnits="userSpaceOnUse">
        <stop stop-color="#CBD5E1" />
        <stop offset="1" stop-color="#64748B" />
      </linearGradient>
    </defs>
  </svg>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    default: 'sun'
  },
  size: {
    type: [Number, String],
    default: 28
  }
})
</script>

<style scoped>
.weather-svg-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.16));
}

.sun-rays {
  transform-origin: 24px 24px;
  animation: slowSpin 28s linear infinite;
}

@keyframes slowSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
