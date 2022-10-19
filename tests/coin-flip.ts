import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { CoinFlip } from "../target/types/coin_flip";
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  createMint,
  TOKEN_PROGRAM_ID,
  transfer,
  getAccount,
  mintTo
} from "@solana/spl-token"
const { SystemProgram, LAMPORTS_PER_SOL } = anchor.web3;
import axios from 'axios'

import * as assert from "assert";
import { expect } from "chai";
const program = anchor.workspace.CoinFlip;

const CLUSTER_API = `http://127.0.0.1:8899`;

function programForUser(user) {
  return new anchor.Program(program.idl, program.programId, user.provider);
}
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
async function play(provider, program, coinFlipPda, playerOne, playerTwo,vendorTokenAccount,playerTokenAccount,coinFlipPdaTokenAccount) {
  const playerChoice = 1;
  const randomSeed = new anchor.BN(Math.floor(Math.random() * 100000));

  const tx = await program.rpc.play(playerChoice, randomSeed, {
    accounts: {
      coinFlip: coinFlipPda,
      vendor: playerOne.publicKey,
      player: playerTwo.publicKey,
      tokenProgram:TOKEN_PROGRAM_ID,
      tokenFrom:playerTokenAccount,
      tokenTo:coinFlipPdaTokenAccount,
      vendorTokenAccount:vendorTokenAccount,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
    signers: playerTwo instanceof (anchor.Wallet as any) ? [] : [playerTwo],
  });

  const gameState = await program.account.coinFlip.fetch(coinFlipPda);
  console.log("playerTwo: ", playerTwo.publicKey.toString());
  console.log("Winner:", gameState.state.finished.winner.toString());
  console.log({ gameState: gameState.players });
  await provider.connection.confirmTransaction(tx);
}

describe("coin-flip", () => {

  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  let connection = provider.connection;

  it("setups the game", async () => {
    const vendorWallet = anchor.web3.Keypair.generate();
    const player = anchor.web3.Keypair.generate();

    let sig = await provider.connection.requestAirdrop(player.publicKey, 1000000000000);
    await provider.connection.confirmTransaction(sig);

    let sig2 = await provider.connection.requestAirdrop(vendorWallet.publicKey, 1000000000000);
    await provider.connection.confirmTransaction(sig2);

    

    const [coinFlipPDA, _] = await anchor.web3.PublicKey.findProgramAddress(
      [anchor.utils.bytes.utf8.encode("coin-flip"), vendorWallet.publicKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );


    const { result }= await getAccountInfo(coinFlipPDA.toString());
    console.log("result----------------:",result.value);
    

    // Create new token mint
    const mint = await createMint(connection, vendorWallet, vendorWallet.publicKey, null, 9);

    // Get the token account of the fromWallet address, and if it does not exist, create it
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        vendorWallet,
        mint,
        vendorWallet.publicKey
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, vendorWallet, mint, coinFlipPDA,true);
    const playerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, player, mint, player.publicKey,true);


    let signature = await mintTo(
      connection,
      vendorWallet,
      mint,
      fromTokenAccount.address,
      vendorWallet.publicKey,
      1000000000
  );
  console.log('mint tx:', signature);

  const vendorProgram = programForUser(vendorWallet);
  const playerProgram = programForUser(player);

  const randomSeed = new anchor.BN(Math.floor(Math.random() * 100000));
  const betAmount = new anchor.BN(50000);

  // Transfer the new token to the "toTokenAccount" we just created
  signature = await transfer(
      connection,
      vendorWallet,
      fromTokenAccount.address,
      playerTokenAccount.address,
      vendorWallet.publicKey,
      500000000
  );

  let TOKEN_PROGRAM = new anchor.web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

  await vendorProgram.rpc.init(player.publicKey,
    {
    accounts: {
      coinFlip: coinFlipPDA,
      vendor: vendorWallet.publicKey,
      player: player.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
    signers: [vendorWallet],
  });


  await vendorProgram.rpc.setup(player.publicKey, betAmount, randomSeed, {
    accounts: {
      coinFlip: coinFlipPDA,
      vendor: vendorWallet.publicKey,
      tokenProgram:TOKEN_PROGRAM,
      tokenFrom : fromTokenAccount.address,
      tokenTo : toTokenAccount.address,
      playerToken : playerTokenAccount.address,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
    signers: [vendorWallet],
  });

  await play(provider, playerProgram, coinFlipPDA, vendorWallet, player,fromTokenAccount.address,playerTokenAccount.address,toTokenAccount.address);
  

  const tokenAccountInfo = await getAccount(
    connection,
    fromTokenAccount.address
  )
  
  console.log(tokenAccountInfo.amount);



  await vendorProgram.rpc.setup(player.publicKey, betAmount, randomSeed, {
    accounts: {
      coinFlip: coinFlipPDA,
      vendor: vendorWallet.publicKey,
      tokenProgram:TOKEN_PROGRAM,
      tokenFrom : fromTokenAccount.address,
      tokenTo : toTokenAccount.address,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
    signers: [vendorWallet],
  });

  await play(provider, playerProgram, coinFlipPDA, vendorWallet, player,fromTokenAccount.address,playerTokenAccount.address,toTokenAccount.address);
  

  const secondtokenAccountInfo = await getAccount(
    connection,
    fromTokenAccount.address
  )
  
  console.log(secondtokenAccountInfo.amount);
  });
});
