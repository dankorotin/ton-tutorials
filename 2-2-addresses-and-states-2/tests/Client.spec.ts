import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, SendMode, toNano } from '@ton/core';
import { Client } from '../wrappers/Client';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Client', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Client');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let client: SandboxContract<Client>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        client = blockchain.openContract(Client.createFromConfig({}, code));
        deployer = await blockchain.treasury('deployer');

        if (expect.getState().currentTestName?.includes("[skip deploy]")) return;

        const deployResult = await client.sendDeploy(deployer.getSender(), toNano('0.0001'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: client.address,
            deploy: true,
            success: true,
        });
    });

    it('should be `uninit` without deploy, with a zero balance [skip deploy]', async () => {
        const address = client.address;
        const contract = await blockchain.getContract(address);
        expect(contract.accountState?.type).toEqual('uninit');
        expect(contract.balance).toEqual(0n);
    });

    it('should be `uninit` without deploy, with a positive balance after a transaction [skip deploy]', async () => {
        const address = client.address;
        await deployer.send({
            to: address,
            value: toNano(1),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            bounce: false
        });
        const contract = await blockchain.getContract(address);
        expect(contract.accountState?.type).toEqual('uninit');
        expect(contract.balance).toEqual(toNano(1));
    });

    it('should be `active` after deploy, with a positive balance', async () => {
        const address = client.address;
        const contract = await blockchain.getContract(address);
        expect(contract.accountState?.type).toEqual('active');
        expect(contract.balance).toBeGreaterThan(0);
    });

    it('should reduce balance over time', async () => {
        const address = client.address;
        let contract = await blockchain.getContract(address);

        // Get and save the contract balance immediately after deployment.
        const balanceAfterDeploy = contract.balance;
        expect(balanceAfterDeploy).toBeGreaterThan(0n);

        // Advance the time by one year.
        blockchain.now = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

        // The contract balance should still be the same as after deployment.
        // This is because the payment phase hasn't been triggered yet.
        contract = await blockchain.getContract(address);
        expect(contract.balance).toEqual(balanceAfterDeploy);

        // Send a message to trigger the storage fee payment.
        await deployer.send({
            to: address,
            value: toNano(0),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
        });

        // Now the contract balance should be 0.
        // On a real blockchain, the balance would become negative, and the contract would be frozen.
        contract = await blockchain.getContract(address);
        expect(contract.balance).toEqual(0n);
    });
});
