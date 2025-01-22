import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPositionDetails } from "../utils/call-apis";

const PositionDetail = (connection, ticks, changedTicks) => {
  const { id } = useParams();
  const [position, setPosition] = useState(null);

  useEffect(() => {

    // Fetch the position details for the given ID
    const data = getPositionDetails(id);
    setPosition(data);

    const symbolName = data.symbolName;
    const conversionSymbol = data.floatingPl ? data.floatingPl.conversionSymbol : null;
    if (conversionSymbol) {
      connection.invoke("Subscribe", [symbolName, conversionSymbol]);
    } else {
      connection.invoke("Subscribe", [symbolName]);
    }

    return () => {
      setPosition(null);
      if (conversionSymbol) {
        connection.invoke("Unsubscribe", [symbolName, conversionSymbol]);
      } else {
        connection.invoke("Unsubscribe", [symbolName]);
      }
    };

  }, [id]);

  useEffect(() => {
    // For each changed ticks, update the profit of the position
    setPosition((prevPosition) => {
      // Only re-render the position if the position.symbolName has changed
      const symbolName = position.symbolName;
      if (!changedTicks.includes(symbolName)) {
        return position;
      }

      const currentPrice = position.type === 0 ? ticks[symbolName].bid : ticks[symbolName].ask;
      let profit = position.volume * position.contractSize * (currentPrice - position.openPrice);

      // Check if the position support conversion
      if (position.floatingPl === null) {
        position.profit = "NaN";
        return position;
      }

      const conversionSymbol = position.floatingPl.conversionSymbol;
      if (conversionSymbol && ticks[conversionSymbol]) {
        position.floatingPl.lastRateProfit = position.type === 0
          ? conversionTicks[conversionSymbol].bid
          : conversionTicks[conversionSymbol].ask;
      }

      // TODO: Update the formulas
      const lastRateProfit = position.floatingPl.isReversed ?
        1 / position.floatingPl.lastRateProfit :
        position.floatingPl.lastRateProfit;

      profit = profit * lastRateProfit;
      profit = position.type === 0 ? profit : -profit;
      profit = profit.toFixed(position.digitsCurrency);
      position.profit = profit;
      position.currentPrice = currentPrice;

      return position;
    });

  }, [changedTicks]);

  return (
    <div>
      <h1>Subscribed symbols</h1>
      {Object.keys(ticks).length > 0 ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '8px' }}>Symbol</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>DateTime</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>Bid</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>Ask</th>
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

      <h1>Opened Position</h1>
      {position ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '8px' }}>PositionId</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>SymbolName</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>Type</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>Volume</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>OpenPrice</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>CurrentPrice</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>Profit (x)</th>
            </tr>
          </thead>
          <tbody>
            <tr key={position.positionId}>
              <td style={{ border: '1px solid black', padding: '8px' }}>{position.positionId}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{position.symbolName}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{position.type}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{position.volume}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{position.openPrice}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{position.currentPrice}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{position.profit + position.swap + position.commission}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p>Waiting for positions...</p>
      )}
    </div>
  );

};

export default PositionDetail;
