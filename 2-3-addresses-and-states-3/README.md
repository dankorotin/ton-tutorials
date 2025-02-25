# Addresses, Part 3: Flags

## Before We Begin

Here, we assume that you have followed the [second part](../2-2-addresses-and-states-2/README.md) of this tutorial and understand user-friendly addresses. If you don’t, please complete the second part and return when you’re comfortable with these concepts.

> **This tutorial uses code from the previous one, so we suggest you copy it to a separate directory and work there.**

## Tutorial Goals

In this part of the tutorial, we will continue developing the fake wallet app, adding the ability to check flags and react accordingly.

## Checking the Network Type Flag

In the previous part of this tutorial, we've ensured that valid user-friendly address strings are parsed, but the app we're developing doesn't care if the address points to a smart contract on testnet or the production chain. We'd like our app to warn the user if they try to send test TON to a production smart contract, and vice versa.

First, let's add a test that expects the app to emit such warnings. Open `tests/helpers/FakeWalletApp.spec.ts` and add another test case below the existing ones:

```typescript
it(`should allow sending to a matching chain type`, async () => {
    // This fake wallet app treats its smart contract as deployed to testnet.
    const testnetWalletApp = new FakeWalletApp(fakeWalletContract, true);
    // This address is testnet-only.
    const testnetAddress = clientContract.address.toString({ testOnly: true });
    let result = await testnetWalletApp.transferFunds(testnetAddress, toNano(1));
    expect(result.error).toBeUndefined();

    // This fake wallet app treats its smart contract as deployed to a production chain.
    const productionWalletApp = new FakeWalletApp(fakeWalletContract, false);
    // This address is production-only.
    const productionAddress = clientContract.address.toString({ testOnly: false });
    result = await productionWalletApp.transferFunds(productionAddress, toNano(1));
    expect(result.error).toBeUndefined();
});
```

Here, we create instances of the **fake wallet app** with the wallet contract “deployed” on testnet (`testnetWalletApp`) and on the production chain (`productionWalletApp`), and call the transfer method on them using addresses with matching workchain IDs. The tests will pass, as there's no logic yet to handle the flags, and we expect them to continue passing once that logic is implemented.

Now, add another test case:

```typescript
it(`should reject sending to a non-matching chain type`, async () => {
    const testnetWalletApp = new FakeWalletApp(fakeWalletContract, true);
    const productionAddress = clientContract.address.toString({ testOnly: false });
    let result = await testnetWalletApp.transferFunds(productionAddress, toNano(1));
    expect(result.error).toEqual('The wallet is testnet: true, the address is testnet-only: false');

    const productionWalletApp = new FakeWalletApp(fakeWalletContract, false);
    const testnetAddress = clientContract.address.toString({ testOnly: true });
    result = await productionWalletApp.transferFunds(testnetAddress, toNano(1));
    expect(result.error).toEqual('The wallet is testnet: false, the address is testnet-only: true');
});
```

It is almost identical to the previous one, but in this test we attempt to send funds to a non-matching blockchain type (first to a testnet wallet contract via a production-only address, and vice versa). The test expects to get an error with the text explaining the reason in both cases. If you run it now, the test will fail because there's still no logic to handle the flags.

Let's implement the necessary checks. Update the funds transfer function in `tests/helpers/FakeWalletApp.ts` to look like this:

```typescript
async transferFunds(addressString: string, amount: bigint): Promise<
    | { result: SendMessageResult; error?: never }
    | { result?: never; error: string }
    > {
        let addressDetails: { isBounceable: boolean, isTestOnly: boolean, address: Address };
    try {
        addressDetails = Address.parseFriendly(addressString);
    } catch (error) {
        if (error instanceof Error) return { error: error.message };
        return { error: 'Unable to parse address' };
    }

    if (this.isTestnet !== addressDetails.isTestOnly) {
        return { error: `The wallet is testnet: ${ this.isTestnet }. The address is testnet-only: ${ addressDetails.isTestOnly }.` };
    }

    const fakeResult: SendMessageResult = { events: [], externals: [], transactions: [] };
    return { result: fakeResult };
}
```

Now, if the chain types don't match, the app will return an error explaining exactly what went wrong. In a real-world app, you would display a warning to the user and refuse to make the transaction. Run the tests and ensure they now pass.

## Checking for Bounceability

Smart contracts with non-bounceable addresses (often wallets) will likely simply “consume” the message you send, along with any funds, regardless of whether they can handle the opcodes or other instructions in the message. Hence, sending large amounts to such addresses implies the risk of losing your funds. Of course, **there's no guarantee that a smart contract at a bounceable address will indeed bounce the message back if something goes wrong**, but at least the address *declares* that it will. Also, sending a message to an "empty" bounceable address ensures your funds (minus fees) are returned to your wallet.

Let's now add tests and implement the logic to:

1. Allow sending any amount to a bounceable address.
2. Allow sending less than 5 TON to a non-bounceable address.
3. Return an error if the amount to be sent to a non-bounceable address is 5 TON or more.

Add the following test cases below the previous one:

```typescript
it(`should allow sending any amount to a bounceable address`, async () => {
    const walletApp = new FakeWalletApp(fakeWalletContract, false);
    const address = clientContract.address.toString({ testOnly: false, bounceable: true });
    const result = await walletApp.transferFunds(address, toNano(1000));
    expect(result.error).toBeUndefined();
});

it(`should allow sending < 5 TON to a non-bounceable address`, async () => {
    const walletApp = new FakeWalletApp(fakeWalletContract, false);
    const address = clientContract.address.toString({ testOnly: false, bounceable: false });
    const result = await walletApp.transferFunds(address, toNano(4.99));
    expect(result.error).toBeUndefined();
});

it(`should reject sending >= 5 TON to a non-bounceable address`, async () => {
    const walletApp = new FakeWalletApp(fakeWalletContract, false);
    const address = clientContract.address.toString({ testOnly: false, bounceable: false });
    const result = await walletApp.transferFunds(address, toNano(5));
    expect(result.error).toEqual('Sending more than 5 TON to a non-bounceable address is forbidden');
});
```

These test cases differ in the following details:

1. When creating the `address`, only the first test case makes it bounceable.
2. The amount sent is adjusted according to the logic outlined above.

Run the tests, and all but the last one will pass. We only need to implement the final piece of logic: check the bounceability flag in the address and, if it’s non-bounceable, limit the amount to be sent. Update the fake wallet app implemetation (`tests/helpers/FakeWalletApp.ts`) to look like this:

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

    async transferFunds(addressString: string, amount: bigint): Promise<
        | { result: SendMessageResult; error?: never }
        | { result?: never; error: string }
    > {
        let addressDetails: { isBounceable: boolean, isTestOnly: boolean, address: Address };
        try {
            addressDetails = Address.parseFriendly(addressString);
        } catch (error) {
            if (error instanceof Error) return { error: error.message };
            return { error: 'Unable to parse address' };
        }

        if (this.isTestnet !== addressDetails.isTestOnly) {
            return { error: `The wallet is testnet: ${ this.isTestnet }, the address is testnet-only: ${ addressDetails.isTestOnly }` };
        }

        if (!addressDetails.isBounceable && amount >= toNano(5)) {
            return { error: 'Sending more than 5 TON to a non-bounceable address is forbidden' };
        }

        const result = await this.walletContract.send({
            to: addressDetails.address,
            value: toNano(amount),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            bounce: addressDetails.isBounceable,
        });

        return { result: result };
    }
}
```

As you can see, the app now correctly checks all the conditions we discussed above, and also performs the actual transaction. Run the tests to ensure they now pass.