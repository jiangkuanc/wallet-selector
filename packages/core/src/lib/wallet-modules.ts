import { Options } from "./options.types";
import { Store } from "./store.types";
import { logger, storage, Provider, EventEmitter } from "./services";
import { WalletSelectorEvents } from "./wallet-selector.types";
import {
  Wallet,
  WalletMetadata,
  WalletModule,
  WalletModuleFactory,
} from "./wallet/wallet.types";
import { omit } from "./utils";
import { WalletEvents } from "./wallet";

interface WalletModulesParams {
  factories: Array<WalletModuleFactory>;
  options: Options;
  store: Store;
  emitter: EventEmitter<WalletSelectorEvents>;
}

export const setupWalletModules = async ({
  factories,
  options,
  store,
  emitter,
}: WalletModulesParams) => {
  const modules: Array<WalletModule> = [];
  const instances: Record<string, Wallet> = {};

  for (let i = 0; i < factories.length; i += 1) {
    const module = await factories[i]();

    // Filter out wallets that aren't available.
    if (!module) {
      continue;
    }

    modules.push(module);
  }

  const getWallet = async (id: string) => {
    let instance = instances[id];

    if (instance) {
      return instances[id];
    }

    const module = modules.find((x) => x.id === id);

    if (!module) {
      return null;
    }

    const metadata = omit(module, ["init"]) as WalletMetadata;
    const walletEmitter = new EventEmitter<WalletEvents>();
    const provider = new Provider(options.network.nodeUrl);

    instance = {
      ...metadata,
      ...(await module.init({
        options,
        metadata: metadata as never,
        provider,
        emitter: walletEmitter,
        logger,
        storage,
      })),
    } as Wallet;

    instances[id] = instance;

    return instance;
  };

  store.dispatch({
    type: "SETUP_WALLET_MODULES",
    payload: {
      modules: modules.map((module) => {
        return omit(module, ["init"]) as WalletMetadata;
      }),
      accounts: [],
      selectedWalletId: null,
    },
  });
};
