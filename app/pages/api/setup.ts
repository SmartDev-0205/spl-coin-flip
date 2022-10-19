// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import * as anchor from "@project-serum/anchor";
import * as idl from "../../coin_flip.json";
import { Connection, PublicKey } from "@solana/web3.js";
import { clusterApiUrl } from "@solana/web3.js";
import axios from 'axios'

const CLUSTER_API = `https://metaplex.devnet.rpcpool.com`;
const programId = "6dnQvFdv2Wgu3mD977Yur7z9ThrDWnhTVM5RjvwwH9My";
import {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"

type Data = {
  coinFlipPDA: string;
  vendor: string;
};

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

const preflightCommitment = "processed";
const commitment = "processed";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  let { playerPublicKey, amount } = JSON.parse(req.body);

  playerPublicKey = new PublicKey(playerPublicKey);
  amount = new anchor.BN(amount);

  const { VENDOR_SECRET_KEY,MINT } = process.env;
  if (!VENDOR_SECRET_KEY || !MINT) return;

  const mintPubKey = new PublicKey(MINT);
  const secretKeyArray = Uint8Array.from(JSON.parse(VENDOR_SECRET_KEY));
  console.log(secretKeyArray);

  const vendor = anchor.web3.Keypair.fromSecretKey(secretKeyArray);
  const vendorWallet = new anchor.Wallet(vendor);
  const connection = new Connection(
    "https://metaplex.devnet.rpcpool.com",
    commitment
  );
  const provider = new anchor.AnchorProvider(connection, vendorWallet, {
    preflightCommitment,
    commitment,
  });
  const program = new anchor.Program(idl as any, programId, provider);
  const randomSeed = new anchor.BN(Math.floor(Math.random() * 100000));
  const [coinFlipPDA, _] = await anchor.web3.PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode("coin-flip"),
      vendor.publicKey.toBuffer(),
      playerPublicKey.toBuffer(),
    ],
    program.programId
  );

  const { result }= await getAccountInfo(coinFlipPDA.toString());
  if(!result.value){
    const initTx = await program.rpc.init(playerPublicKey, {
      accounts: {
        coinFlip: coinFlipPDA,
        vendor: vendor.publicKey,
        player: playerPublicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [vendor],
    });
    await provider.connection.confirmTransaction(initTx);
  }

  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    vendor,
    mintPubKey,
    vendorWallet.publicKey
  );

  const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, vendor, mintPubKey, coinFlipPDA,true);

  const setupTx = await program.rpc.setup(playerPublicKey, amount, randomSeed, {
    accounts: {
      coinFlip: coinFlipPDA,
      vendor: vendorWallet.publicKey,
      tokenProgram:TOKEN_PROGRAM_ID,
      tokenFrom : fromTokenAccount.address,
      tokenTo : toTokenAccount.address,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
    signers: [vendor],
  });
  await provider.connection.confirmTransaction(setupTx);
  
  res.status(200).json({
    coinFlipPDA: coinFlipPDA.toString(),
    vendor: vendor.publicKey.toString(),
  });
}
