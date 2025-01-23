const powOf10 = {
  0: 1,
  1: 10,
  2: 100,
  3: 1000,
  4: 10000,
  5: 100000,
  6: 1000000,
}

const normalize = (value, digits) => {
  const factor = powOf10[digits];
  return Math.round(value * factor) / factor;
};

const calculateMargin = (initialMargin, maintainanceMargin, calcMode, volume, contractSize, leverage, openPrice) => {
  if (initialMargin == null && maintainanceMargin == null) {
    switch (calcMode) {
      case 1: // Forex
        return volume * contractSize / leverage;
      case 2: // CFD
        return volume * contractSize * openPrice;
      case 3: // CFD Leverage
        return volume * contractSize * openPrice / leverage;
      case 4: // Forex No Leverage
        return volume * contractSize;
      default:
        return NaN;
    }
  }

  const fixedMargin = maintainanceMargin ?? initialMargin;
  switch (calcMode) {
    case 1: case 3: // Forex, CFD Leverage
      return volume * fixedMargin / leverage;
    default:
      return volume * fixedMargin;
  }
}

export { normalize, calculateMargin };