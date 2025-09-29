// A good practice is to place this in a type declaration file, e.g., `src/types/mydoge.d.ts`
// This ensures TypeScript understands the `window.doge` object injected by the extension.

export interface MyDogeAPI {
  isMyDoge: true;
  connect: () => Promise<{ approved: boolean; address: string }>;
  disconnect: () => Promise<{ disconnected: boolean }>;
  getConnectionStatus: () => Promise<{ connected: boolean }>;
  getBalance: () => Promise<{ balance: number }>; // balance in koinu
  requestTransaction: (params: {
    recipientAddress: string;
    dogeAmount: number; // amount in DOGE
  }) => Promise<{ txId: string }>;
  requestInscriptionTransaction: (params: {
    recipientAddress: string;
    location: string;
  }) => Promise<{ txId: string }>;
  getDRC20Balance: (params: {
    ticker: string;
  }) => Promise<{ availableBalance: string; transferableBalance: string }>;
  getTransferableDRC20: (params: {
    ticker: string;
  }) => Promise<{ inscriptions: any[] }>; // You can define a stricter type for inscriptions
  requestAvailableDRC20Transaction: (params: {
    ticker: string;
    amount: string;
  }) => Promise<{ txId: string }>;
  getDunesBalance: (params: {
    ticker: string;
  }) => Promise<{ balance: string }>;
  requestDunesTransaction: (params: {
    ticker: string;
    recipientAddress: string;
    amount: string;
  }) => Promise<{ txId: string }>;
  getTransactionStatus: (params: { txId: string }) => Promise<{ status: string; confirmations: number }>;
  requestPsbt: (params: { rawTx: string; indexes: number[]; signOnly: boolean }) => Promise<any>;
  requestSignedMessage: (params: { message: string }) => Promise<any>;
  requestDecryptedMessage: (params: { message: string }) => Promise<any>;
}

declare global {
  interface Window {
    // The wallet extension injects the API into the window object.
    doge?: MyDogeAPI;
  }
}
