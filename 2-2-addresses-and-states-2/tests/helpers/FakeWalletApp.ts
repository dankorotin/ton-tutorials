import { Address, SendMode, toNano } from '@ton/core';
import { SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';

export class FakeWalletApp {
    private readonly wallet: SandboxContract<TreasuryContract>;
    private readonly testnet: boolean;

    constructor(wallet: SandboxContract<TreasuryContract>, testnet: boolean) {
        this.wallet = wallet;
        this.testnet = testnet;
    }

    async transferFunds(addressString: string, amount: number): Promise<{ result?: SendMessageResult; error?: string }> {
        let addressDetails: { isBounceable: boolean, isTestOnly: boolean, address: Address } | null = null;
        try {
            addressDetails = Address.parseFriendly(addressString);
        } catch (error) {
            return { error: 'Incorrect address!' };
        }

        const result = await this.wallet.send({
            to: addressDetails.address,
            value: toNano(amount),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            bounce: addressDetails.isBounceable,
        });

        return { result: result };
    }
}