Addresses, Part 2: User-Friendly Addresses

## Before We Begin

Here, we assume that you followed the [first part](../2-1-addresses-and-states-1/README.md) of this tutorial and understand raw addresses and states. If you don’t, please complete the first part and return when you’re comfortable with these concepts.

> **This tutorial uses the code from the previous one, so we suggest you copy it to a separate directory and work there**.

## Tutorial Goals

In this part of the tutorial, we will explore the traits and benefits of user-friendly addresses, write a fake wallet app, and test the behavior different forms of addresses would trigger.

## User-Friendly Addresses

**Raw addresses don't provide any safety nets**: they don't indicate whether the funds should be returned to the sender on error (e.g., if there's no contract at the address or it cannot execute the request). They also don't reveal whether the address belongs to a production or test blockchain. Moreover, there's no validity check—accidentally replacing a character in an address won't make it invalid. **User-friendly addresses are here to fix this!**

> **Tip:** You can find more details on user-friendly addresses in [TEP-2](https://github.com/ton-blockchain/TEPs/blob/master/text/0002-address.md#smart-contract-addresses) and [docs](https://docs.ton.org/v3/documentation/smart-contracts/addresses#user-friendly-address).

A user-friendly address creation **starts with a 36-byte sequence**, composed as follows:

1. **Flags (1 byte).** These indicate whether messages sent to this address should be bounceable, whether the address belongs to testnet, and whether the address is URL-safe (deprecated).
    - `isBounceable` If true (`0x11`), this means that a smart contract at the address expects bounceable internal messages that will "bounce back" to the sender if a problem occurs with its handling (carrying the original message’s TON value minus the fees). A non-bounceable flag (`0x51`), however, indicates that the messages are expected to be "consumed" by the receiver, adding the value in TON to its balance (again, after fees are paid). Typically, the bounceable flag is true for smart contracts with internal logic, and non-bounceable for wallets.
    - `isTestnetOnly` Addresses beginning with `0x80` should not be accepted by software running on the production network.

2. **Workchain ID (1 byte).** A signed 8-bit integer (`0x00` for the Basechain, `0xff` for the Masterchain).

3. **Account ID (32 bytes).** The account ID is a big-endian 256-bit address within the workchain.

4. **Address Verification (2 bytes).** A CRC16-CCITT checksum of the previous 34 bytes. This ensures that the address is valid.

The 36-bit sequence of bytes is then encoded using regular or URL-friendly `base64`, resulting in a **48-character long user-friendly address**.

## User-Friendly Addresses in Practice

> ⚠️ **Important!** It is crucial to understand that **only raw addresses are used on-chain**! These addresses **do not have any flags**. The interpretation of user-friendly addresses, including their flags, is handled by off-chain applications, which may choose to respect or ignore them.

A **real wallet app** would reside on your mobile device or computer (i.e., be off-chain) and send external messages (we will get to these in a later tutorial) to the wallet contract deployed on the TON blockchain, which in turn would send an **internal message** to the address you pasted or typed in your app. Here are the steps to make it clear:

1. You enter or scan an address in the wallet app on your device. Here, your app might warn you that you send too much to an unbounceable address, check its status, refuse to send to testnet from a Basechain wallet, etc. All of this logic would be implemented **in the app, not in a smart contract**.
2. The app sends an **external** (off-chain to on-chain) message to your wallet smart contract.
3. The wallet smart contract receives it and sends an **internal message** (on-chain) to a different smart contract, carrying the value in TON that you specified, and optionally a message.

To illustrate this process and user-friendly addresses handling, we will create a basic **fake wallet app** and test its behavior based on the type of address. We will also inspect the results of sending messages with different flags and payloads to addresses in various states. For the sake of simplicity and testability, we will skip the "off-chain to on-chain" step in our implementation: the app will use the deployed wallet contract directly.

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

> **Tip**: Your IDE might show warnings that some of the imports are unused. Ignore them for now, as they will disappear as we add more logic to the class.

The fake wallet class we are creating has two `private readonly` (not "visible" outside the class) properties:

1. `walletContract` of type `SandboxContract<TreasuryContract>`. This is a wallet contract implementation provided by Sandbox. It will emulate your **wallet contract** deployed to the TON blockchain. Again, a **real wallet app wouldn't be able to use it directly**, as we do in this **test helper app**, so just imagine that instead of sending the messages directly from the contract, we first send one extra message from the app to the contract, triggering the exact same behavior.
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
   let blockchain: Blockchain;
   let fakeWalletContract: SandboxContract<TreasuryContract>;
   let clientContract: SandboxContract<Client>;

   beforeAll(async () => {
      clientCode = await compile('Client');
   });

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

### Parsing

Create the first test case in `FakeWalletApp.spec.ts`:

```typescript
it('should parse correct addresses', async () => {

});
```

Here, we are going to ultimately add some `expect` functions to check if the address string we pass to the wallet app can be parsed. But in order to do that, we need two key components:

1. A valid user-friendly address string of a smart contract (we will use `client.tolk` we created earlier, but you can use any you like).
2. A method in the fake wallet app to handle parsing the address and sending funds.

Let's deal with the address first. Add the following lines to the test case body, so that it looks like this:

```typescript
it('should parse correct addresses', async () => {
   console.log("Raw: " + clientContract.address.toRawString());
   console.log("User-Friendly 1: " + clientContract.address.toString({ bounceable: true, testOnly: true }));
   console.log("User-Friendly 2: " + clientContract.address.toString({ bounceable: false, testOnly: true }));
   console.log("User-Friendly 3: " + clientContract.address.toString({ bounceable: true, testOnly: false }));
   console.log("User-Friendly 4: " + clientContract.address.toString({ bounceable: false, testOnly: false }));
});
```

Run the test (`npx blueprint test`). In the console output, you should find the following strings:

```
Raw: 0:6f2f56f5bef8bec973ff95e3a25f7b6c3816b0588b5739ff45981d310a5e9c86
User-Friendly 1: kQBvL1b1vvi-yXP_leOiX3tsOBawWItXOf9FmB0xCl6chnfz
User-Friendly 2: 0QBvL1b1vvi-yXP_leOiX3tsOBawWItXOf9FmB0xCl6chio2
User-Friendly 3: EQBvL1b1vvi-yXP_leOiX3tsOBawWItXOf9FmB0xCl6chsx5
User-Friendly 4: UQBvL1b1vvi-yXP_leOiX3tsOBawWItXOf9FmB0xCl6chpG8
```

As you see, the user-friendly addresses don't differ much. The key takeaway here is that the first character will tell you what type of a user-friendly address you see (this applies to all user-friendly addresses):

1. `k`: Bounceable, testnet.
2. `0`: Non-bounceable, testnet.
3. `E`: Bounceable, production chain.
4. `U`: Non-bounceable, production chain.

Now, let's add a funds transfer function to the app and write the first tests for it. Open the `FakeWalletApp.ts` file and add this function under the constructor:

> **Tip**: Remember that you can always open the files from this tutorial's repository to compare them to your implementation!

```typescript
async transferFunds(addressString: string, amount: bigint): Promise<{ result?: SendMessageResult, error?: string }> {
   try {
      let addressDetails = Address.parseFriendly(addressString);
   } catch (error) {
      if (error instanceof Error) return { error: error.message };
      return { error: 'Unable to parse address' };
   }

   return {};
}
```

1. It has two parameters: `addressString`, expecting an address in a user-friendly format, and `amount` to transfer.
2. It returns a promise with two optional fields: `result`, if the transfer was successful, and `error`, explaining a failure if it occurs.
3. Inside, we call the static function `parseFriendly` of the `Address` class, which throws errors if it cannot parse the string we pass.
4. If the address is parsed successfully, for now it will return an empty object.

It's time to test it! For now, we will simply test the existing behavior and not employ a test-driven approach (as we needed a basic transfer function to start testing), but for the upcoming functionality in the next part of the tutorial, we will be writing tests first. Update the only test case to look like this:

```typescript
it('should parse correct addresses', async () => {
   const testnetWalletApp = new FakeWalletApp(fakeWalletContract, true);
   const validAddress = 'kQBvL1b1vvi-yXP_leOiX3tsOBawWItXOf9FmB0xCl6chnfz';
   const result = await testnetWalletApp.transferFunds(validAddress, toNano(1));
   expect(result.error).toBeUndefined();
});
```

Run it from your IDE or by executing `npx blueprint test` in the console. It should be green, as we pass a valid address to the transfer function.

Now, let's test a couple of invalid address strings and ensure we get proper error messages. Add another test case below the previous one:

```typescript
it('should throw for incorrect addresses', async () => {
   const testnetWalletApp = new FakeWalletApp(fakeWalletContract, true);

   // Incorrect checksum (last character changed).
   let invalidAddress = 'kQBvL1b1vvi-yXP_leOiX3tsOBawWItXOf9FmB0xCl6chnfa';
   let result = await testnetWalletApp.transferFunds(invalidAddress, toNano(1));
   expect(result.error).toEqual('Invalid checksum: kQBvL1b1vvi+yXP/leOiX3tsOBawWItXOf9FmB0xCl6chnfa');

   // Incorrect length (last character deleted).
   invalidAddress = 'kQBvL1b1vvi-yXP_leOiX3tsOBawWItXOf9FmB0xCl6chnf';
   result = await testnetWalletApp.transferFunds(invalidAddress, toNano(1));
   expect(result.error).toEqual('Unknown address type');
});
```

> ⚠️ **Important!** In this test, we use error messages returned from the `Address` class in the `@ton` library. Since we have no control over them, the texts may change in future versions. If your test fails, check if the messages match.

The test is very similar to the first one, but first it tries to pass an address string with the last character changed, and in the second one—with a removed character. You can modify a valid address any way you want and test it to ensure that even the slightest modification leads to a parsing failure.

## Wrapping Up

In this part, we've learned about user-friendly addresses and their main benefit: any errors in such an address will lead to parsing failures. In the next part, we will dig deeper and add much more functionality to the wallet app—along with more tests!