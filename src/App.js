import React, { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";

const App = () => {
  const [ticks, setTicks] = useState({}); // Dictionary to store last tick data for multiple symbols
  // Capture the previous ticks for comparison in future updates
  const [prevTicks, setPrevTicks] = useState({});
  const [conversionTicks, setConversionTicks] = useState({}); // Dictionary to store exchange rates for multiple symbols
  const [positions, setPositions] = useState([]); // Array to store opened positions

  useEffect(() => {
    // Set up SignalR connection
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5010/ws/TradingTerminal", {
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: true,
      })
      .withHubProtocol(new MessagePackHubProtocol()) // Use MessagePack protocol
      .build();

    // Define the method to handle NewTick for multiple symbols
    connection.on("1", (symbol, datetime, bid, ask, last, volume) => {
      if (!last) {
        last = 0.0;
        volume = 0.0;
      }

      if (conversionTicks[symbol]) {
        setConversionTicks((prevConversionTicks) => ({
          ...prevConversionTicks,
          [symbol]: { datetime, bid, ask, last, volume },
        }));
      }

      // Update the ticks state with the new tick data for the symbol
      setTicks((prevTicks) => ({
        ...prevTicks,
        [symbol]: { datetime, bid, ask, last, volume },
      }));
    });

    // Start the connection
    connection
      .start()
      .then(async () => {
        console.log("Connected to SignalR");

        const response = await fetch("http://localhost:5010/TradingPositionInternal/TradingPositions/Open/505814", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tradingAccountId: "9714ffc8-cd19-46d8-a7f1-457dc136c8c6",
            userId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          }),
        });
        const data = (await response.json()).data;
        console.log("Opened position:", data);

        // Update the positions state with the new opened position
        setPositions((prevPositions) => [...prevPositions, data]);

        // Subscribe to symbolName and conversionSymbol by send signalR message to "Subscribe", ["JPYAUD", "AUDUSD_"]
        const symbolName = data.symbolName;
        const conversionSymbol = data.floatingPl ? data.floatingPl.conversionSymbol : null;
        if (conversionSymbol) {
          connection.invoke("Subscribe", [symbolName, conversionSymbol]);
        } else {
          connection.invoke("Subscribe", [symbolName]);
        }
      })
      .catch((err) => console.error("SignalR Connection Error:", err));

    // Clean up the connection on component unmount
    return () => {
      connection.stop();
    };
  }, []);

  // Update the positions state with the new profit for the position
  useEffect(() => {
    // for each changed ticks, update the profit of the position

    // Log which tick is changing
    const changedTicks = Object.keys(ticks).filter((symbol) => {
      return prevTicks[symbol] && (
        prevTicks[symbol].bid !== ticks[symbol].bid ||
        prevTicks[symbol].ask !== ticks[symbol].ask ||
        prevTicks[symbol].last !== ticks[symbol].last
      );
    });
    console.log("Changed ticks:", changedTicks);

    setPositions((prevPositions) =>
      prevPositions.map((position) => {
        // Only re-render the position if the position.symbolName has changed
        const symbolName = position.symbolName;
        if (!changedTicks.includes(symbolName)) {
          return position;
        }

        const currentPrice = position.type === 0 ?
          ticks[symbolName].bid
          : ticks[symbolName].ask;
        let profit = position.volume * position.contractSize * (currentPrice - position.openPrice);

        // Check if the position support conversion
        if (position.floatingPl === null) {
          position.profit = "NaN";
          return position;
        }

        const conversionSymbol = position.floatingPl.conversionSymbol;
        let lastRateProfit = 1;

        if (ticks[conversionSymbol]) {
          position.floatingPl.lastRateProfit = position.type === 0
            ? ticks[conversionSymbol].bid
            : ticks[conversionSymbol].ask;
        }

        lastRateProfit = position.floatingPl.isReversed ?
          1 / position.floatingPl.lastRateProfit :
          position.floatingPl.lastRateProfit;


        profit = profit * lastRateProfit;
        position.profit = position.type === 0 ? profit : -profit;
        position.profit = Math.round(position.profit * 100) / 100;
        position.currentPrice = currentPrice;

        return position;
      })
    );

  }, [ticks]);

  useEffect(() => {
    // Store the previous ticks to compare with future updates
    setPrevTicks(ticks);
  }, [ticks]);

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

      <h1>Opened Positions</h1>
      {positions.length > 0 ? (
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
            {positions.map(({ positionId, symbolName, type, volume, openPrice, profit, currentPrice, swap, commission }) => (
              <tr key={positionId}>
                <td style={{ border: '1px solid black', padding: '8px' }}>{positionId}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{symbolName}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{type}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{volume}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{openPrice}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{currentPrice}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{profit + swap + commission}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Waiting for positions...</p>
      )}
    </div>
  );


};

export default App;
