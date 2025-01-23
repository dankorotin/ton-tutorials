fun onInternalMessage(myBalance: int, msgValue: int, msgFull: cell, msgBody: slice) {
    assert(msgBody.getRemainingBitsCount() >= 16, 9);

    var dataSlice = getContractData().beginParse();
    var total = dataSlice.loadUint(64);
    val toAdd = msgBody.loadUint(16);
    total += toAdd;
    var cellBuilder = beginCell();
    cellBuilder.storeUint(total, 64);
    val finalizedCell = cellBuilder.endCell();
    setContractData(finalizedCell);
}

get fun total() {
    return getContractData().beginParse().loadUint(64);
}