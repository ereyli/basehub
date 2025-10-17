// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract AIArtCollection is ERC721, ERC2981, Ownable {
    using Strings for uint256;

    uint256 public nextId = 1;
    string private _contractURI;
    mapping(uint256 => string) private _tokenURIs;

    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event BatchMinted(address indexed to, uint256[] tokenIds, string tokenURI);
    event ContractURISet(string contractURI);

    constructor(string memory name_, string memory symbol_)
        ERC721(name_, symbol_)
        Ownable(msg.sender) // ✅ owner = deployer
    {
        _setDefaultRoyalty(msg.sender, 500);
    }

    // ---------- Fee tiers ----------
    function previewFee(uint256 quantity) public pure returns (uint256) {
        require(quantity > 0 && quantity <= 10_000, "qty out of range");
        if (quantity <= 1_000) return 0.001 ether;
        if (quantity <= 2_000) return 0.002 ether;
        if (quantity <= 4_000) return 0.004 ether;
        if (quantity <= 8_000) return 0.008 ether;
        return 0.01 ether;
    }

    // ---------- Collection metadata ----------
    function setContractURI(string memory contractURI_) external onlyOwner {
        _contractURI = contractURI_;
        emit ContractURISet(contractURI_);
    }

    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    // ---------- Mint single ----------
    function mintWithTokenURI(address to, string memory tokenURI_)
        public
        payable
        returns (uint256)
    {
        uint256 requiredFee = previewFee(1);
        require(msg.value >= requiredFee, "insufficient fee");

        uint256 tokenId = nextId++;
        
        // ✅ CRITICAL: Set tokenURI BEFORE _safeMint
        // _safeMint calls onERC721Received which may call tokenURI()
        _tokenURIs[tokenId] = tokenURI_;
        _safeMint(to, tokenId);
        
        emit Minted(to, tokenId, tokenURI_);

        // Transfer fee to owner after successful mint
        (bool sent, ) = payable(owner()).call{value: msg.value}("");
        require(sent, "fee transfer failed");
        return tokenId;
    }

    // ---------- Batch mint ----------
    function mintBatch(
        address to,
        string memory tokenURI_,
        uint256 quantity
    ) public payable returns (uint256[] memory) {
        require(quantity > 0 && quantity <= 10_000, "qty out of range");
        uint256 requiredFee = previewFee(quantity);
        require(msg.value >= requiredFee, "insufficient fee");

        uint256[] memory tokenIds = new uint256[](quantity);
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = nextId++;
            
            // ✅ CRITICAL: Set tokenURI BEFORE _safeMint
            _tokenURIs[tokenId] = tokenURI_;
            _safeMint(to, tokenId);
            
            tokenIds[i] = tokenId;
        }

        emit BatchMinted(to, tokenIds, tokenURI_);

        // Transfer fee to owner after all successful mints
        (bool sent, ) = payable(owner()).call{value: msg.value}("");
        require(sent, "fee transfer failed");
        return tokenIds;
    }

    // ---------- Views ----------
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        _requireOwned(tokenId);
        string memory u = _tokenURIs[tokenId];
        require(bytes(u).length > 0, "tokenURI not set");
        return u;
    }

    function totalSupply() public view returns (uint256) {
        return nextId - 1;
    }

    // ---------- Admin ----------
    function setDefaultRoyalty(address receiver, uint96 feeNumerator)
        external
        onlyOwner
    {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "no balance");
        (bool sent, ) = payable(owner()).call{value: balance}("");
        require(sent, "withdraw failed");
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
