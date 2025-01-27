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