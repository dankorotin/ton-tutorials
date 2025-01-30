# Smart Contract Addresses

## Before We Begin

To understand and successfully complete this tutorial, you should be familiar with the basic concepts of the TON blockchain, such as smart contracts and messages. If you aren’t, we suggest completing the [Basics and Testing](../README.md#-1-basics-and-testing) section first.

## Tutorial Goals

In this tutorial, we'll begin creating a simple **client-server** relationship between two smart contracts. In the following parts, we will explore how contracts can communicate and trigger different functionality, as well as potential pitfalls when implementing such interactions.

But first, we'll start with the essentials: what types of smart contract addresses exist on TON, how they are calculated, and the lifecycle of both the address itself and the smart contract residing at that address.

## Raw Address

**Smart contract addresses on TON consist of two main components**: the **workchain ID** (a signed 32-bit integer) and the **account ID** (a 256-bit address for both of the currently existing chains).

TON supports creating up to 2^32 **workchains** (i.e., separate blockchains), each of which can be subdivided into up to 2^60 **shards** (used to parallelize code execution). Currently, there are two workchains: Masterchain and Basechain.

**Masterchain** is "the blockchain of blockchains"—its blocks contain additional information (latest block hashes) about all other chains in the system. It has an ID of `-1`.

**Basechain** is where most smart contracts exist and interact. It has significantly lower fees, so unless you need to do something highly specific, you would deploy your smart contracts to Basechain. It has an ID of `0`.

> **Tip:** You can read more on this topic [here](https://docs.ton.org/v3/concepts/dive-into-ton/ton-blockchain/blockchain-of-blockchains).

The second part of the address is a 256-bit hash (SHA-256) of its **initial code** and **initial state**. This means that if two smart contracts have the exact same code after compilation and the exact same values at the moment of deployment, they will have the same address.

Which makes perfect sense if you think about it—there’s absolutely no reason to have two copies of a smart contract doing *exactly the same thing*.

The two parts we discussed above are written one after the other, separated by a `:`, forming the **raw smart contract address**. For example, like this:

```
-1:fcb91a3a3816d0f7b8c2c76108b8a9bc5a6b7a55bd79f8ab101c52db29232260
```

> Uppercase letters (such as 'A', 'B', 'C', 'D', etc.) may be used in address strings instead of their lowercase counterparts (such as 'a', 'b', 'c', 'd', etc.).

## Address States

By now, you might be thinking: if a contract address can be calculated prior to deployment, does that mean messages can be sent to an empty address? Absolutely! In fact, this address will have **states** even before anything is deployed there. Moreover, it can even change state *after* a smart contract is deployed at that address.

Let's take a look at the possible state values:

- `nonexist`: No accepted transactions have occurred on this address, meaning it doesn't contain any data (or the contract was deleted).
- `uninit`: The address has a balance and meta info but does not yet contain smart contract code or persistent data. It enters this state, for example, when it was in a `nonexist` state and another address sent tokens to it.
- `active`: The address has smart contract code, persistent data, and balance. In this state, it can execute logic during transactions and modify its persistent data. An address enters this state when it was `uninit` and receives an incoming message with a `state_init` parameter.
- `frozen`: The address cannot perform any operations. This state contains only two hashes of the previous state (code and state cells, respectively). When an address's storage fee exceeds its balance, it enters this state. There is a [project](https://unfreezer.ton.org) that can help unfreeze your contract if this happens, but the process can be challenging.