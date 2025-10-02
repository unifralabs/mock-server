import Head from 'next/head';
import Image from 'next/image';
import sb from 'satoshi-bitcoin';
import styles from '@/styles/Home.module.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Inter } from 'next/font/google';
import { Psbt, networks, payments } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import { useInterval } from '../hooks/useInterval';
import { Network } from 'inspector/promises';

const inter = Inter({ subsets: ['latin'] });
const MDO_ADDRESS = 'DAHkCF5LajV6jYyi5o4eMvtpqXRcm9eZYq';

export default function Home() {
  const [btnText, setBtnText] = useState('Connect');
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [balance, setBalance] = useState(0);
  const [txId, setTxId] = useState('');
  const [inscriptionLocation, setinscriptionLocation] = useState('');
  const [recipientAddress, setRecipientAddress] = useState(MDO_ADDRESS);
  const [drc20Ticker, setDrc20Ticker] = useState('');
  const [drc20Available, setDrc20Available] = useState('');
  const [drc20Transferable, setDrc20Transferable] = useState('');
  const [drc20Inscriptions, setDrc20Inscriptions] = useState<any[]>([]);
  const [drc20Amount, setDrc20Amount] = useState('');
  const [dunesTicker, setDunesTicker] = useState('');
  const [dunesBalance, setDunesBalance] = useState('');
  const [dunesAmount, setDunesAmount] = useState('');
  const [rawTx, setRawTx] = useState('');
  const [psbtIndexes, setPsbtIndexes] = useState([1, 2]);
  const [signMessage, setSignMessage] = useState('');
  const [decryptMessage, setDecryptMessage] = useState('');
  const [myDoge, setMyDoge] = useState<any>();
  const intervalRef = useRef<any>();

  // 多输出和 OP_RETURN 配置
  const [recipient1Address, setRecipient1Address] = useState("2Mu6Pi8NATjSRCW6DTcrCRXhZQiVSL4z7ak");
  const [recipient1Amount, setRecipient1Amount] = useState('2');
  const [recipient2Address, setRecipient2Address] = useState('nq5qTGSppHq2uAawXqQcqCtr5sdf9pyuHX');
  const [recipient2Amount, setRecipient2Amount] = useState('0.1');
  const [opReturnText, setOpReturnText] = useState('00Bb8Bc29695232088b1A2dbc117E8C6006478c295');

  useEffect(() => {
    if (!myDoge) {
      const onInit = () => {
        const { doge } = window as any;
        setMyDoge(doge);
        window.removeEventListener('doge#initialized', onInit);
        console.log('MyDoge API injected from event');
      };
      window.addEventListener('doge#initialized', onInit, { once: true });
    }
  }, [myDoge]);

  // Handle dev edge case where component mounts after MyDoge is initialized
  useEffect(() => {
    if (!myDoge && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        const { doge } = window as any;
        if (doge?.isMyDoge) {
          setMyDoge(doge);
          clearInterval(intervalRef.current);
          console.log('MyDoge API injected from interval');
        } else {
          console.log('MyDoge API not injected');
        }
      }, 1000);
    }
  }, [myDoge]);

  const onConnect = useCallback(async () => {
    console.log('onConnect called, myDoge:', myDoge);
    console.log('current connected state:', connected);

    if (!myDoge?.isMyDoge) {
      alert(`MyDoge not installed! Please install the MyDoge browser extension.`);
      return;
    }

    try {
      if (connected) {
        const disconnectRes = await myDoge.disconnect();
        console.log('disconnect result', disconnectRes);
        if (disconnectRes.disconnected) {
          setConnected(false);
          setAddress('');
          setBtnText('Connect');
        }
        return;
      }

      const connectRes = await myDoge.connect();
      console.log('connect result', connectRes);
      if (connectRes.approved) {
        console.log('Connection approved, setting connected to true');
        setConnected(true);
        setAddress(connectRes.address);
        setBtnText('Disconnect');

        const balanceRes = await myDoge.getBalance();
        console.log('balance result', balanceRes);
        setBalance(sb.toBitcoin(balanceRes.balance));
      } else {
        console.log('Connection not approved');
      }
    } catch (e) {
      console.error('Connection error:', e);
      alert('Connection failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [connected, myDoge]);

  const checkConnection = useCallback(async () => {
    if (!myDoge?.isMyDoge) return;
    try {
      const status = await myDoge.getConnectionStatus();
      console.log('connection status result', status);

      // Add a defensive check. If status is undefined, it means the extension
      // background script is not ready. Do nothing and wait for the next check.
      if (status === undefined) {
        return;
      }

      if (status?.connected) {
        if (!connected) {
          // sync to connected state
          setConnected(true);
          setBtnText('Disconnect');
          // Avoid calling connect() here to prevent extra wallet popups.
          // Prefer using address from status if provided, otherwise keep existing.
          if (status?.address && typeof status.address === 'string') {
            setAddress(status.address);
          }
          // fetch balance best-effort
          try {
            const balanceRes = await myDoge.getBalance();
            setBalance(sb.toBitcoin(balanceRes.balance));
          } catch (e) {
            console.warn('fetch balance after status.connected failed', e);
          }
        }
      } else if (connected) {
        // was connected locally but wallet says disconnected
        setConnected(false);
        setAddress('');
        setBtnText('Connect');
      }
    } catch (e) {
      console.error('checkConnection error', e);
    }
  }, [connected, myDoge]);

  useInterval(checkConnection, 5000, false);

  const isConnected = useCallback(() => {
    if (!myDoge?.isMyDoge) {
      alert(`MyDoge not installed!`);
      return false;
    }

    if (!connected) {
      alert(`MyDoge not connected!`);
      return false;
    }

    return true;
  }, [connected, myDoge]);

  const onTip = useCallback(async () => {
    if (!isConnected()) return;

    try {
      const txReqRes = await myDoge.requestTransaction({
        recipientAddress: MDO_ADDRESS,
        dogeAmount: 4.2,
      });
      console.log('request transaction result', txReqRes);
      setTxId(txReqRes.txId);
    } catch (e) {
      console.error(e);
    }
  }, [isConnected, myDoge]);

  const onAdvancedSend = useCallback(async () => {
    if (!isConnected() || !address) {
      alert('Please connect wallet first.');
      return;
    }

    try {
      // --- Advanced Mode: Building a PSBT with multiple outputs and change ---

      // Step 1: Define constants and helper functions
      const blockbook_base = 'https://blockbook.qiaoxiaorui.org/api/v2';
      const DOGE_TO_KOINU = 100_000_000;
      const DUST_THRESHOLD = 1_000_000; // 0.01 DOGE, as a safe dust limit for outputs
      const TX_FEE_PER_BYTE = 5000; // A reasonable fee rate in koinu/byte

      const fetchUtxos = async (addr: string) => {
        const res = await fetch(`${blockbook_base}/utxo/${addr}`);
        /*
            [
              {
                "txid": "6b520a26a0f74ad6aafd9c2d2322780db35a4d6c48946de40bb38f755942cfc0",
                "vout": 1,
                "value": "990999000000",
                "height": 13096585,
                "confirmations": 1976
              }
            ]
        */
        if (!res.ok) throw new Error(`UTXO fetch failed: ${res.status}`);
        const utxos = await res.json();
        if (!Array.isArray(utxos)) throw new Error('UTXO response is not an array');
        return utxos.map((u: any) => ({ txid: u.txid, vout: u.vout, value: Number(u.value) }));
      };

      const fetchTxHex = async (txid: string) => {
        // Fetch full transaction details to get the hex
        const res = await fetch(`${blockbook_base}/tx/${txid}`);
        /*
          Blockbook response for /tx/${txid} is a JSON object like:
          { 
            "txid": "6b520a26a0f74ad6aafd9c2d2322780db35a4d6c48946de40bb38f755942cfc0",
            "version": 1,
            "hex":"01...."
          }
        */
        if (!res.ok) throw new Error(`tx hex fetch failed: ${res.status}`);
        const body = await res.json();
        return body.hex;
      };

      // Step 2: Prepare outputs
      const outputs: Array<{ address: string; value: number } | { script: Buffer; value: number }> = [];
      let totalOutputValue = 0;

      if (recipient1Address && recipient1Amount && parseFloat(recipient1Amount) > 0) {
        const value = Math.floor(parseFloat(recipient1Amount) * DOGE_TO_KOINU);
        outputs.push({ address: recipient1Address, value });
        totalOutputValue += value;
      }
      if (recipient2Address && recipient2Amount && parseFloat(recipient2Amount) > 0) {
        const value = Math.floor(parseFloat(recipient2Amount) * DOGE_TO_KOINU);
        outputs.push({ address: recipient2Address, value });
        totalOutputValue += value;
      }

      if (opReturnText) {
        const data = Buffer.from(opReturnText, 'utf8');
        const embed = payments.embed({ data: [data] });
        if (embed.output) {
          outputs.push({ script: embed.output, value: 0 });
        }
      }

      if (outputs.length === 0) {
        alert("No valid outputs to send.");
        return;
      }

      // Step 3: Fetch UTXOs and perform coin selection
      const allUtxos = await fetchUtxos(address);
      if (!allUtxos || allUtxos.length === 0) {
        alert("No spendable coins (UTXOs) found for this address.");
        return;
      }

      let selectedUtxos: any[] = [];
      let totalInputValue = 0;
      let estimatedFee = 0;

      // Simple coin selection: find enough UTXOs to cover outputs + estimated fee
      for (const utxo of allUtxos) {
        selectedUtxos.push(utxo);
        totalInputValue += utxo.value;
        // Estimate fee: 148 bytes per input, 34 per output. Add one for change.
        const estimatedSize = (selectedUtxos.length * 148) + ((outputs.length + 1) * 34) + 10;
        estimatedFee = estimatedSize * TX_FEE_PER_BYTE;
        if (totalInputValue >= totalOutputValue + estimatedFee) {
          break; // Found enough funds
        }
      }

      if (totalInputValue < totalOutputValue + estimatedFee) {
        alert(`Not enough funds. Required: ~${(totalOutputValue + estimatedFee) / DOGE_TO_KOINU} DOGE, Available: ${totalInputValue / DOGE_TO_KOINU} DOGE`);
        return;
      }

      // Step 4: Build the PSBT
      //const network = networks.bitcoin; // Use bitcoin as a base for Dogecoin compatibility in bitcoinjs-lib
      const network = {
        messagePrefix: '\x19Dogecoin Signed Message:\n',
        bip32: {
          public: 0x043587cf,
          private: 0x04358394,
        },
        pubKeyHash: 0x71,
        scriptHash: 0xc4,
        wif: 0xf1,
      } as networks.Network;
      const psbt = new Psbt({ network });

      for (const utxo of selectedUtxos) {
        const txHex = await fetchTxHex(utxo.txid);
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(txHex, 'hex'),
        });
      }

      outputs.forEach(output => psbt.addOutput(output));

      // Step 5: Calculate and add change output
      console.log(`estimatedFee=${estimatedFee}, totalInputValue=${totalInputValue}, totalOutputValue=${totalOutputValue}`);
      const changeAmount = totalInputValue - totalOutputValue - estimatedFee;
      if (changeAmount >= DUST_THRESHOLD) {
        psbt.addOutput({
          address: address, // Send change back to self
          value: changeAmount,
        });
      }

      // Step 6: Convert the PSBT to a Hex string for the wallet
      const rawTx = psbt.toHex();
      const indexesToSign = selectedUtxos.map((_, index) => index);

      // Step 7: Request signature and broadcast from the wallet
      const txReqRes = await myDoge.requestPsbt({
        rawTx: rawTx,
        indexes: indexesToSign,
        signOnly: false, // false = sign AND broadcast
      });

      console.log('Advanced send transaction result', txReqRes);
      setTxId(txReqRes.txId);
    } catch (e) {
      console.error('Advanced send failed:', e);
      alert(
        `Transaction failed. Check the browser console for details. Error: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }, [isConnected, myDoge, address, recipient1Address, recipient1Amount, recipient2Address, recipient2Amount, opReturnText]);

  const onSendInscription = useCallback(async () => {
    if (!isConnected()) return;

    try {
      const txReqRes = await myDoge.requestInscriptionTransaction({
        recipientAddress,
        location: inscriptionLocation,
      });
      console.log('request inscription transaction result', txReqRes);
      setTxId(txReqRes.txId);
    } catch (e) {
      console.error(e);
    }
  }, [isConnected, myDoge, recipientAddress, inscriptionLocation]);

  const onGetDRC20Balance = useCallback(async () => {
    if (!isConnected()) return;

    try {
      const balanceRes = await myDoge.getDRC20Balance({
        ticker: drc20Ticker,
      });
      console.log('request drc-20 balance result', balanceRes);
      setDrc20Inscriptions([]);
      setDrc20Available(balanceRes.availableBalance);
      setDrc20Transferable(balanceRes.transferableBalance);
    } catch (e) {
      console.error(e);
    }
  }, [isConnected, myDoge, drc20Ticker]);

  const onGetDRC20Inscriptions = useCallback(async () => {
    if (!isConnected()) return;

    try {
      const transferableRes = await myDoge.getTransferableDRC20({
        ticker: drc20Ticker,
      });
      console.log('request drc-20 transferable result', transferableRes);
      setDrc20Inscriptions(transferableRes.inscriptions);
    } catch (e) {
      console.error(e);
    }
  }, [isConnected, myDoge, drc20Ticker]);

  const onAvailableDRC20 = useCallback(async () => {
    if (!isConnected()) return;

    try {
      const txReqRes = await myDoge.requestAvailableDRC20Transaction({
        ticker: drc20Ticker,
        amount: drc20Amount,
      });
      console.log('request available drc-20 tx result', txReqRes);
      setTxId(txReqRes.txId);
    } catch (e) {
      console.error(e);
    }
  }, [isConnected, myDoge, drc20Ticker, drc20Amount]);

  const onGetDunesBalance = useCallback(async () => {
    if (!isConnected()) return;

    try {
      const balanceRes = await myDoge.getDunesBalance({
        ticker: dunesTicker,
      });
      console.log('request dunes balance result', balanceRes);

      setDunesBalance(balanceRes.balance);
    } catch (e) {
      console.error(e);
    }
  }, [isConnected, myDoge, dunesTicker]);

  const onSendDunes = useCallback(async () => {
    if (!isConnected()) return;

    try {
      const txReqRes = await myDoge.requestDunesTransaction({
        ticker: dunesTicker,
        recipientAddress,
        amount: dunesAmount,
      });
      console.log('request dunes transaction result', txReqRes);
      setTxId(txReqRes.txId);
    } catch (e) {
      console.error(e);
    }
  }, [isConnected, myDoge, recipientAddress, dunesTicker, dunesAmount]);

  const txStatus = useCallback(async () => {
    if (txId) {
      const txStatusRes = await myDoge.getTransactionStatus({
        txId,
      });
      console.log('transaction status result', txStatusRes);
      // Once confirmed, stop polling and update balance
      if (txStatusRes.status === 'confirmed' && txStatusRes.confirmations > 1) {
        const balanceRes = await myDoge.getBalance();
        console.log('balance result', balanceRes);
        setBalance(sb.toBitcoin(balanceRes.balance));
        setTxId('');
      }
    }
  }, [myDoge, txId]);

  const onSendPSBT = useCallback(async () => {
    if (!isConnected()) return;
    const signOnly = true;

    try {
      const txReqRes = await myDoge.requestPsbt({
        rawTx,
        indexes: psbtIndexes,
        signOnly, // Optionally return the signed transaction instead of broadcasting
      });
      console.log('request send psbt result', txReqRes);

      if (!signOnly) {
        setTxId(txReqRes.txId);
      }
    } catch (e) {
      console.error(e);
    }
  }, [isConnected, myDoge, psbtIndexes, rawTx]);

  const onSignMessage = useCallback(async () => {
    if (!isConnected()) return;

    try {
      const signMsgRes = await myDoge.requestSignedMessage({
        message: signMessage,
      });
      console.log('request sign message result', signMsgRes);
    } catch (e) {
      console.error(e);
    }
  }, [isConnected, myDoge, signMessage]);

  const onDecryptMessage = useCallback(async () => {
    if (!isConnected()) return;

    try {
      const decryptMsgRes = await myDoge.requestDecryptedMessage({
        message: decryptMessage,
      });
      console.log('request decrypt message result', decryptMsgRes);
    } catch (e) {
      console.error(e);
    }
  }, [isConnected, myDoge, decryptMessage]);

  useInterval(txStatus, 10000, false);

  return (
    <>
      <Head>
        <title>MyDoge</title>
        <meta name='description' content='Sample integration' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <main className={styles.main}>
        <div className={styles.item}>
          <div>
            <a
              href='https://github.com/mydoge-com/mydogemask'
              target='_blank'
              rel='noopener noreferrer'
            >
              Checkout MyDoge Wallet Browser Extension on GitHub
              <Image
                src='/github.svg'
                alt='GitHub Logo'
                width={25}
                height={25}
                priority
              />
            </a>
          </div>
        </div>

        <div className={styles.center}>
          <button onClick={onConnect}>{btnText}</button>
        </div>

        {/* Debug information */}
        <div style={{ margin: '20px', padding: '10px', backgroundColor: '#f0f0f0', fontSize: '12px' }}>
          <div>Debug Info:</div>
          <div>Connected: {connected ? 'Yes' : 'No'}</div>
          <div>MyDoge Available: {myDoge?.isMyDoge ? 'Yes' : 'No'}</div>
          <div>Address: {address || 'None'}</div>
        </div>

        {connected && (
          <div className={styles.container}>
            <div className={styles.item}>Address: {address}</div>
            <div className={styles.item}>Balance: {balance}</div>
            <div className={styles.center}>
              <button onClick={onTip}>Tip MyDoge Team 4.20</button>
            </div>
            --------------------------------------------------------------------
            <div className={styles.center}>高级多输出发送 (支持 OP_RETURN)</div>
            <div className={styles.item}>收款地址 1:</div>
            <input
              type='text'
              style={{ width: '365px' }}
              value={recipient1Address}
              onChange={(e) => setRecipient1Address(e.target.value)}
            />
            <div className={styles.item}>金额 1 (DOGE):</div>
            <input
              type='text'
              style={{ width: '100px' }}
              value={recipient1Amount}
              onChange={(e) => setRecipient1Amount(e.target.value)}
            />
            <div className={styles.item}>收款地址 2 (可选):</div>
            <input
              type='text'
              style={{ width: '365px' }}
              value={recipient2Address}
              onChange={(e) => setRecipient2Address(e.target.value)}
            />
            <div className={styles.item}>金额 2 (DOGE):</div>
            <input
              type='text'
              style={{ width: '200px' }}
              value={recipient2Amount}
              onChange={(e) => setRecipient2Amount(e.target.value)}
            />
            <div className={styles.item}>OP_RETURN 文本 (可选):</div>
            <input
              type='text'
              style={{ width: '500px' }}
              value={opReturnText}
              onChange={(e) => setOpReturnText(e.target.value)}
            />
            <div className={styles.center}>
              <button onClick={onAdvancedSend}>
                高级模式发送交易
              </button>
            </div>
            --------------------------------------------------------------------
            {/* <div className={styles.center}>
              Inscription location (Doginal/DRC-20) (txid:vout:offset)
            </div>
            <input
              type='text'
              style={{ width: '485px' }}
              value={inscriptionLocation}
              onChange={(text) => {
                setinscriptionLocation(text.target.value);
              }}
            />
            <div className={styles.center}>Inscription recipient address</div>
            <input
              type='text'
              style={{ width: '265px' }}
              value={recipientAddress}
              onChange={(text) => {
                setRecipientAddress(text.target.value);
              }}
            />
            <div className={styles.center}>
              <button onClick={onSendInscription}>Send Inscription</button>
            </div> */}
            --------------------------------------------------------------------
            {/* <div className={styles.center}>DRC-20 Ticker</div>
            <input
              type='text'
              style={{ width: '35px' }}
              value={drc20Ticker}
              onChange={(text) => {
                setDrc20Ticker(text.target.value);
              }}
            />
            <div className={styles.center}>
              <button onClick={onGetDRC20Balance}>Get DRC-20 Balance</button>
            </div>
            {drc20Available && (
              <div className={styles.item}>
                Available Balance: {drc20Available}
              </div>
            )}
            {drc20Transferable && (
              <div className={styles.item}>
                Transferable Balance: {drc20Transferable}
              </div>
            )}
            {drc20Available || drc20Transferable ? (
              <input
                type='text'
                className={styles.item}
                style={{ width: '100px' }}
                value={drc20Amount}
                onChange={(text) => {
                  setDrc20Amount(text.target.value);
                }}
              />
            ) : null}
            {drc20Available && drc20Available !== '0' && (
              <div className={styles.center}>
                <button onClick={() => onAvailableDRC20()}>
                  Make Transferable
                </button>
              </div>
            )}
            {drc20Transferable && drc20Transferable !== '0' && (
              <div className={styles.center}>
                <button onClick={() => onGetDRC20Inscriptions()}>
                  Get Transferable DRC-20
                </button>
              </div>
            )}
            {drc20Inscriptions.length > 0 &&
              (drc20Inscriptions as any[]).map((inscription) => (
                <div key={inscription.location}>
                  {inscription.location} {inscription.ticker}{' '}
                  {inscription.amount}
                </div>
              ))} */}
            --------------------------------------------------------------------
            {/* <div className={styles.center}>Dunes Ticker</div>
            <input
              type='text'
              style={{ width: '130px' }}
              value={dunesTicker}
              onChange={(text) => {
                setDunesTicker(text.target.value);
              }}
            />
            <div className={styles.center}>
              <button onClick={onGetDunesBalance}>Get Dunes Balance</button>
            </div>
            {dunesBalance && (
              <div className={styles.container}>
                <div className={styles.item}>Dunes Balance: {dunesBalance}</div>
                <div className={styles.item}>Dunes Recipient Address</div>
                <input
                  className={styles.item}
                  type='text'
                  style={{ width: '265px' }}
                  value={recipientAddress}
                  onChange={(text) => {
                    setRecipientAddress(text.target.value);
                  }}
                />
                <div className={styles.item}>Dunes Amount</div>
                <input
                  type='text'
                  className={styles.item}
                  style={{ width: '100px' }}
                  value={dunesAmount}
                  onChange={(text) => {
                    setDunesAmount(text.target.value);
                  }}
                />
                <button className={styles.item} onClick={onSendDunes}>
                  Send Dunes
                </button>
              </div>
            )} */}
            --------------------------------------------------------------------
            {/* <div className={styles.item}>Send PSBT</div>
            <div className={styles.item}>Raw TX</div>
            <input
              type='text'
              className={styles.item}
              style={{ width: '500px' }}
              value={rawTx}
              onChange={(text) => {
                setRawTx(text.target.value);
              }}
            />
            <div className={styles.item}>Input Indexes (csv)</div>
            <input
              type='text'
              className={styles.item}
              style={{ width: '150px' }}
              value={psbtIndexes.join(',')}
              onChange={(text) => {
                if (text?.target?.value) {
                  const indexes = text.target.value.split(',').map(Number);
                  setPsbtIndexes(indexes);
                }
              }}
            />
            <div className={styles.center}>
              <button onClick={() => onSendPSBT()}>Send PSBT</button>
            </div>
            --------------------------------------------------------------------
            <div className={styles.item}>Sign Message</div>
            <input
              type='text'
              className={styles.item}
              style={{ width: '500px' }}
              value={signMessage}
              onChange={(text) => {
                setSignMessage(text.target.value);
              }}
            />
            <div className={styles.center}>
              <button onClick={() => onSignMessage()}>Sign Message</button>
            </div> */}
            --------------------------------------------------------------------
            {/* <div className={styles.item}>Decrypt Message</div>
            <input
              type='text'
              className={styles.item}
              style={{ width: '500px' }}
              value={decryptMessage}
              onChange={(text) => {
                setDecryptMessage(text.target.value);
              }}
            />
            <div className={styles.center}>
              <button onClick={() => onDecryptMessage()}>
                Decrypt Message
              </button>
            </div> */}
          </div>
        )}
      </main>
    </>
  );
}
