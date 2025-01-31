import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type ClientConfig = {};

export function clientConfigToCell(config: ClientConfig): Cell {
    return beginCell().endCell();
}

export class Client implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Client(address);
    }

    static createFromConfig(config: ClientConfig, code: Cell, workchain = 0) {
        const data = clientConfigToCell(config);
        const init = { code, data };
        return new Client(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
