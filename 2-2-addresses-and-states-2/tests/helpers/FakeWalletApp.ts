import { Address, SendMode, toNano } from '@ton/core';
import { SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';

export class FakeWalletApp {
    private readonly walletContract: SandboxContract<TreasuryContract>;
    private readonly isTestnet: boolean;

    constructor(walletContract: SandboxContract<TreasuryContract>, isTestnet: boolean) {
        this.walletContract = walletContract;
        this.isTestnet = isTestnet;
    }

    async transferFunds(addressString: string, amount: bigint): Promise<{ result?: SendMessageResult, error?: string }> {
        try {
            let addressDetails = Address.parseFriendly(addressString);
        } catch (error) {
            if (error instanceof Error) return { error: error.message };
            return { error: 'Unable to parse address' };
        }

        return {};
    }
}