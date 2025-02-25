import { Address, SendMode, toNano } from '@ton/core';
import { SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';

export class FakeWalletApp {
    private readonly walletContract: SandboxContract<TreasuryContract>;
    private readonly isTestnet: boolean;

    constructor(walletContract: SandboxContract<TreasuryContract>, isTestnet: boolean) {
        this.walletContract = walletContract;
        this.isTestnet = isTestnet;
    }

    async transferFunds(addressString: string, amount: bigint): Promise<
        | { result: SendMessageResult; error?: never }
        | { result?: never; error: string }
    > {
        let addressDetails: { isBounceable: boolean, isTestOnly: boolean, address: Address };
        try {
            addressDetails = Address.parseFriendly(addressString);
        } catch (error) {
            if (error instanceof Error) return { error: error.message };
            return { error: 'Unable to parse address' };
        }

        if (this.isTestnet !== addressDetails.isTestOnly) {
            return { error: `The wallet is testnet: ${ this.isTestnet }, the address is testnet-only: ${ addressDetails.isTestOnly }` };
        }

        if (!addressDetails.isBounceable && amount >= toNano(5)) {
            return { error: 'Sending more than 5 TON to a non-bounceable address is forbidden' };
        }

        const result = await this.walletContract.send({
            to: addressDetails.address,
            value: toNano(amount),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            bounce: addressDetails.isBounceable,
        });

        return { result: result };
    }
}