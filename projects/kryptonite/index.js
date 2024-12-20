const { queryContractWithRetries, getToken, getTokenBalance } = require("../helper/chain/cosmos");

const getReservesAbi = "function getReserves() view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)";
const totalSupplyAbi = "uint256:totalSupply";
const decimalsAbi = "uint256:decimals";
const token0Abi = "address:token0";
const token1Abi = "address:token1";

// node test.js projects/kryptonite/index.js
const config = {
  sei: {
    coinGeckoId: "sei-network",
    hub: "sei1swe2fy3t49j2c2xl8l64ldjaqyr6khmaya60pl5kr4em2v2jp0ysa3xjum",
    seilorLps: [
      {
        name: "SEILOR-USEI-LP",
        lp: "sei1cw59j944v9uvseq3jz67tft7p92yhnff0l52eek3d5qnxj908wpqz4vrr8",
        pair: "sei13pzdhenzugwa02tm975g2y5kllj26rf4x4ykpqtrfw2h4mcezmmqz06dfr",
        staking: "sei17na3tj5mjnz0f4s3gqa3eqykzp4qk5qz4uvmz7hzak2zwyh5ym7s7ljcay"
      },
      {
        name: "STSEI-USEI-LP",
        lp: "sei1y03a4m9etthj9w5mz7sltqcgh05ss09cjrezstfgqt28sgsvqxwsapqwfx",
        pair: "sei1jqkqp7ql0n9edp9e7y86znt0m2h7rstlc2rwfvyxzrj84et9czaq89uqdx",
        staking: "sei1x4jr7j63tq37lm8m0pmkdsjjtswsvpvmfhug9az207zp4m9a5j6s04gz0n"
      },
      {
        name: "STSEI-SEIYAN-LP",
        lp: "sei1hxh76ty0fk9esq3qsvrhzz6fsvmh55j59xnduswn6dfnsyjs06vqcye8yf",
        pair: "sei1qgyrkxvnydcvtzj8w6e4n2p07pykxw4y25ntncz5a4puz6fd6e9slq6jgk",
        staking: "sei1400dydwghdkpxz9tqzv2f9nr7p04tvwawkvxsxf9xqvylec593fs73vr53"
      },
      {
        name: "SEILOR-USEI-WLP",
        lp: "sei1lahjp2h2wchtncxsszpjeu5kr77wmn6uh354hu0l57pym9p3mvys8qnpp6",
        lpEvm: "0xe7d76b9affb1f7a7bcf0b9206386d570e16bc17a",
        pair: "sei1lahjp2h2wchtncxsszpjeu5kr77wmn6uh354hu0l57pym9p3mvys8qnpp6",
        staking: "sei1ckske9cf8kw9ea66n5p3xpnz4ns3ruw052zcyhdsqpm54jjy3t9qjn7c7l",
        wrapperLpEvm: true
      },
      {
        name: "STSEI-USEI-WLP",
        lp: "sei16pe95h9uujjdp660tzsuv0utp9zymw926j604lx3p53rsy2tjh3s7ypvnu",
        lpEvm: "0xa543dfa5c278d0d8499676e17b7f6bfd8ce18e39",
        pair: "sei16pe95h9uujjdp660tzsuv0utp9zymw926j604lx3p53rsy2tjh3s7ypvnu",
        staking: "sei1488mn0n3j3dv36nk9t2zkz3c5x8xsmfkmx36qg57z2xnkl6a5tns6stzm6",
        wrapperLpEvm: true
      }
    ],
    coinGeckoMap: {
      usei: "sei-network",
      "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7": "sei-network", // wSEI EVM
      sei1xq7g6asf63mkv7t5jkfu6uf8jpzkvwnu4zl2kh4cfvk0ynxvvksqf7z3d2: "sei-network", // bSEI
      sei1ln7ntsqmxl8s502f83km9a475zyhcfhpj7v2fsm3pcmckdyys3tsktx9vk: "kryptonite-staked-sei", // stSEI
      "0xe5085112160fF75ee89a540Cdba570eAFdAF7f57": "kryptonite-staked-sei", // stSEI EVM
      sei10knxlv9e54z0xcywdhtycc63uf970aefeec73ycqwd75ep9nu45sh66m6a: "kryptonite", // SEILOR
      "0x89aeC21572F6637cCbd0d66861AAAC46Dd775ed1": "kryptonite", // SEILOR EVM
      sei1hrndqntlvtmx2kepr0zsfgr7nzjptcc72cr4ppk4yav58vvy7v3s4er8ed: "seiyan"
    }
  },
  nibiru: {
    coinGeckoId: "nibiru",
    hub: "nibi1dvepyy7s2nkfep05c4v6tfkmzqyvz7x3nj6ddj3kkr8nfsmmylhqy7t9a0",
    seilorLps: [],
    coinGeckoMap: {
      unibiru: "nibiru",
      nibi1fke5pfygutantkfd9lakf9e8zu06cq43tss6avclm8lhkskr4f3semnvx5: "nibiru"
    }
  }
};

function getCoinGeckoId(chain, denom) {
  return config[chain].coinGeckoMap[denom];
}

module.exports = {
  timetravel: false
};

Object.keys(config).forEach(chain => {
  const { coinGeckoId, hub, seilorLps } = config[chain];

  module.exports[chain] = {
    tvl: async (api) => {
      // Logic for calculating TVL excluding staked LP tokens
      const { total_bond_stsei_amount, total_bond_st_amount } = await queryContractWithRetries({ contract: hub, chain, data: { state: {} } });
      api.add(coinGeckoId, (total_bond_stsei_amount ?? total_bond_st_amount) / 10 ** 6, { skipChain: true });
      return api.getBalances();
    },
    pool2: async (api) => {
      // Logic for calculating the value of staked LP tokens
      for (let { lp, pair, staking, pairInfo, wrapperLpEvm, lpEvm } of seilorLps) {
        if (!wrapperLpEvm) {
          const lpTokenInfo = await queryContractWithRetries({ contract: lp, chain, data: { token_info: {} } });
          const stakingState = await queryContractWithRetries({ contract: staking, chain, data: { query_staking_state: {} } });
          if (!pairInfo) {
            pairInfo = await queryContractWithRetries({ contract: pair, chain, data: { pair: {} } });
          }
          const token0Obj = pairInfo.asset_infos[0];
          const token1Obj = pairInfo.asset_infos[1];
          const token0 = getToken(token0Obj);
          const token1 = getToken(token1Obj);
          const token0Balance = await getTokenBalance({ token: token0Obj, owner: pair, chain });
          const token1Balance = await getTokenBalance({ token: token1Obj, owner: pair, chain });
          const token0Staked = token0Balance * stakingState.total_supply / lpTokenInfo.total_supply / 10 ** 6;
          const token1Staked = token1Balance * stakingState.total_supply / lpTokenInfo.total_supply / 10 ** 6;

          api.add(getCoinGeckoId(chain, token0), token0Staked, { skipChain: true });
          api.add(getCoinGeckoId(chain, token1), token1Staked, { skipChain: true });
        } else {
          // Logic for calculating the value of staked wrapper EVM LP tokens
          const stakingState = await queryContractWithRetries({ contract: staking, chain, data: { query_staking_state: {} } });

          const [reserveAmounts, totalSupply, token0, token1] = await api.batchCall([
            { target: lpEvm, abi: getReservesAbi },
            { target: lpEvm, abi: totalSupplyAbi },
            { target: lpEvm, abi: token0Abi },
            { target: lpEvm, abi: token1Abi }
          ]);
          const [token0Decimals, token1Decimals] = await api.batchCall([
            { target: token0, abi: decimalsAbi },
            { target: token1, abi: decimalsAbi }
          ]);

          const token0Staked = reserveAmounts[0] * stakingState.total_supply / totalSupply / 10 ** token0Decimals;
          const token1Staked = reserveAmounts[1] * stakingState.total_supply / totalSupply / 10 ** token1Decimals;

          api.add(getCoinGeckoId(chain, token0), token0Staked, { skipChain: true });
          api.add(getCoinGeckoId(chain, token1), token1Staked, { skipChain: true });
        }
      }

      return api.getBalances();
    }
  };
});
