# Testing Smart Contracts

## Before We Begin

Here we assume that you followed the first tutorial ([Create and Deploy, Part 1: Implementing Logic](../1-1-create-and-deploy-1/README.md)) and understand the concepts of messages, working with data, and the deployment process ([Create and Deploy, Part 2: Deploying and Testing](../1-2-create-and-deploy-2/README.md)). If you don't, please follow the first tutorial and come back when you're comfortable with these concepts.

> **This tutorial uses the code from the previous one, so we suggest you copy it to a separate directory and work there**.

## Tutorial Goals

After writing, deploying, and “testing” (by sending messages) your first smart contract, you might have some questions, such as: **"Is there a way to test the code *before* deploying it?"** This is exactly the question we'll tackle today!

## Testing with Sandbox

[Sandbox](https://github.com/ton-org/sandbox) is a package that allows you to emulate arbitrary TON smart contracts, send messages to them, and run `get` methods as if they were deployed on a real network. It is installed by default with all projects created using Blueprint (just as we did in the previous tutorial).

It may come as a surprise, but you already have a test generated for you! Navigate to the `tests` directory (this is where you will create all your test files) and open `Counter.spec.ts`. The amount of code there can be a bit overwhelming, so let's take a closer look at it before writing anything.

## Deployment Test

Below the imports, you will see the `describe` block. Sandbox uses [Jest](https://jestjs.io) for testing, and you can find the `describe` details [here](https://jestjs.io/docs/api#describename-fn). This block is purely optional but helps you organize your tests into groups.

Inside the `describe` block, we have some variables and methods. Let's take a look at them in small chunks, starting with the first four lines of code:

```typescript
let code: Cell;

beforeAll(async () => {
    code = await compile('Counter');
});
```

Here are the details:
1. `let code: Cell;` declares a variable that will contain the contract's code.
2. `beforeAll(async () ...` is a method that runs once before all the tests.
3. Inside it, the `code` variable is assigned the compiled code of the smart contract for later use.

Below this is a rather large section of code. Let's take a look at it now:

```typescript
let blockchain: Blockchain;
let deployer: SandboxContract<TreasuryContract>;
let counter: SandboxContract<Counter>;

beforeEach(async () => {
    blockchain = await Blockchain.create();
    counter = blockchain.openContract(Counter.createFromConfig({}, code));
    deployer = await blockchain.treasury('deployer');

    const deployResult = await counter.sendDeploy(deployer.getSender(), toNano('0.05'));

    expect(deployResult.transactions).toHaveTransaction({
        from: deployer.address,
        to: counter.address,
        deploy: true,
        success: true,
    });
});
```

Let's break it down:
1. First, three variables are declared (these can be used in all of your test cases). `blockchain` is an instance of the blockchain emulator where you can deploy your contract, send messages, and more. `deployer` is a `TreasuryContract` that will deploy your contract (it has a lot of TON to test any behavior involving payments; its role is similar to your wallet's when you deploy a contract), and `counter` is the smart contract you wrote in the previous tutorial, created from the wrapper.
2. The `beforeEach(async () ... ` method is called before each test, creating new `blockchain`, `counter`, and `deployer` instances to ensure a clean state so that tests won't affect each other.
3. Then, the `deployResult` constant is initialized with the result of the deployment attempt.
4. Finally, the `expect` function is used to check that the `deployResult.transactions` array contains a transaction matching the one declared in the `toHaveTransactions` matcher.

Now, let's take a look at the final lines of the file—the only test case:

```typescript
it('should deploy', async () => {
    // the check is done inside beforeEach
    // blockchain and counter are ready to use
});
```

`it(...` is a test case function with the following parameters: a name (`'should deploy'` in this case), an optional function (the one with the comments in it; you can omit it to make the test case pending and provide the implementation later, e.g., `it('should deploy');`), and an optional timeout (none here). Since the deployment result is checked before each test, this test case is empty.

It's time to run the tests and see if they pass. Run this command in the terminal window inside your project's directory:

```bash
npx blueprint test
```

The only test will run and should return success:

```
 PASS  tests/Counter.spec.ts
  Counter
    ✓ should deploy (184 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        1.645 s
Ran all test suites.
```

But what exactly is tested here? Take a look at this line of code from the `beforeEach`:

```typescript
const deployResult = await counter.sendDeploy(deployer.getSender(), toNano('0.05'));
```

It calls the `sendDeploy` method from the wrapper, which includes the following line constructing the message body:

```typescript
body: beginCell().storeUint(0, 16).endCell()
```

The cell created here satisfies the `assert` condition in the contract, so the contract has a successful transaction upon deployment. How can we introduce an error here? One way would be to use fewer bits than the contract expects (say, 8). Modify this line (e.g., like this: `body: beginCell().storeUint(0, 8).endCell()`) and run the tests again.

After confirming that the test indeed fails, restore the modified line in the wrapper, and let's add more tests!

## Testing the Contract Logic

The contract you created in the previous tutorial can receive internal messages and has a `get` method returning the current value stored in its persistent storage. We've already tested it by sending messages and calling methods on testnet, but this process is tedious and time-consuming. Let's take a look at a much faster way of doing it.

Add the following method below the existing `it(...` function:

```typescript
it('should increase the total', async () => {
    await counter.sendIncrement(deployer.getSender(), toNano('0.05'), 42n);
    expect(await counter.getTotal()).toEqual(42n);
    
    const johnDoe = await blockchain.treasury('johndoe');
    await counter.sendIncrement(johnDoe.getSender(), toNano('0.05'), 1337n);
    expect(await counter.getTotal()).toEqual(1379n);
});
```

Here's what happens here:
1. We created another test case with the name `'should increase the total'` and a closure with the code to execute every time the test is run.
2. The first line calls the internal message handler function in the contract, sending `0.05` TON and the value to increment the counter by: `42n` (`n` means this number is a `BigInt`). The sender here is `deployer`, which is created before each test. As the contract is deployed with its stored value set to `0`, we then call the `get` method and expect it to return `42n` (`0 + 42`).
3. Then we introduce another sender (`johnDoe`) to ensure any contract can send messages to our contract, not just its deployer. The last two lines are similar to the first two, except the sender now is `johnDoe` and the number to increase the counter by is `1337n`. Before the message is handled, the total is `42n`, so we expect it to be `1379n` afterward (`42 + 1337`).

Run the tests again, and you should see a similar result:

```
 PASS  tests/Counter.spec.ts
  Counter
    ✓ should deploy (180 ms)
    ✓ should increase the total (96 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.652 s, estimated 2 s
```

Now, two test cases were executed, and both succeeded. Let's add another one...

## Testing the Assertion

So far, we've only written tests for the intended behavior. Earlier in this tutorial, we manually triggered the `assert` in our contract by passing an insufficient number of bits to it. Now, it's time to write a test case for this scenario. The `assert` in the smart contract (`contracts/counter.tolk`) looks like this:

```tolk
assert(msgBody.getRemainingBitsCount() >= 16, 9);
```

It expects the message body to contain at least 16 bits and will throw an exception with code `9` if it doesn't. We need a way to send an internal message from the test suite with an altered body size. There are several ways to approach this task, but we'll use a straightforward approach by slightly modifying the `sendIncrement` method in the wrapper (`Counter.ts`).

Open the file, find the function, and add one more parameter to it: `bits: number = 16`. Then, use this parameter inside the `body` construction code:

```typescript
async sendIncrement(provider: ContractProvider, via: Sender, value: bigint, incrementValue: bigint, bits: number = 16) {
    await provider.internal(via, {
        value,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell().storeUint(incrementValue, bits).endCell(),
    });
}
```

Let's take a closer look at the changes:
1. The parameter we added has a **default value** of `16`, meaning you can omit it in calls, and `bits` will be initialized with this value.
2. `storeUint(incrementValue, bits)` now uses `bits` to define its length instead of the hardcoded `16`.

These changes won't affect the current tests, as `bits` will have the default value `16` in all calls (it's omitted everywhere this method is used). Now that we have control over the message body, let's add another test case to the `Counter.spec.ts`, just below the last one:

```typescript
it('should throw an exception if body is less than 16 bits long', async () => {
    const callResult = await counter.sendIncrement(deployer.getSender(), toNano('0.05'), 42n, 15);
    expect(callResult.transactions).toHaveTransaction({
        from: deployer.address,
        to: counter.address,
        success: false,
        exitCode: 9,
    });
});
```

As you can see, the call to `sendIncrement` now has one more argument: `15`. This will make the body 1 bit shorter than expected, triggering the `assert`. This is why the transaction is expected to have an `exitCode` with the value of `9`. Run the tests and ensure this case also reports success.

## Testing Larger Values

So far, we've tested expected scenarios where the value sent to the contract is within the expected bounds, as well as an erroneous scenario where there's not enough data to parse. There's one more group of scenarios left: those where a caller sends a value exceeding 16 bits in the message body. Let's cover these with tests, too.

As the contract only uses the first 16 bits of the data, we expect that the maximum value the counter is increased by is `2^16 - 1`, i.e., 65,535, regardless of the value sent.

Create one more test case, and let's fill it with the code step by step to better understand what's going on:

```typescript
it('should increase the total by the correct amount when 17 bits of 65,536 are passed', async () => {
    const largeValue: bigint = 65536n;
    console.log(largeValue.toString(2));
});
```

Here, we initialize the `largeValue` variable with a value just 1 above the maximum value we expect the total to increase by. If you run the tests now, you will see its binary representation (logged to the console in the second line of code):

```
...
  console.log
    10000000000000000
...
```

The binary representation of 65,536 is `1` followed by sixteen `0`s. Let's pass it as 17 bits inside the message body. Add the following lines to the test case:

```typescript
await counter.sendIncrement(deployer.getSender(), toNano('0.05'), largeValue, 17);
expect(await counter.getTotal()).toEqual(32768n);
```

Why do we expect the total to increase by 32,768 (it was 0 before we sent the message), not 65,535 (the maximum increase value) or 65,536 (the value we sent)? The reason is that we sent 17 bits to the contract: `10000000000000000`. It read only the first 16: `1000000000000000` (`1` followed by fifteen `0`s). And this is the binary representation of 32,768!

Now, let's send a larger value to it, with the binary representation of all `1`s. Say, `2^32 - 1`, which is 4,294,967,295 (the largest 32-bit unsigned integer) and represented in binary as `11111111111111111111111111111111` (thirty-two `1`s).

Add yet another test case with the following code:

```typescript
it('should increase the total by the correct amount when 32 bits of 4,294,967,295 are passed', async () => {
    await counter.sendIncrement(deployer.getSender(), toNano('0.05'), 4294967295n, 32);
    expect(await counter.getTotal()).toEqual(65535n);
});
```

Here, we send 32 `1`s, of which only the first 16 are used. This is the binary representation of 65,535 (the largest 16-bit unsigned integer). As you can see, even very large values can't violate the limitation we've set by restricting the amount to increase the total to 16 bits of data.

## Wrapping Up

You made it! Now you have a very important tool in your skill set: automated testing. It will not only save you a ton of time testing your contracts' logic but also help you write better code with more confidence. In the [next tutorial](../1-4-opcodes-and-tdd-1/README.md), we'll explore this further as we employ the power of Test-Driven Development!