import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
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

    it(`should allow sending to a matching chain type`, async () => {
        const testnetWalletApp = new FakeWalletApp(fakeWalletContract, true);
        const testnetAddress = clientContract.address.toString({ testOnly: true });
        let result = await testnetWalletApp.transferFunds(testnetAddress, toNano(1));
        expect(result.error).toBeUndefined();

        const productionWalletApp = new FakeWalletApp(fakeWalletContract, false);
        const productionAddress = clientContract.address.toString({ testOnly: false });
        result = await productionWalletApp.transferFunds(productionAddress, toNano(1));
        expect(result.error).toBeUndefined();
    });

    it(`should reject sending to a non-matching chain type`, async () => {
        const testnetWalletApp = new FakeWalletApp(fakeWalletContract, true);
        const productionAddress = clientContract.address.toString({ testOnly: false });
        let result = await testnetWalletApp.transferFunds(productionAddress, toNano(1));
        expect(result.error).toEqual('The wallet is testnet: true, the address is testnet-only: false');

        const productionWalletApp = new FakeWalletApp(fakeWalletContract, false);
        const testnetAddress = clientContract.address.toString({ testOnly: true });
        result = await productionWalletApp.transferFunds(testnetAddress, toNano(1));
        expect(result.error).toEqual('The wallet is testnet: false, the address is testnet-only: true');
    });

    it(`should allow sending any amount to a bounceable address`, async () => {
        const walletApp = new FakeWalletApp(fakeWalletContract, false);
        const address = clientContract.address.toString({ testOnly: false, bounceable: true });
        const result = await walletApp.transferFunds(address, toNano(1000));
        expect(result.error).toBeUndefined();
    });

    it(`should allow sending < 5 TON to a non-bounceable address`, async () => {
        const walletApp = new FakeWalletApp(fakeWalletContract, false);
        const address = clientContract.address.toString({ testOnly: false, bounceable: false });
        const result = await walletApp.transferFunds(address, toNano(4.99));
        expect(result.error).toBeUndefined();
    });

    it(`should reject sending >= 5 TON to a non-bounceable address`, async () => {
        const walletApp = new FakeWalletApp(fakeWalletContract, false);
        const address = clientContract.address.toString({ testOnly: false, bounceable: false });
        const result = await walletApp.transferFunds(address, toNano(5));
        expect(result.error).toEqual('Sending more than 5 TON to a non-bounceable address is forbidden');
    });

    it('should send the full amount when sent to an existing non-bounceable address', async () => {
        const walletApp = new FakeWalletApp(fakeWalletContract, false);
        const address = clientContract.address.toString({ testOnly: false, bounceable: false });
        const amountToSend = toNano(1);
        const result = await walletApp.transferFunds(address, amountToSend);

        expect(result.result?.transactions).toHaveTransaction({
            from: fakeWalletContract.address,
            to: clientContract.address,
            value: amountToSend,
            success: true
        });
    });

    it('should send the full amount when sent to an existing bounceable address', async () => {
        const walletApp = new FakeWalletApp(fakeWalletContract, false);
        const address = clientContract.address.toString({ testOnly: false, bounceable: true });
        const amountToSend = toNano(1);
        const result = await walletApp.transferFunds(address, amountToSend);

        expect(result.result?.transactions).toHaveTransaction({
            from: fakeWalletContract.address,
            to: clientContract.address,
            value: amountToSend,
            success: true
        });
    });

    it('should send the full amount when sent to a non-existing non-bounceable address', async () => {
        const nonExistingRawAddress = "0:cbd5fedaafb6bf68024eb52d8d3a497c920cfe44cd269ed7e10126ef5a1d4466";
        const nonExistingAddress = Address.parseRaw(nonExistingRawAddress);
        const nonExistingAddressString = nonExistingAddress.toString({ testOnly: false, bounceable: false })
        const nonExistingContract = await blockchain.getContract(nonExistingAddress);

        expect(nonExistingContract.balance).toEqual(0n);

        const walletApp = new FakeWalletApp(fakeWalletContract, false);
        const amountToSend = toNano(1);
        const result = await walletApp.transferFunds(nonExistingAddressString, amountToSend);

        expect(result.result?.transactions).toHaveTransaction({
            from: fakeWalletContract.address,
            to: nonExistingAddress,
            value: amountToSend,
            success: false
        });

        expect(nonExistingContract.balance).toEqual(1000000000n);
    });

    it('should bounce the sent amount when sent to a non-existing bounceable address', async () => {
        const nonExistingRawAddress = "0:cbd5fedaafb6bf68024eb52d8d3a497c920cfe44cd269ed7e10126ef5a1d4466";
        const nonExistingAddress = Address.parseRaw(nonExistingRawAddress);
        const nonExistingAddressString = nonExistingAddress.toString({ testOnly: false, bounceable: true })
        const nonExistingContract = await blockchain.getContract(nonExistingAddress);

        expect(nonExistingContract.balance).toEqual(0n);

        const walletApp = new FakeWalletApp(fakeWalletContract, false);
        const amountToSend = toNano(1);
        const result = await walletApp.transferFunds(nonExistingAddressString, amountToSend);

        expect(result.result?.transactions).toHaveTransaction({
            from: fakeWalletContract.address,
            to: nonExistingAddress,
            value: amountToSend,
            success: false
        });

        expect(nonExistingContract.balance).toEqual(0n);
    });
});
