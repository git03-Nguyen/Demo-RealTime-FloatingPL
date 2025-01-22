const normalize = (value, digits) => {
  return parseFloat(parseFloat(value).toFixed(digits));
};

export { normalize };