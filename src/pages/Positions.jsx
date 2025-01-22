import React, { useEffect, useState } from "react";
import { getAccountSummary, getPositionList } from "../utils/call-apis";
import { normalize } from "../utils/math-utils";
import { parseCalcMode, parseType } from "../utils/parse-strings";


const Positions = ({ connection }) => {
  const [ticks, setTicks] = useState({});
  const [prevTicks, setPrevTicks] = useState({});
  const [changedTicks, setChangedTicks] = useState([]);

  const [balance, setBalance] = useState(0);
  const [equity, setEquity] = useState(0);
  const [usedMargin, setUsedMargin] = useState(0);
  const [freeMargin, setFreeMargin] = useState(0);

  const [groups, setGroups] = useState([]);

  useEffect(() => {

    // Fetch the account summary
    async function fetchAccountSummary() {
      const data = await getAccountSummary();
      setBalance(data.balance);
      setEquity(data.equity);
    };

    fetchAccountSummary();

    // Fetch the position list
    async function fetchPositionList() {
      connection.on("1", (symbol, datetime, bid, ask, last = 0, volume = 0) => {
        if (!last) { last = 0; volume = 0; }
        setTicks((prevTicks) => ({
          ...prevTicks,
          [symbol]: { datetime, bid, ask, last, volume },
        }));
      });

      const data = await getPositionList();
      setGroups(data);
      const symbolNames = data.map((group) => group.symbolName);
      const conversionSymbols = data
        .map((group) => group.positions
          .map((position) => position.plCalculation?.conversionSymbol))
        .flat()
        .filter((symbol) => symbol);
      const subscriptions = [...symbolNames, ...conversionSymbols];
      console.log("Subscribing to:", subscriptions);
      connection.invoke("Subscribe", subscriptions);
    }

    fetchPositionList();

    return () => {
      connection.off("1");
      connection.invoke("Unsubscribe", Object.keys(ticks));
      setGroups([]);
    };
  }, []);

  // Log which ticks are changing
  useEffect(() => {
    setPrevTicks(ticks);
    const changedTicks = Object.keys(ticks).filter((symbol) => {
      return prevTicks[symbol] && (
        prevTicks[symbol].bid !== ticks[symbol].bid ||
        prevTicks[symbol].ask !== ticks[symbol].ask ||
        prevTicks[symbol].last !== ticks[symbol].last
      );
    });
    setChangedTicks(changedTicks);
  }, [ticks]);

  useEffect(() => {

    setGroups((prevGroups) =>
      prevGroups.map((group) => {
        // Only re-render the position if the position.symbolName has changed
        const symbolName = group.symbolName;
        if (!changedTicks.includes(symbolName)) {
          return group;
        }

        // Check if the position support conversion
        if (group.positions[0].plCalculation === null) {
          group.positions.forEach((position) => {
            position.profit = "NaN";
          });
          return group;
        }

        // Update the profit of each position
        group.positions = group.positions.map((position) => {

          const conversionSymbol = position.plCalculation.conversionSymbol;
          const calculationMode = position.plCalculation.calculationMode;
          const contractSize = position.contractSize;

          const currentPrice = position.type === 0 ? ticks[symbolName].bid : ticks[symbolName].ask;
          let profit = position.type === 0 // TODO: based on calculation mode
            ? position.volume * contractSize * (currentPrice - position.openPrice)
            : position.volume * contractSize * (position.openPrice - currentPrice);

          if (conversionSymbol && ticks[conversionSymbol]) {
            position.plCalculation.exchangeRate = position.type === 0
              ? ticks[conversionSymbol].bid
              : ticks[conversionSymbol].ask;
          }

          // TODO: Update the formulas
          const exchangeRate = position.plCalculation.isReversed ?
            1 / position.plCalculation.exchangeRate :
            position.plCalculation.exchangeRate;

          profit = profit * exchangeRate;
          position.profit = profit;
          position.closedPrice = currentPrice;
          return position;
        });

        return group;
      }));

    const totalPL = groups.reduce((acc, group) => acc + group.positions.reduce((acc, position) => {
      if (!position.profit || position.profit === "NaN") {
        return acc;
      }
      return acc + Number(position.profit) + Number(position.swap) + Number(position.commission);
    }, 0), 0);
    console.log("Total PL:", totalPL);
    const equity = balance + totalPL;
    setEquity(normalize(equity, groups[0]?.positions[0]?.digitsCurrency));

  }, [ticks]);

  useEffect(() => {

  }, [groups]);

  return (
    <div>
      <h1>Subscribed symbols</h1>
      {Object.keys(ticks).length > 0 ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '8px' }}>Symbol</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>DateTime</th>
              <th style={{ border: '1px solid black', padding: '8px', width: '200px' }}>Bid</th>
              <th style={{ border: '1px solid black', padding: '8px', width: '200px' }}>Ask</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>Last</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>Volume</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(ticks).map(([symbol, { datetime, bid, ask, last, volume }]) => (
              <tr key={symbol}>
                <td style={{ border: '1px solid black', padding: '8px' }}>{symbol}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>
                  {new Date((datetime - 7200) * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' })}
                </td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{bid}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{ask}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{last}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{volume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Waiting for ticks...</p>
      )}

      <h1>Opened Positions</h1>
      {groups.length > 0 ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid black", padding: "8px" }}>ID</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Type</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Calc Mode</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Volume / ContractSize</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Open Price</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Close Price</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Exchange Rate</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Profit By Market?</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Swap / Commission / Profit</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Total Profit</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, index) => (
              <React.Fragment key={group.symbolName}>
                {/* Render Group Summary */}
                <tr style={{ backgroundColor: "#f1f1f1" }}>
                  <td colSpan="3" style={{ border: "", padding: "8px", fontWeight: "bold" }}>Group: {group.symbolName}</td>
                  <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold" }}>{group.positions.reduce((acc, position) => acc + position.volume, 0)} / {group.positions[0].contractSize}</td>
                  <td colSpan="4" style={{ border: "", padding: "8px", fontWeight: "bold" }}></td>
                  <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold" }}>{normalize(group.positions.reduce((acc, position) => acc + Number(position.profit), 0), group.positions[0].digitsCurrency)}</td>
                  <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold" }}>{normalize(group.positions.reduce((acc, position) => acc + Number(position.profit) + Number(position.swap) + Number(position.commission), 0), group.positions[0].digitsCurrency)}</td>
                  <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold" }}></td>
                </tr>
                {/* Render Nested Positions */}
                {group.positions.map((position) => (
                  <tr key={position.positionId}>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{position.positionId}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{parseType(position.type)}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{parseCalcMode(position.calculationMode)}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{position.volume} / {position.contractSize}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{position.openPrice}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{position.closedPrice ? normalize(position.closedPrice, position.digits) : "NaN"}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>
                      {position.plCalculation ? normalize(position.plCalculation.exchangeRate, position.digits) : "NaN"}
                      {position.plCalculation?.conversionSymbol ? ` - ${position.plCalculation.conversionSymbol}` : ""}
                    </td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{position.plCalculation?.isForexProfitByMarket ? "True" : "False"}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{normalize(position.swap, position.digitsCurrency)} / {normalize(position.commission, position.digitsCurrency)} / <strong>{normalize(position.profit, position.digitsCurrency)}</strong></td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{normalize(Number(position.profit) + Number(position.swap) + Number(position.commission), position.digitsCurrency)}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{new Date(position.actionTime).toLocaleString()}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>

        </table>
      ) : (
        <p>Waiting for positions...</p>
      )}

      <h1>Other Statistics</h1>
      <p>Balance: {balance}</p>
      <p>Equity: {equity}</p>
      <p>Used Margin: {usedMargin}</p>
      <p>Free Margin: {usedMargin}</p>

    </div>
  );
};

export default Positions;
