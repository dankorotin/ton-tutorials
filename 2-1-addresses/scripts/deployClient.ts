import { toNano } from '@ton/core';
import { Client } from '../wrappers/Client';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const client = provider.open(Client.createFromConfig({}, await compile('Client')));

    await client.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(client.address);

    // run methods on `client`
}
