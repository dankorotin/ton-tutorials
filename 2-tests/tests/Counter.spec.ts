import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Counter } from '../wrappers/Counter';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Counter', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Counter');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let counter: SandboxContract<Counter>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        counter = blockchain.openContract(Counter.createFromConfig({}, code));
        deployer = await blockchain.treasury('deployer');

        const deployResult = await counter.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: counter.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and counter are ready to use
    });

    it('should increase the total', async () => {
        await counter.sendIncrement(deployer.getSender(), toNano('0.05'), 42n);
        expect(await counter.getTotal()).toEqual(42n);

        // Introduce a new blockchain entity by creating another `TreasuryContract` instance.
        // This will ensure anyone can increase the total, not only the deployer.
        const johnDoe = await blockchain.treasury('johndoe');
        await counter.sendIncrement(johnDoe.getSender(), toNano('0.05'), 1337n);
        expect(await counter.getTotal()).toEqual(1379n);
    });
});
