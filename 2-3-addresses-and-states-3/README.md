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

Here, we create instances of the **fake wallet app** with the wallet contract “deployed” on testnet (`testnetWalletApp`) and on the production chain (`productionWalletApp`), and call the transfer method on them using addresses with matching WorkChain IDs. The tests will pass, as there's no logic yet to handle the flags, and we expect them to continue passing once that logic is implemented.

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

Smart contracts with non-bounceable addresses (often wallets) will likely simply “consume” the message you send, along with any funds, regardless of whether they can handle the opcodes or other instructions in the message. Hence, sending large amounts to such addresses implies the risk of losing your funds.

Of course, **there's no guarantee that a smart contract at a bounceable address will indeed bounce the message back if something goes wrong**, but at least the address *declares* that it will. Also, sending a message to an "empty" bounceable address ensures your funds (minus fees) are returned to your wallet.

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

> 🛟 **Tip:** Use console logging (`console.log`) in your tests to verify that the generated values (such as addresses) match your understanding and expectations.

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
            value: amount,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            bounce: addressDetails.isBounceable,
        });

        return { result: result };
    }
}
```

> ⚠️ **Important!** Read the code carefully and ensure you understand every line. Refer to the logic requirements we outlined above if you're unsure why a particular condition exists.

As you can see, the app now correctly checks all the conditions we discussed above and also performs the actual transaction. Remember: **the bounceability flag only works because we implemented its handling in the fake wallet app**, where it gets parsed and translated to the smart contract (here: `bounce: addressDetails.isBounceable`)!

Run the tests to ensure they now pass.

## Bounceability In Practice

Let's write some tests to see how the bounceability flag affects transactions to existing and non-existing smart contracts. Add the following test cases to `FakeWalletApp.spec.ts`:

```typescript
it('should send the full amount when sent to an existing non-bounceable address', async () => {
    const walletApp = new FakeWalletApp(fakeWalletContract, false);
    const address = clientContract.address.toString({ testOnly: false, bounceable: false });
    const amountToSend = toNano(1);
    const result = await walletApp.transferFunds(address, amountToSend);

    expect(result.result?.transactions).toHaveTransaction({
        from: fakeWalletContract.address,
        to: clientContract.address,
        value: amountToSend,
        success: true
    });
});

it('should send the full amount when sent to an existing bounceable address', async () => {
    const walletApp = new FakeWalletApp(fakeWalletContract, false);
    const address = clientContract.address.toString({ testOnly: false, bounceable: true });
    const amountToSend = toNano(1);
    const result = await walletApp.transferFunds(address, amountToSend);

    expect(result.result?.transactions).toHaveTransaction({
        from: fakeWalletContract.address,
        to: clientContract.address,
        value: amountToSend,
        success: true
    });
});

it('should send the full amount when sent to a non-existing non-bounceable address', async () => {
    const nonExistingRawAddress = "0:cbd5fedaafb6bf68024eb52d8d3a497c920cfe44cd269ed7e10126ef5a1d4466";
    const nonExistingAddress = Address.parseRaw(nonExistingRawAddress);
    const nonExistingAddressString = nonExistingAddress.toString({ testOnly: false, bounceable: false })
    const nonExistingContract = await blockchain.getContract(nonExistingAddress);

    expect(nonExistingContract.balance).toEqual(0n);

    const walletApp = new FakeWalletApp(fakeWalletContract, false);
    const amountToSend = toNano(1);
    const result = await walletApp.transferFunds(nonExistingAddressString, amountToSend);

    expect(result.result?.transactions).toHaveTransaction({
        from: fakeWalletContract.address,
        to: nonExistingAddress,
        value: amountToSend,
        success: false
    });

    expect(nonExistingContract.balance).toEqual(1000000000n);
});

it('should bounce the sent amount when sent to a non-existing bounceable address', async () => {
    const nonExistingRawAddress = "0:cbd5fedaafb6bf68024eb52d8d3a497c920cfe44cd269ed7e10126ef5a1d4466";
    const nonExistingAddress = Address.parseRaw(nonExistingRawAddress);
    const nonExistingAddressString = nonExistingAddress.toString({ testOnly: false, bounceable: true })
    const nonExistingContract = await blockchain.getContract(nonExistingAddress);

    expect(nonExistingContract.balance).toEqual(0n);

    const walletApp = new FakeWalletApp(fakeWalletContract, false);
    const amountToSend = toNano(1);
    const result = await walletApp.transferFunds(nonExistingAddressString, amountToSend);

    expect(result.result?.transactions).toHaveTransaction({
        from: fakeWalletContract.address,
        to: nonExistingAddress,
        value: amountToSend,
        success: false
    });

    expect(nonExistingContract.balance).toEqual(0n);
});
```

> 🛟 **Tip:** `1000000000n` in one of the test cases above is a `bigint` (hence the `n` at the end) and represents 1 billion nanotons—this is how TON values are stored on-chain. **1 billion nanotons equals 1 TON.** We explore this topic in greater detail in the fees tutorial!

By now, you should be able to understand what's being tested and how (the test case names should guide you if you're unsure). Let's outline the most important parts:

1. The **first pair of tests** checks what happens when you send TON to an **existing** smart contract via **bounceable and non-bounceable user-friendly addresses**. In both cases, the transaction is successful.
2. The **second pair** tests the same scenario but with a **non-existing address**. Sending a **non-bounceable message still transfers the funds**, even though the transaction is considered non-successful (this approach is used to fund smart contracts before deployment). Sending a **bounceable message, however, returns ("bounces" back) the sent amount minus fees**, leaving the address's balance unchanged.

As a "homework" task, you can (and should) add checks to the tests to verify the sender's balance before and after each transaction. You can even retrieve the fees from transactions and implement an exact comparison!

## Wrapping up

Let's summarize the key takeaways from this rather lengthy 3-part tutorial:

1. **Raw addresses are used on-chain** (when sending messages to smart contracts).
2. **User-friendly addresses provide integrity checks** (via checksum calculation) and allow **annotating the expected address properties**: being deployed to a particular chain and expecting bounceable/non-bounceable messages.
3. **All user-friendly address features are implemented in off-chain applications**, which may or may not respect the address traits, and might add additional behavior based on them.

Congratulations on completing this rather lengthy three-part tutorial! 🥳🎉🎊

See you in the next one!