# Your first smart contract

A smart contract is a program running on the TON Blockchain via its [TVM](https://docs.ton.org/v3/documentation/tvm/tvm-overview) (TON Virtual Machine). It consists of code (TVM instructions) and data (persistent state) stored at a specific address.

> This address is derived from the initial code and data, so it can be calculated prior to deployment. Moreover, if your code produces the exact same bytecode and data on deployment as another deployed contract, their addresses will be the same. You will most likely encounter this behavior if you don't change any significant parts of this tutorial's code: after deployment, you'll see that your "new" smart contract already has transactions and a non-zero total value.

In the following tutorial, we'll create a simple counter contract, deploy it to the testnet, and query for the current total value. The logic will be very basic: it increments a counter by a specified number from an internal message and saves the total in its persistent data.

> Internal messages are the ones sent between blockchain entities and cannot be sent from off-chain. These methods consume gas (blockchain currency that's paid for transactions, code execution, and storage).

A dedicated `get` method (implemented and explained later in the tutorial) allows querying the current total.

> `Get` methods are free, as they don't mutate the blockchain state and are handled off-chain.

For those with some experience in TON development: we will not be checking for the existence of opcodes and flags in the incoming message to keep this tutorial simple, but we will add an `assert` to ensure there is enough data to convert to a number.

## Creating the project

We will use [Blueprint](https://github.com/ton-community/blueprint) to simplify and streamline the setup, so open a terminal window (a separate one or in your IDE), navigate to the directory with your TON projects, and run the following command:

```
npm create ton@latest
```

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
