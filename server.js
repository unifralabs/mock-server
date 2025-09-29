// Simple mock backend for MyDogeMask frontend
// Run with:  node server.js (after `npm i` in mock-server directory)

const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const bitcoin = require('bitcoinjs-lib');

const app = express();
const PORT = process.env.PORT || 4000;

// In-memory storage
const txStore = new Map();

app.use(bodyParser.json());
app.use(cors());


// Dogecoin network parameters for bitcoinjs-lib (Testnet)
const dogecoin = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x71,
  scriptHash: 0xc4,
  wif: 0xf1,
};

const blockbookBase="https://blockbook.unifra.xyz/api/v2";

// Helper: random txid string
const randomTxId = () => crypto.randomBytes(32).toString('hex');
// 1. Transaction building endpoints
app.post('/v3/tx/prepare', async (req, res) => {
  const { sender, recipient, amount: amountDoge } = req.body;
  const requestedAmountDoge = Number(amountDoge);
  const requestedAmountSatoshi = Math.round(requestedAmountDoge * 1e8);
  console.log(
    '[mock] prepare tx for',
    { sender, recipient, amount: requestedAmountDoge }
  );

  try {
    // 1. Fetch UTXOs for the sender
    const addressResponse = await axios.get(
      `${blockbookBase}/utxo/${sender}`
    );
    const utxos = addressResponse.data || [];

    if (utxos.length == 0) {
      return res.status(400).json({ error: 'No spendable outputs (UTXOs)' });
    }

    // 2. Coin selection and fee calculation
    const feeRateSatPerByte = 100; // Using a simple mock fee rate
    const txb = new bitcoin.TransactionBuilder(dogecoin);
    let totalInputSatoshi = 0;
    let inputCount = 0;

    // Sort UTXOs: largest first to minimize inputs
    utxos.sort((a, b) => Number(b.value) - Number(a.value));

    for (const utxo of utxos) {
      // TransactionBuilder only needs the txid and vout for the input.
      txb.addInput(utxo.txid, utxo.vout);
      totalInputSatoshi += Number(utxo.value);
      inputCount++;

      // Simple coin selection: stop when we have enough for amount + estimated fee
      const estimatedFee = (inputCount * 148 + 2 * 34 + 10) * feeRateSatPerByte; // P2PKH approx.
      if (totalInputSatoshi >= requestedAmountSatoshi + estimatedFee) {
        break;
      }
    }

    // 3. Add outputs and check for sufficient funds
    const finalFee = (inputCount * 148 + 2 * 34 + 10) * feeRateSatPerByte; // P2PKH approx.
    if (totalInputSatoshi < requestedAmountSatoshi + finalFee) {
      return res.status(400).json({ error: 'Insufficient funds for transaction and fee' });
    }

    txb.addOutput(recipient, requestedAmountSatoshi);

    const changeAmount = totalInputSatoshi - requestedAmountSatoshi - finalFee;
    // Add change output if it's not dust
    const DUST_THRESHOLD = 546; // A common dust threshold
    if (changeAmount > DUST_THRESHOLD) {
      txb.addOutput(sender, changeAmount);
    }

    // 4. Return the unsigned transaction hex and calculated fee
    // We return the unsigned raw transaction hex. The background script will sign it.
    const rawTx = txb.buildIncomplete().toHex();

    res.json({ rawTx, fee: finalFee / 1e8, amount: requestedAmountDoge });

  } catch (error) {
    console.error(`[mock] Error preparing tx for ${sender}:`, error.message);
    res.status(500).json({ error: 'Failed to prepare transaction' });
  }
});

app.post('/tx/prepare/inscription', (req, res) => {
  const { sender, recipient, inscriptionId } = req.body;
  console.error(
    '[mock] prepare inscription tx',
    sender,
    recipient,
    inscriptionId
  );
  res.json({ rawTx: 'deadbeef', fee: 1, amount: 0 });
});

app.post('/tx/prepare/dune', (req, res) => {
  const { sender, recipient, amount, duneId } = req.body;
  console.log('[mock] prepare dune tx', sender, recipient, amount, duneId);
  res.json({ rawTx: 'deadbeef', fee: 1, amount });
});

// 2. JSON-RPC passthrough mock
app.post('/wallet/rpc', async (req, res) => {
  const { method, params, id, jsonrpc } = req.body;
  const rpcUrl = 'https://rpc:rpcp@dogecoin-testnet.unifra.xyz';

  console.log(`[mock] rpc passthrough for method: ${method}`);
  if (method == "sendrawtransaction") {
    console.log(`     req.body=${JSON.stringify(req.body)}`);
  }

  try {
    const response = await axios.post(rpcUrl, {
      jsonrpc,
      id,
      method,
      params,
    });

    // Forward the response from the real RPC server
    console.log("   /wallet/rpc=>", response.data);
    res.json(response.data);
    
  } catch (error) {
    console.error(
      `[mock] Error in RPC passthrough for method ${method}:`,
      error.response ? error.response.data : error.message
    );

    const status = error.response ? error.response.status : 500;
    const data = error.response ? error.response.data : { error: `Proxy failed: ${error.message}` };
    console.error("   /wallet/rpc=>", data);
    res.status(status).json(data);
  }
});

// 3. wallet/info proxy
app.get('/wallet/info', async (req, res) => {
  const { route } = req.query;
  console.log('[mock] wallet/info route=', route);

  if (route?.startsWith('/tickers')) {
    return res.json({ rates: { usd: 0.1 } });
  }

  if (route?.startsWith('/address')) {
    try {
      const blockbookUrl = `${blockbookBase}/${route}`;
      console.log(`[mock] proxying to ${blockbookUrl}`);
      const response = await axios.get(blockbookUrl);
      return res.json(response.data);
    } catch (error) {
      console.error(
        `[mock] Error fetching address info for route ${route}:`,
        error.message
      );
      return res.status(500).json({
        balance: '0',
        txids: [],
        totalPages: 0,
        page: 1,
        error: 'Failed to fetch address info',
      });
    }
  }

  if (route?.startsWith('/tx')) {
    const id = route.split('/tx/')[1];
    try {
      const stored = txStore.get(id);
      if (stored) {
        return res.json(stored);
      }

      // If not in store, fetch from blockbook
      const blockbookUrl = `${blockbookBase}/tx/${id}`;
      console.log(`[mock] proxying to ${blockbookUrl}`);
      const response = await axios.get(blockbookUrl);
      return res.json(response.data);
    } catch (error) {
      console.error(`[mock] Error fetching tx info for ${id}:`, error.message);
      // Return default/error structure if fetch fails
      return res.status(500).json({
        vout: [{ value: 0, addresses: ['UNKNOWN'] }],
        confirmations: 0,
        blockTime: Math.floor(Date.now() / 1000),
        error: 'Failed to fetch transaction info',
      });
    }
  }

  return res.json({ message: 'unhandled route' });
});

// 4. Inscriptions & tokens
app.get('/inscriptions/:address', (req, res) => {
  res.json({ list: [], total: 0 });
});

app.get('/inscription/:id', (req, res) => {
  res.json({
    inscription_id: req.params.id,
    content_type: 'text/plain',
    content_length: 0,
    content: '',
  });
});

app.get('/drc20/:address', (req, res) => {
  res.json({ balances: [], total: 0 });
});

app.get('/dunes/:address', (req, res) => {
  res.json({ balances: [], total: 0 });
});

// 5. UTXO list
app.get('/utxos/:address', async (req, res) => {
  const { address } = req.params;
  try {
    const response = await axios.get(
      `${blockbookBase}/address/${address}`
    );
    const data = response.data;
    const utxos = (data.utxos || []).map((utxo) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      satoshis: Number(utxo.value),
      script_pubkey: utxo.scriptPubKey, // Assuming blockbook provides this, otherwise it will be undefined
    }));
    res.json({ utxos, next_cursor: null });
  } catch (error) {
    console.error(`[mock] Error fetching utxos for ${address}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch UTXOs' });
  }
});

// Health check endpoint for Kubernetes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '::', () => {
  /* eslint-disable no-console */
  console.log(`Mock backend listening on port ${PORT}. Access via http://localhost:${PORT} or your network IP.`);
});
