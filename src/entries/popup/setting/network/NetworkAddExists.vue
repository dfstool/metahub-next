<script lang="ts" setup>
import _ from 'lodash';
import { eosChainId, dfsChainId, supportNetworks } from '@/common/util/network';
import { Network } from '@/types/settings';

const { t } = useI18n();
const router = useRouter();

const eChainId = ref(eosChainId);
const dChainId = ref(dfsChainId);

// 添加网络前置操作
const chainStore = useChainStore();

const handleAdd = (network: Network) => {
    window.dialog.warning({
        title: t('public.tip'),
        content: t('setting.sureAddPrefix') + network.name + t('setting.sureAddSuffix'),
        positiveText: t('password.submit'),
        negativeText: t('password.cancel'),
        onPositiveClick: () => {
            addNetwork(network);
            router.go(-1);
        },
        onNegativeClick: () => {},
    });
};

const networkExists = (chainId: string) => {
    return  chainStore.networks.findIndex((x) => x.chainId == chainId) >= 0;
}

// 新增网络
const addNetwork = (network: Network) => {
    chainStore.setNetworks([...chainStore.networks, network]);
    chainStore.setSelectedRpc(network.chainId, network.endpoint);

    const customRpcs = chainStore.customRpcs;
    customRpcs[network.chainId] = [
        {
            name: network.name,
            endpoint: network.endpoint,
        },
    ];
    chainStore.setCustomRpcs(customRpcs);
};

// 确定移除
const handleRemove = (item: Network) => {
    window.dialog.warning({
        title: t('public.tip'),
        content: t('setting.sureDeletePrefix') + item.name + t('setting.sureDeleteSuffix'),
        positiveText: t('password.submit'),
        negativeText: t('password.cancel'),
        onPositiveClick: () => {
            removeNetwork(item);
            router.go(-1);
        },
        onNegativeClick: () => {},
    });
};

// 移除网络
const removeNetwork = (network: Network) => {
    const widx = useWalletStore().wallets.findIndex((x) => x.chainId == network.chainId);
    if (widx >= 0) return window.msg.error(t('setting.alreadyExistAccount'));

    const index = chainStore.networks.findIndex((x) => x.chainId == network.chainId);
    if (index >= 0) {
        const networks = chainStore.networks;
        networks.splice(index, 1);
        chainStore.setNetworks(networks);

        const customRpcs = chainStore.customRpcs;
        if (customRpcs[network.chainId]) {
            delete customRpcs[network.chainId];
            chainStore.setCustomRpcs(customRpcs);
        }
    }
};
</script>

<template>
    <div class="full-router">
        <div class="full-inner">
            <page-header :title="$t('setting.addExistingNetwork')"></page-header>

            <div class="cover-content _effect">
                <n-scrollbar>
                    <n-table class="networks w-full">
                        <thead>
                            <tr>
                                <th>{{ $t('setting.name') }}</th>
                                <th>ChainId</th>
                                <th>{{ t('setting.operation') }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(network, index) of supportNetworks" :key="index">
                                <!-- name -->
                                <td>{{ network.name }}</td>
                                <!-- chainId -->
                                <td>{{ network.chainId.substring(0, 16) + '..' }}</td>

                                <td class="flex justify-center min-h-[48px]">
                                    <!-- add -->
                                    <icon-plus
                                        theme="outline"
                                        size="24"
                                        fill="#bf01fa"
                                        :strokeWidth="3"
                                        class="cursor-pointer"
                                        v-show="!networkExists(network.chainId)"
                                        @click="handleAdd(network)"
                                    />
                                    <!-- remove  -->
                                    <icon-delete
                                        theme="outline"
                                        size="20"
                                        fill="#e53e30"
                                        :strokeWidth="3"
                                        class="cursor-pointer"
                                        v-show="networkExists(network.chainId) && network.chainId != dChainId"
                                        @click="handleRemove(network)"
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </n-table>
                </n-scrollbar>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped></style>
