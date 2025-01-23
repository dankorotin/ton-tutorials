# Opcodes and Test-Driven Development

## Before We Begin

Here, we assume that you followed the first two parts of this tutorial: [Creating and Deploying a Smart Contract](../1-creation-and-deployment/README.md) and [Testing Smart Contract Behavior](../2-tests/README.md). This tutorial also uses the code from the previous one, so we suggest you copy it to a separate directory and work there.

## Tutorial Goals

As you already know, there's **only one function to handle incoming internal messages**, and there seem to be no parameters in it responsible for altering the contract behavior. How, then, can we implement logic more complex than the simple counter we currently have? Finding this out is our first goal today.

Additionally, we have already used the test suite to ensure the correct behavior of the contract under different scenarios. But so far, we’ve followed the order: "write code first, test later." What if we reverse the order? It turns out that this way of software development (**Test-Driven Development**, or TDD) has many advantages. It forces you to think about exactly what you need to implement to make the tests pass and helps you write clean and testable code. Getting familiar with this approach is our second goal.

## Altering the Contract Behavior

Take a look at the signature of the function responsible for handling the internal messages (you will find it in `contracts/counter.tolk`):

```tolk
fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice)
```

There seem to be no obvious candidates for passing any conditions to make the contract behave in a certain way. But today’s hero hides in plain sight: it’s the **message body** (`msgBody`, a parameter of type `slice`)! You can pass any data in it, so if you decide which part of it represents the instructions to determine what to do, you can implement any logic, no matter how complex and intricate it might be.

There's a [convention](https://docs.ton.org/v3/documentation/smart-contracts/message-management/internal-messages#internal-message-body) to begin the message body with so-called **opcodes**, or `op`s, if it has any data at all. **An opcode is a 32-bit unsigned integer** and is usually followed by a 64-bit `query_id`. `query_id`s are used when a contract sends messages to other contracts, and we will cover them in a later tutorial.

For now, let's focus on the opcodes. There are [expectations](https://docs.ton.org/v3/documentation/smart-contracts/message-management/internal-messages) (**you really should read this right now** if you want to better understand the next steps!) on how their values should be handled. You can, of course, invent your own rules, but in general, your smart contracts are expected to follow these conventions. Here's the plan for today's contract improvements:

1. If an incoming internal message has no opcode or the `op` is `0`, do nothing (such messages can be used to top up the contract balance).
2. If the `op` is `1`, expect the next 16 bits of the body to contain an unsigned integer, parse it, and increment the total by its value (i.e., behave just as it does now).
3. If the `op` is `2`, reset the total (assign 0 to the 64-bit value stored in the contract data).
4. If the `op` is anything else, throw an exception.

## Test-Driven Development

In the previous tutorials, we wrote the code *before* testing it. Now, we will reverse the order and start with the tests. The goal is to have them "red" (i.e., failing) in the beginning and gradually make them all "green" (i.e., passing). This approach forces the developer to write only the necessary, testable code.

The (*only?*) drawback here is that it makes the process of software development somewhat longer. But in return, you will (*most likely*) get cleaner code that is guaranteed to work as intended (*if you covered all of the scenarios, of course* 😉). You will also be (*almost*) sure that if you introduce new behavior and it breaks something in the existing one, the tests will let you know.

> If you want, you can run `npx blueprint test` in the console (make sure you're in the project's directory) to ensure all tests are currently "green."

Open the file containing the tests (`tests/Counter.spec.ts`) and take a look at the existing test cases. The first one, named `'should deploy'`, contains no code, as the contract is deployed before each test in the `beforeEach` method. So it's there just in case deployment fails. We want our deployment message to trigger the first scenario of today's plan by sending an empty body (no opcode at all, and it shouldn't increment the total value).

Open the contract wrapper (`wrappers/Counter.ts`) and find the function responsible for deployment:

```typescript
async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
        value,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell().storeUint(0, 16).endCell(),
    });
}
```

To send a message with an empty `body`, simply remove the `storeUint(0, 16)` part so that an empty cell is passed to it: `beginCell().endCell()` (here, you create a builder, don’t pass any data to it, and finalize the cell, passing it to the `body` parameter). The contract expects the body to contain at least 16 bits of data; otherwise, it throws an exception, so all of the tests will fail. Run them to ensure they do.