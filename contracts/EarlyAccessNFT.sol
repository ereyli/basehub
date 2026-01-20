// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract EarlyAccessNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    uint256 public constant MAX_SUPPLY = 5000;
    uint256 public constant MINT_PRICE = 0.001 ether;

    // SAME metadata for all tokens
    string private _contractURI;

    uint256 public totalMinted;
    uint256 public uniqueMinters;
    mapping(address => bool) public hasMinted;
    mapping(address => uint256) public mintCount;

    bool public mintingEnabled = true;

    event NFTMinted(address indexed to, uint256 indexed tokenId);
    event ContractURIUpdated(string newURI);

    constructor(string memory contractURI_)
        ERC721("BaseHub Early Access Pass", "BHUB-PASS")
        Ownable(msg.sender)
    {
        _contractURI = contractURI_;
    }

    function setContractURI(string memory newURI) public onlyOwner {
        _contractURI = newURI;
        emit ContractURIUpdated(newURI);
    }

    function setMintingEnabled(bool enabled) public onlyOwner {
        mintingEnabled = enabled;
    }

    function mint() public payable {
        require(mintingEnabled, "Minting disabled");
        require(totalMinted < MAX_SUPPLY, "Max supply reached");
        require(msg.value >= MINT_PRICE, "Insufficient payment");

        if (!hasMinted[msg.sender]) {
            uniqueMinters++;
            hasMinted[msg.sender] = true;
        }

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        totalMinted++;
        mintCount[msg.sender]++;

        _safeMint(msg.sender, tokenId);

        (bool sent, ) = payable(owner()).call{value: msg.value}("");
        require(sent, "Payment failed");

        emit NFTMinted(msg.sender, tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        require(_ownerOf(tokenId) != address(0), "URI query for nonexistent token");
        return _contractURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool sent, ) = payable(owner()).call{value: balance}("");
            require(sent, "Withdraw failed");
        }
    }
}
