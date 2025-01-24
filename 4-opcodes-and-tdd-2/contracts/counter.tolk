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
        assert(msgBody.getRemainingBitsCount() > 0, 100);
        return;
    }

    throw 0xffff;
}

get fun total() {
    return getContractData().beginParse().loadUint(64);
}