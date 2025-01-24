# Opcodes and Test-Driven Development, Part 2

## Before We Begin

Here, we assume that you followed the previous part of this tutorial: [Opcodes and Test-Driven Development, Part 2](../3-opcodes-and-tdd-1/README.md).

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

Opcode `0` is [expected to mean](https://docs.ton.org/v3/documentation/smart-contracts/message-management/internal-messages#simple-message-with-comment) "simple transfer message with comment". It is expected to contain some data besides the opcode, so we assume there will remain at least one bit in the `msgBody` slice after we parse the opcode.