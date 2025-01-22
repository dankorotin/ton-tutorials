# Testing and Adapting Contract Behavior

## Before We Begin

Here we assume that you followed the first tutorial ([Creating and Deploying a Smart Contract](../1-create-and-deploy/README.md)) and understand the concepts of messages, working with data, and the deployment process. If you don't, please follow the first tutorial and come back when you're comfortable with these concepts. This tutorial also uses the code from the previous one, so we suggest you copy it to a separate directory and work there.

## Tutorial Goals

After writing, deploying, and “testing” (by sending messages) your first smart contract, you might have some questions, such as:
1.	Is there a way to test the code *before* deploying it?
2.	How can I make the contract handle internal messages *in more than one way*?

These are exactly the questions we'll tackle today! Let's start with the tests.

## Testing with Sandbox

[Sandbox](https://github.com/ton-org/sandbox) is a package that allows you to emulate arbitrary TON smart contracts, send messages to them, and run `get` methods as if they were deployed on a real network. It is installed by default with all projects created using Blueprint (just as we did in the previous tutorial).

It may come as a surprise, but you already have a test generated for you! Navigate to the `tests` directory (this is where you will create all your test files) and open `Counter.spec.ts`. The amount of code there can be a bit overwhelming, so let's take a closer look at it before writing anything.

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

`it(...` creates a test closure with the following parameters: a name (`'should deploy'` in this case), an optional function (the one with the comments in it), and an optional timeout (none here). Since the deployment result is checked before each test, this test case is empty.

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

The contract you created in the previous tutorial can receive internal messages and has a `get` method returning the current value stored in its persistent storage. We've already tested it by sending messages and calling methods on the testnet, but this process is tedious and time-consuming. Let's take a look at a much faster way of doing it.

Add the following method below the existing `it(...`:

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
2. The first lines calls the internal message handler function in the contract, sending `0.05` TON and the value to increment the counter by: `42n` (`n` means this number is a `BigInt`). The sender here is `deployer`, which is created before each test. As the contract is deployed with its stored value set to `0`, we then call the `get` method and expect it to return `42n` (`0 + 42`).
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

---

# 🚧 Work In Progress 🚧