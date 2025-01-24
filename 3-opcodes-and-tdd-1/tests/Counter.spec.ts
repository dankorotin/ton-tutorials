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
        expect(await counter.getTotal()).toEqual(0n);
    });

    it('should throw an exception if cannot parse an opcode', async () => {
        const callResult = await counter.sendOpcode(deployer.getSender(), toNano('0.05'), 1000, 28);
        expect(callResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: counter.address,
            success: false,
            exitCode: 9,
        });
    });

    it('should throw an exception if cannot handle an opcode', async () => {
        const callResult = await counter.sendOpcode(deployer.getSender(), toNano('0.05'), 1000);
        expect(callResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: counter.address,
            success: false,
            exitCode: 65535,
        });
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

    it('should increase the total by the correct amount when 17 bits of 65,536 are passed', async () => {
        await counter.sendIncrement(deployer.getSender(), toNano('0.05'), 65536n, 17);
        expect(await counter.getTotal()).toEqual(32768n);
    });

    it('should increase the total by the correct amount when 32 bits of 4,294,967,295 are passed', async () => {
        await counter.sendIncrement(deployer.getSender(), toNano('0.05'), 4294967295n, 32);
        expect(await counter.getTotal()).toEqual(65535n);
    });
});
