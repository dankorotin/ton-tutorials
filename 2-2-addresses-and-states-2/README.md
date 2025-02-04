Addresses, Part 2: User-Friendly Addresses

## Before We Begin

Here, we assume that you followed the [first part](../2-1-addresses-and-states-1/README.md) of this tutorial and understand raw addresses and states. If you don’t, please complete the first part and return when you’re comfortable with these concepts.

> **This tutorial uses the code from the previous one, so we suggest you copy it to a separate directory and work there**.

## Tutorial Goals

In this part of the tutorial, we will explore the traits and benefits of user-friendly addresses, write a fake wallet app, and test the behavior different forms of addresses would trigger.

## User-Friendly Addresses

**Raw addresses don't provide any safety nets**: they don't indicate whether the funds should be returned to the sender on error (e.g., if there's no contract at the address or it cannot execute the request). They also don't reveal whether the address belongs to a production or test blockchain. Moreover, there's no validity check—accidentally replacing a character in an address won't make it invalid. **User-friendly addresses are here to fix this!**

> **Tip:** You can find more details on user-friendly addresses in [TEP-2](https://github.com/ton-blockchain/TEPs/blob/master/text/0002-address.md#smart-contract-addresses) and [docs](https://docs.ton.org/v3/documentation/smart-contracts/addresses#user-friendly-address).

A user-friendly address creation starts with a 36-byte sequence, composed as follows:

1. **Flags (1 byte).** These indicate whether messages sent to this address should be bounceable, whether the address belongs to testnet, and whether the address is URL-safe (deprecated).
    - `isBounceable` If true (`0x11`), this means that a smart contract at the address expects bounceable internal messages that will "bounce back" to the sender if a problem occurs with its handling (carrying the original message’s TON value minus the fees). A non-bounceable flag (`0x51`), however, indicates that the messages are expected to be "consumed" by the receiver, adding the value in TON to its balance (again, after fees are paid). Typically, the bounceable flag is true for smart contracts with internal logic, and non-bounceable for wallets.
    - `isTestnetOnly` Addresses beginning with `0x80` should not be accepted by software running on the production network.

2. **Workchain ID (1 byte).** A signed 8-bit integer (`0x00` for the Basechain, `0xff` for the Masterchain).

3. **Account ID (32 bytes).** The account ID is a big-endian 256-bit address within the workchain.

4. **Address Verification.** A CRC16-CCITT checksum of the previous 34 bytes. This ensures that the address is valid.

The sequence of bytes is then encoded using regular or URL-friendly `base64`, resulting in a 48-character long user-friendly address.

## User-Friendly Addresses in Practice

**It is important to understand that only raw addresses are used on-chain.** These addresses do not have any flags. The interpretation of user-friendly addresses, including their flags, is handled by off-chain applications, which can choose to either respect or ignore them.

To illustrate this, we will create a basic **fake wallet app** and test its behavior based on the type of address. We will also inspect the results of sending messages with different flags and payloads to addresses in various states.

### Fake Wallet App

The "wallet app" we will create will be a **helper** used for testing purposes only, so we will place it in the `tests` directory.

1. Create another directory inside `tests` named `helpers`.
2. Then, create an empty TypeScript file there and name it `FakeWalletApp.ts`.

The full path to it should be `tests/helpers/FakeWalletApp.ts`. Paste the code below into it:

```typescript
import { Address, SendMode, toNano } from '@ton/core';
import { SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';

export class FakeWalletApp {
    private readonly walletContract: SandboxContract<TreasuryContract>;
    private readonly isTestnet: boolean;

    constructor(walletContract: SandboxContract<TreasuryContract>, isTestnet: boolean) {
        this.walletContract = walletContract;
        this.isTestnet = isTestnet;
    }
}
```

> Your IDE might show warnings that some of the imports are unused. Ignore them for now, as they will disappear as we add more logic to the class.

The fake wallet class we are making has two `private readonly` properties:

1. `walletContract` of type `SandboxContract<TreasuryContract>`. This is a wallet contract implementation provided by Sandbox. It will emulate your wallet contract deployed to the TON blockchain.
2. `isTestnet` indicates whether we treat this contract as being deployed on testnet or a production chain.

Below the properties is the class constructor, which simply assigns the arguments to the properties.

### Fake Wallet App Tests

Now, create another file in the same directory and name it `FakeWalletApp.spec.ts`. This file will contain tests for the wallet, and we will use a **test-driven approach** to gradually implement the logic required for handling user-friendly addresses and analyzing the resulting transactions.

The full path to the file should be `tests/helpers/FakeWalletApp.spec.ts`. Paste the following code into it:

```typescript
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { Client } from '../../wrappers/Client';
import { FakeWalletApp } from './FakeWalletApp';

describe('FakeWalletApp', () => {
    let clientCode: Cell;

    beforeAll(async () => {
        clientCode = await compile('Client');
    });

    let blockchain: Blockchain;
    let fakeWalletContract: SandboxContract<TreasuryContract>;
    let clientContract: SandboxContract<Client>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        clientContract = blockchain.openContract(Client.createFromConfig({}, clientCode));
        fakeWalletContract = await blockchain.treasury('fake_wallet');

        const deployResult = await clientContract.sendDeploy(fakeWalletContract.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: fakeWalletContract.address,
            to: clientContract.address,
            deploy: true,
            success: true,
        });
    });
});
```

This code should be familiar to you from the tests we wrote in other tutorials. So far, there are no test cases here, but we already have some useful variables that we will use in the tests:

1. `clientContract` – The smart contract we created in the first part of this tutorial (currently empty, residing at `contracts/tolk.ts`). It is deployed before each test case to a fresh instance of the test blockchain.
2. `fakeWalletContract` – An instance of `TreasuryContract` provided by Sandbox. This serves as the **wallet smart contract** that we will use in the fake wallet app to send messages to `clientContract`.

### Implementing the Wallet Logic

Create the first test case in `FakeWalletApp.spec.ts`:

