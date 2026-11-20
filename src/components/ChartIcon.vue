<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="square"
    stroke-linejoin="miter"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'play'">
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'pause'">
      <path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'prev'">
      <path d="M6 5v14" />
      <path d="M19 5v14L8.5 12z" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'next'">
      <path d="M18 5v14" />
      <path d="M5 5v14l10.5-7z" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'star'">
      <path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8L8 13.6l-4.3-4 5.8-.7z" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'star-on'">
      <path
        d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8L8 13.6l-4.3-4 5.8-.7z"
        fill="currentColor"
        stroke-linejoin="round"
      />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </template>
    <template v-else-if="name === 'locate'">
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </template>
    <template v-else-if="name === 'roam'">
      <path d="M3 7h4.5l9 10H21" />
      <path d="M3 17h4.5l2.6-2.9M13.9 9.9L16.5 7H21" />
      <path d="M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="M6 6l12 12M18 6L6 18" />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4v4.5H15" />
    </template>
    <template v-else-if="name === 'volume'">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </template>
  </svg>
</template>

<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 18 }
})
</script>
