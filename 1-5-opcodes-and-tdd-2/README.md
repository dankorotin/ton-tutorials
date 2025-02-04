# Conditional Logic, Part 2: Handling Valid Opcodes

## Before We Begin

Here, we assume that you followed the previous part of this tutorial: [Conditional Logic, Part 1: Opcodes, Exceptions, and TDD](../1-4-opcodes-and-tdd-1/README.md).

> **This tutorial uses the code from the previous one, so we suggest you copy it to a separate directory and work there**.

## Tutorial Goals

In this part, we will finally handle the valid opcode values. Let's check our progress so far:

1. ✅ **Done.** If an incoming internal message has an empty body, do nothing.
2. ✅ **Done.** If an opcode cannot be parsed (i.e., the message body contains fewer than 32 bits), throw an exception.
3. If the `op` is `0`, the message is expected to include a plain-text or encrypted comment. For simplicity, we'll assume the message body contains at least one bit of information besides the `op`.
4. If the `op` is `1`, expect the next 16 bits of the body to contain an unsigned integer, parse it, and increment the total by its value (i.e., behave just as the contract does now).
5. If the `op` is `2`, reset the total (assign 0 to the 64-bit value stored in the contract data). No additional information is expected in the body for this case.
6. ✅ **Done.** If the `op` is anything else, throw an exception.

Looks like we're halfway there, so let's get to work!

## Simple Message With Comment

Opcode `0` is [expected to mean](https://docs.ton.org/v3/documentation/smart-contracts/message-management/internal-messages#simple-message-with-comment) a "simple transfer message with comment." It is expected to contain some data besides the opcode, so we assume there will remain at least one bit in the `msgBody` slice after we parse the opcode.

As before, let's start with the test.

```typescript
it('should properly handle the simple message', async () => {

});
```

We will need to send the "simple message" opcode along with some additional bits to the contract. First, let's define opcode constants to make the code more readable and easier to maintain. If you ever need to update the opcode value for a particular scenario, you'll only need to update it in one place. Add this below the `counterConfigToCell` function in the wrapper (`Counter.ts`):

```typescript
export const Opcode = {
    MESSAGE: 0,
    INCREASE: 1,
    RESET: 2
};
```

Then, above the `sendIncrement` function inside the `Counter` class, add this function (we suggest placing it here so that the functions are ordered like the opcodes):

```typescript
async sendSimpleMessage(provider: ContractProvider, via: Sender, value: bigint, messageLength: number) {
    await provider.internal(via, {
        value,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell().storeUint(Opcode.MESSAGE, 32).storeUint(0, messageLength).endCell(),
    });
}
```

Here, we begin the cell with the `MESSAGE` opcode (equal to `0`) and add an unsigned integer `0` to it if `messageLength` is positive. Let's update the test and see what happens when we run it:

```typescript
it('should properly handle the simple message', async () => {
    const messageResult = await counter.sendSimpleMessage(deployer.getSender(), toNano('0.05'), 8);
    expect(messageResult.transactions).toHaveTransaction({
        from: deployer.address,
        to: counter.address,
        success: true,
    });
    expect(await counter.getTotal()).toEqual(0n);
});
```

The message is valid (it sends the supported opcode and has 8 bits of data in its body besides the opcode), but the test still fails because the contract lacks the logic to handle it. As a result, it treats the message as an unknown opcode and throws an exception. Let's fix this!

Update the contract to match the following code listing:

```tolk
const OP_MESSAGE = 0;
const OP_INCREASE = 1;
const OP_RESET = 2;

fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    val bodyBitsCount = msgBody.getRemainingBitsCount();

    if (bodyBitsCount == 0) {
        return;
    }

    assert(bodyBitsCount >= 32, 9);

    // By convention, the first 32 bits of incoming message is the `op`.
    val op = msgBody.loadMessageOp();

    if (op == OP_MESSAGE) {
        return;
    }

    throw 0xffff;
}

get fun total() {
    return getContractData().beginParse().loadUint(64);
}
```

We've added `op` constants to the contract as well to avoid mistakes from using numerical codes. Additionally, the contract now reads the `op` from `msgBody` (`val op = msgBody.loadMessageOp();`) and checks if its value is equal to `OP_MESSAGE` (which is equal to `0`). If it is, the contract simply returns. Run the test again, and it will pass!

But what about a simple message *without* data? Let's add a test case to check if it fails (as it should):

```typescript
it('should throw if a simple message has no data', async () => {
    const messageResult = await counter.sendSimpleMessage(deployer.getSender(), toNano('0.05'), 0);
    expect(messageResult.transactions).toHaveTransaction({
        from: deployer.address,
        to: counter.address,
        success: false,
        exitCode: 100,
    });
    expect(await counter.getTotal()).toEqual(0n);
});
```

Here, we pass `0` for the data length parameter and expect the contract to throw an exception with the code `100`. We've chosen this value as it's outside the convention bounds for TVM exit codes, and we need distinct exception values to know exactly what went wrong. You may have already guessed that the test will fail, as there's no check for the data length yet, so this message is treated as valid by the contract.

Add the following `assert` to the contract code to finish implementing the "simple message" logic and make the test pass:

```tolk
...
if (op == OP_MESSAGE) {
    assert(msgBody.getRemainingBitsCount() > 0, 100);
    return;
}
...
```

The only line added here is `assert(msgBody.getRemainingBitsCount() > 0, 100);`, which simply throws an exception with the code `100` if there's no data left in the message body. We don't read the data here, as handling the actual message comments is outside the scope of this tutorial.

Run the tests, and ensure both simple message ones are now "green":

```
✓ should deploy (180 ms)
✓ should throw an exception if cannot parse an opcode (87 ms)
✓ should throw an exception if cannot handle an opcode (99 ms)
✓ should properly handle the simple message (94 ms)
✓ should throw if a simple message has no data (90 ms)
✕ should increase the total (98 ms)
✕ should increase the total by the correct amount when 17 bits of 65,536 are passed (93 ms)
✕ should increase the total by the correct amount when 32 bits of 4,294,967,295 are passed (86 ms)
```

## Incrementation

Now, let's deal with the tests that already exist but fail because the contract logic changed (which is a good sign in TDD, mind you!). The tests themselves are perfectly fine; we just need to update the code to support the new conditions.

First, take a look at the `sendIncrement` function in the wrapper:

```typescript
async sendIncrement(provider: ContractProvider, via: Sender, value: bigint, incrementValue: bigint, bits: number = 16) {
    await provider.internal(via, {
        value,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell().storeUint(incrementValue, bits).endCell(),
    });
}
```

As you can see, it only lacks sending the opcode. Modify the `body` code to include it:

```typescript
beginCell().storeUint(Opcode.INCREASE, 32).storeUint(incrementValue, bits).endCell()
```

But there's still no logic in the contract to handle this scenario, so let's add it. Add another `if` (or `else if`, if you prefer) to the contract's internal message handling logic, below the `OP_MESSAGE` case:

```tolk
if (op == OP_INCREASE) {
    var dataSlice = getContractData().beginParse();
    var total = dataSlice.loadUint(64);
    val toAdd = msgBody.loadUint(16);
    total += toAdd;
    var cellBuilder = beginCell();
    cellBuilder.storeUint(total, 64);
    val finalizedCell = cellBuilder.endCell();
    setContractData(finalizedCell);
    return;
}
```

This is exactly the code we used in the contract before to increase the total value stored! All of the tests will now pass, but we need to add another one: we lack the check for the number of bits left to parse in `msgBody`. Add the test case for it:

```typescript
it('should throw if cannot parse the increment value', async () => {
    const messageResult = await counter.sendIncrement(deployer.getSender(), toNano('0.05'), 42n, 15);
    expect(messageResult.transactions).toHaveTransaction({
        from: deployer.address,
        to: counter.address,
        success: false,
        exitCode: 101,
    });
    expect(await counter.getTotal()).toEqual(0n);
});
```

For now, it will fail. Update the condition in the contract to assert there are at least 16 bits to convert to an unsigned integer:

```tolk
    if (op == OP_INCREASE) {
        assert(msgBody.getRemainingBitsCount() >= 16, 101);
        
        var dataSlice = getContractData().beginParse();
        var total = dataSlice.loadUint(64);
        val toAdd = msgBody.loadUint(16);
        total += toAdd;
        var cellBuilder = beginCell();
        cellBuilder.storeUint(total, 64);
        val finalizedCell = cellBuilder.endCell();
        setContractData(finalizedCell);
        return;
    }
```

In the test, we pass `42` as only 15 bits of data, so the contract's `assert` triggers and throws the code `101`, which we expect to see in the failed transaction. All of the tests are "green" again!

## Reset

The last bit of logic left to implement is resetting the total value. As before, start with the test:

```typescript
it('should reset', async () => {
    await counter.sendIncrement(deployer.getSender(), toNano('0.05'), 42n);
    expect(await counter.getTotal()).toEqual(42n);

    await counter.sendOpcode(deployer.getSender(), toNano('0.05'), Opcode.RESET);
    expect(await counter.getTotal()).toEqual(0n);
});
```

We already have the wrapper method to send the opcode, but the test will fail on the last `expect` because the total value is never reset. The only thing left is to update the contract to implement this logic.

Add the third `if`:

```tolk
if (op == OP_RESET) {
    setContractData(beginCell().storeUint(0, 64).endCell());
    return;
}
```

And that's it! Upon receiving the `OP_RESET` opcode, the contract will simply overwrite the stored value with a 64-bit unsigned integer with the value of `0`.

Run the tests once more and enjoy the utter and complete "greenness":

```
 PASS  tests/Counter.spec.ts
  Counter
    ✓ should deploy (184 ms)
    ✓ should throw an exception if cannot parse an opcode (85 ms)
    ✓ should throw an exception if cannot handle an opcode (84 ms)
    ✓ should properly handle the simple message (93 ms)
    ✓ should throw if a simple message has no data (101 ms)
    ✓ should increase the total (96 ms)
    ✓ should increase the total by the correct amount when 17 bits of 65,536 are passed (94 ms)
    ✓ should increase the total by the correct amount when 32 bits of 4,294,967,295 are passed (84 ms)
    ✓ should throw if cannot parse the increment value (88 ms)
    ✓ should reset (88 ms)
```

## Wrapping Up

Congratulations on learning how to use opcodes to alter your contract's behavior! You’ve also mastered how to ~~drive yourself crazy~~ write clean and tested code with TDD. See you in the [next one](../2-1-addresses-and-states-1/README.md)!