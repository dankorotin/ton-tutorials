import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
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

        const deployResult = await client.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: client.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and client are ready to use
    });
});
