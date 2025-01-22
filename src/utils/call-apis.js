import { toastError } from "./toast-messages";

const API_URL = 'http://localhost:5010';
const TRADING_ACCOUNT_ID = '9714ffc8-cd19-46d8-a7f1-457dc136c8c6';
const USER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

const getPositionDetails = async (positionId) => {
  try {
    const response = await fetch(`${API_URL}/TradingPositionInternal/TradingPositions/Open/${positionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tradingAccountId: TRADING_ACCOUNT_ID,
        userId: USER_ID,
      }),
    });

    const data = (await response.json()).data;
    console.log("Opened position:", data);
    return data;
  }
  catch (error) {
    console.error("Error while fetching position details:", error);
    toastError("Error while fetching position details");
  }
}

const getPositionList = async () => {
  try {
    const response = await fetch(`${API_URL}/TradingPositionInternal/TradingPositions/Open`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tradingAccountId: TRADING_ACCOUNT_ID,
        userId: USER_ID,
      }),
    });

    const data = (await response.json()).data;
    console.log("Opened positions:", data);
    return data;
  }
  catch (error) {
    console.error("Error while fetching position list:", error);
    toastError("Error while fetching position list");
  }
}

const getAccountSummary = async () => {
  try {
    const response = await fetch(`${API_URL}/TradingAccountManagement/TradingAccounts/${TRADING_ACCOUNT_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tradingAccountId: TRADING_ACCOUNT_ID,
        userId: USER_ID,
      }),
    });

    const data = (await response.json()).data;
    console.log("Account summary:", data);
    return data;
  }
  catch (error) {
    console.error("Error while fetching account summary:", error);
    toastError("Error while fetching account summary");
  }
}

export { getPositionDetails, getPositionList, getAccountSummary };