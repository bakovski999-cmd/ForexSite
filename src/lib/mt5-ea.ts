export const MT5_EA_FILE_NAME = "ForexSiteConnectorEA.mq5";

const DEFAULT_SYNC_INTERVAL_SECONDS = 10;
const DEFAULT_HISTORY_DAYS = 30;

function escapeMqlString(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n");
}

export function buildMt5EaSource({
  endpointUrl,
  historyDays = DEFAULT_HISTORY_DAYS,
  secretToken,
  syncIntervalSeconds = DEFAULT_SYNC_INTERVAL_SECONDS,
}: {
  endpointUrl: string;
  historyDays?: number;
  secretToken: string;
  syncIntervalSeconds?: number;
}) {
  return String.raw`#property copyright "ForexSite"
#property version   "1.01"
#property strict

input string EndpointUrl = "${escapeMqlString(endpointUrl)}";
input string SecretToken = "${escapeMqlString(secretToken)}";
input int SyncIntervalSeconds = ${syncIntervalSeconds};
input int HistoryDays = ${historyDays};

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", "\\r");
   StringReplace(value, "\n", "\\n");
   StringReplace(value, "\t", "\\t");
   return value;
}

string JsonString(string value)
{
   return "\"" + JsonEscape(value) + "\"";
}

string JsonNumber(double value, int digits = 8)
{
   return DoubleToString(value, digits);
}

string JsonInteger(long value)
{
   return IntegerToString(value);
}

string TimeToPayloadString(datetime value)
{
   return TimeToString(value, TIME_DATE | TIME_SECONDS);
}

string PositionTypeToPayload(long value)
{
   return value == POSITION_TYPE_SELL ? "sell" : "buy";
}

string DealTypeToPayload(long value)
{
   if(value == DEAL_TYPE_BUY)
      return "buy";
   if(value == DEAL_TYPE_SELL)
      return "sell";
   if(value == DEAL_TYPE_BALANCE)
      return "balance";
   if(value == DEAL_TYPE_CREDIT)
      return "credit";
   if(value == DEAL_TYPE_CHARGE)
      return "charge";
   if(value == DEAL_TYPE_CORRECTION)
      return "correction";
   if(value == DEAL_TYPE_BONUS)
      return "bonus";
   if(value == DEAL_TYPE_COMMISSION)
      return "commission";
   if(value == DEAL_TYPE_INTEREST)
      return "interest";

   return JsonInteger(value);
}

string DealEntryToPayload(long value)
{
   if(value == DEAL_ENTRY_IN)
      return "in";
   if(value == DEAL_ENTRY_OUT)
      return "out";
   if(value == DEAL_ENTRY_INOUT)
      return "inout";
   if(value == DEAL_ENTRY_OUT_BY)
      return "out_by";

   return JsonInteger(value);
}

string BuildTerminalJson()
{
   string json = "{";
   json += "\"name\":" + JsonString("MetaTrader 5") + ",";
   json += "\"build\":" + JsonInteger(TerminalInfoInteger(TERMINAL_BUILD)) + ",";
   json += "\"path\":" + JsonString(TerminalInfoString(TERMINAL_PATH));
   json += "}";
   return json;
}

string BuildAccountJson()
{
   string company = AccountInfoString(ACCOUNT_COMPANY);
   string json = "{";
   json += "\"login\":" + JsonString(JsonInteger(AccountInfoInteger(ACCOUNT_LOGIN))) + ",";
   json += "\"server\":" + JsonString(AccountInfoString(ACCOUNT_SERVER)) + ",";
   json += "\"broker\":" + JsonString(company) + ",";
   json += "\"company\":" + JsonString(company) + ",";
   json += "\"currency\":" + JsonString(AccountInfoString(ACCOUNT_CURRENCY)) + ",";
   json += "\"balance\":" + JsonNumber(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\"equity\":" + JsonNumber(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   json += "\"margin\":" + JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
   json += "\"freeMargin\":" + JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
   json += "\"marginLevel\":" + JsonNumber(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2) + ",";
   json += "\"leverage\":" + JsonInteger(AccountInfoInteger(ACCOUNT_LEVERAGE)) + ",";
   json += "\"profit\":" + JsonNumber(AccountInfoDouble(ACCOUNT_PROFIT), 2);
   json += "}";
   return json;
}

string BuildPositionsJson()
{
   string json = "[";
   bool first = true;
   int total = PositionsTotal();

   for(int index = 0; index < total; index++)
   {
      ulong ticket = PositionGetTicket(index);
      if(ticket == 0)
         continue;

      string symbol = PositionGetString(POSITION_SYMBOL);

      if(!first)
         json += ",";
      first = false;

      json += "{";
      json += "\"ticket\":" + JsonString(IntegerToString((long)ticket)) + ",";
      json += "\"symbol\":" + JsonString(symbol) + ",";
      json += "\"type\":" + JsonString(PositionTypeToPayload(PositionGetInteger(POSITION_TYPE))) + ",";
      json += "\"volume\":" + JsonNumber(PositionGetDouble(POSITION_VOLUME), 8) + ",";
      json += "\"openPrice\":" + JsonNumber(PositionGetDouble(POSITION_PRICE_OPEN), 8) + ",";
      json += "\"currentPrice\":" + JsonNumber(PositionGetDouble(POSITION_PRICE_CURRENT), 8) + ",";
      json += "\"stopLoss\":" + JsonNumber(PositionGetDouble(POSITION_SL), 8) + ",";
      json += "\"takeProfit\":" + JsonNumber(PositionGetDouble(POSITION_TP), 8) + ",";
      json += "\"profit\":" + JsonNumber(PositionGetDouble(POSITION_PROFIT), 2) + ",";
      json += "\"swap\":" + JsonNumber(PositionGetDouble(POSITION_SWAP), 2) + ",";
      json += "\"commission\":0,";
      json += "\"magic\":" + JsonString(JsonInteger(PositionGetInteger(POSITION_MAGIC))) + ",";
      json += "\"comment\":" + JsonString(PositionGetString(POSITION_COMMENT)) + ",";
      json += "\"openTime\":" + JsonString(TimeToPayloadString((datetime)PositionGetInteger(POSITION_TIME))) + ",";
      json += "\"contractSize\":" + JsonNumber(SymbolInfoDouble(symbol, SYMBOL_TRADE_CONTRACT_SIZE), 8) + ",";
      json += "\"currencyProfit\":" + JsonString(SymbolInfoString(symbol, SYMBOL_CURRENCY_PROFIT)) + ",";
      json += "\"currencyMargin\":" + JsonString(SymbolInfoString(symbol, SYMBOL_CURRENCY_MARGIN)) + ",";
      json += "\"tickSize\":" + JsonNumber(SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE), 8) + ",";
      json += "\"tickValue\":" + JsonNumber(SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE), 8);
      json += "}";
   }

   json += "]";
   return json;
}

string BuildHistoryDealsJson()
{
   int days = HistoryDays < 1 ? 1 : HistoryDays;
   datetime to = TimeCurrent();
   datetime from = to - days * 86400;
   string json = "[";

   if(!HistorySelect(from, to))
      return json + "]";

   int total = HistoryDealsTotal();
   int start = total > 200 ? total - 200 : 0;
   bool first = true;

   for(int index = start; index < total; index++)
   {
      ulong ticket = HistoryDealGetTicket(index);
      if(ticket == 0)
         continue;

      string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      if(StringLen(symbol) == 0)
         continue;

      if(!first)
         json += ",";
      first = false;

      json += "{";
      json += "\"ticket\":" + JsonString(IntegerToString((long)ticket)) + ",";
      json += "\"orderTicket\":" + JsonString(JsonInteger(HistoryDealGetInteger(ticket, DEAL_ORDER))) + ",";
      json += "\"symbol\":" + JsonString(symbol) + ",";
      json += "\"type\":" + JsonString(DealTypeToPayload(HistoryDealGetInteger(ticket, DEAL_TYPE))) + ",";
      json += "\"entry\":" + JsonString(DealEntryToPayload(HistoryDealGetInteger(ticket, DEAL_ENTRY))) + ",";
      json += "\"volume\":" + JsonNumber(HistoryDealGetDouble(ticket, DEAL_VOLUME), 8) + ",";
      json += "\"price\":" + JsonNumber(HistoryDealGetDouble(ticket, DEAL_PRICE), 8) + ",";
      json += "\"profit\":" + JsonNumber(HistoryDealGetDouble(ticket, DEAL_PROFIT), 2) + ",";
      json += "\"swap\":" + JsonNumber(HistoryDealGetDouble(ticket, DEAL_SWAP), 2) + ",";
      json += "\"commission\":" + JsonNumber(HistoryDealGetDouble(ticket, DEAL_COMMISSION), 2) + ",";
      json += "\"time\":" + JsonString(TimeToPayloadString((datetime)HistoryDealGetInteger(ticket, DEAL_TIME)));
      json += "}";
   }

   json += "]";
   return json;
}

string BuildPayload()
{
   string json = "{";
   json += "\"version\":1,";
   json += "\"sentAt\":" + JsonString(TimeToPayloadString(TimeCurrent())) + ",";
   json += "\"terminal\":" + BuildTerminalJson() + ",";
   json += "\"account\":" + BuildAccountJson() + ",";
   json += "\"positions\":" + BuildPositionsJson() + ",";
   json += "\"historyDeals\":" + BuildHistoryDealsJson();
   json += "}";
   return json;
}

void SendSnapshot()
{
   if(StringLen(EndpointUrl) == 0 || StringLen(SecretToken) == 0)
   {
      Print("ForexSite MT5 sync skipped: EndpointUrl or SecretToken is empty.");
      return;
   }

   string payload = BuildPayload();
   char data[];
   int dataSize = StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(dataSize > 0)
      ArrayResize(data, dataSize - 1);

   char result[];
   string resultHeaders;
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + SecretToken + "\r\n";

   ResetLastError();
   int status = WebRequest("POST", EndpointUrl, headers, 10000, data, result, resultHeaders);

   if(status == -1)
   {
      Print("ForexSite MT5 sync WebRequest failed. Error ", GetLastError(),
            ". Add the site URL in Tools > Options > Expert Advisors > Allow WebRequest.");
      return;
   }

   if(status < 200 || status >= 300)
   {
      Print("ForexSite MT5 sync HTTP ", status, ": ", CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8));
      return;
   }

   Print("ForexSite MT5 sync completed. HTTP ", status);
}

int OnInit()
{
   int interval = SyncIntervalSeconds < 1 ? 10 : SyncIntervalSeconds;
   EventSetTimer(interval);
   SendSnapshot();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   SendSnapshot();
}
`;
}

export function buildMt5EaDataUri(options: Parameters<typeof buildMt5EaSource>[0]) {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(buildMt5EaSource(options))}`;
}
