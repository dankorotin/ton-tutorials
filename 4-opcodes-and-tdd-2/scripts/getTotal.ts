import { compile, NetworkProvider } from '@ton/blueprint';
import { Counter } from '../wrappers/Counter';

export async function run(provider: NetworkProvider) {
    const counter = provider.open(Counter.createFromConfig({}, await compile('Counter')));
    console.log('Current total:', await counter.getTotal());
}