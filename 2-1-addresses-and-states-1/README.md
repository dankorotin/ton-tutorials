# Addresses, Part 1: Raw Addresses and States

## Before We Begin

To understand and successfully complete this tutorial, you should be familiar with the basic concepts of the TON blockchain, such as smart contracts, messages, and automated testing. If you aren’t, we suggest completing the [Basics and Testing](../README.md#-1-basics-and-testing) section first.

## Tutorial Goals

In this tutorial, we'll begin creating a simple **client-server** relationship between two smart contracts. In the following parts, we will explore how contracts can communicate and trigger different functionality, as well as potential pitfalls when implementing such interactions.

But since **contracts interact by sending messages**—and a message requires an address—we’ll start with the essentials: **what types of smart contract addresses exist on TON**, how they are calculated, and the lifecycle of both the address itself and the smart contract residing at that address.

## Raw Address

**Smart contract addresses on TON consist of two main components**: the **workchain ID** (a signed 32-bit integer) and the **account ID** (a 256-bit identifier, used in both existing chains).

TON supports creating up to 2^32 **workchains** (i.e., separate blockchains), each of which can be subdivided into up to 2^60 **shards** (used to parallelize code execution). Currently, there are two workchains: Masterchain and Basechain.

**Masterchain** is "the blockchain of blockchains"—its blocks contain additional information (latest block hashes) about all other chains in the system. **It has an ID of `-1`.**

**Basechain** is where most smart contracts exist and interact. It has significantly lower fees, so unless you need to do something highly specific, you would deploy your smart contracts to Basechain. **It has an ID of `0`.**

**The first part of the address** is the **workchain ID**, which is either `0` (Basechain) or `-1` (Masterchain).

> **Tip:** You can read more on this topic [here](https://docs.ton.org/v3/concepts/dive-into-ton/ton-blockchain/blockchain-of-blockchains).

**The second part of the address** is a **256-bit hash** (`SHA-256`) of its **initial code** and **initial state**. This means that if two smart contracts have the exact same code after compilation and the exact same values at the moment of deployment, they will have the same address.

> Which makes perfect sense if you think about it—there’s absolutely no reason to have two copies of a smart contract doing *exactly the same thing* with *exactly the same initial state*.

The two parts we discussed above are written one after the other, separated by a `:`, forming the **raw smart contract address**. For example, like this:

```
-1:fcb91a3a3816d0f7b8c2c76108b8a9bc5a6b7a55bd79f8ab101c52db29232260
```

> Uppercase letters (such as 'A', 'B', 'C', 'D', etc.) may be used in address strings instead of their lowercase counterparts (such as 'a', 'b', 'c', 'd', etc.).

## Address States

By now, you might be wondering: if a contract address can be calculated before deployment, can messages be sent to an empty address? Absolutely! In fact, **this address will have—and may change—its state even before anything is deployed there**. Moreover, it can continue to change *after* a smart contract is deployed at that address.

Let's take a look at the possible state values:

- `nonexist`: No accepted transactions have occurred on this address, meaning it doesn't contain any data (or the contract was deleted).
- `uninit`: The address has a balance and meta info but does not yet contain smart contract code or persistent data. It enters this state, for example, when it was in a `nonexist` state and another address sent tokens to it.
- `active`: The address has smart contract code, persistent data, and balance. In this state, it can execute logic during transactions and modify its persistent data. An address enters this state when it was `uninit` and receives an incoming message with a `state_init` parameter.
- `frozen`: The address cannot perform any operations. This state contains only two hashes of the previous state (code and state cells, respectively). When an address's storage fee exceeds its balance, it enters this state. There is a [project](https://unfreezer.ton.org) that can help unfreeze your contract if this happens, but the process can be challenging.

### Address States in Practice

Let's create a new project and use the Sandbox test framework to obtain smart contract addresses and their states, gaining a better understanding of what happens to them, why, and when.

Navigate to your TON projects directory, open a terminal window, and run this:

```bash
npm create ton@latest
```

Name the project whatever you like (e.g., `client-server` or `addresses`). Set the first contract name to `Client` (we will add a `Server` later), and choose the option to create an empty contract in Tolk.

Your input should look like this:

```
? Project name client-server
? First created contract name (PascalCase) Client
? Choose the project template An empty contract (Tolk)
```

As you probably remember from the earlier tutorials, we use Blueprint to create a project from a template. This template includes an empty contract (located at `contracts/client.tolk`), wrappers, scripts, and tests.

### `nonexist` State

Right now, we’re specifically interested in the tests. Unfortunately, we can't test for the `nonexist` state locally, as the `getContract` method in Sandbox *always* returns an instance of `SmartContract`, which has only the three other possible values in its `accountState.type`. In practice, the `nonexist` state represents the absence of any data at the address.

However, you can generate a valid random TON account address by combining a workchain ID (e.g., `0`) with a random SHA-256 hash. Then, search for it in a blockchain explorer like Tonviewer to confirm that it is in the `nonexist` state.

For example, the following address: `0:cbd5fedaafb6bf68024eb52d8d3a497c920cfe44cd269ed7e10126ef5a1d4466`. You can see that it has a `nonexist` state [here](https://tonviewer.com/EQDL1f7ar7a_aAJOtS2NOkl8kgz-RM0mntfhASbvWh1EZsK7).

> **Tip:** Replace the hash value with your own random SHA-256 hash, and you'll get a different address. It's *extremely unlikely* that you will generate the address of an existing contract.

> ⚠️ **Important!** You might have noticed that the address displayed in Tonviewer (or another service of your choice) is different: `EQDL1f7ar7a_aAJOtS2NOkl8kgz-RM0mntfhASbvWh1EZsK7` in this case. This is because it’s a *user-friendly* representation of the raw address. We will learn about these soon.

### `uninit` State

On a real blockchain, this state follows `nonexist` if someone sends funds to the address. As of the time of writing, in Sandbox, it is the default state of an "empty" address. So we can only test two traits of such an address:

1. The initial balance is zero.
2. Even an `uninit` address can have a positive balance.

Open `tests/Client.spec.ts` and take a look at the only test case there—the one named `'should deploy'`:

```typescript
it('should deploy', async () => {
    // the check is done inside beforeEach
    // blockchain and client are ready to use
});
```

It's empty because all of the deployment logic is inside the `beforeEach` function. By the time the test runs, our contract is already deployed, so it should be in the `active` state. However, we want to make it `uninit`.

Delete the comments inside the test case and update it to look like this (the test name has also been updated):

```typescript
it('should be `uninit` without deploy, with a zero balance [skip deploy]', async () => {
    const address = client.address;
    const contract = await blockchain.getContract(address);
    expect(contract.accountState?.type).toEqual('uninit');
    expect(contract.balance).toEqual(0n);
});
```

Here, we obtain the `client` contract address (it's calculated from its code and state), retrieve the contract at that address from the test blockchain, and expect its state to be `uninit`. We also expect the account balance to be 0, as no transactions have occurred yet.

If you run the tests now by executing

```
npx blueprint test
```

in the terminal window inside your project directory, you will see that this one fails—which is expected because there's no logic to skip deployment in `beforeEach`. There are several ways to do this; here, we’ll check for the presence of the `[skip deploy]` instruction in the test name to determine whether to skip deployment.

Update the `beforeEach` function to look like this:

```typescript
beforeEach(async () => {
    blockchain = await Blockchain.create();
    client = blockchain.openContract(Client.createFromConfig({}, code));
    deployer = await blockchain.treasury('deployer');

    if (expect.getState().currentTestName?.includes("[skip deploy]")) return;

    const deployResult = await client.sendDeploy(deployer.getSender(), toNano('0.05'));
    expect(deployResult.transactions).toHaveTransaction({
        from: deployer.address,
        to: client.address,
        deploy: true,
        success: true,
    });
});
```

The only line added here is `if (expect.getState().currentTestName?.includes("[skip deploy]")) return;`. It checks for the presence of `[skip deploy]` in the current test's name, and if it's found, the deployment code is not executed.

The tests will now pass:

```
 PASS  tests/Client.spec.ts
  Client
    ✓ should be `uninit` without deploy, with a zero balance [skip deploy] (72 ms)
```

Now, let's see what happens when someone sends TON to an account in the `uninit` state. Copy the previous test, paste it below, and make a few modifications so that the new one looks like this:

```typescript
it('should be `uninit` without deploy, with a positive balance after a transaction [skip deploy]', async () => {
    const address = client.address;
    await deployer.send({
        to: address,
        value: toNano(1),
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        bounce: false
    });
    const contract = await blockchain.getContract(address);
    expect(contract.accountState?.type).toEqual('uninit');
    expect(contract.balance).toEqual(toNano(1));
});
```

The difference here is that we send 1 TON to an `uninit` address (paying gas separately—i.e., from the sender's balance). The test expects the balance at the address to be exactly 1 TON (the balance is stored in nanotons, hence the `toNano` usage).

> You might have noticed the `bounce: false` line in the test above. We will cover what this means in the next part of this tutorial. For now, you can treat it as *"keep the funds I sent you, even if there was an error processing the request."*

Run the tests again, and they should both pass:

```
 PASS  tests/Client.spec.ts
  Client
    ✓ should be `uninit` without deploy, with a zero balance [skip deploy] (171 ms)
    ✓ should be `uninit` without deploy, with a positive balance after a transaction [skip deploy] (80 ms)
```

### `active` State

Let's write another test to check the state of a deployed smart contract address.

Add the following code below the previous test case:

```typescript
it('should be `active` after deploy, with a positive balance', async () => {
    const address = client.address;
    const contract = await blockchain.getContract(address);
    expect(contract.accountState?.type).toEqual('active');
    expect(contract.balance).toBeGreaterThan(0);
});
```

It looks almost identical to the first one, with three key differences:

1. Its name doesn't contain `[skip deploy]`.
2. It expects the state to be `active`.
3. It expects the balance to be greater than zero due to the deployment transaction, which includes some funds.

Since there's no `[skip deploy]` instruction in the test name, the `beforeEach` function will execute the deployment steps, ensuring that all tests pass:

```
 PASS  tests/Client.spec.ts
  Client
    ✓ should be `uninit` without deploy, with a zero balance [skip deploy] (171 ms)
    ✓ should be `uninit` without deploy, with a positive balance after a transaction [skip deploy] (80 ms)
    ✓ should be `active` after deploy, with a positive balance (77 ms)

```

### `frozen` State

As of the time of writing, Sandbox won't mark a smart contract as `frozen` if it lacks funds to pay for its storage (as would happen on a real blockchain). Instead, it will simply reduce its balance to zero while keeping the contract active.

> **Tip:** Read more about fees (particularly the storage fee) [here](https://docs.ton.org/v3/documentation/smart-contracts/transaction-fees/fees-low-level#storage-fee).

However, we can at least write a test to ensure that the contract balance decreases over time—though not before the contract receives a message to trigger payments.

Add this test below the previous ones:

```typescript
it('should reduce balance over time', async () => {
    const address = client.address;
    let contract = await blockchain.getContract(address);

    // Get and save the contract balance immediately after deployment.
    const balanceAfterDeploy = contract.balance;
    expect(balanceAfterDeploy).toBeGreaterThan(0n);

    // Advance the time by one year.
    blockchain.now = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

    // The contract balance should still be the same as after deployment.
    // This is because the payment phase hasn't been triggered yet.
    contract = await blockchain.getContract(address);
    expect(contract.balance).toEqual(balanceAfterDeploy);

    // Send a message to trigger the storage fee payment.
    await deployer.send({
        to: address,
        value: toNano('0'),
        sendMode: SendMode.PAY_GAS_SEPARATELY,
    });

    // Now the contract balance should be 0.
    // On a real blockchain, the balance would become negative, and the contract would be frozen.
    contract = await blockchain.getContract(address);
    expect(contract.balance).toEqual(0n);
});
```

Read the comments in the test above—they explain what happens at each step.

Before running it, reduce the amount of TON sent to the contract during deployment in `beforeEach` to a smaller value so that it is consumed by fees more quickly.

For example, update the deployment code like this:

```typescript
const deployResult = await client.sendDeploy(deployer.getSender(), toNano('0.0001'));
```

Run the tests again, and all should pass. If the last one doesn’t (e.g., due to changed fees in Sandbox), log the balance values to the console and check: it’s likely that you need to either reduce the amount of TON sent during deployment or increase the time elapsed on the test blockchain.

Run the tests once again and ensure all are "green":

```
 PASS  tests/Client.spec.ts
  Client
    ✓ should be `uninit` without deploy, with a zero balance [skip deploy] (171 ms)
    ✓ should be `uninit` without deploy, with a positive balance after a transaction [skip deploy] (80 ms)
    ✓ should be `active` after deploy, with a positive balance (77 ms)
    ✓ should reduce balance over time (87 ms)

```

## Wrapping Up

So far, we've learned about **raw contract addresses** and **account states**. In the [second part](../2-2-addresses-and-states-2/README.md) of this tutorial, we will explore **user-friendly addresses**, their differences, and their roles in smart contract behavior.