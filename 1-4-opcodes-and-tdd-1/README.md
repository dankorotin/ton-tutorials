# Conditional Logic, Part 1: Opcodes, Exceptions, and TDD

## Before We Begin

Here, we assume that you followed the first two parts of this tutorial: [Create and Deploy, Part 1: Implementing Logic](../1-1-create-and-deploy-1/README.md) and [Testing Smart Contracts](../1-3-tests/README.md).

> **This tutorial uses the code from the previous one, so we suggest you copy it to a separate directory and work there**.

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

For now, let's focus on the opcodes. There are [expectations](https://docs.ton.org/v3/documentation/smart-contracts/message-management/internal-messages) (you should read this if you want to better understand the next steps) on how their values should be handled. You can, of course, invent your own rules, but in general, your smart contracts are expected to follow these conventions. Here's the plan for today's contract improvements:

1. If an incoming internal message has an empty body (and consequently no opcode), do nothing (such messages can be used to top up the contract balance).
2. If an opcode cannot be parsed (i.e., the message body contains fewer than 32 bits), throw an exception.
3. If the `op` is `0`, the message is expected to include a plain-text or encrypted comment. For simplicity, we'll assume the message body contains at least one bit of information besides the `op`. Handling comments is beyond the scope of today's tutorial, but you can challenge yourself by saving it to the persistent data (e.g., along with the total value) and reading it with a separate `get` method.
4. If the `op` is `1`, expect the next 16 bits of the body to contain an unsigned integer, parse it, and increment the total by its value (i.e., behave just as the contract does now).
5. If the `op` is `2`, reset the total (assign 0 to the 64-bit value stored in the contract data). No additional information is expected in the body for this case.
6. If the `op` is anything else, throw an exception.

## Test-Driven Development

In the previous tutorials, we wrote the code *before* testing it. Now, we will reverse the order and start with the tests. The goal is to have them "red" (i.e., failing) in the beginning and gradually make them all "green" (i.e., passing). This approach forces the developer to write only the necessary, testable code.

The (*only?*) drawback here is that it makes the process of software development somewhat longer. But in return, you will (*most likely*) get cleaner code that is guaranteed to work as intended (*if you covered all of the scenarios, of course* 😉). You will also be (*almost*) sure that if you introduce new behavior and it breaks something in the existing one, the tests will let you know.

> If you want, you can run `npx blueprint test` in the console (make sure you're in the project's directory) to ensure all tests are currently "green".

### Empty Message Body

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

How do we update the contract (`contracts/counter.tolk`) logic to handle this case? Easy: remove or comment out all of the code in the `onInternalMessage` function:

```tolk
fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    
}
```

Finally, modify the `'should deploy'` test case to check for the total value. Remember, we expect messages with no data in the body to not affect the stored value in any way:

```typescript
it('should deploy', async () => {
    expect(await counter.getTotal()).toEqual(0n);
});
```

Run the tests again, and now the first one will pass. Why? Because there's no logic left, and no exception is thrown regardless of the data (if any) in the message body. However, this test case only handles the first scenario: no data at all. We need the contract to also be able to parse and handle the opcodes.

### Preparing to Handle Opcodes

The contract logic we outlined at the beginning of this tutorial imposes the following restrictions on the data it receives: the body should contain either no data at all or at least 32 bits to be parsed as an opcode. To cover these conditions, the contract will need to perform the following:
1. Get the length of the message body in bits.
2. Check if it's either 0 (in which case, return without any further code execution) or greater than or equal to 32 (throw an exception if not).
3. Parse and handle the opcode, if possible.

This means we need to add two more test cases (the empty body is already covered by `'should deploy'`, and if we break anything, it will fail). The first one will expect the contract to throw an exception if an opcode cannot be parsed. Add it below the `'should deploy'` case:

```typescript
it('should throw an exception if cannot parse an opcode', async () => {
    
});
```

We need to be able to pass an opcode stored in the body as an unsigned integer of variable length in bits. In particular, for this test case, we need to store it as less than 32 bits. We already have a method in the wrapper that almost fits the requirements: `sendIncrement`. Copy it and paste it below the `sendDeploy` method. Then modify the pasted code to look like this:

```typescript
async sendOpcode(provider: ContractProvider, via: Sender, value: bigint, opcode: number, bits: number = 32) {
    await provider.internal(via, {
        value,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell().storeUint(opcode, bits).endCell(),
    });
}
```

Now we're ready to fill the test case with code:

```typescript
it('should throw an exception if cannot parse an opcode', async () => {
    const callResult = await counter.sendOpcode(deployer.getSender(), toNano('0.05'), 1000, 28);
    expect(callResult.transactions).toHaveTransaction({
        from: deployer.address,
        to: counter.address,
        success: false,
        exitCode: 9,
    });
});
```

Here, we pass the opcode `1000` (we only have 3 valid values: `0`, `1`, and `2`, so it's unlikely to ever reach `1000`) that gets saved as a `28`-bit unsigned integer. We use this value to avoid interfering with future tests that will handle valid opcodes (and later, we'll use it to test the "unsupported opcode" scenario). We expect the contract to throw an exception with the code `9` in this case.

Run the tests, and you will see this one fails. This is expected, as there's no logic to handle data parsing in the smart contract yet. Let's fix this! Open the smart contract (`contracts/counter.tolk`) and update the internal message handler:

```tolk
fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    val bodyBitsCount = msgBody.getRemainingBitsCount();

    if (bodyBitsCount == 0) {
        return;
    }

    assert(bodyBitsCount >= 32, 9);
}
```

First, we read the message size in bits. Then we either return if it's `0` (without doing anything) or check if it's at least `32`, throwing an exception with code `9` if it isn't. Both cases are handled by the first two test cases. Run the tests and ensure both are now "green"!

In fact, now *three* tests pass, as the one named `'should throw an exception if body is less than 16 bits long'` also triggers the same check in the contract. We don't need this test case anymore, so just remove it.

### Handling an Unsupported Opcode

Before we get to testing and adding the supported opcodes logic, let's first handle the last scenario we outlined earlier: an unsupported opcode. This refers to an opcode that *can* be parsed but *cannot* trigger any logic in the smart contract. We already have the method to send such an opcode, so add another test case below the previous one:

```typescript
it('should throw an exception if cannot handle an opcode', async () => {
    const callResult = await counter.sendOpcode(deployer.getSender(), toNano('0.05'), 1000);
    expect(callResult.transactions).toHaveTransaction({
        from: deployer.address,
        to: counter.address,
        success: false,
        exitCode: 65535,
    });
});
```

Here, we again pass the opcode `1000`, omitting the length in bits as it defaults to `32`, and expect the contract to throw an exception with code `65535`. This code is often used to indicate that the received opcode is unknown to the contract (see more details on the TVM exit codes [here](https://docs.ton.org/v3/documentation/tvm/tvm-exit-codes)).

This test, of course, will fail, as the contract doesn't yet throw the exception for this case. Open the contract and add the following line below the existing code in the `onInternalMessage` function:

```tolk
throw 0xffff;
```

`0xffff` is the hexadecimal representation of `65535` (you can use the decimal value if you prefer). Run the tests, and this case will turn "green":

```
 FAIL  tests/Counter.spec.ts
  Counter
    ✓ should deploy (182 ms)
    ✓ should throw an exception if cannot parse an opcode (82 ms)
    ✓ should throw an exception if cannot handle an opcode (83 ms)
    ✕ should increase the total (91 ms)
    ✕ should increase the total by the correct amount when 17 bits of 65,536 are passed (89 ms)
    ✕ should increase the total by the correct amount when 32 bits of 4,294,967,295 are passed (85 ms)
```

## Wrapping Up

Your smart contract should look like this now:

```tolk
fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    val bodyBitsCount = msgBody.getRemainingBitsCount();

    if (bodyBitsCount == 0) {
        return;
    }

    assert(bodyBitsCount >= 32, 9);

    throw 0xffff;
}

get fun total() {
    return getContractData().beginParse().loadUint(64);
}
```

You can also compare the tests and the wrapper to your implementation by taking a look at `tests/Counter.spec.ts` and `wrappers/Counter.ts` in this tutorial's files.

So far, we've covered 3 out of 6 scenarios outlined at the beginning of the tutorial, and it's been a rather long journey, so we'll split this one into two parts. In the [next one](../1-5-opcodes-and-tdd-2/README.md), we'll finally handle the valid opcodes!