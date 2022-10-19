import { PublicKey } from '@solana/web3.js';
import axios from 'axios'
const CLUSTER_API = `https://metaplex.devnet.rpcpool.com`;
const MINT = new PublicKey ("CKAMTbtpzRuCYpxg7WftSoTxc6B6Ym4WKYXCwHHv2zC3");
const VENDOR = new PublicKey ("HfF3ig5es1mqcZjKYLyMhE4ha6NAUQ7dFU8Lq9vxzCU3");
const getAccountInfo = async (pubkey: String) => {
  const result = await axios.post(CLUSTER_API, {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getAccountInfo",
    "params": [
      pubkey,
      {
        "encoding": "jsonParsed"
      }
    ]
  })
  
  return result.data;
}

const getTokenAccountByOwner = async (owner: String, mint: String) => {
  const result = await axios.post(CLUSTER_API, {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getTokenAccountsByOwner",
    "params": [
      owner,
      {
        "mint": mint
      },
      {
        "encoding": "jsonParsed"
      }
    ]
  });
  return result.data;
}

const getRecentBlockHash = async () => {
  const result = await axios.post(CLUSTER_API, {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getRecentBlockhash",
  });
  return result.data;
}

const getBlockTime = async (block: number) => {
  const result = await axios.post(CLUSTER_API, 
    {
      "jsonrpc":"2.0",
      "id":1, 
      "method":"getBlockTime",
      "params":[block]}
    );
  return result.data;
}

export {
  MINT,
  VENDOR,
  getAccountInfo,
  getTokenAccountByOwner,
  getRecentBlockHash,
  getBlockTime
}