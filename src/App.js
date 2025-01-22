import React, { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";
import { toastError, toastInfo, toastSuccess } from "./utils/toast-messages";
import Positions from "./pages/Positions";

const App = () => {
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true); // Loading state

  useEffect(() => {
    // Set up SignalR connection
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5010/ws/TradingTerminal", {
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: true,
      })
      .withHubProtocol(new MessagePackHubProtocol()) // Use MessagePack protocol
      .build();

    // Start the connection
    connection
      .start()
      .then(() => {
        setConnection(connection);
        setLoading(false); // Connection established, stop loading
        toastSuccess("Connected to SignalR");
      })
      .catch((err) => {
        console.error("SignalR Connection Error:", err);
        toastError("Failed to connect to SignalR");
        setLoading(false); // Stop loading even on failure
      });

    return () => {
      connection.stop();
      setConnection(null);
    };
  }, []);

  if (loading) {
    return <div>Connecting to SignalR...</div>;
  }

  return <Positions connection={connection} />;
};

export default App;
