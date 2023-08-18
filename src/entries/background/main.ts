import { AccountPayload, ArbitrarySignaturePayload, SignatureResult, RequiredKeysPayload, LoginPayload, Message, Payload, SignaturePayload, Identity } from '@/common/lib/messages/message';
import * as MessageTypes from '@/common/lib/messages/types';
import { Auth, AuthStore, Wallet, WhiteItem } from '@/store/wallet/type';
import SdkError from '@/common/lib/sdkError';
import Windows from '@/common/lib/windows';
import { Network as ChainNetwork, RPC } from '@/store/chain/type';
import { signature } from '@/common/lib/keyring';
import { decrypt, md5 } from '@/common/util/crypto';
import { Api, JsonRpc } from 'eosjs';

console.log('run...');

let cachedInfo: any;

function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request: any, sender, sendResponse: Function) => {
        if (sender.id !== chrome.runtime.id) return true;
        if (typeof request == 'string') {
            request = JSON.parse(request);
        }
        const message = Message.fromJson(request);
        if (message.payload && !message.payload.domain) {
            message.payload.domain = 'localhost';
        }
        dispenseMessage(sendResponse, message);
        return true;
    });
}

async function dispenseMessage(sendResponse: Function, message: Message<any> ) {
    let response;
    try {
        switch (message.type) {
            case MessageTypes.GET_IDENTITY:
                response = await getIdentity(message.payload);
                break;
            case MessageTypes.GET_IDENTITY_FROM_PERMISSIONS:
                response = await getIdentityFromPermissions(message.payload);
                break;
            case MessageTypes.GET_ACCOUNT_SMOOTH_MODE:
                response = await getAccountSmoothMode(message.payload);
                break;
            case MessageTypes.FORGET_IDENTITY:
                response = await forgetIdentity(message.payload);
                break;
            case MessageTypes.REQUEST_CHAIN_INFO:
                response = await requestChainInfo(message.payload);
                break;
            case MessageTypes.REQUEST_AVAILABLE_KEYS:
                response = await requestAvailableKeys(message.payload);
                break;
            case MessageTypes.REQUEST_SIGNATURE:
                response = await requestSignature(message.payload);
                break;
            case MessageTypes.REQUEST_ARBITRARY_SIGNATURE:
                response = await requestArbitrarySignature(message.payload);
                break;
            case MessageTypes.REQUEST_ADD_NETWORK:
                response = await requestAddNetwork(message.payload);
                break;
            case MessageTypes.REQUEST_GET_VERSION:
                response = await requestGetVersion();
                break;
            case MessageTypes.REQUEST_VERSION_UPDATE:
                response = await requestVersionUpdate(message.payload);
                break;
            case MessageTypes.AUTHENTICATE:
                response = await authenticate(message.payload);
                break;
            case MessageTypes.REQUEST_HAS_ACCOUNT_FOR:
                response = await requestHasAccountFor(message.payload);
                break;
            case MessageTypes.REQUEST_RAW_ABI:
                response = await requestRawAbi(message.payload);
                break;
            case MessageTypes.REQUEST_REQUIRED_KEYS:
                response = await requestRequiredKeys(message.payload);
                break;
        }
    } catch (err: any) {
        response = err;
    }
    sendResponse(response);
}

async function getIdentity(payload: LoginPayload) : Promise<Identity> {

    // fill chainId
    if (!payload.chainId && payload.accounts && payload.accounts.length) {
        const network = payload.accounts[0];
        payload.chainId = network.chainId;
    }
    if (!payload.newLogin) {
        const accounts = await getAuthorizations(payload.domain, payload.chainId);
        if (accounts && accounts.length) {
            return generateIdengity(accounts);
        }
    }
    try {
        const result = await Windows.createWindow('login', 450, 600, payload);
        //save...
        const authorizations = (await localCache.get('authorizations', [])) as AuthStore[];
        const account = Object.assign({}, result.data);
        account.expire = Date.now() + 86400 * 7 * 1000;
        let auth = authorizations.find((x) => x.domain == payload.domain) as AuthStore;
        if (!auth) {
            auth = { domain: payload.domain, accounts: [], actor: '', permission: '' };
            authorizations.push(auth);
        }
        const index = auth.accounts.findIndex(
            (x) => x.chainId == account.chainId && x.name == account.name && x.authority == account.authority
        );
        if (index >= 0) {
            auth.accounts.splice(index, 1);
        }
        auth.accounts.unshift(account);
        chrome.storage.local.set({ authorizations });
        const accounts = await getAuthorizations(payload.domain, payload.chainId);
        return generateIdengity(accounts);
    } catch (e) {
        console.log(e);
        throw SdkError.signatureError('identity_rejected', 'User rejected the provision of an Identity');
    }
}



async function getAuthorizations(domain: string, chainId = '*') {
    const wallets = (await localCache.get('wallets', [])) as Wallet[];
    const authorizations = (await localCache.get('authorizations', [])) as AuthStore[];
    for (let auth of authorizations) {
        if (auth.domain == domain) {
            let now = Date.now();

            let filterAccounts = auth.accounts.filter((x) => {
                if (x.expire && x.expire < now) return false;

                return (
                    wallets.findIndex(
                        (y) =>
                            x.chainId == y.chainId &&
                            x.name == y.name &&
                            y.keys.findIndex((z) => {
                                return z.permissions.findIndex((item) => {
                                    return item === x.authority;
                                });
                            }) >= 0
                    ) >= 0
                );
            });
            if (auth.accounts.length != filterAccounts.length) {
                auth.accounts = filterAccounts;
                chrome.storage.local.set({ authorizations });
            }

            const chainAccounts =
                chainId == '*' ? filterAccounts : filterAccounts.filter((x) => x.chainId == chainId);
            const returnAccounts = [];
            for (const chainAccount of chainAccounts) {
                const { expire, ...account } = Object.assign({ blockchain: 'eos' }, chainAccount);
                returnAccounts.push(account);
            }
            return returnAccounts;
        }
    }
    return [];
}

function generateIdengity(accounts: any[]) : Identity {
    return {
        accounts: accounts.map((x) => {
            const id = {
                blockchain: 'eos',
                name: x.name,
                publicKey: x.publicKey,
                authority: x.authority,
                chainId: x.chainId,
                isHardware: false,
            };
            return id;
        }),
        kyc: false,
        name: 'default',
        publicKey: 'EOS8KAnYVnhZQ4HG8W9N8iTDpy6NDG3Y2ob48BGQbre8J1HBWt51c',
        hash: 'a7d14118a71c163f2bd0c7e6bc52ced2',
    };
}

async function getIdentityFromPermissions(payload: Payload) {
    const accounts = await getAuthorizations(payload.domain, '*');
    if (!accounts || !accounts.length) return null;
    return generateIdengity(accounts);
}

async function getAccountSmoothMode(payload: AccountPayload) {
    const wallets = (await localCache.get('wallets', [])) as Wallet[];
    const wallet = wallets.find((x) => x.name === payload.account && x.chainId === payload.chainId);
    if (wallet) return wallet.smoothMode;

    return false;
}

async function forgetIdentity(payload: AccountPayload) {
    //可以指定域名，指定链，指定账号
    const authorizations = (await localCache.get('authorizations', [])) as AuthStore[];
    let authorization = authorizations.find((x) => x.domain == payload.domain);
    if (!authorization) return generateIdengity([]);

    let deletes = authorization.accounts;
    if (payload.chainId) deletes = deletes.filter((x) => x.chainId == payload.chainId);
    if (payload.account) deletes = deletes.filter((x) => x.name == payload.account);

    if (deletes.length < authorization.accounts.length) {
        deletes.map((x) => {
            const idx = authorization?.accounts.indexOf(x) || 0;
            authorization?.accounts.splice(idx, 1);
        });
        chrome.storage.local.set({ authorizations });
    } else if (deletes.length == authorization.accounts.length) {
        const idx = authorizations.indexOf(authorization);
        authorizations.splice(idx, 1);
        chrome.storage.local.set({ authorizations });
    }
    return generateIdengity(authorization.accounts);
}

async function requestChainInfo(payload: Payload) {
    if (cachedInfo && cachedInfo[payload.chainId]) {
        return cachedInfo[payload.chainId];
    }
    return await cacheChainInfo(payload.chainId);
}

async function cacheChainInfo(chainId: string) {
    // todo: cachedInfo use localStoreage or sessionStoreage
    if (!cachedInfo) cachedInfo = {};

    const info = await getEosInfo(chainId);
    const _cachedInfo = {
        info,
        time: new Date(info.head_block_time + 'Z').getTime(),
    };
    cachedInfo[chainId] = _cachedInfo;
    return cachedInfo;
}



async function getEndPoint(chainId: string) {
    const selectedRpc = (await localCache.get('selectedRpc', {})) as RPC;
    let endpoint = selectedRpc[chainId];

    if (!endpoint) {
        const networks = (await localCache.get('networks', [])) as ChainNetwork[];
        const network = networks.find((x) => x.chainId == chainId);
        endpoint = network ? network.endpoint : '';
    }
    return endpoint;
}

async function requestAvailableKeys(payload: Payload) {
    // scatter好像直接返回了没有登录的账号，头疼。todo:针对同key也自动登录吗？
    if (!payload.chainId) {
        throw SdkError.noNetwork();
    }

    const authorizations = await getAuthorizations(payload.domain, payload.chainId);
    return Array.from(new Set(authorizations.map((x) => x.publicKey)));
}

async function requestSignature(payload: SignaturePayload | ArbitrarySignaturePayload) : Promise<SignatureResult> {
    if (!payload.chainId) {
        throw SdkError.noNetwork();
    }

    const newPayload = {
        chainId: payload.chainId,
        domain: payload.domain,
        actions: [] as any[],
        authorization: {} as Auth,
        encryptText: '',
        buffer: Buffer.from([]),
    };
    let account: any; // old
    const authAccounts: string[] = []; // new
    const authorizations = await getAuthorizations(payload.domain, payload.chainId);
    if ('serializedTransaction' in payload) {
        // payload.transaction
        const result = await parseEosjsRequest(payload);
        newPayload.actions = result.actions;
        newPayload.buffer = result.buffer;

        // -- old start --
        const authIdx = newPayload.actions[0].authorization.length - 1;
        newPayload.authorization = newPayload.actions[0].authorization[authIdx]; //todo: 是否正确 ???
        account = authorizations.find(
            (x) => x.name == newPayload.authorization.actor && x.authority == newPayload.authorization.permission
        );
        // -- new start ---
        const allAuths = newPayload.actions
            .flatMap((a) => a.authorization)
            .map((auth) => auth.actor + '@' + auth.permission);
        const requestAuths = Array.from(new Set(allAuths));
        for (const requestAuth of requestAuths) {
            const [actor, perm] = requestAuth.split('@');
            const account = authorizations.find((x) => x.name == actor && x.authority == perm);
            if (account) {
                authAccounts.push(account.account + '@' + account.authority);
            }
        }
        // 说明： 正常来讲，有一个验证过就可以了。如果有多个，也要一起签名掉
        // requestAuths.map();
        // -- new end --
    } else if ('data' in payload) {
        const tooLongWord = payload.data.split(/\s+/).findIndex((x) => x.length > 12);
        if (tooLongWord >= 0) {
            throw SdkError.signatureError(
                'signature_rejected',
                'Each word cannot exceed 12 characters in length.'
            );
        }
        if (payload.data.length >= 1024) {
            throw SdkError.signatureError('signature_rejected', 'String length cannot greater than 1024.');
        }
        account = authorizations.find((x) => x.publicKey == payload.publicKey);
        if (account) {
            newPayload.authorization = {
                actor: account.name,
                permission: account.authority,
            };
            // new
            authAccounts.push(account.actor + '@' + account.permission);
        }
        newPayload.encryptText = payload.data;
    } else {
        throw SdkError.signatureError('signature_rejected', 'unknow your operation');
    }

    if (!account) {
        throw SdkError.signatureError('signature_rejected', 'you have no permission for this operation');
    }

    // check whitelist
    if (newPayload.actions.length > 0) {
        //只检查单个的action
        const whitelist = (await localCache.get('whitelist', [])) as WhiteItem[];
        let allMatch = true;
        for (const action of newPayload.actions) {
            const hash = md5(
                [payload.domain, payload.chainId, account.name, account.authority, action.code, action.type].join(
                    '-'
                )
            );
            const wli = whitelist.find((x) => x.hash == hash);
            if (wli) {
                for (const key in action.data) {
                    const value = action.data[key];
                    if (wli.properties[key] !== '*' && wli.properties[key] !== value) {
                        allMatch = false;
                        break;
                    }
                }
                if (!allMatch) break;
            } else allMatch = false;
        }
        if (allMatch) {
            const locked = (await getPassword()) == '';
            if (locked) {
                //to unlock
                const result = (await new Promise((resolve) => {
                    Windows.createWindow('unlock', 500, 450, newPayload, async (result: any) => {
                        if (result.code < 0) {
                            resolve({ unlock: false });
                            return;
                        }
                        resolve({ unlock: true });
                    });
                })) as any;
                if (!result.unlock) {
                    throw SdkError.signatureError('signature_rejected', 'User rejected the signature request');
                }
            }
            // todo, through permission
            const privateKey = await getPrivateKey(payload.chainId, account.publicKey);
            const sig = signature(newPayload.buffer, privateKey);
            return { signatures: [ sig ] };
        } else {
            window.msg.error('not match');
        }
    }
    return new Promise((resolve, reject) => {
        let windowHeight = 400;
        if (newPayload.actions.length > 0) windowHeight = 518;
        if (newPayload.actions.length > 1) windowHeight = 542;

        Windows.createWindow(
            'transcation',
            600,
            windowHeight,
            newPayload,
            async (result: { code: number; data: any }) => {
                if (result.code < 0) {
                    reject(SdkError.signatureError('signature_rejected', 'User rejected the signature request'));
                    return;
                }
                //save whitelist...
                if (result.data.whitelists.length > 0) {
                    const whitelist = (await localCache.get('whitelist', [])) as WhiteItem[];
                    for (const whitelistRow of result.data.whitelists) {
                        let index = whitelist.findIndex((x) => x.hash === whitelistRow.hash);
                        if (index == -1) {
                            whitelist.push(whitelistRow);
                        } else {
                            whitelist.splice(index, 1, whitelistRow);
                        }
                    }
                    chrome.storage.local.set({ whitelist: JSON.stringify(whitelist) });
                }

                const privateKey = await getPrivateKey(payload.chainId, account.publicKey);
                let arbitrary = newPayload.actions.length > 0;
                if (newPayload.actions.length == 0) {
                    arbitrary = true;
                } 
                const sig = signature(arbitrary ? newPayload.encryptText : newPayload.buffer, privateKey, arbitrary);
                resolve({ signatures: [ sig ] });
            }
        );
    });
}

async function getPrivateKey(chainId: string, publicKey: string) {
    const wallets = (await localCache.get('wallets', [])) as Wallet[];
    let privateKey = '';
    let seed = '';
    for (const wallet of wallets) {
        if (wallet.chainId == chainId) {
            const key = wallet.keys.find((x) => x.publicKey == publicKey);
            if (key) {
                privateKey = key.privateKey;
                seed = wallet.seed;
                break;
            }
        }
    }
    if (!privateKey) {
        return '';
    }
    const password = await getPassword();
    return decrypt(privateKey, md5(seed + password));
}

async function requestArbitrarySignature(payload: ArbitrarySignaturePayload) {
    const authorizations = await getAuthorizations(payload.domain, '*');
    for (const authorization of authorizations) {
        if (authorization.publicKey == payload.publicKey) {
            payload.chainId = authorization.chainId;
            break;
        }
    }
    return await requestSignature(payload);
}

async function requestAddNetwork(payload: Payload) {}

async function requestGetVersion() {
    let manifestData = chrome.runtime.getManifest();
    let clientVersion = manifestData.version;
    return 'Metahub ' + clientVersion;
}

async function requestVersionUpdate(payload: Payload) {

}

async function authenticate(payload: Payload) {
    
}

async function requestHasAccountFor(payload: LoginPayload) {
    const wallets = (await localCache.get('wallets', [])) as Wallet[];
    const idx = wallets.findIndex((x) => payload.chainId == x.chainId);
    return idx >= 0;
}

async function requestRawAbi(payload: AccountPayload) {
    return await getEosRawAbi(payload.chainId, payload.account);
}

async function requestRequiredKeys(payload: RequiredKeysPayload) {
    if (payload.availableKeys.length == 1) {
        return payload.availableKeys;
    }
    // todo: this is wrong method, to find required keys
    return [ payload.availableKeys[0] ];
}

// Interval
async function cacheChainInfoInterval() {
    console.log('cacheChainInfoInterval');
    const wallets = (await localCache.get('wallets', [])) as Wallet[];
    const selectedIndex = (await localCache.get('selectedIndex', -1)) as number;
    if (wallets.length > 0 && selectedIndex >= 0) {
        const currentWallet = wallets[selectedIndex];
        const currentChainId = currentWallet.chainId;
        cacheChainInfo(currentChainId);
    }
}

async function parseEosjsRequest(payload: SignaturePayload) {

    const trxBuf = Buffer.from(Uint8Array.from(payload.serializedTransaction).toString(), 'hex');
    const parsed = await deserializeTransactionWithActions(trxBuf);
    const actions = parsed.actions.map((account: string, name: string, ...x: any[]) => ({
        ...x,
        code: account,
        type: name,
    }));

    const buffer = Buffer.concat([
        Buffer.from(payload.chainId, 'hex'), // Chain ID
        trxBuf, // Transaction
        Buffer.from(new Uint8Array(32)), // Context free actions
    ]);
    return { actions, buffer };
}

async function deserializeTransactionWithActions(buffer: Buffer): Promise<any> {
    // create empty api
    const api = new Api({ rpc: new JsonRpc(''), signatureProvider: {
        getAvailableKeys: async () => [],
        sign: async (args : any) => ({ signatures: [], serializedTransaction: args.serializedTransaction }),
    } });
    return api.deserializeTransactionWithActions(buffer);
}

async function getEosInfo(chainId: string) {
    const baseUrl = await getEndPoint(chainId);
    const response = await fetch(baseUrl + '/v1/chain/get_info');
    return response.json();
}

async function getEosRawAbi(chainId: string, account_name: string) {
    const baseUrl = await getEndPoint(chainId);
    const response = await fetch(baseUrl + '/v1/chain/get_raw_abi', {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account_name }),
    });
    const result = response.json() as any;
    return result.abi;
}

async function getPassword() {
    const result: any = (await chrome.storage.session.get(['password'])) ?? {};
    return result.password as string || '';
}

// Initialize the demo on install
chrome.runtime.onInstalled.addListener(({ reason }) => {
    setupMessageListener();

    // timer
    chrome.alarms.create({ delayInMinutes: 0, periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener(() => {
        cacheChainInfoInterval();
    });
});

// // 监听退出了浏览器,下次需要输入密码
// chrome.windows.onRemoved.addListener((windowId) => {
//     chrome.windows.getAll((windows) => {
//         if (windows.length == 0) {
//              lock
//         }
//     });
// });
