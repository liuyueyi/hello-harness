<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { onMounted, watch, nextTick, computed } from 'vue'

const { Layout } = DefaultTheme
const { site, page } = useData()

const isTutorialPage = computed(() => {
  const path = page.value.relativePath || ''
  return path.startsWith('zh/tutorials/') || path.startsWith('en/tutorials/')
})

let gitalkInstance: any = null

const renderGitalk = async () => {
  const container = document.getElementById('gitalk-container')
  if (!container || !isTutorialPage.value) return

  if (gitalkInstance) {
    container.innerHTML = ''
    gitalkInstance = null
  }

  const gitalkConfig = (site.value.themeConfig as any)?.gitalk
  if (!gitalkConfig?.clientID || !gitalkConfig?.clientSecret) {
    console.warn('[Gitalk] Missing gitalk config in themeConfig')
    return
  }

  const Gitalk = (await import('gitalk')).default

  gitalkInstance = new Gitalk({
    ...gitalkConfig,
    id: page.value.relativePath || window.location.pathname,
    distractionFreeMode: false,
    language: 'zh-CN',
  })

  gitalkInstance.render(container)
}

onMounted(() => {
  nextTick(() => {
    renderGitalk()
  })
})

watch(
  () => page.value.relativePath,
  () => {
    nextTick(() => {
      renderGitalk()
    })
  }
)
</script>

<template>
  <Layout>
    <template #doc-bottom>
      <div class="gitalk-wrapper">
        <div id="gitalk-container"></div>
      </div>
    </template>
  </Layout>
</template>

<style>
.gitalk-wrapper {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1.5rem;
}

.gitalk-wrapper .gt .gt-meta {
  max-width: 100%;
}

.gitalk-wrapper .gt .gt-comments {
  max-width: 100%;
}
</style>
