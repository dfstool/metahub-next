<script setup lang="ts">
interface Props {
    isShow: boolean;
}
const props = withDefaults(defineProps<Props>(), {});

// 初始化
watch(
    () => props.isShow,
    () => {
        if (props.isShow) generateKeyHandle();
    },
    { immediate: true }
);

// 生成key
const publicKey = ref('');
const privateKey = ref('');
const generateKeyHandle = async () => {
    let keypair = null as any;
    // let keypair = await chain.get(chainId.value).getRandomPairKey();
    if (keypair) {
        publicKey.value = keypair.publicKey;
        privateKey.value = keypair.privateKey;
    }
};

// 使用key
const emit = defineEmits(['close', 'setOperateKey']);
const useKeyHandle = () => {
    emit('setOperateKey', publicKey.value);
    emit('close');
};
</script>

<template>
    <n-modal :show="props.isShow" @mask-click="$emit('close')">
        <n-card class="w-5/6" :title="$t('setting.generatePublicKey')" :bordered="false">
            <div class="dialog-box">
                <!-- public key -->
                <div class="dialog-cell py-3">
                    <div class="dialog-cell-left">{{ $t('setting.newPublicKey') }}</div>
                    <clip-button :value="publicKey" />
                </div>

                <!-- private key -->
                <div class="dialog-cell py-3">
                    <div class="dialog-cell-left">{{ $t('setting.newPrivateKey') }}</div>
                    <clip-button :value="privateKey" />
                </div>

                <!-- tip -->
                <div class="dialog-tip">
                    <div class="dialog-tip-one">{{ $t('setting.notice') }}</div>
                    <div class="dialog-tip-one">- {{ $t('setting.generateTipOne') }}</div>
                    <div class="dialog-tip-one">- {{ $t('setting.generateTipTwo') }}</div>
                    <div class="dialog-tip-one">- {{ $t('setting.generateTipThree') }}</div>
                </div>

                <!-- button -->
                <div class="flex justify-between mt-3">
                    <n-button @click="generateKeyHandle" class="dialog-change-button">
                        {{ $t('setting.refresh') }}
                    </n-button>
                    <n-button type="primary" @click="useKeyHandle" class="dialog-change-button">
                        {{ $t('setting.useIt') }}
                    </n-button>
                </div>
            </div>
        </n-card>
    </n-modal>
</template>

<style lang="scss" scoped>
.dialog-cell {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #f2f2f2;
    word-break: break-all;
    white-space: normal;

    .dialog-cell-left {
        width: 45px;
    }
    .dialog-cell-mid {
        color: #999999;
        flex: 1;
        text-align: left;
        word-wrap: break-word;
        vertical-align: middle;
        font-size: 12px;
        padding: 5px;
        line-height: 20px;
        min-height: 70px;
    }
    .dialog-cell-right {
        width: 52px;
        color: #999999;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .dialog-change-button {
        height: 24px;
        text-align: center;
        vertical-align: middle;
        line-height: 0px;
        padding: 0 12px;
        border: 0;
        background-color: #e7faf7;
        border-radius: 12px;
        font-size: 12px;
    }
}
.dialog-tip {
    margin-top: 20px;
    font-size: 12px;
    color: #be4a44;
    .dialog-tip-one {
        margin-top: 3px;
    }
}
</style>