import { Blockchain, createEmptyShardAccount, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, SendMode, toNano } from '@ton/core';
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

        blockchain.now = Math.floor(Date.now() / 1000);

        if (expect.getState().currentTestName?.includes("[skip deploy]")) return;

        const deployResult = await client.sendDeploy(deployer.getSender(), toNano('0.0001'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: client.address,
            deploy: true,
            success: true,
        });
    });

    it('should be `uninit` without deploy [skip deploy]', async () => {
        let address = client.address;
        const contract = await blockchain.getContract(address);
        expect(contract.accountState?.type).toEqual('uninit');
    });

    it('should be `active` after deploy', async () => {
        let address = client.address;
        const contract = await blockchain.getContract(address);
        expect(contract.accountState?.type).toEqual('active');
    });
});
