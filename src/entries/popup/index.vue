<script setup lang="ts">
// 初始化钱包情况
const userStore = useUserStore();

// 钱包选择
const showAccountSelector = ref(false);
const router = useRouter();
const handleImportKey = (chainId: string) => {
    router.push({
        name: 'import-key',
        query: { chainId },
    });
    showAccountSelector.value = false;
};

// 路由动画
const route = useRoute();
const transitionName = ref('');
watch(
    () => route.meta.index,
    (toIndex, fromIndex) => {
        if (toIndex < fromIndex) {
            transitionName.value = 'slideInLeft';
        } else if (toIndex > fromIndex) {
            transitionName.value = 'slideInRight';
        } else {
            transitionName.value = '';
        }
    }
);
</script>

<template>
    <!-- 已解锁钱包 -->
    <div v-if="!userStore.isLock" class="bg">
        <top-nav @change-account="showAccountSelector = true"></top-nav>

        <!-- 显示路由对应的信息，这里显示的是@/entries/popup/wallet/index.vue        -->
        <div class="app-content">
            <router-view  class="animate__animated" :class="`animate__${transitionName}`" v-slot="{ Component }">
                <keep-alive :include="['wallet']">
                    <component :is="Component" />
                </keep-alive>
            </router-view>
           
        </div>

        <account-selector
            :is-show="showAccountSelector"
            v-model="showAccountSelector"
            @close="showAccountSelector = false"
            @importKey="handleImportKey"
        ></account-selector>
    </div>

    <!-- 未解锁钱包但已初始化 -->
    <div class="bg" v-else-if="userStore.isInited">
        <password-unlock></password-unlock>
    </div>

    <!-- 未初始化钱包 -->
    <div class="bg" v-else>
        <password-setting></password-setting>
    </div>
</template>

<style lang="scss" scoped>
.bg {
    height: 100%;
    background-image: linear-gradient(rgba(246, 221, 255, 0.24), rgba(225, 225, 250, 0.04));
}

.app-content {
    padding-top: 70px;
    overflow: hidden;
    height: 600px;
}

.app-content .full-inner {
    z-index: 2;
}
</style>
