const parseType = (type) => {
  switch (type) {
    case 0:
      return "Buy";
    case 1:
      return "Sell";
    default:
      return "Unknown";
  }
};

const parseCalcMode = (calcMode) => {
  switch (calcMode) {
    case 1:
      return "Forex";
    case 2:
      return "CFD";
    case 3:
      return "CFD Leverage";
    case 4:
      return "Forex No Leverage";
    default:
      return "Unknown";
  }
};

const parseIsForexByMarket = (isForexByMarket) => {
  switch (isForexByMarket) {
    case false:
      return "No";
    case true:
      return "Yes";
    case null:
      return "";
    default:
      return "";
  }
};

const parseFreeMarginMode = (marginMode) => {
  switch (marginMode) {
    case 1:
      return "FreeMarginNotUsePL";
    case 2:
      return "FreeMarginUsePL";
    case 3:
      return "FreeMarginProfit";
    case 4:
      return "FreeMarginLoss";
    default:
      return "Undefined";
  }
};

export { parseType, parseCalcMode, parseIsForexByMarket, parseFreeMarginMode };