# Create and Deploy a Smart Contract

## Before We Begin

Here are the steps required to follow this tutorial.

**1. Install Node.js**

> **Tip:** (Skip this step if you already have it installed. Just make sure it's version 18 or later.)

On a Mac with [Homebrew](https://brew.sh):
```
brew install node
```
Otherwise: [download the installer](https://nodejs.org/en) from the official site.

**2. Choose an IDE**

We suggest [WebStorm](https://www.jetbrains.com/webstorm/) (it's the one we're using, free for non-commercial use) or [Visual Studio Code](https://code.visualstudio.com) (free).

**3. Add the Plugin/Extension for Tolk**

JetBrains IDEs (WebStorm, IDEA) [plugin](https://plugins.jetbrains.com/plugin/23382-ton) or VS Code [extension](https://marketplace.visualstudio.com/items?itemName=ton-core.tolk-vscode).

## Basic Concepts

A **smart contract** is a program running on the TON Blockchain via its [TVM](https://docs.ton.org/v3/documentation/tvm/tvm-overview) (TON Virtual Machine). It consists of **code** (TVM instructions) and **data** (persistent state) stored at a specific **address**. It also has a **balance**: some amount of currency used to pay for its existence and computations.

> The address is derived from the initial code and data, so it can be calculated prior to deployment. Moreover, if your code produces the exact same bytecode and data on deployment as another deployed contract, their addresses will be the same. You will most likely encounter this behavior if you don't change any significant parts of this tutorial's code: after deployment, you'll see that your "new" smart contract already has transactions and a non-zero total value.

Smart contracts on TON interact only by sending and receiving **messages** (unlike in EVM-based chains, where calling other contracts can be done during the process of code execution). This pattern is called [Actor](https://docs.ton.org/v3/concepts/dive-into-ton/ton-blockchain/blockchain-of-blockchains#single-actor).

The most important takeaway here is that **there's no way to predict how long it will take a message from one actor (i.e., smart contract) to reach another**, nor **how long it will take for the response to arrive**. However, **the delivery of messages is strictly guaranteed**.

## Tutorial Goals

In this tutorial, we'll create a simple **counter contract**, deploy it to testnet, and increase and query the current total value. The logic will be very basic: it increments a counter by a specified number from an **internal message** and saves the total in its persistent data.

> **Internal messages** are those sent between blockchain entities and cannot be sent from off-chain. **These methods consume gas** (blockchain currency paid for transactions, code execution, and storage).

A dedicated `get` method will be implemented and explained later in the tutorial: it allows querying the current total.

> **`Get` methods are free** (meaning no gas is paid), as they don't mutate the blockchain state and are handled off-chain.

Contracts can also receive **external messages**, which are somewhat similar to internal ones but come from outside the blockchain. We will cover handling these in a later tutorial.

> **For those with some experience in TON development:** We will not be checking for the existence of opcodes and flags in the incoming message to keep this tutorial simple, but we will add an `assert` to ensure there is enough data to convert to a number.

## Creating the Project

We will use [Blueprint](https://github.com/ton-community/blueprint) to simplify and streamline the setup, so open a terminal window (a separate one or in your IDE), navigate to the directory with your TON projects, and run the following command:

```bash
npm create ton@latest
```

This command creates a project from template. Make the following choices: name the project whatever you like (e.g., `my-project`), first contract: `Counter`, and choose the template: `An empty contract (Tolk)`. Your console should look like this:

```bash
? Project name my-project
? First created contract name (PascalCase) Counter
? Choose the project template An empty contract (Tolk)
```

Open the project directory (named `my-project` or whatever name you chose) and take a look at the contents. Depending on the IDE you're using, there may be more or fewer directories, but for now, we'll focus on just one: `contracts`. Navigate to it, and inside you'll see the only file: `counter.tolk`. Open it in the IDE and take a look at the code.

## Reading the Data

The only **function** generated for you by Blueprint will look like this:
```tolk
fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {

}
```

> If you're coming from the FunC world, you may be surprised by the absence of the `impure` specifier. In Tolk, all functions are [impure by default](https://docs.ton.org/v3/documentation/smart-contracts/tolk/tolk-vs-func/in-detail). You can explicitly annotate a function as `pure`, and then impure operations are forbidden in its body (exceptions, global modifications, calling non-pure functions, etc.).

As mentioned above, a smart contract has some **code** (functions like this) and **data** (stored in so-called cells). Let's deal with the former first. This particular function (part of your contract's **code**) is the one called when a smart contract is accessed **on-chain** (for example, by another smart contract) by sending a **message**. This type of message is called **internal**, hence the function name. Let's take a closer look at its parameters, especially the last two: `msgFull` and `msgBody`.

- `msgFull` has the type `cell`. **Cells are data structures that can hold up to 1023 bits of information and have links to up to 4 other cells.** This allows for creating "trees" of cells, potentially storing as much data as you need. To read data from cells, you need to begin parsing them.
- `msgBody` is a `slice`. **A slice is a representation of a cell that you can read data from.** It reads data bit by bit, and some methods (in particular, the one we will soon use) return the data that has been read and "subtract" it from the slice. This means that when you read data from it later, it will start from the bit following the last one you read. For example, if a slice contains `101110` and you read the first three bits (`101`), it will then contain only the last three bits: `110`.

Your smart contract also has its own storage (**data**): a root cell stored in the so-called `c4` register (potentially having links to more cells if you need to store more than 1023 bits). Let's start by reading the data it consists of.

> **If you ever get confused, you can always open the `counter.tolk` file in this tutorial's repository and take a look at the final implementation.** The code there is commented in detail, helping you understand what's going on and why.

Add the following line inside the function:
```tolk
var dataSlice = getContractData().beginParse();
```

**`var` means that this variable (`dataSlice`) is *mutable***, i.e., **it can (and will) be changed.** `getContractData()` reads the root cell in `c4` (it's still a `cell` at this point), and `beginParse()` makes it a `slice` we can read from. **This is exactly the reason we declared it as mutable: the slice will be modified as we read data, mutating the variable.**

Now, add the following line of code below the previous one:

```tolk
var total = dataSlice.loadUint(64);
```

**This variable is also mutable, but for a different reason: we will increase it by the value received in the message body.** Calling `loadUint(64)` on the slice we read in the first line makes it process data bit by bit, reading up to **64 bits** (if available) and converting them to an *unsigned integer* (which cannot be negative).

> **64 bits** means the maximum value is **2⁶⁴ - 1**—a *very, very* large number (**18,446,744,073,709,551,615**). We subtract one since the first possible value is **0**, not **1**.

Finally, we get to reading the value passed in the message body. Add the following line:

```tolk
val toAdd = msgBody.loadUint(16);
```

**`val` here means that the `toAdd` variable is *immutable*, i.e., it will be initialized once and will not change.** `msgBody` is one of the function parameters we discussed above. It has the `slice` type, so we can read from it right away, unlike the contract data (a `cell`). **We expect the body to contain 16 bits of information that we treat as a 16-bit unsigned integer**, so we read it with `loadUint(16)` and assign it to `toAdd`.

> A **16-bit unsigned integer** has a maximum value of **2¹⁶ - 1 (65,535)**. You can, of course, use more bits (such as **32** or even **64**). The reason for choosing **16 bits** is that it ensures **a very long time before the counter reaches its maximum value**—a **64-bit unsigned integer** stored in the contract’s cell, which we read earlier. Later, we’ll write tests to illustrate this concept.

## Increasing the Counter

Your code should look like this at the moment:

```tolk
fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    var dataSlice = getContractData().beginParse();
    var total = dataSlice.loadUint(64);
    val toAdd = msgBody.loadUint(16);
}
```

We've read all the **data** we need (the current **counter value**, stored in a mutable variable `total`, and the **value to add**, stored in the immutable one—`toAdd`. Let's **increase the `total` and save it to the contract's persistent storage**. Add the following lines to your existing code:

```tolk
total += toAdd;

var cellBuilder = beginCell();
cellBuilder.storeUint(total, 64);
val finalizedCell = cellBuilder.endCell();
setContractData(finalizedCell);
```

Here's what happens here, step by step:
1. `total` gets **increased by the value of `toAdd`** (you could alternatively write it as `total = total + toAdd`).
2. **A cell builder** is created by calling `var cellBuilder = beginCell()`. `builder` is the third "flavor" of data representation, in addition to `cell` and `slice`. A `cell` **stores data**, a `slice` lets you **read** from it, and a `builder` lets you **create and modify data** that you will later "pack" as a `cell`. We declare it as a `var` because it will be mutated (i.e., some data will be stored in it, as shown in the next step).
3. Calling `cellBuilder.storeUint(total, 64)` **stores the `total` value as 64 bits** in the `builder` (the future `cell`).
4. `val finalizedCell = cellBuilder.endCell()` **"packs" the `builder` data into a `cell`** and declares an immutable variable of type `cell` (this is what you get by calling `endCell` on a `builder`).
5. Finally, `setContractData(finalizedCell)` **saves the data** (a `cell`) from `finalizedCell` into the **contract's storage** (replacing the `cell` from the `c4` register that we read from at the very beginning of the function).

## Checking the Input Data

By now, we have assumed that the internal messages the contract receives will contain valid data in the body (i.e., at least 16 bits of data that we will treat as a 16-bit integer). We can formalize this assumption as an **assertion** and **throw an exception** (i.e., halt the execution and return an error code) if the amount of data is not sufficient to proceed.

> **Remember:** Any code execution on TVM costs **gas** (essentially, money). Thus, **the earlier a faulty computation is interrupted, the less money you** (or the function's caller) **spend**.

Add this line of code at the very beginning of the function, above the line where we begin parsing the contract's data:

```tolk
assert(msgBody.getRemainingBitsCount() >= 16, 9);
```

Here are the details:
- **Declare an `assert` with two arguments**: the condition and the exception code.
- The **condition** is: “count the bits left in the message body and ensure the amount is 16 or more” (this method doesn't modify the slice).
- The **exception code** is **9**. You can choose any code you like, but it’s better to stick to conventions. This one can be found in the [TVM Whitepaper](https://ton-blockchain.github.io/docs/tvm.pdf) or the [TVM Exit Codes](https://docs.ton.org/v3/documentation/tvm/tvm-exit-codes) document and means **“Cell underflow. The read operation from slice primitive tried to read more bits or references than available.”**

If the condition ("at least 16 bits in the message body") is not satisfied, the code execution stops immediately and an exception with the code 9 is thrown.

> **Remember:** Codes 0 and 1 indicate **successful execution** in TVM!

## Getting the Current Total

The last thing we'll add is a `get` method to check the current value stored in the contract's persistent storage. Add this function below the previous one:

```tolk
get fun total() {
    return getContractData().beginParse().loadUint(64);
}
```

> You can also omit `fun` here: both `get total()` and `get fun total()` [are acceptable](https://docs.ton.org/v3/documentation/smart-contracts/tolk/tolk-vs-func/in-detail).

Note that here we use the same code as in the first function but write it in a single line and return the read value right away. Let's review what happens here:
1. `getContractData()` reads data from the contract's storage (a `cell` at this moment).
2. Calling `beginParse()` on the `cell` makes it a `slice`.
3. Finally, calling `loadUint(64)` on the `slice` reads the first 64 bits and converts them to an unsigned integer which we return.

## The Completed Contract

Here's what your code should look like at this stage:

```tolk
fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    assert(msgBody.getRemainingBitsCount() >= 16, 9);
    
    var dataSlice = getContractData().beginParse();
    var total = dataSlice.loadUint(64);
    val toAdd = msgBody.loadUint(16);
    total += toAdd;
    
    var cellBuilder = beginCell();
    cellBuilder.storeUint(total, 64);
    val finalizedCell = cellBuilder.endCell();
    setContractData(finalizedCell);
}

get fun total() {
    return getContractData().beginParse().loadUint(64);
}
```

At this point, you can open a terminal window and build your contract:
```bash
npx blueprint build
```

There should be no errors, but you can introduce some yourself to see how they look. For example, you could change `var dataSlice = getContractData().beginParse()` to `val` and see what happens when you build the contract.

<details>
  <summary>Click to reveal the spoiler!</summary>

> You will get an error pointing out that you're trying to mutate the immutable variable `dataSlice` when reading the unsigned integer in the next line, consequently modifying the slice.

</details>

## Test Network Deployment

Your first contract is ready to be deployed to a real blockchain! There's one made specifically for testing purposes: [testnet](https://docs.ton.org/v3/documentation/smart-contracts/getting-started/testnet). It's very similar to the "real" TON blockchain, but the currency here has no real-world value, and the data can be wiped at any moment. Other than that, there's no difference, so your smart contracts will behave just as they would on the production chain.

The first step is to get some test TON from the test faucet: [Testgiver TON Bot](https://t.me/testgiver_ton_bot). You will need a wallet on testnet to receive and spend the test TON; an app like Tonkeeper will allow you to use one. Alternatively, you can use the web-based wallet [here](https://wallet.ton.org/?testnet=true).

> **Important!** Creating a test wallet can be a confusing step for newcomers. A great article can help you overcome this obstacle if you encounter it: [Step-by-Step Guide for Working with Your First TON Wallet](https://tonhelloworld.com/01-wallet/).

> **Tip:** If you’re stuck at any step, refer to [this document](https://docs.ton.org/v3/documentation/smart-contracts/getting-started/testnet). It includes helpful information about the test network, wallets, and more.

### Wrappers

Go to the `wrappers` directory and open `Counter.ts`. It's a TypeScript file containing code that lets you interact with your contract. Let's take a closer look at its contents, particularly this function:

```typescript
export function counterConfigToCell(config: CounterConfig): Cell {
    return beginCell().endCell();
}
```

It's used later in the code to create the initial cell with data that will be created when the contract is deployed. We need to store 64 bits of data and start with zero, so modify the only line inside this function to look like this:

```typescript
return beginCell().storeUint(0, 64).endCell();
```

Find the `createFromConfig(config: ...)` function below. You will see that it uses the call to `counterConfigToCell(config: ...)` to initialize the contract's data. It then initializes and returns the newly created `Counter` object. We won't need to modify anything here.

Now, take a look at the function below it: `sendDeploy(provider: ...)`. It sends an internal message with an empty (for now) cell and some amount of TON to your contract upon deployment.

> **Note:** Don't worry—it will be test TON if you're deploying to testnet.

Let's modify the cell creation code in this function and send a zero 16-bit integer in it to avoid triggering the assertion we added before. Modify the `body: beginCell().endCell()` line to look like this:
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

### Scripts

Navigate to the `scripts` directory and open the only file there: `deployCounter`. It's a TypeScript file containing one function:

```typescript
export async function run(provider: NetworkProvider) {
    const counter = provider.open(Counter.createFromConfig({}, await compile('Counter')));
    await counter.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(counter.address);
}
```

The scripts in this directory can be run with a console command you will learn soon, but first, let's understand what this particular one does:
1. First, it creates and compiles the wrapper object we modified above.
2. Next, it calls the `sendDeploy(provider: ...)` method on it, essentially sending an internal message from your wallet with 0.05 TON attached to it.
3. Finally, it awaits the successful deployment.

Now it's finally time to deploy the contract! Open the terminal and run the following command:

```bash
npx blueprint run
```

It looks for the scripts in the `scripts` directory and executes their `run(provider: ...)` function. Since you only have one script (`deployCounter.ts`), there will be no prompts regarding what to run—that is the script being executed.

Follow the instructions (remember to choose **`testnet`** when offered a choice!) and select one of the options to complete the transaction. For example, if you're using **Tonkeeper**, you will need to scan the QR code that appears after selecting this option and confirm the transaction from your test wallet. You will receive a success message after a short while. If you don't, try again and pay close attention to the on-screen steps.

Successful deployment should end with a message like this:
```
Contract deployed at address EQAtcdYS2AsDEpNKFRmt9POvKWUB_WfNHbqzhCp3aP2uiOuQ
You can view it at https://testnet.tonscan.org/address/EQAtcdYS2AsDEpNKFRmt9POvKWUB_WfNHbqzhCp3aP2uiOuQ
```

> **Important!** Remember: if you didn't modify the methods in your smart contract in any significant way compared to the code from this tutorial (e.g., still expect a 16-bit unsigned integer, don't use flags, etc.), it will have the same address (as it's determined by the initial code and data). As a result, you may see transactions from other users when following the link.

You can use https://testnet.tonscan.org/ to check your contract's transactions, as well as your wallet's.

## Sending Messages

As you may remember, our smart contract can receive **internal** and **get** messages. We've already triggered the internal one once when we deployed the contract, but it passed `0` in its body. Here's how we did it: running the `deployCounter.ts` script called the `sendDeploy(provider: ...)` method in the wrapper (`Counter.ts` in the `wrappers` directory), which looks like this:

```typescript
async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
        value,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell().storeUint(0, 16).endCell(),
    });
}
```

As you can see, the value `0` is hardcoded in the `storeUint(0, 16)` call. We'd like to be able to pass an arbitrary value there to increase the total value stored in the contract. Copy the code above, paste it below the `sendDeploy(provider: ...)` function, and modify it to look like this:

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

> We could use this method during deployment instead by simply passing `0` to it. However, let's leave things as-is for now for the sake of clarity.

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

It's very similar to `deployCounter.ts`. The only difference is that it calls the `sendIncrement(provider: ...)` method, passing the value `42` (you can choose your own, of course), and doesn't wait for deployment.

Execute `npx blueprint run` in the console again, and this time you will be provided with a choice of two scripts: `deployCounter` and `sendIncrement`. Choose the latter and follow steps similar to those you performed during deployment (only now your wallet should already be connected if you used one). Remember to check for and confirm the transaction in your wallet.

If everything went well, your wallet's balance will decrease, and you will see the transaction in the explorer ([here](https://testnet.tonscan.org/address/EQAtcdYS2AsDEpNKFRmt9POvKWUB_WfNHbqzhCp3aP2uiOuQ) or at the address of your contract).

## Calling `get` Methods

Finally, let's add a way to call the `get` method on our smart contract and check the total! Add the following code below the `sendIncrement(provider: ...)` function in the wrapper:

```typescript
async getTotal(provider: ContractProvider) {
    const result = (await provider.get('total', [])).stack;
    return result.readBigNumber();
}
```

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

See you in the [next tutorial](../1-2-tests/README.md)! 👋