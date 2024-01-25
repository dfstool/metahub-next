import { eosChainId, dfsChainId } from '@/common/util/network';
import { ChainState } from './type';
import { supportNetworks } from '@/common/util/network';
import { Network, RPC } from '@/types/settings';
import { Wallet } from '@/types/wallet';

export const useChainStore = defineStore('chain', {
    state: (): ChainState => {
        return {
            networks: [],
            currentNetwork: {} as Network,
            selectedRpcs: {},
            customRpcs: {},
        }
    },

    getters: {
        currentChain: (state) : string => {
            return state.currentNetwork.chain || 'dfs';
        },
        currentChainId: (state) : string => {
            return state.currentNetwork.chainId || dfsChainId;
        },
        findNetwork: (state) => (chainId: string) : Network => {
            const network = state.networks.find((x) => x.chainId == chainId);
            return network ?? state.networks[0];
        },
        selectedRpc: (state) => (chainId: string) : string => {
            let _selectedRpc = state.selectedRpcs[chainId];
            if (!_selectedRpc) {
                const network = state.networks.find((x) => x.chainId == chainId);
                return network ? network.endpoint : '';
            }
            return _selectedRpc;
        },
        currentSymbol: (state) => {
            const network = state.networks.find((x: Network) => x.chainId == state.currentNetwork.chainId);
            return network ? network.token.symbol : 'DFS';
        },
    },
    actions: {
        async init() {
            console.log('store chain init');
            const wallets = (await localCache.get('wallets', [])) as Wallet[];
            const selectedIndex = (await localCache.get('selectedIndex', 0)) as number;
            this.networks = (await localCache.get('networks', supportNetworks.slice(0, 1))) as Network[];
            if (wallets.length) {
                this.setCurrentNetworkByChainId(wallets[selectedIndex].chainId);
            } else {
                this.currentNetwork = this.networks[0];
            }
            this.selectedRpcs = (await localCache.get('selectedRpcs', {}));
            this.customRpcs = (await localCache.get('customRpcs', {}));
        },
        async setNetworks(networks: Network[]) {
            this.networks = networks;
            await localCache.set('networks', networks);
        },
        async setCurrentNetworkByChainId(chainId: string) {
            const network = this.networks.find(x => x.chainId == chainId);
            if (network) {
                this.currentNetwork = network;
            }
        },
        async setSelectedRpc(chainId: string, endpoint: string) {
            this.selectedRpcs[chainId] = endpoint;
            await localCache.set('selectedRpcs', this.selectedRpcs);
        },
        async setSelectedRpcs(endpoints: string[]) {
            await localCache.set('selectedRpcs', endpoints);
        },
        async setCustomRpcs(rpcs: Record<string, RPC[]>) {
            this.customRpcs = rpcs;
            await localCache.set('customRpcs', rpcs);
        },
    },
});

  
