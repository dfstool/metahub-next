<script setup lang="ts">
import EOSIcon from '@/assets/images/eos_icon.png';
import DFSIcon from '@/assets/images/dfs_icon.png';
import CoinGet from '@/assets/images/coin_get@2x.png';
import CoinOut from '@/assets/images/coin_out@2x.png';
import chain from '@/common/lib/chain';
import { getTransactionList } from '@/common/lib/remote';
import { Coin } from '@/types/tokens';

const { timeFormat } = tool;

const walletStore = useWalletStore();

const [contract, symbol] = (useRoute().params.token as any).split('-');
const token = ref(walletStore.currentUserTokens.find(
    (x: Coin) => x.contract == contract && x.symbol == symbol
)!);

// 初始化
onMounted(() => {
    getBalance();
    setTimeout(() => {
        getTraceList();
    }, 200);
});

// 获取余额
const getBalance = async () => {
    const balance = await chain
        .getApi()
        .getCurrencyBalance(token.value.contract, walletStore.currentWallet.name, token.value.symbol);
    if (balance) {
        token.value.amount = Number(balance.split(' ')[0]);
    }
};

// 获取远程数据
const traceList = ref([] as any);
const loading = ref(true);
const getTraceList = async () => {
    const chain = useChainStore().currentChain;
    const params = {
        account: walletStore.currentWallet.name,
        filter: `${token.value.contract}:*`,
        sort: 'desc',
    };
    traceList.value = await getTransactionList(chain, params);
    loading.value = false;
};

// 跳转至转账页面
const router = useRouter();
const viewTransfer = () => {
    router.push({
        name: 'transfer',
        query: {
            symbol: token.value.symbol,
            contract: token.value.contract,
        },
    });
};

// 跳转至事务详情页
const viewTransation = (item: any) => {
    router.push({
        name: 'transation',
        query: {
            token: JSON.stringify(token.value),
            trx: JSON.stringify(item),
        },
    });
};
</script>

<template>
    <div class="full-router">
        <div class="full-inner">
            <page-header :title="$t('wallet.detail')"></page-header>

            <div class="cover-content _effect pb-[80px]">
                <n-scrollbar>
                    <!-- header -->
                    <div class="header">
                        <div class="coin-icon">
                            <div class="icon-left">
                                <img
                                    :src="token.logo ? token.logo : DFSIcon"
                                    class="icon-img"
                                    @error.once="($event.target as HTMLImageElement).src = DFSIcon"
                                />

                                <div class="icon-name">{{ token.symbol }}</div>
                            </div>
                            <div class="icon-right">
                                <n-button type="primary" @click="viewTransfer" class="transfer-btn">
                                    {{ $t('wallet.transfer') }}
                                </n-button>
                            </div>
                        </div>
                    </div>

                    <!-- balance-box -->
                    <div class="balance-box">
                        <span>{{ $t('wallet.balance') }}</span>
                        <span>{{ token.amount }} {{ token.symbol }}</span>
                    </div>

                    <!-- main -->
                    <div class="main-content">
                        <div class="content-title">
                            <h2>{{ $t('wallet.tradeHistory') }}</h2>
                        </div>
                        <div class="content-list">
                            <div
                                @click="viewTransation(item)"
                                class="content-item"
                                v-for="(item, index) of traceList"
                                :key="index"
                                v-if="traceList.length"
                            >
                                <div class="content-info-big">
                                    <div class="content-info-left">
                                        <img
                                            :src="
                                                item.receiver == walletStore.currentWallet.name
                                                    ? CoinGet
                                                    : CoinOut
                                            "
                                        />
                                        <div>
                                            <div class="content-info-up">
                                                {{
                                                    item.receiver != walletStore.currentWallet.name
                                                        ? item.receiver
                                                        : item.sender
                                                }}
                                            </div>
                                            <div class="content-info-bottom">
                                                {{ timeFormat(item.time) }}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        :class="
                                            item.receiver == walletStore.currentWallet.name
                                                ? 'content-info-right-blue'
                                                : 'content-info-right-red'
                                        "
                                    >
                                        {{
                                            item.receiver == walletStore.currentWallet.name
                                                ? '+' + item.quantity
                                                : '-' + item.quantity
                                        }}
                                    </div>
                                </div>
                                <div class="separate-line"></div>
                            </div>

                            <div v-else-if="loading">
                                <div class="flex flex-row px-4 py-3 justify-between items-center" v-for="i in [0, 1]">
                                    <div class="flex flex-row items-center">
                                        <n-skeleton height="24px" circle />
                                        <div class="flex flex-col ml-2">
                                            <n-skeleton text  class="w-[80px]" />
                                            <n-skeleton text  class="w-[120px] mt-2" />
                                        </div>
                                    </div>
                                    <n-skeleton text class="w-[40px]" />
                                </div>
                            </div>
                            <div class="footer" v-else>{{ $t('public.noData') }}</div>
                        </div>
                    </div>
                </n-scrollbar>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.cover-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #fff;
    .header {
        display: flex;
        background: rgba(252, 252, 252, 0.4);
        margin: 18px 18px;
        border: 1px solid #dbdbdb;
        box-shadow: 0px 1px 3px 0px rgba(255, 66, 216, 0.11);
        border-radius: 12px;
        justify-content: space-between;
        .coin-icon {
            padding: 21px 17px;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            .icon-img {
                width: 30px;
                height: 30px;
                border-radius: 50%;
            }
            .icon-name {
                font-weight: 500;
                font-size: 18px;
                color: #333333;
                margin-left: 10px;
            }

            .icon-left {
                display: flex;
                flex-direction: row;
                justify-content: left;
                align-items: center;
            }

            .icon-right {
                font-family: PingFangSC;
                font-size: 12px;
                font-weight: 400;
                color: #999999;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: flex-end;
                .transfer-btn {
                    padding: 8px 24px;
                    border-radius: 16px;
                    font-size: 12px;
                    font-family: PingFangSC-Medium, PingFang SC;
                    font-weight: 500;
                    color: #ffffff;
                }
            }
        }
        .coin-info {
            margin: 0;
            padding: 8px 15px;
            font-weight: 400;
            font-size: 14px;
            color: #999999;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            .value {
                color: #666666;
            }
            &.clickable {
                cursor: pointer;
            }
            &.clickable:hover {
                background-color: #e1f3eb;
            }
        }
        .separate-line {
            margin: 0 0 0 15px;
            background-color: $color-separate;
            height: 1px;
        }
    }
    .balance-box {
        display: flex;
        margin: 12px 18px 25px 18px;
        justify-content: space-between;
        align-items: center;
        color: #222;
        font-size: 12px;
    }
    .main-container {
        flex-grow: 1;
        overflow: hidden;
    }
    .main-content {
        display: flex;
        flex-direction: column;
        padding: 0;

        .content-title {
            padding: 0 18px;
            border-bottom: 1px solid $color-separate;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 16px;
            font-weight: 600;
            color: #222;
            h2 {
                margin: 0 0 5px 0;
                padding: 0;
            }
            .btns {
                padding: 5px 0;
                display: flex;
                flex-direction: row;
                .btn {
                    display: block;
                    margin: 0 0 0 10px;
                }
            }
        }
        .footer {
            color: #7f7f7f;
            text-align: center;
            margin-top: 10px;
        }

        .content-list {
            flex-grow: 1;
            overflow-x: hidden;
            overflow-y: auto;
            min-height: 200px;
            .content-item {
                cursor: pointer;
                background-color: #fff;
                .content-info-big {
                    padding-left: 17px;
                    height: 66px;
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                    align-items: center;
                }
                .content-info-left {
                    display: flex;
                    flex-direction: row;
                    justify-content: flex-start;
                    align-items: center;
                    img {
                        width: 20px;
                        height: 20px;
                    }
                }
                .content-info-text {
                    height: 40px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .content-info-up {
                    padding-left: 11px;
                    font-size: 15px;
                    color: #222;
                    font-weight: bold;
                    letter-spacing: 0;
                }
                .content-info-bottom {
                    font-weight: 400;
                    padding-left: 11px;
                    font-size: 12px;
                    color: #888;
                    letter-spacing: 0;
                }

                .content-info-right-red {
                    font-weight: 500;
                    padding-right: 15px;
                    font-size: 14px;
                    letter-spacing: 0;
                    text-align: right;
                    color: #4276ff;
                }
                .content-info-right-blue {
                    font-weight: 500;
                    padding-right: 15px;
                    font-size: 14px;
                    letter-spacing: 0;
                    text-align: right;
                    color: #00b494;
                }
                .separate-line {
                    margin: 0 0 0 50px;
                    background-color: $color-separate;
                    height: 1px;
                }
            }
        }
    }
}
</style>
