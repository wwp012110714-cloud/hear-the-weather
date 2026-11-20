<template>
  <div class="app-shell" data-sky="sunny-day">
    <main class="container">
      <h1>听见天气</h1>
      <p>正在初始化城市气象声景电台…</p>
    </main>
  </div>
</template>

<script setup>
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: linear-gradient(165deg, var(--sky-top), var(--sky-mid), var(--sky-bottom));
  display: flex;
  align-items: center;
  justify-content: center;
}
.container {
  text-align: center;
}
</style>
