// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * NFTLaunchCollection – NFT Launchpad public-mint collection.
 *
 * Creator deploys via NFTCollectionDeployer (platform fee).
 * Anyone can mint by paying mintPrice per NFT; ETH goes to fundsRecipient (creator).
 * Owner = fundsRecipient (creator), so they can setContractURI, toggleSale, setMintPrice (e.g. on OpenSea).
 */
contract NFTLaunchCollection is ERC721, ERC721URIStorage, Ownable {
    uint256 public constant MAX_MINT_PER_WALLET = 20;
    uint256 private _nextTokenId;
    uint256 public maxSupply;
    uint256 public mintPrice;
    address payable public fundsRecipient;
    string private _baseTokenURI;
    string private _contractURI;
    bool public saleActive;
    mapping(address => uint256) public mintedPerWallet;

    event Minted(address indexed minter, uint256 quantity, uint256 startTokenId);
    event SaleToggled(bool active);
    event MintPriceUpdated(uint256 newPrice);
    event ContractURIUpdated(string newContractURI);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        address payable fundsRecipient_,
        string memory baseTokenURI_,
        string memory contractURI_
    ) ERC721(name_, symbol_) Ownable(fundsRecipient_) {
        maxSupply = maxSupply_;
        mintPrice = mintPrice_;
        fundsRecipient = fundsRecipient_;
        _baseTokenURI = baseTokenURI_;
        _contractURI = contractURI_;
        saleActive = true;
        _nextTokenId = 0;
        emit ContractURIUpdated(contractURI_);
    }

    /// @notice Public mint – anyone can call. ETH goes to fundsRecipient.
    function mint(uint256 quantity) external payable {
        require(saleActive, "Sale not active");
        require(quantity > 0 && quantity <= 20, "1-20 per tx");
        require(
            mintedPerWallet[msg.sender] + quantity <= MAX_MINT_PER_WALLET,
            "Wallet mint limit exceeded"
        );
        require(_nextTokenId + quantity <= maxSupply, "Exceeds max supply");
        require(msg.value >= mintPrice * quantity, "Insufficient payment");

        uint256 startId = _nextTokenId;
        _nextTokenId += quantity;
        mintedPerWallet[msg.sender] += quantity;

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = startId + i;
            _safeMint(msg.sender, tokenId);
            _setTokenURI(tokenId, _baseTokenURI);
        }

        // Send ETH to creator
        (bool ok, ) = fundsRecipient.call{value: msg.value}("");
        require(ok, "Payment transfer failed");

        emit Minted(msg.sender, quantity, startId);
    }

    // --- Owner functions ---

    function toggleSale() external onlyOwner {
        saleActive = !saleActive;
        emit SaleToggled(saleActive);
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
        emit MintPriceUpdated(newPrice);
    }

    function setContractURI(string calldata newURI) external onlyOwner {
        _contractURI = newURI;
        emit ContractURIUpdated(newURI);
    }

    // --- View functions ---

    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    function totalSupply() public view returns (uint256) {
        return _nextTokenId;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
