import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { Client } from '../../wrappers/Client';
import { FakeWalletApp } from './FakeWalletApp';

describe('FakeWalletApp', () => {
    let clientCode: Cell;
    let blockchain: Blockchain;
    let fakeWalletContract: SandboxContract<TreasuryContract>;
    let clientContract: SandboxContract<Client>;

    beforeAll(async () => {
        clientCode = await compile('Client');
    });

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

    it('should parse correct addresses', async () => {
        const testnetWalletApp = new FakeWalletApp(fakeWalletContract, true);
        const validAddress = 'kQBvL1b1vvi-yXP_leOiX3tsOBawWItXOf9FmB0xCl6chnfz';
        const result = await testnetWalletApp.transferFunds(validAddress, toNano(1));
        expect(result.error).toBeUndefined();
    });

    it('should throw for incorrect addresses', async () => {
        const testnetWalletApp = new FakeWalletApp(fakeWalletContract, true);

        // Incorrect checksum (last character changed).
        let invalidAddress = 'kQBvL1b1vvi-yXP_leOiX3tsOBawWItXOf9FmB0xCl6chnfa';
        let result = await testnetWalletApp.transferFunds(invalidAddress, toNano(1));
        expect(result.error).toEqual('Invalid checksum: kQBvL1b1vvi+yXP/leOiX3tsOBawWItXOf9FmB0xCl6chnfa');

        // Incorrect length (last character deleted).
        invalidAddress = 'kQBvL1b1vvi-yXP_leOiX3tsOBawWItXOf9FmB0xCl6chnf';
        result = await testnetWalletApp.transferFunds(invalidAddress, toNano(1));
        expect(result.error).toEqual('Unknown address type');
    });
});
