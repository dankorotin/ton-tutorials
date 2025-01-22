# Testing and Adapting Contract Behavior

## Before We Begin

Here we assume that you followed the first tutorial ([Creating and Deploying a Smart Contract](1-create-and-deploy/README.md)) and understand the concepts of messages, working with data, and the deployment process. If you don't, please follow the first tutorial and come back when you're comfortable with these concepts. This tutorial also uses the code from the previous one, so we suggest you copy it to a separate directory and work there.

## Tutorial Goals

After writing, deploying, and "testing" (by sending messages) your first smart contract, you may have some questions, namely these:

1. Is there a way to test the code *before* deploying it?
2. How can I make the contract handle internal messages in more than one way?

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
1. First, three variables are declared (these can be used in all of your test cases). `blockchain` is an instance of the blockchain emulator where you can deploy your contract, send messages, and more. `deployer` is a `Treasury` contract that will deploy your contract (it has a lot of TON to test any behavior involving payments), and `counter` is the smart contract you wrote in the previous tutorial, created from the wrapper.

---

# 🚧 Work In Progress 🚧