<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useRoute, useData } from 'vitepress'
import { ref, onMounted, watch, nextTick, computed } from 'vue'

const { Layout } = DefaultTheme
const route = useRoute()
const { site } = useData()

const isTutorialPage = computed(() => {
  return route.path.startsWith('/zh/tutorials/') || route.path.startsWith('/en/tutorials/')
})

const commentContainer = ref<HTMLElement | null>(null)
let gitalkInstance: any = null

const renderGitalk = async () => {
  if (!commentContainer.value) return

  if (gitalkInstance) {
    commentContainer.value.innerHTML = ''
    gitalkInstance = null
  }

  if (!isTutorialPage.value) return

  const gitalkConfig = (site.value.themeConfig as any)?.gitalk
  if (!gitalkConfig?.clientID || !gitalkConfig?.clientSecret) {
    console.warn('[Gitalk] Missing gitalk config in themeConfig')
    return
  }

  const Gitalk = (await import('gitalk')).default

  gitalkInstance = new Gitalk({
    ...gitalkConfig,
    id: route.path,
    distractionFreeMode: false,
    language: 'zh-CN',
  })

  gitalkInstance.render(commentContainer.value)
}

onMounted(() => {
  nextTick(() => {
    renderGitalk()
  })
})

watch(
  () => route.path,
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
        <div v-if="isTutorialPage" ref="commentContainer" id="gitalk-container"></div>
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

#gitalk-container .gt .gt-meta {
  max-width: 100%;
}

#gitalk-container .gt .gt-comments {
  max-width: 100%;
}
</style>
