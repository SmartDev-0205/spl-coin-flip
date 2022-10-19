import { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { useState } from 'react'
import { useProgram } from '../hooks/useProgram'
import * as anchor from '@project-serum/anchor'
import * as api from '../utils'
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import { associated } from '@project-serum/anchor/dist/cjs/utils/pubkey'
import { publicKey } from '@project-serum/anchor/dist/cjs/utils'
import { PublicKey } from '@solana/web3.js'

const Play: NextPage = () => {
  const { program, wallet, connection } = useProgram()
  const [betAmount, setBetAmount] = useState('')
  const [betSide, setBetSide] = useState(0)
  const [statusInfo, setStatusInfo] = useState('Idle')
  const [isLoading, setIsLoading] = useState(false)

  const playFlip = async () => {
    try {

      const vendorTokenAccount: any = await getAssociatedTokenAddress(
        api.MINT,
        api.VENDOR,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
      if (parseFloat(betAmount) < 0.1 || parseFloat(betAmount) > 5) {
        setStatusInfo('Please enter a bet between 0.1 and 5 SOL.')
        return
      }
      if (wallet && program && connection) {

        setIsLoading(true)
        const amount = parseFloat(betAmount) * anchor.web3.LAMPORTS_PER_SOL

        const data = {
          playerPublicKey: wallet.publicKey.toString(),
          amount,
          side: betSide
        }

        try {
          setStatusInfo('Generating a random seed')
          const response = await fetch('/api/setup', {
            method: 'POST',
            body: JSON.stringify(data)
          })

          const responseJson = await response.json()
          const randomSeed = new anchor.BN(Math.floor(Math.random() * 100000))

          const playerTokenAccount: any = await getAssociatedTokenAddress(
            api.MINT,
            wallet!.publicKey
          )
          const { result } = await api.getAccountInfo(playerTokenAccount.toString());
          console.log(result);
          if (result.value == null) {
            setStatusInfo("Please Deposit spl");
            setIsLoading(false);
            return;
          }
          console.log(playerTokenAccount, playerTokenAccount.address);
          const tokenAccountInfo = await getAccount(
            connection,
            playerTokenAccount
          )

          console.log(tokenAccountInfo.amount);

          if (tokenAccountInfo.amount < parseFloat(betAmount) * 10 ** 9) {
            setStatusInfo("Please Deposit more spl");
            setIsLoading(false);
            return;
          }


          const vendorTokenAccount: any = await getAssociatedTokenAddress(
            api.MINT,
            api.VENDOR
          )
          const pdaTokenAccount: any = await getAssociatedTokenAddress(
            api.MINT,
            new PublicKey(responseJson.coinFlipPDA),
            true,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )

          setStatusInfo('Waiting for user confirmation')
          const tx = await program.rpc.play(betSide, randomSeed, {
            accounts: {
              coinFlip: responseJson.coinFlipPDA,
              vendor: responseJson.vendor,
              player: wallet.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              tokenFrom: playerTokenAccount,
              tokenTo: pdaTokenAccount,
              vendorTokenAccount: vendorTokenAccount,
              systemProgram: anchor.web3.SystemProgram.programId
            }
          })

          await connection.confirmTransaction(tx)
          setStatusInfo('Waiting for transaction confirmation')

          const coinFlipData: any = await program.account.coinFlip.fetch(
            responseJson.coinFlipPDA
          )

          const winner = coinFlipData.state.finished.winner.toString()
          if (winner === wallet.publicKey.toString())
            setStatusInfo(`You won! Amount: ${betAmount} SPL`)
          else setStatusInfo(`You lost :(`)
          setIsLoading(false)
        } catch (error) {
          console.log(error)
          setStatusInfo('Something went wrong, please try again.')
          setIsLoading(false)
        }
      }
    } catch (error) {
      setIsLoading(false)
    }
  }

  const selectInput = (amount: string, e: any) => {
    setBetAmount(amount);
    // isActive
  }

  return (
    <>
      <div className='max-w-7xl mx-auto py-4 px-4  sm:px-6 lg:px-8'></div>
      <div className='flex justify-center flex-col'>
        <div className='flex w-full text-center mb-16'>
          <h1 className='m-auto text-3xl text-sky-600 font-extrabold p-2 sm:p-2'>
            Welcome to our SPLCOINFLIP Game
          </h1>
        </div>
        <div
          className={`flex m-auto mb-6 ${isLoading ? 'spinner-logo' : 'spinner-logo-stop'
            } `}
        >
          <img src='/favicon.ico' width={'150px'} alt='' />
        </div>
        <div className='flex justify-center'>
          <div className='bg-white p-0 sm:p-6 lg:p-16 dark:bg-gray-800 dark:border-gray-700 sm:w-1/2'>
            <form className='space-y-6 pb-3' action='#'>
              <h5 className='text-center text-xl font-medium text-gray-900 dark:text-white'>
                I LIKE
              </h5>
              <div className='flex gap-4'>
                <button
                  className={`w-full bg-[#0072c2] text-white ${betSide === 0 ? 'bg-[#399946]' : 'red'
                    } hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium text-sm px-5 py-2.5 text-center`}
                  onClick={() => setBetSide(0)}
                >
                  Heads
                </button>
                <button
                  className={`w-full bg-[#0072c2] text-white ${betSide === 1 ? 'bg-[#399946]' : 'bg-black-200'
                    } hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium text-sm px-5 py-2.5 text-center`}
                  onClick={() => setBetSide(1)}
                >
                  Tails
                </button>
              </div>
              <div>
                {/* <label
                  htmlFor='amount'
                  className='block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300'
                >
                  Bet amount in SOL
                </label>
                <input
                  type='number'
                  id='amount'
                  className={`bg-gray-50 border border-gray-300 text-gray-900 text-sm focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white`}
                  placeholder='0.1'
                  step='0.1'
                  onChange={e => setBetAmount(e.target.value)}
                /> */}
                <div className='w-full flex justify-between items-center gap-4 flex-col'>
                  <div className='w-full flex justify-between items-center gap-4 flex-wrap sm:flex-nowrap'>
                    <button
                      className={`${betAmount == '1' && 'bg-[#399946]'} w-full break-words text-white bg-[#0072c2] hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium text-sm px-5 py-2.5 text-cene:anyter`}
                      onClick={(e: any) => selectInput('1', e)}
                    >
                      1 SPL
                    </button>
                    <button
                      className={`${betAmount == '2' && 'bg-[#399946]'} w-full text-white bg-[#0072c2] hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium text-sm px-5 py-2.5 text-center`}
                      onClick={(e: any) => selectInput('2', e)}
                    >
                      2 SPL
                    </button>
                    <button
                      className={`${betAmount == '3' && 'bg-[#399946]'} w-full text-white bg-[#0072c2] hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium text-sm px-5 py-2.5 text-center`}
                      onClick={(e: any) => selectInput('3', e)}
                    >
                      3 SPL
                    </button>
                  </div>

                  <div className='w-full flex justify-between items-center gap-4 flex-wrap sm:flex-nowrap'>
                    <button
                      className={`${betAmount == '4' && 'bg-[#399946]'} w-full text-white bg-[#0072c2] hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium text-sm px-5 py-2.5 text-center`}
                      onClick={(e: any) => selectInput('4', e)}
                    >
                      4 SPL
                    </button>
                    <button
                      className={`${betAmount == '5' && 'bg-[#399946]'} w-full text-white bg-[#0072c2] hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium text-sm px-5 py-2.5 text-center`}
                      onClick={(e: any) => selectInput('5', e)}
                    >
                      5 SPL
                    </button>
                    <button
                      className={`${betAmount == '6' && 'bg-[#399946]'} w-full text-white bg-[#0072c2] hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium text-sm px-5 py-2.5 text-center`}
                      onClick={(e: any) => selectInput('6', e)}
                    >
                      6 SPL
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => playFlip()}
                className={`w-full text-white  ${betAmount !== '' ? 'bg-blue-700' : 'bg-gray-500'
                  } focus:ring-4  font-medium text-sm px-5 py-2.5 text-center`}
                disabled={betAmount === ''}
              >
                Play
              </button>
            </form>
            <p className='block text-sm font-medium text-gray-900 dark:text-gray-300 mt-3'>
              Status: {statusInfo}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default Play
