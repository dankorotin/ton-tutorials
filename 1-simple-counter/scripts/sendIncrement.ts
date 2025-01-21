import { compile, NetworkProvider } from '@ton/blueprint';
import { toNano } from '@ton/core';
import { Counter } from '../wrappers/Counter';

export async function run(provider: NetworkProvider) {
    const counter = provider.open(Counter.createFromConfig({}, await compile('Counter')));
    await counter.sendIncrement(provider.sender(), toNano('0.05'), 42n);
}