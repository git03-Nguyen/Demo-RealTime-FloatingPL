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

export { parseType, parseCalcMode };