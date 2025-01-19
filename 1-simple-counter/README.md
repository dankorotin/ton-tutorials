# Your first smart contract

A smart contract is a program running on the TON Blockchain via its [TVM](https://docs.ton.org/v3/documentation/tvm/tvm-overview) (TON Virtual Machine). It consists of code (TVM instructions) and data (persistent state) stored at a specific address.

> This address is derived from the initial code and data, so it can be calculated prior to deployment. Moreover, if your code produces the exact same bytecode and data on deployment as another deployed contract, their addresses will be the same. You will most likely encounter this behavior if you don't change any significant parts of this tutorial's code: after deployment, you'll see that your "new" smart contract already has transactions and a non-zero total value.

In the following tutorial, we'll create a simple counter contract, deploy it to the testnet, and query for the current total value. The logic will be very basic: it increments a counter by a specified number from an internal message and saves the total in its persistent data.

> Internal messages are the ones sent between blockchain entities and cannot be sent from off-chain. These methods consume gas (blockchain currency that's paid for transactions, code execution, and storage).

A dedicated `get` method (implemented and explained later in the tutorial) allows querying the current total.

> `Get` methods are free (meaning no gas is paid), as they don't mutate the blockchain state and are handled off-chain.

For those with some experience in TON development: we will not be checking for the existence of opcodes and flags in the incoming message to keep this tutorial simple, but we will add an `assert` to ensure there is enough data to convert to a number.

## Creating the project

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

The only function generated for you by Blueprint will look like this:
```tolk
fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {

}
```

[//]: TODO: (As you only have one script &#40;`deployCounter.ts`&#41; there will be no prompts regarding what to run, but that is the script being executed. In particular, this command...)

# 🚧 Work in progress 🚧 #

# Counter

## Project structure

-   `contracts` - source code of all the smart contracts of the project and their dependencies.
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts.

## How to use

### Build

`npx blueprint build` or `yarn blueprint build`

### Test

`npx blueprint test` or `yarn blueprint test`

### Deploy or run another script

`npx blueprint run` or `yarn blueprint run`

### Add a new contract

`npx blueprint create ContractName` or `yarn blueprint create ContractName`
