import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type CounterConfig = {};

export function counterConfigToCell(config: CounterConfig): Cell {
    // Create the cell that will be stored in `c4` register.
    // It contains zero as the initial value, stored as a 64-bit integer.
    return beginCell().storeUint(0, 64).endCell();
}

export class Counter implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Counter(address);
    }

    static createFromConfig(config: CounterConfig, code: Cell, workchain = 0) {
        const data = counterConfigToCell(config);
        const init = { code, data };
        return new Counter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0, 16).endCell(),
        });
    }

    // Send a value to increment the one stored in the contract storage by.
    // It's stored in a newly created cell as a 16-bit unsigned integer.
    async sendIncrement(provider: ContractProvider, via: Sender, value: bigint, incrementValue: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(incrementValue, 16).endCell(),
        });
    }

    async getTotal(provider: ContractProvider) {
        // Call the `get` method named `total` in the Tolk smart contract by its name.
        const result = (await provider.get('total', [])).stack;
        return result.readBigNumber();
    }
}
