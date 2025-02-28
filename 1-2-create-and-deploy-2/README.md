# Create and Deploy, Part 2: Deployment, Wrappers, Message Basics

## Before We Begin

Here we assume that you followed the [first part](../1-1-create-and-deploy-1/README.md) of this tutorial and understand the concepts of messages and working with data. If you don't, please follow the first part and come back when you're comfortable with these concepts.

> **This tutorial uses the code from the previous one, so we suggest you copy it to a separate directory and work there**.

Your first contract is ready to be deployed to a real blockchain! There's one made specifically for testing purposes: [testnet](https://docs.ton.org/v3/documentation/smart-contracts/getting-started/testnet). It's very similar to the "real" TON blockchain, but the currency here has no real-world value, and the data can be wiped at any moment. Other than that, there's no difference, so your smart contracts will behave just as they would on the production chain.

The first step is to get some test TON from the test faucet: [Testgiver TON Bot](https://t.me/testgiver_ton_bot). You will need a wallet on testnet to receive and spend the test TON; an app like Tonkeeper will allow you to use one. Alternatively, you can use the web-based wallet [here](https://wallet.ton.org/?testnet=true).

> 🛟 **Tip:** Creating a test wallet can be a confusing step for newcomers. This great article can help you overcome this obstacle if you encounter it: [Step-by-Step Guide for Working with Your First TON Wallet](https://tonhelloworld.com/01-wallet/).

> 🛟 **Tip:** If you’re stuck at any step, refer to [this document](https://docs.ton.org/v3/documentation/smart-contracts/getting-started/testnet). It includes helpful information about the test network, wallets, and more.

## Wrappers

Wrappers help you send **internal messages** (on-chain) to your smart contract address from your wallet contract. For example, if you connect your **wallet app** (an **off-chain** entity—say, Tonkeeper on your smartphone), Blueprint will call the app with a request to send a certain amount of TON to your smart contract address, along with some data. If you confirm the transaction, your wallet app will send an **external (off-chain to on-chain) message** via an API to your **wallet smart contract**. It will be signed with your private key, so the wallet smart contract "knows" it can trust the received request. The wallet smart contract then sends the message (containing the data and the TON amount you requested to transfer) to **your smart contract address**.

> 🛟 **Tip:** It may sound overwhelming right now, but don't worry: we'll get to using this functionality shortly, so you'll experience all the steps yourself. The key takeaway here is that **wrappers help you use your wallet to send messages to your smart contract**.

Go to the `wrappers` directory and open `Counter.ts`. It's a TypeScript file containing code that lets you interact with your contract. Let's take a closer look at its contents, particularly this function:

```typescript
export function counterConfigToCell(config: CounterConfig): Cell {
    return beginCell().endCell();
}
```

It's used later in the code to create the **initial cell with data** that will be created when the contract is deployed. We need to store 64 bits of data and start with zero, so modify the only line inside this function to look like this:

```typescript
return beginCell().storeUint(0, 64).endCell();
```

Find the `createFromConfig(config: ...)` function below. You will see that it uses the call to `counterConfigToCell(config: ...)` to initialize the contract's data. It then initializes and returns the newly created `Counter` object. We won't need to modify anything here.

Now, take a look at the wrapper function below it: `sendDeploy(provider: ...)`. This function is responsible for deploying your smart contract. Blueprint will “pack” your contract code and data into a structure called a “bag of cells” (BOC), calculate the address based on this data, and send a request to your wallet to send this data (along with the amount of TON you specified) to the calculated address when you call the function.

> **Note:** Don’t worry—it will be test TON if you’re deploying to testnet.

Let’s update the data cell creation code in this function to store a zero 16-bit integer in it (the initial counter value). Modify the `body: beginCell().endCell()` line to look like this:

```typescript
body: beginCell().storeUint(0, 16).endCell(),
```

Here's how your wrapper should look by now:
```typescript
import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type CounterConfig = {};

export function counterConfigToCell(config: CounterConfig): Cell {
    return beginCell().storeUint(0, 64).endCell();
}

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
            body: beginCell().storeUint(0, 16).endCell(),
        });
    }
}
```

## Scripts

Navigate to the `scripts` directory and open the only file there: `deployCounter`. It's a TypeScript file containing one function:

```typescript
export async function run(provider: NetworkProvider) {
    const counter = provider.open(Counter.createFromConfig({}, await compile('Counter')));
    await counter.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(counter.address);
}
```

The scripts in this directory can be run with a console command you'll learn soon. First, let's understand what this particular script does:

1. It compiles the smart contract.  
2. Next, it calls the `sendDeploy(provider: ...)` method of the wrapper, effectively sending an internal message from your wallet contract with the contract code, initial data, and 0.05 TON attached to the calculated address. 
3. Finally, it awaits the successful deployment.

Now, it's finally time to deploy the contract! Open the terminal and run the following command:

```bash
npx blueprint run
```

It looks for the scripts in the `scripts` directory and executes their `run(provider: ...)` function. Since you only have one script (`deployCounter.ts`), there will be no prompts regarding what to run.

Follow the instructions (remember to choose **`testnet`** when offered a choice!) and select one of the options to complete the transaction. For example, if you're using **Tonkeeper**, you will need to scan the QR code that appears after selecting this option and confirm the transaction from your wallet app. You will receive a success message in the console after a short while. If you don't, try again and pay close attention to the on-screen steps.

Successful deployment should end with a message like this:

```
Contract deployed at address EQAtcdYS2AsDEpNKFRmt9POvKWUB_WfNHbqzhCp3aP2uiOuQ
You can view it at https://testnet.tonscan.org/address/EQAtcdYS2AsDEpNKFRmt9POvKWUB_WfNHbqzhCp3aP2uiOuQ
```

> **Important!** Remember: if you didn't modify the methods in your smart contract in any significant way compared to the code from this tutorial (e.g., still expect a 16-bit unsigned integer, don't use flags, etc.), it will have the same address (as it's determined by the initial code and data). As a result, you may see transactions from other users when following the link.

You can use https://testnet.tonscan.org/ to check your contract's transactions, as well as your wallet's.

## Sending Messages

As you may recall, a smart contract can receive **internal** and **external** messages. We've already triggered an internal message once when we deployed the contract, passing `0` as the initial counter value in its body.

Here's how we did it: running the `deployCounter.ts` script called the `sendDeploy(provider: ...)` method in the wrapper (`Counter.ts` in the `wrappers` directory), which looks like this:

```typescript
async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
        value,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell().storeUint(0, 16).endCell(),
    });
}
```

Blueprint then sent a request to your wallet app. You confirmed the transaction, so the wallet app sent an **external** message to your **wallet smart contract** on testnet, which, in turn, sent an **internal** message to the address calculated based on the initial code and data.

Now, we'd like to be able to pass an arbitrary value to increase the total counter value stored in the contract. Copy the code above, paste it below the `sendDeploy(provider: ...)` function, and modify it to look like this:

```typescript
async sendIncrement(provider: ContractProvider, via: Sender, value: bigint, incrementValue: bigint) {
    await provider.internal(via, {
        value,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell().storeUint(incrementValue, 16).endCell(),
    });
}
```

Here's the breakdown of what's different in this one:

1. It's named `sendIncrement` and has an additional parameter: `incrementValue: bigint`. This allows us to pass a value to increase the total by.
2. When constructing the body, we now use `incrementValue` instead of the hardcoded `0`.

Now, navigate to the `scripts` directory and create a new file named `sendIncrement.ts`. Paste this code into it:

```typescript
import { compile, NetworkProvider } from '@ton/blueprint';
import { toNano } from '@ton/core';
import { Counter } from '../wrappers/Counter';

export async function run(provider: NetworkProvider) {
    const counter = provider.open(Counter.createFromConfig({}, await compile('Counter')));
    await counter.sendIncrement(provider.sender(), toNano('0.05'), 42n);
}
```

It's very similar to `deployCounter.ts`. The difference is that it calls the `sendIncrement(provider: ...)` method, passing the value `42` (you can choose your own, of course), and doesn't trigger the deployment process.

Execute `npx blueprint run` in the console again, and this time you will be provided with a choice of two scripts: `deployCounter` and `sendIncrement`. Choose the latter and follow steps similar to those you performed during deployment (only now your wallet should already be connected if you used one). Remember to check for and confirm the transaction in your wallet app.

If everything went well, your wallet's balance will decrease, and you will see the transaction in the explorer ([here](https://testnet.tonscan.org/address/EQAtcdYS2AsDEpNKFRmt9POvKWUB_WfNHbqzhCp3aP2uiOuQ) or at the address of your contract).

## Calling Get Methods

Finally, let's add a way to call the get method on our smart contract and check the total! Add the following code below the `sendIncrement(provider: ...)` function in the wrapper:

```typescript
async getTotal(provider: ContractProvider) {
    const result = (await provider.get('total', [])).stack;
    return result.readBigNumber();
}
```

Get methods are executed off-chain, so they don't consume any gas: no messages are sent, and the request is executed on a TON node that has access to the chain state. They're sent via an API and generally cost nothing to execute when called infrequently (as in testing).

> **Important!** You might have noticed that the methods in the wrapper start with `send` and `get`. Stick to this convention for wrapper methods that send messages and call `get` methods.

In the function above, we call the `total` method of the smart contract by its name and read the result as a number. It will be logged to the console in the script you will write next.

Navigate to the `scripts` directory and create another file named `getTotal.ts`. Paste this code into it:

```typescript
import { compile, NetworkProvider } from '@ton/blueprint';
import { Counter } from '../wrappers/Counter';

export async function run(provider: NetworkProvider) {
    const counter = provider.open(Counter.createFromConfig({}, await compile('Counter')));
    console.log('Current total:', await counter.getTotal());
}
```

The first line of the function in this one is the same as in the other two, and the second one calls the wrapper method we've just added and logs the result to the console. Let's test it!

Execute `npx blueprint run` in the console once again, and this time choose `getTotal`. You won't need to pay anything, as **`get` methods are free to execute**. You should see something like this in the console as the result:

```
Current total: 98387n
```

## Wrapping Up

Congratulations on finishing the first step of this exciting journey! 🥳

See you in the [next tutorial](../1-3-tests/README.md)! 👋
