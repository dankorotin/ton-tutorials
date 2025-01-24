import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type CounterConfig = {};

export function counterConfigToCell(config: CounterConfig): Cell {
    return beginCell().storeUint(0, 64).endCell();
}

export const Opcode = {
    MESSAGE: 0,
    INCREASE: 1,
    RESET: 2
};

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
            body: beginCell().endCell(),
        });
    }

    async sendOpcode(provider: ContractProvider, via: Sender, value: bigint, opcode: number, bits: number = 32) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(opcode, bits).endCell(),
        });
    }

    async sendSimpleMessage(provider: ContractProvider, via: Sender, value: bigint, messageLength: number) {
        let slice = beginCell().storeUint(Opcode.MESSAGE, 32)
        if (messageLength > 0) {
            slice.storeUint(0, messageLength);
        }
        const body = slice.endCell()
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: body,
        });
    }

    async sendIncrement(provider: ContractProvider, via: Sender, value: bigint, incrementValue: bigint, bits: number = 16) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(incrementValue, bits).endCell(),
        });
    }

    async getTotal(provider: ContractProvider) {
        const result = (await provider.get('total', [])).stack;
        return result.readBigNumber();
    }
}
