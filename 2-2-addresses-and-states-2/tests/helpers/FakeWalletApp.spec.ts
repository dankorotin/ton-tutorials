import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { Client } from '../../wrappers/Client';
import { FakeWalletApp } from './FakeWalletApp';

describe('FakeWalletApp', () => {
    let clientCode: Cell;

    beforeAll(async () => {
        clientCode = await compile('Client');
    });

    let blockchain: Blockchain;
    let fakeWalletContract: SandboxContract<TreasuryContract>;
    let clientContract: SandboxContract<Client>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        clientContract = blockchain.openContract(Client.createFromConfig({}, clientCode));
        fakeWalletContract = await blockchain.treasury('fake_wallet');

        const deployResult = await clientContract.sendDeploy(fakeWalletContract.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: fakeWalletContract.address,
            to: clientContract.address,
            deploy: true,
            success: true,
        });
    });

    it('should send funds', async () => {
        const address = clientContract.address;
        const addressString = address.toString({ bounceable: true });
        const transferAmount = 2;
        let walletApp = new FakeWalletApp(fakeWalletContract, false);
        const transferRequest = await walletApp.transferFunds(addressString, transferAmount);
        expect(transferRequest.result?.transactions).toHaveTransaction({
            value: toNano(transferAmount),
            from: fakeWalletContract.address,
            to: clientContract.address,
            inMessageBounced: false,
            inMessageBounceable: true,
            success: true,
        });

        const deployedClientContract = await blockchain.getContract(address);
        expect(deployedClientContract.balance).toBeGreaterThan(toNano(transferAmount));
    });
});
