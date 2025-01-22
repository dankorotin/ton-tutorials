# TON Smart Contract Development with Tolk

Tolk is a smart contract development language for The Open Network (TON) blockchain, featuring a modern Kotlin-like syntax. Its compiler is a fork of the FunC compiler, so essentially, you get the same bytecode with a much friendlier syntax and fewer opportunities to make errors (see more on the differences and improvements [here](https://docs.ton.org/v3/documentation/smart-contracts/tolk/tolk-vs-func/in-detail)).

These tutorials reflect my journey into the depths of smart contract development for TON. Each one is a step-by-step guide, with code extensively commented in key areas to provide context and details. Welcome aboard! 🏴‍☠️

## Before you begin

### 1. Install Node.js

> (Skip this step if you already have it installed. Just make sure it's version 18 or later.)

On a Mac with [Homebrew](https://brew.sh):
```
brew install node
```
Otherwise: [download the installer](https://nodejs.org/en) from the official site.

### 2. Choose an IDE

I'd suggest [WebStorm](https://www.jetbrains.com/webstorm/) (it's the one I'm using, free for non-commercial use) or [Visual Studio Code](https://code.visualstudio.com) (free).

### 3. Add the plugin/extension for Tolk.

JetBrains IDEs (WebStorm, IDEA) [plugin](https://plugins.jetbrains.com/plugin/23382-ton) or VS Code [extension](https://marketplace.visualstudio.com/items?itemName=ton-core.tolk-vscode).

> ...And you're ready to rock! 🤘

# 👶 Smart Contract Basics and Testing

## 1. [Creating and Deploying a Smart Contract](1-create-and-deploy/README.md)

Create and deploy a smart contract, and send messages.

## 2. [Testing and Adapting Contract Behavior](2-tests-and-opcodes/README.md)

Alter the smart contract behavior with opcodes, test with Blueprint, and get a taste of Test-Driven Development (TDD)!

---

### ✍️ Feedback

Feel free to create issues and/or pull requests; I'll do my best to review them ASAP.
