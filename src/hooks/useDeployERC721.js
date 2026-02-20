import { useState } from 'react'
import { useAccount, useWaitForTransactionReceipt, useWalletClient, useChainId } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { parseEther, encodeAbiParameters, parseAbiParameters } from 'viem'
import { config, DATA_SUFFIX } from '../config/wagmi'
import { addXP, recordTransaction } from '../utils/xpUtils'
import { uploadToIPFS, uploadMetadataToIPFS, createNFTMetadata } from '../utils/pinata'
import { useNetworkCheck } from './useNetworkCheck'
import { useQuestSystem } from './useQuestSystem'
import { useFarcaster } from '../contexts/FarcasterContext'
import { NETWORKS, getContractAddressByNetwork } from '../config/networks'
import { BASEHUB_DEPLOYER_ABI, DEPLOYER_FEE_ETH, encodeDeployerCall } from '../config/deployer'

// ERC721 Contract ABI
const ERC721_ABI = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "ERC721IncorrectOwner",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ERC721InsufficientApproval",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "approver",
				"type": "address"
			}
		],
		"name": "ERC721InvalidApprover",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			}
		],
		"name": "ERC721InvalidOperator",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "ERC721InvalidOwner",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "receiver",
				"type": "address"
			}
		],
		"name": "ERC721InvalidReceiver",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "ERC721InvalidSender",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ERC721NonexistentToken",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "approved",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Approval",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "approved",
				"type": "bool"
			}
		],
		"name": "ApprovalForAll",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "approve",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "balanceOf",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "getApproved",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			}
		],
		"name": "isApprovedForAll",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "name",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ownerOf",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			},
			{
				"internalType": "bytes",
				"name": "data",
				"type": "bytes"
			}
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "approved",
				"type": "bool"
			}
		],
		"name": "setApprovalForAll",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "symbol",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "tokenURI",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "transferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]

export const useDeployERC721 = () => {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const { isCorrectNetwork, networkName, baseNetworkName, switchToBaseNetwork } = useNetworkCheck()
  const { updateQuestProgress } = useQuestSystem()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Get Farcaster context for SDK access
  const farcasterContext = useFarcaster()
  const isInFarcaster = farcasterContext?.isInFarcaster || false

  // Network validation - allow Base or InkChain
  const validateAndSwitchNetwork = async () => {
    if (!isCorrectNetwork) {
      // Don't auto-switch - let user choose network via RainbowKit
      throw new Error(`❌ SUPPORTED NETWORK REQUIRED!\n\nYou are currently on ${networkName}.\nBaseHub works on Base or InkChain networks.\n\nPlease switch to a supported network using RainbowKit's network selector.`)
    }
  }

  const deployERC721 = async (name, symbol, imageFile) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    // Validate and auto-switch network before proceeding
    await validateAndSwitchNetwork()

    setIsLoading(true)
    setError(null)

    try {
      console.log('🚀 Processing ERC721 deployment request:', { name, symbol })

      // Step 1: Upload image to IPFS (only if provided)
      let imageUrl = null
      let metadataUrl = ''
      
      if (imageFile) {
        console.log('📤 Uploading image to IPFS...')
        imageUrl = await uploadToIPFS(imageFile)
        console.log('✅ Image uploaded to IPFS:', imageUrl)

        // Step 2: Create and upload metadata to IPFS
        console.log('📤 Creating and uploading metadata to IPFS...')
        const metadata = createNFTMetadata(
          name,
          `${name} NFT Collection`,
          imageUrl,
          [
            { trait_type: "Collection", value: name },
            { trait_type: "Symbol", value: symbol }
          ]
        )
        metadataUrl = await uploadMetadataToIPFS(metadata)
        console.log('✅ Metadata uploaded to IPFS:', metadataUrl)
      } else {
        console.log('⏭️ No image provided, using default metadata URL')
        metadataUrl = `https://api.example.com/metadata/${name.toLowerCase().replace(/\s+/g, '-')}`
      }

      // Build initCode (bytecode + constructor)
      const ERC721_BYTECODE = "608060405234801561000f575f5ffd5b506040518060400160405280600881526020017f546f6b656e3732310000000000000000000000000000000000000000000000008152506040518060400160405280600381526020017f4d544b0000000000000000000000000000000000000000000000000000000000815250815f908161008a91906102df565b50806001908161009a91906102df565b5050506103ae565b5f81519050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f600282049050600182168061011d57607f821691505b6020821081036101305761012f6100d9565b5b50919050565b5f819050815f5260205f209050919050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f600883026101927fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82610157565b61019c8683610157565b95508019841693508086168417925050509392505050565b5f819050919050565b5f819050919050565b5f6101e06101db6101d6846101b4565b6101bd565b6101b4565b9050919050565b5f819050919050565b6101f9836101c6565b61020d610205826101e7565b848454610163565b825550505050565b5f5f905090565b610224610215565b61022f8184846101f0565b505050565b5b81811015610252576102475f8261021c565b600181019050610235565b5050565b601f8211156102975761026881610136565b61027184610148565b81016020851015610280578190505b61029461028c85610148565b830182610234565b50505b505050565b5f82821c905092915050565b5f6102b75f198460080261029c565b1980831691505092915050565b5f6102cf83836102a8565b9150826002028217905092915050565b6102e8826100a2565b67ffffffffffffffff811115610301576103006100ac565b5b61030b8254610106565b610316828285610256565b5f60209050601f831160018114610347575f8415610335578287015190505b61033f85826102c4565b8655506103a6565b601f19841661035586610136565b5f5b8281101561037c57848901518255600182019150602085019450602081019050610357565b868310156103995784890151610395601f8916826102a8565b8355505b6001600288020188555050505b505050505050565b611bc6806103bb5f395ff3fe608060405234801561000f575f5ffd5b50600436106100cd575f3560e01c80636352211e1161008a578063a22cb46511610064578063a22cb46514610221578063b88d4fde1461023d578063c87b56dd14610259578063e985e9c514610289576100cd565b80636352211e146101a357806370a08231146101d357806395d89b4114610203576100cd565b806301ffc9a7146100d157806306fdde0314610101578063081812fc1461011f578063095ea7b31461014f57806323b872dd1461016b57806342842e0e14610187575b5f5ffd5b6100eb60048036038101906100e69190611471565b6102b9565b6040516100f891906114b6565b60405180910390f35b61010961039a565b604051610116919061153f565b60405180910390f35b61013960048036038101906101349190611592565b610429565b60405161014691906115fc565b60405180910390f35b6101696004803603810190610164919061163f565b610444565b005b6101856004803603810190610180919061167d565b61045a565b005b6101a1600480360381019061019c919061167d565b610559565b005b6101bd60048036038101906101b89190611592565b610578565b6040516101ca91906115fc565b60405180910390f35b6101ed60048036038101906101e891906116cd565b610589565b6040516101fa9190611707565b60405180910390f35b61020b61063f565b604051610218919061153f565b60405180910390f35b61023b6004803603810190610236919061174a565b6106cf565b005b610257600480360381019061025291906118b4565b6106e5565b005b610273600480360381019061026e9190611592565b61070a565b604051610280919061153f565b60405180910390f35b6102a3600480360381019061029e9190611934565b610770565b6040516102b091906114b6565b60405180910390f35b5f7f80ac58cd000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916148061038357507f5b5e139f000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916145b806103935750610392826107fe565b5b9050919050565b60605f80546103a89061199f565b80601f01602080910402602001604051908101604052809291908181526020018280546103d49061199f565b801561041f5780601f106103f65761010080835404028352916020019161041f565b820191905f5260205f20905b81548152906001019060200180831161040257829003601f168201915b5050505050905090565b5f61043382610867565b5061043d826108ed565b9050919050565b6104568282610451610926565b61092d565b5050565b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036104ca575f6040517f64a0ae920000000000000000000000000000000000000000000000000000000081526004016104c191906115fc565b60405180910390fd5b5f6104dd83836104d8610926565b61093f565b90508373ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614610553578382826040517f64283d7b00000000000000000000000000000000000000000000000000000000815260040161054a939291906119cf565b60405180910390fd5b50505050565b61057383838360405180602001604052805f8152506106e5565b505050565b5f61058282610867565b9050919050565b5f5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036105fa575f6040517f89c62b640000000000000000000000000000000000000000000000000000000081526004016105f191906115fc565b60405180910390fd5b60035f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050919050565b60606001805461064e9061199f565b80601f016020809104026020016040519081016040528092919081815260200182805461067a9061199f565b80156106c55780601f1061069c576101008083540402835291602001916106c5565b820191905f5260205f20905b8154815290600101906020018083116106a857829003601f168201915b5050505050905090565b6106e16106da610926565b8383610b4a565b5050565b6106f084848461045a565b6107046106fb610926565b85858585610cb3565b50505050565b606061071582610867565b505f61071f610e5f565b90505f81511161073d5760405180602001604052805f815250610768565b8061074784610e75565b604051602001610758929190611a3e565b6040516020818303038152906040525b915050919050565b5f60055f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f9054906101000a900460ff16905092915050565b5f7f01ffc9a7000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916827bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916149050919050565b5f5f61087283610f3f565b90505f73ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036108e457826040517f7e2732890000000000000000000000000000000000000000000000000000000081526004016108db9190611707565b60405180910390fd5b80915050919050565b5f60045f8381526020019081526020015f205f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050919050565b5f33905090565b61093a8383836001610f78565b505050565b5f5f61094a84610f3f565b90505f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff161461098b5761098a818486611137565b5b5f73ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614610a16576109ca5f855f5f610f78565b600160035f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825403925050819055505b5f73ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1614610a9557600160035f8773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825401925050819055505b8460025f8681526020019081526020015f205f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550838573ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef60405160405180910390a4809150509392505050565b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610bba57816040517f5b08ba18000000000000000000000000000000000000000000000000000000008152600401610bb191906115fc565b60405180910390fd5b8060055f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f6101000a81548160ff0219169083151502179055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c3183604051610ca691906114b6565b60405180910390a3505050565b5f8373ffffffffffffffffffffffffffffffffffffffff163b1115610e58578273ffffffffffffffffffffffffffffffffffffffff1663150b7a02868685856040518563ffffffff1660e01b8152600401610d119493929190611ab3565b6020604051808303815f875af1925050508015610d4c57506040513d601f19601f82011682018060405250810190610d499190611b11565b60015b610dcd573d805f8114610d7a576040519150601f19603f3d011682016040523d82523d5f602084013e610d7f565b606091505b505f815103610dc557836040517f64a0ae92000000000000000000000000000000000000000000000000000000008152600401610dbc91906115fc565b60405180910390fd5b805160208201fd5b63150b7a0260e01b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916817bffffffffffffffffffffffffffffffffffffffffffffffffffffffff191614610e5657836040517f64a0ae92000000000000000000000000000000000000000000000000000000008152600401610e4d91906115fc565b60405180910390fd5b505b5050505050565b606060405180602001604052805f815250905090565b60605f6001610e83846111fa565b0190505f8167ffffffffffffffff811115610ea157610ea0611790565b5b6040519080825280601f01601f191660200182016040528015610ed35781602001600182028036833780820191505090505b5090505f82602083010190505b600115610f34578080600190039150507f3031323334353637383961626364656600000000000000000000000000000000600a86061a8153600a8581610f2957610f28611b3c565b5b0494505f8503610ee0575b819350505050919050565b5f60025f8381526020019081526020015f205f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050919050565b8080610fb057505f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614155b156110e2575f610fbf84610867565b90505f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff161415801561102957508273ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614155b801561103c575061103a8184610770565b155b1561107e57826040517fa9fbf51f00000000000000000000000000000000000000000000000000000000815260040161107591906115fc565b60405180910390fd5b81156110e057838573ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45b505b8360045f8581526020019081526020015f205f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050505050565b61114283838361134b565b6111f5575f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036111b657806040517f7e2732890000000000000000000000000000000000000000000000000000000081526004016111ad9190611707565b60405180910390fd5b81816040517f177e802f0000000000000000000000000000000000000000000000000000000081526004016111ec929190611b69565b60405180910390fd5b505050565b5f5f5f90507a184f03e93ff9f4daa797ed6e38ed64bf6a1f0100000000000000008310611256577a184f03e93ff9f4daa797ed6e38ed64bf6a1f010000000000000000838161124c5761124b611b3c565b5b0492506040810190505b6d04ee2d6d415b85acef81000000008310611293576d04ee2d6d415b85acef8100000000838161128957611288611b3c565b5b0492506020810190505b662386f26fc1000083106112c257662386f26fc1000083816112b8576112b7611b3c565b5b0492506010810190505b6305f5e10083106112eb576305f5e10083816112e1576112e0611b3c565b5b0492506008810190505b612710831061131057612710838161130657611305611b3c565b5b0492506004810190505b60648310611333576064838161132957611328611b3c565b5b0492506002810190505b600a8310611342576001810190505b80915050919050565b5f5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff161415801561140257508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1614806113c357506113c28484610770565b5b8061140157508273ffffffffffffffffffffffffffffffffffffffff166113e9836108ed565b73ffffffffffffffffffffffffffffffffffffffff16145b5b90509392505050565b5f604051905090565b5f5ffd5b5f5ffd5b5f7fffffffff0000000000000000000000000000000000000000000000000000000082169050919050565b6114508161141c565b811461145a575f5ffd5b50565b5f8135905061146b81611447565b92915050565b5f6020828403121561148657611485611414565b5b5f6114938482850161145d565b91505092915050565b5f8115159050919050565b6114b08161149c565b82525050565b5f6020820190506114c95f8301846114a7565b92915050565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f601f19601f8301169050919050565b5f611511826114cf565b61151b81856114d9565b935061152b8185602086016114e9565b611534816114f7565b840191505092915050565b5f6020820190508181035f8301526115578184611507565b905092915050565b5f819050919050565b6115718161155f565b811461157b575f5ffd5b50565b5f8135905061158c81611568565b92915050565b5f602082840312156115a7576115a6611414565b5b5f6115b48482850161157e565b91505092915050565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6115e6826115bd565b9050919050565b6115f6816115dc565b82525050565b5f60208201905061160f5f8301846115ed565b92915050565b61161e816115dc565b8114611628575f5ffd5b50565b5f8135905061163981611615565b92915050565b5f5f6040838503121561165557611654611414565b5b5f6116628582860161162b565b92505060206116738582860161157e565b9150509250929050565b5f5f5f6060848603121561169457611693611414565b5b5f6116a18682870161162b565b93505060206116b28682870161162b565b92505060406116c38682870161157e565b9150509250925092565b5f602082840312156116e2576116e1611414565b5b5f6116ef8482850161162b565b91505092915050565b6117018161155f565b82525050565b5f60208201905061171a5f8301846116f8565b92915050565b6117298161149c565b8114611733575f5ffd5b50565b5f8135905061174481611720565b92915050565b5f5f604083850312156117605761175f611414565b5b5f61176d8582860161162b565b925050602061177e85828601611736565b9150509250929050565b5f5ffd5b5f5ffd5b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b6117c6826114f7565b810181811067ffffffffffffffff821117156117e5576117e4611790565b5b80604052505050565b5f6117f761140b565b905061180382826117bd565b919050565b5f67ffffffffffffffff82111561182257611821611790565b5b61182b826114f7565b9050602081019050919050565b828183375f83830152505050565b5f61185861185384611808565b6117ee565b9050828152602081018484840111156118745761187361178c565b5b61187f848285611838565b509392505050565b5f82601f83011261189b5761189a611788565b5b81356118ab848260208601611846565b91505092915050565b5f5f5f5f608085870312156118cc576118cb611414565b5b5f6118d98782880161162b565b94505060206118ea8782880161162b565b93505060406118fb8782880161157e565b925050606085013567ffffffffffffffff81111561191c5761191b611418565b5b61192887828801611887565b91505092959194509250565b5f5f6040838503121561194a57611949611414565b5b5f6119578582860161162b565b92505060206119688582860161162b565b9150509250929050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f60028204905060018216806119b657607f821691505b6020821081036119c9576119c8611972565b5b50919050565b5f6060820190506119e25f8301866115ed565b6119ef60208301856116f8565b6119fc60408301846115ed565b949350505050565b5f81905092915050565b5f611a18826114cf565b611a228185611a04565b9350611a328185602086016114e9565b80840191505092915050565b5f611a498285611a0e565b9150611a558284611a0e565b91508190509392505050565b5f81519050919050565b5f82825260208201905092915050565b5f611a8582611a61565b611a8f8185611a6b565b9350611a9f8185602086016114e9565b611aa8816114f7565b840191505092915050565b5f608082019050611ac65f8301876115ed565b611ad360208301866115ed565b611ae060408301856116f8565b8181036060830152611af28184611a7b565b905095945050505050565b5f81519050611b0b81611447565b92915050565b5f60208284031215611b2657611b25611414565b5b5f611b3384828501611afd565b91505092915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601260045260245ffd5b5f604082019050611b7c5f8301856115ed565b611b8960208301846116f8565b939250505056fea26469706673582212206e2c97d5f4151e5095e5edf8104c7f3f8203265f80dbad1cffcf50f23878623364736f6c634300081e0033" // Add your bytecode here
      
      const constructorData = encodeAbiParameters(
        parseAbiParameters('string name, string symbol, string baseTokenURI'),
        [name, symbol, metadataUrl]
      )
      const initCode = ERC721_BYTECODE + constructorData.slice(2)

      let deployTxHash
      let contractAddress = null
      const deployerAddress = getContractAddressByNetwork('BASEHUB_DEPLOYER', chainId)

      if (deployerAddress) {
        console.log('📦 Deploying ERC721 via BaseHubDeployer (single tx)...')
        if (!walletClient) throw new Error('Wallet not available. Please connect your wallet.')
        const deployData = encodeDeployerCall('deployERC721', initCode)
        const deployDataWithSuffix = `${deployData}${DATA_SUFFIX.startsWith('0x') ? DATA_SUFFIX.slice(2) : DATA_SUFFIX}`
        deployTxHash = await walletClient.sendTransaction({
          to: deployerAddress,
          data: deployDataWithSuffix,
          value: parseEther(DEPLOYER_FEE_ETH),
          chainId,
          gas: 3000000n,
        })
        console.log('✅ Deploy transaction sent:', deployTxHash)
        const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
        const timeoutDuration = isOnInkChain ? 120000 : 60000
        const deployReceipt = await Promise.race([
          waitForTransactionReceipt(config, { hash: deployTxHash, chainId, confirmations: 1, pollingInterval: isOnInkChain ? 1000 : 4000 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Deploy confirmation timeout')), timeoutDuration)),
        ]).catch((e) => { console.warn('⚠️ Deploy confirmation timeout:', e.message); return null })
        if (deployReceipt?.logs?.length) {
          const deployerLog = deployReceipt.logs.find((l) => l.address?.toLowerCase() === deployerAddress.toLowerCase() && l.topics?.length >= 2)
          if (deployerLog?.topics?.[1]) contractAddress = '0x' + deployerLog.topics[1].slice(-40).toLowerCase()
        }
        console.log('✅ ERC721 deployed via deployer', contractAddress || '(check tx)')
      } else {
        const feeWallet = '0x7d2Ceb7a0e0C39A3d0f7B5b491659fDE4bb7BCFe'
        console.log('💰 Sending fee then deploying ERC721...')
        if (!walletClient) throw new Error('Wallet not available. Please connect your wallet.')
        const feeTxHash = await walletClient.sendTransaction({ to: feeWallet, value: parseEther('0.00007'), chainId })
        try {
          const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
          await Promise.race([
            waitForTransactionReceipt(config, { hash: feeTxHash, chainId, confirmations: 1, pollingInterval: isOnInkChain ? 1000 : 4000 }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Fee confirmation timeout')), 60000)),
          ])
        } catch (e) { console.warn('⚠️ Fee confirmation timeout (proceeding):', e.message) }
        const initCodeWithSuffix = `${initCode}${DATA_SUFFIX.startsWith('0x') ? DATA_SUFFIX.slice(2) : DATA_SUFFIX}`
        deployTxHash = await walletClient.sendTransaction({ data: initCodeWithSuffix, gas: 2000000n })
        try {
          const isOnInkChain = chainId === NETWORKS.INKCHAIN.chainId
          const deployReceipt = await Promise.race([
            waitForTransactionReceipt(config, { hash: deployTxHash, chainId, confirmations: 1, pollingInterval: isOnInkChain ? 1000 : 4000 }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Deploy confirmation timeout')), 60000)),
          ])
          contractAddress = deployReceipt?.contractAddress ?? null
        } catch (e) { console.warn('⚠️ Deploy confirmation timeout:', e.message) }
      }

      try {
        await addXP(address, 850, 'ERC721 Deployment', chainId)
        await recordTransaction({
          wallet_address: address,
          transaction_type: 'ERC721_DEPLOY',
          transaction_hash: deployTxHash,
          contract_address: contractAddress,
          amount: deployerAddress ? DEPLOYER_FEE_ETH : '0.00007',
          currency: 'ETH',
          status: 'success',
          game_type: 'ERC721 Deployment',
          metadata: { name, symbol, imageUrl: imageUrl || null, metadataUrl },
        })
      } catch (e) { console.error('❌ XP/record failed:', e) }
      try { await updateQuestProgress('erc721Deployed', 1) } catch (questError) { console.error('❌ Quest update failed:', questError) }

      return {
        contractAddress,
        imageUrl: imageUrl || null,
        metadataUrl,
        deployTxHash,
      }
    } catch (err) {
      console.error('❌ ERC721 deployment failed:', err)
      setError(err.message || 'Failed to deploy ERC721 contract')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return { deployERC721, isLoading, error }
}
