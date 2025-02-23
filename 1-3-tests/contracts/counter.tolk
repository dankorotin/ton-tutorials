// This is the internal message handler function.
// This type of message can only be sent between blockchain entities on TVM.
// https://docs.ton.org/v3/documentation/smart-contracts/message-management/sending-messages#types-of-messages
fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    // Throw an exception if there aren't enough bits in the message.
    // Here we expect it to be at least 16 bits long; otherwise throw an exception.
    // Throwing an exception is a way to let TVM and the caller know something went wrong.
    // The exception code (cell underflow) is from the list of TVM standard exit codes:
    // https://ton-blockchain.github.io/docs/tvm.pdf
    assert(msgBody.getRemainingBitsCount() >= 16, 9);

    // 1-1-create-and-deploy-1. Begin parsing the existing data storage of the contract (i.e., read the previously saved data).
    // The saved data here is a `cell` stored in `c4` register of TVM.
    // More on registers: https://docs.ton.org/v3/documentation/tvm/tvm-overview#control-registers
    // After we begin parcing a `cell` it becomes a `slice`.
    // More on types here (only FunC types doc exists at the time of writing,
    // but they're essentially the same under the hood):
    // https://docs.ton.org/v3/documentation/smart-contracts/func/docs/types#atomic-types
    var dataSlice = getContractData().beginParse();

    // 2. Read 64 bits of saved data and treat them as a 64-bit unsigned integer.
    var total = dataSlice.loadUint(64);

    // 3. Read the bit sequence from the incoming message body
    // and treat it as a 16-bit unsigned integer.
    val toAdd = msgBody.loadUint(16);

    // 4. Sum the existing total amount with the value from the message.
    // You could also write it like this: `total = total + toAdd;`
    total += toAdd;

    // 5. Make a `builder` (the only way to mutate a `cell`).
    var cellBuilder = beginCell();

    // 6. Save the new value of `total` as a 64-bit unsigned integer.
    cellBuilder.storeUint(total, 64);

    // 7. "Seal" the cell to prepare it for saving.
    val finalizedCell = cellBuilder.endCell();

    // 8. Now store the cell overwriting the old value (also a `cell`,
    // we read from it in steps 1-1-create-and-deploy-1 and 2) in `c4` register.
    setContractData(finalizedCell);
}

// This is a get method (lightweight and doesn't modify anything).
// These can be called by off-chain entities, like explorers.
// This one allows you to read the current state of the counter.
// You can also omit `fun` here and declare it as `get total() { ...`:
// https://docs.ton.org/v3/documentation/smart-contracts/tolk/tolk-vs-func/in-detail
get fun total() {
    // Note that here we use the same code as in steps 1-1-create-and-deploy-1 and 2, but write it in a single line
    // and return the read value right away.
    return getContractData().beginParse().loadUint(64);
}