import { Api, JsonRpc } from 'eosjs';
import { ErrorCode } from '../util/type';
import { Transaction } from 'eosjs/dist/eosjs-api-interfaces';
import { Permission, PermissionLevel } from 'eosjs/dist/eosjs-rpc-interfaces';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';  
import { Auth } from '@/types/account';
import { getContractAbi } from '../util/abi';
import { Chain } from './chain';

export default class EOSApi {
    public rpc;
    public api;
    public freeApi;
    constructor(public chainId: string, public endpoint: string, private chain: Chain) {
        this.rpc = new JsonRpc(this.endpoint);
        this.api = this.initAPI();
        this.freeApi = new Api({ 
            rpc: this.rpc, 
            signatureProvider: new JsSignatureProvider(['5JdBkvZva99uwBanXjGGhF4T7SrLpgTBipU76CD9QN4dFRPuD4N']),
            chainId
        });
    }



    // 查询账户的EOS余额
    async getCurrencyBalance(contract: string, account: string, symbol: string) {
        try {
            let res = await this.rpc.get_currency_balance(contract, account, symbol);
            return res[0];
        } catch (e) {
            return '';
        }
    }

    // 获取REX信息
    async getREXInfo(account = '') {
        try {
            let res = await this.rpc.get_table_rows({
                json: true,
                code: 'eosio',
                scope: 'eosio',
                table: 'rexbal',
                lower_bound: account,
                limit: '1',
            });
            return res;
        } catch (e) {
            return null;
        }
    }

    // 获取EOS价格
    async getEosPrice() {
        try {
            let res = await this.rpc.get_table_rows({
                json: true,
                code: 'swap.defi',
                scope: 'swap.defi',
                table: 'pairs',
                lower_bound: 12,
                upper_bound: 12,
                limit: '1',
            });
            return parseFloat(res.rows[0].price0_last);
        } catch (e) {
            return 0;
        }
    }

    // 获取Markets
    async getMarkets() {
        try {
            let res = await this.rpc.get_table_rows({
                json: true,
                code: 'swapswapswap',
                scope: 'swapswapswap',
                table: 'markets',
                limit: 1000
            });
            return res.rows;
        } catch (e) {
            return [];
        }
    }

    // 通过公钥查询账号
    async getKeyAccounts(publicKey: string) {
        try {
            let result = await this.rpc.get_accounts_by_authorizers([], [publicKey]);
            let accounts = [];
            for (const account of result.accounts) {
                accounts.push(account.account_name);
            }
            let filterAccounts = [...new Set(accounts)];
            return filterAccounts;
        } catch (e) {
            console.log(e);
            return [];
        }
    }

    // 测试节点
    async testHttpEndpoint(endpoint = '') {
        let rpc = new JsonRpc(endpoint);
        return await rpc.get_info();
    }

    // 更新节点
    updateHttpEndpoint(endpoint: string) {
        this.endpoint = endpoint;
        this.rpc.endpoint = endpoint;
    }

    // 查询账户的币种信息
    async getCurrencyStats(contract: string, symbol: string) {
        try {
            let res = await this.rpc.get_currency_stats(contract, symbol);
            return res[symbol];
        } catch (e) {
            return null;
        }
    }

    /**
     * 根据实际需求更新 sourcePerms
     * @param {string} sourcePerms 账户权限说明
     * @param {string} operateType 操作方式: add/modify/remove
     * @param {string} operatePerm 操作类型: owner/active
     * @param {string} oldOperateKey 针对操作的 pubkey
     * @param {string} newOperateKey 需要新增的 pubkey
     *
     */
    makeNewPermissions(
        perms: Permission[],
        operateType: string,
        operatePerm: string,
        oldOperateKey: string,
        newOperateKey?: string
    ) {
        for (const perm of perms) {
            if (perm.perm_name == operatePerm) {
                const keys = perm.required_auth.keys.concat();
                switch (operateType) {
                    case 'add':
                        let item = {
                            key: newOperateKey!,
                            weight: 1,
                        };
                        keys.push(item);
                        break;
                    case 'modify':
                        const idx = keys.findIndex(x => x.key == oldOperateKey);
                        keys[idx].key = newOperateKey!;
                        break;
                    case 'remove':
                        const idx1 = keys.findIndex(x => x.key == oldOperateKey);
                        keys.splice(idx1, 1);
                        break;
                    default:
                        break;
                }
                if (keys.length) {
                    keys.sort((a, b) => a.key.localeCompare(b.key));
                }
                perm.required_auth.keys = keys;
            }
        }
        return perms;
    }

    // 权限更新操作
    async updatePerms(accountName: string, perms: Permission[]) {
        const actions = [];

        for (const perm of perms) {
            actions.push({
                account: 'eosio',
                name: 'updateauth',
                authorization: [ this.chain.getMaxPermission(accountName, this.chainId) ],
                data: {
                    account: accountName,
                    permission: perm.perm_name,
                    parent: perm.parent,
                    auth: perm.required_auth,
                },
            });
        }
        console.log(JSON.stringify(actions[0].data));
        // 变更权限无法免CPU
        const result = await this.transact(
            { actions },
            {
                blocksBehind: 3,
                expireSeconds: 30,
            },
            true
        );

        return result;
    }

    async deletePerm(accountName: string, perm: PermissionLevel) {
       const actions = [{
            account: 'eosio',
            name: 'deleteauth',
            authorization: [ this.chain.getMaxPermission(accountName, this.chainId) ],
            data: perm,
        }];

        // 变更权限无法免CPU
        const result = await this.transact(
            { actions },
            {
                blocksBehind: 3,
                expireSeconds: 30,
            },
            true
        );

        return result;

    }

    // EOS RAM价格
    async getRamMarket() {
        try {
            let res = await this.rpc.get_table_rows({
                json: true,
                code: 'eosio',
                scope: 'eosio',
                table: 'rammarket',
            });
            return res;
        } catch (e) {
            return null;
        }
    }

    // EOS 为他人抵押列表
    async getDelegatebwList(from: string) {
        try {
            let res = await this.rpc.get_table_rows({
                json: true,
                code: 'eosio',
                scope: from,
                table: 'delband',
            });
            return res.rows;
        } catch (e) {
            return [];
        }
    }

    // 获取powerup状态
    async getPowupState() {
        try {
            let res = await this.rpc.get_table_rows({
                code: 'eosio',
                scope: '',
                table: 'powup.state',
                json: true,
                limit: 1,
            });
            return res && res.rows && res.rows.length ? res.rows[0] : null;
        } catch (e) {
            return null;
        }
    }

    // 抵押CPU和NET
    async delegatebw(
        from: string,
        receiver: string,
        stake_net_quantity = '0.0000 EOS',
        stake_cpu_quantity = '0.0000 EOS',
        transfer = false,
        auth: Auth
    ) {
        return await this.transact(
            {
                actions: [
                    {
                        account: 'eosio',
                        name: 'delegatebw',
                        authorization: [auth],
                        data: {
                            from,
                            receiver,
                            stake_net_quantity,
                            stake_cpu_quantity,
                            transfer: transfer ? 1 : 0,
                        },
                    },
                ],
            },
            {
                blocksBehind: 3,
                expireSeconds: 30,
            }
        );
    }

    // 赎回CPU和NET
    async undelegatebw(
        from: string,
        receiver: string,
        unstake_net_quantity = '0.0000 EOS',
        unstake_cpu_quantity = '0.0000 EOS',
        auth: Auth
    ) {
        return await this.transact(
            {
                actions: [
                    {
                        account: 'eosio',
                        name: 'undelegatebw',
                        authorization: [auth],
                        data: {
                            from,
                            receiver,
                            unstake_net_quantity,
                            unstake_cpu_quantity,
                        },
                    },
                ],
            },
            {
                blocksBehind: 3,
                expireSeconds: 30,
            }
        );
    }

    // 立即取回赎回中的资源
    async refund(owner: string, auth: Auth) {
        return await this.transact(
            {
                actions: [
                    {
                        account: 'eosio',
                        name: 'refund',
                        authorization: [auth],
                        data: {
                            owner,
                        },
                    },
                ],
            },
            {
                blocksBehind: 3,
                expireSeconds: 30,
            }
        );
    }

    // 租用
    async powerup(parms: any, auth: Auth) {
        return await this.transact(
            {
                actions: [
                    {
                        account: 'eosio',
                        name: 'powerup',
                        data: parms,
                        authorization: [auth],
                    },
                ],
            },
            {
                blocksBehind: 3,
                expireSeconds: 30,
            },
            true
        );
    }

    // 购买RAM
    async buyRam(payer: string, receiver: string, quant: string, auth: Auth) {
        return await this.transact(
            {
                actions: [
                    {
                        account: 'eosio',
                        name: 'buyram',
                        authorization: [auth],
                        data: {
                            payer,
                            receiver,
                            quant,
                        },
                    },
                ],
            },
            {
                blocksBehind: 3,
                expireSeconds: 30,
            }
        );
    }

    // 出售RAM
    async sellRam(account: string, bytes: number, auth: Auth) {
        return await this.transact(
            {
                actions: [
                    {
                        account: 'eosio',
                        name: 'sellram',
                        authorization: [auth],
                        data: {
                            account,
                            bytes,
                        },
                    },
                ],
            },
            {
                blocksBehind: 3,
                expireSeconds: 30,
            }
        );
    }

    // 转账
    async transfer(contract: string, from: string, to: string, quantity: string, memo: string, auth: Auth) {
        return await this.transact(
            {
                actions: [
                    {
                        account: contract,
                        name: 'transfer',
                        authorization: [auth],
                        data: {
                            from,
                            to,
                            quantity,
                            memo,
                        },
                    },
                ],
            },
            {
                blocksBehind: 3,
                expireSeconds: 30,
            }
        );
    }

    // 办理
    async transact(transaction: Transaction, options: any = {}, ignoreCPUProxy: boolean = false) {
        const { currentChain } = useChainStore();
        let currentAccount = this.chain.currentAccount();
        let isProxy = currentAccount.smoothMode;
        // 是否为充值CPU
        if (transaction.actions[0].name == 'transfer' && transaction.actions[0].account == 'eosio.token') {
            if (transaction.actions[0].data.to == '1stbillpayer') {
                isProxy = true;
            }
        } else if ((typeof options.broadcast != 'undefined' && options.broadcast == false) || ignoreCPUProxy) {
            isProxy = false;
        }
        if (!isProxy) {
            // 以下测试固定数据用
            // transaction.expiration = '2023-08-04T11:00:00.000';
            // transaction.ref_block_num = 43492;
            // transaction.ref_block_prefix = 2225954522;
            options.requiredKeys = [currentAccount.keys[0].publicKey]
            const trx = await this.api.transact(transaction, options);
            return trx;
        }

        // 顺畅模式下执行免CPU操作
        options.broadcast = false;
        options.sign = true;

        if (currentChain === 'dfs') {
            const auth = transaction.actions[0].authorization[0];
            transaction.actions.unshift({
                account: 'dfsfreecpu11',
                name: 'freecpu',
                authorization: [
                  {
                    actor: 'dfs.service',
                    permission: 'cpu',
                  },
                  auth //必需要加，否则会提示missing freecpu auth
                ],
                data: {
                  user: currentAccount.name,
                },
              });

            // 必须要设置requiredKeys，否则会报错transaction declares authority '{"actor":"yfcmonitor11","permission":"active"}', but does not have signatures for it.
            options.requiredKeys = ["EOS5uVSPtx2CiVV3X3jzrVBhKMRXh4GwiBCKk2HuBYTroNuEgBJ9w"]; //dfs.service公钥
            let signedTrxFree = (await this.freeApi.transact(transaction, options)) as any;
            // console.log(signedTrxFree)
            const trxFree = this.freeApi.deserializeTransaction(signedTrxFree.serializedTransaction) as any;
            // console.log(trxFree)
            // 给trx新增signatures属性，好像加不加都不影响
            trxFree.signatures = signedTrxFree.signatures;

            options.requiredKeys = [currentAccount.keys[0].publicKey]
            let signedTrx = (await this.api.transact(trxFree, options)) as any;
            // console.log(signedTrx)
            // const trx = this.api.deserializeTransaction(signedTrx.serializedTransaction) as any;
            // console.log(trx)
            const signatures = [ ...signedTrxFree.signatures, ...signedTrx.signatures];
            return this.rpc.push_transaction({
                signatures,
                serializedTransaction: signedTrx.serializedTransaction,
                serializedContextFreeData: signedTrx.serializedContextFreeData,
            });
        } else {
            for (const action of transaction.actions) {
                action.authorization.unshift({
                    actor: '1stbillpayer',
                    permission: 'active',
                });
            }
            let signedTrx = (await this.api.transact(transaction, options)) as any;

            const trx = this.api.deserializeTransaction(signedTrx.serializedTransaction) as any;
            trx.signatures = signedTrx.signatures;
            
            let data = { signed: JSON.stringify(trx) };
            let res: any = await api.resource.pushTx(data);
            if (res && res.result) {
                const serverSignature = res.result.signature;
                const signatures = [serverSignature, ...signedTrx.signatures];
                return this.rpc.push_transaction({
                    signatures,
                    serializedTransaction: signedTrx.serializedTransaction,
                    serializedContextFreeData: signedTrx.serializedContextFreeData,
                });
            } else {
                let msg = 'unkonwn error';
                if (res && res.message) {
                    msg = res.message;
                }
                console.log('error', msg);
                throw new Error(msg);
            }
        }
    }

    protected initAPI() {
        const options: any = {
            rpc: this.rpc,
            abiProvider: {
                getRawAbi: async (accountName: string) => {
                    return await this.getRawAbi(accountName);
                },
            },
            chainId: this.chainId,
        };
        if (this.chain) {
            options.authorityProvider = this.chain.authorityProvider(this.chainId);
            options.signatureProvider = this.chain.signatureProvider(this.chainId);
        }

        return new Api(options as any);
    }

    async getRawAbi(accountName: string) {
        const abi = await getContractAbi(this.api, this.chainId, accountName);
        return { accountName, abi: abi.raw };
    }

    async getAccount(account = '') {
        if (account == '') throw { code: ErrorCode.NAME_EMPTY };

        try {
            let res = await this.rpc.get_account(account);
            return res;
        } catch (e) {
            return null;
        }
    }

    async getAbis(contracts: string[]) {
        const abis = {} as any;
        await Promise.all(
            contracts.map(async (contract) => {
                abis[contract] = (await this.getRawAbi(contract)).abi;
            })
        );
        return abis;
    }

}
