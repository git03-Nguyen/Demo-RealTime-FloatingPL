import React, { useEffect, useState } from "react";
import { getAccountSummary, getPositionList } from "../utils/call-apis";
import { calculateMargin, normalize } from "../utils/math-utils";
import { parseCalcMode, parseFreeMarginMode, parseIsForexByMarket as parseIsForexPLByMarket, parseType } from "../utils/parse-strings";


const Positions = ({ connection }) => {
  const [ticks, setTicks] = useState({});

  const [balance, setBalance] = useState(0);
  const [equity, setEquity] = useState(0);
  const [leverage, setLeverage] = useState(0);
  const [usedMargin, setUsedMargin] = useState(0);
  const [freeMarginMode, setFreeMarginMode] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [digits, setDigits] = useState(2);

  const [groups, setGroups] = useState([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalLoss, setTotalLoss] = useState(0);
  const [totalSwap, setTotalSwap] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);

  useEffect(() => {

    // Fetch the account summary
    async function fetchAccountSummary() {
      const data = await getAccountSummary();
      setBalance(data.balance);
      setEquity(data.equity);
      setLeverage(data.leverage);
      setUsedMargin(data.margin);
      setFreeMarginMode(data.freeMarginMode);
      setDigits(data.digits);
      setCurrency(data.currency);
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
      let totalProfit = 0;
      let totalLoss = 0;
      let totalSwap = 0;
      let totalCommission = 0;
      data.forEach((group) => {
        let groupSwap = 0;
        let groupCommission = 0;
        let groupProfit = 0;
        let groupLoss = 0;
        group.positions.forEach((position) => {
          groupSwap += position.swap;
          groupCommission += position.commission;
          if (position.profit > 0) {
            groupProfit += position.profit;
          } else {
            groupLoss += position.pro
          }
        });
        group.profit = groupProfit;
        group.loss = groupLoss;
        group.swap = groupSwap;
        group.commission = groupCommission;
        totalLoss += groupLoss;
        totalProfit += groupProfit;
        totalSwap += groupSwap;
        totalCommission += groupCommission;
      });
      setTotalProfit(totalProfit);
      setTotalLoss(totalLoss);
      setTotalSwap(totalSwap);
      setTotalCommission(totalCommission);
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

  useEffect(() => {

    setGroups((prevGroups) =>
      prevGroups.map((group) => {
        // Only re-render the position if the position.symbolName has changed
        const symbolName = group.symbolName;
        if (!ticks.hasOwnProperty(symbolName)) {
          return group;
        }

        // Check if the position support conversion
        if (group.positions[0].plCalculation === null) {
          group.positions.forEach((position) => {
            position.profit = "NaN";
          });
          group.profit = "NaN";
          group.loss = "NaN";
          return group;
        }

        // Update the profit of each position
        group.positions = group.positions.map((position) => {

          position.closedPrice = position.type === 0 ? ticks[symbolName].bid : ticks[symbolName].ask;

          // 1. CALCULATE PROFIT
          const calculationMode = position.plCalculation.calculationMode;
          if (calculationMode === 1 || calculationMode === 4) {
            // Forex or ForexNoLeverage
            position.profit = position.type === 0
              ? normalize(position.closedPrice * position.volume * position.contractSize, position.digits) - normalize(position.openPrice * position.volume * position.contractSize, position.digits)
              : normalize(position.openPrice * position.volume * position.contractSize, position.digits) - normalize(position.closedPrice * position.volume * position.contractSize, position.digits);
          }
          else {
            // CFD or CFDLeverage
            position.profit = position.type === 0
              ? normalize(position.volume * position.contractSize * (position.closedPrice - position.openPrice), position.digits)
              : normalize(position.volume * position.contractSize * (position.openPrice - position.closedPrice), position.digits);
          }

          // 2. CONVERT PROFIT TO DEPOSIT CURRENCY
          const conversionSymbol = position.plCalculation.conversionSymbol;

          // If there is no conversion symbol (that means profit currency is USD), we don't need to convert
          if (!conversionSymbol) {
            return position;
          }

          // Now we need to convert the profit to the deposit currency

          // If there is conversion symbol ticks, we need to get the exchange rate
          if (ticks[conversionSymbol]) {
            const bid = ticks[conversionSymbol].bid;
            const ask = ticks[conversionSymbol].ask;
            let useBid = false;

            if (calculationMode != 1 && calculationMode != 4) {
              // For all except Forex and ForexNoLeverage, we calculate based on Profitable or Losing deal
              useBid = position.profit > 0;
            }
            else {
              // For Forex and ForexNoLeverage, we have ByDeal or ByMarket options
              const isForexProfitByMarket = position.plCalculation.isForexProfitByMarket;
              useBid = isForexProfitByMarket
                ? position.profit > 0 // If ByMarket, we calculate based on Profitable or Losing deal
                : position.type === 1; // If ByDeal, it does not matter whether it is Profitable or Losing deal
            }

            // If there is only a reverse rate, we need to reverse the rate
            const isReversed = position.plCalculation.isReversed;
            const exchangeRate = useBid ? (isReversed ? 1 / ask : bid) : (isReversed ? 1 / bid : ask);
            position.plCalculation.exchangeRate = exchangeRate;
          }

          // Complete the rate conversion
          position.profit = normalize(position.profit * position.plCalculation.exchangeRate, digits);
          return position;
        });

        // Update the profit of the group
        group.profit = 0;
        group.loss = 0;
        for (let position of group.positions) {
          if (position.profit > 0) {
            group.profit += position.profit;
          } else {
            group.loss += position.profit;
          }
        }
        return group;
      }));

    let totalProfit = 0;
    let totalLoss = 0;
    for (let group of groups) {
      totalProfit += group.profit;
      totalLoss += group.loss;
    }
    setTotalProfit(totalProfit);
    setTotalLoss(totalLoss);
  }, [ticks]);

  useEffect(() => {
    let equity = balance + totalSwap + totalCommission;

    switch (freeMarginMode) {
      case 1: // FreeMarginNotUsePL
        break;
      case 2: // FreeMarginUsePL
        equity += totalProfit + totalLoss;
        break;
      case 3: // FreeMarginProfit
        equity += totalProfit;
        break;
      case 4: // FreeMarginLoss
        equity += totalLoss;
        break;
      default:
        equity += totalProfit + totalLoss;
        break;
    }

    setEquity(equity);
  }, [totalProfit, totalLoss]);

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
              <th style={{ border: "1px solid black", padding: "8px" }}>Swap / Commission</th>
              <th style={{ border: "1px solid black", padding: "8px", width: "100px" }}>Profit</th>
              <th style={{ border: "1px solid black", padding: "8px", width: "100px" }}>Total Profit</th>
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
                  <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold" }}>{group.swap} / {group.commission}</td>
                  <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold", textAlign: "right" }}>{group.profit + group.loss}</td>
                  <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold", textAlign: "right" }}></td>
                  <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold" }}></td>
                </tr>
                {/* Render Nested Positions */}
                {group.positions.map((position) => (
                  <tr key={position.positionId} style={{ marginLeft: "20px" }}>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{position.positionId}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{parseType(position.type)}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{parseCalcMode(position.calculationMode)}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{position.volume} / {position.contractSize}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{position.openPrice}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{position.closedPrice}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>
                      {position.plCalculation ? normalize(position.plCalculation.exchangeRate, digits) : "NaN"}
                      {position.plCalculation?.conversionSymbol ? ` - ${position.plCalculation.conversionSymbol}` : ""}
                    </td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{parseIsForexPLByMarket(position.plCalculation?.isForexProfitByMarket)}</td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{position.swap} / {position.commission}</td>
                    <td style={{ border: "1px solid black", padding: "8px", textAlign: "right" }}>{position.profit}</td>
                    <td style={{ border: "1px solid black", padding: "8px", textAlign: "right" }}></td>
                    <td style={{ border: "1px solid black", padding: "8px" }}>{new Date(position.actionTime).toLocaleString()}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {/* Render Group Summary */}
            <tr style={{ backgroundColor: "#f1f1f1" }}>
              <td colSpan="3" style={{ border: "", padding: "8px", fontWeight: "bold", color: "red" }}>Group Total</td>
              <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold" }}></td>
              <td colSpan="5" style={{ border: "", padding: "8px", fontWeight: "bold" }}></td>
              <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold", textAlign: "right", color: "red" }}>{normalize(totalProfit + totalLoss, digits)}</td>
              <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold", textAlign: "right", color: "red" }}>{normalize(totalProfit + totalLoss + totalSwap + totalCommission, digits)}</td>
              <td colSpan="1" style={{ border: "", padding: "8px", fontWeight: "bold" }}></td>
            </tr>
          </tbody>

        </table>
      ) : (
        <p>Waiting for positions...</p>
      )}

      <h1>Other Statistics</h1>
      <p>Balance: {balance}</p>
      <p>Equity: {normalize(equity, digits)}</p>
      <p>Leverage: 1:{leverage}</p>
      <p>Used Margin: {usedMargin}</p>
      <p>Free Margin: {normalize(equity - usedMargin, digits)}</p>
      <p>Margin Level: {normalize(equity / usedMargin * 100, digits)}%</p>
      <p>Free Margin Mode: {parseFreeMarginMode(freeMarginMode)}</p>
      <p>Total Profit: {totalProfit}</p>
      <p>Total Loss: {totalLoss}</p>

    </div>
  );
};

export default Positions;
